import { 
  type Lead, 
  type TeamMember, 
  type CrmDeal,
  type InsertCrmDeal,
  crmDeals,
  teamMembers,
  leads
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc } from "drizzle-orm";

export interface PipelineStage {
  stage: string;
  description: string;
  nextActions: string[];
}

export interface Pipeline {
  name: string;
  stages: PipelineStage[];
}

export interface CrmService {
  // Pipeline management
  getPipelines(): Record<string, Pipeline>;
  getDealsInPipeline(pipeline: 'insurance' | 'recruiting', assignedToId?: string): Promise<CrmDeal[]>;
  
  // Deal lifecycle management
  createDealFromHotLead(lead: Lead, assignedMember: TeamMember): Promise<CrmDeal>;
  moveDealToNextStage(dealId: string, notes?: string): Promise<CrmDeal>;
  updateDealStage(dealId: string, newStage: string, notes?: string): Promise<CrmDeal>;
  updateDealValue(dealId: string, newValue: number): Promise<void>;
  
  // Deal reporting and analytics
  getDealsByMember(memberId: string): Promise<CrmDeal[]>;
  getOverdueDeals(): Promise<CrmDeal[]>;
  getPipelineMetrics(pipeline: 'insurance' | 'recruiting'): Promise<PipelineMetrics>;
  
  // Deal closing
  closeDeal(dealId: string, won: boolean, finalValue?: number, notes?: string): Promise<CrmDeal>;
}

export interface PipelineMetrics {
  totalDeals: number;
  totalValue: number;
  averageDealValue: number;
  conversionRate: number;
  stageDistribution: Record<string, number>;
  avgTimeInPipeline: number;
}

export class FortuneFirstCrmService implements CrmService {
  // Define the pipeline stages
  private pipelines: Record<string, Pipeline> = {
    insurance: {
      name: 'Insurance Sales',
      stages: [
        {
          stage: 'New',
          description: 'Hot lead just assigned, initial contact needed',
          nextActions: ['Call within 2 hours', 'Send welcome email', 'Schedule consultation']
        },
        {
          stage: 'Engaged',
          description: 'Initial contact made, interest confirmed',
          nextActions: ['Needs assessment', 'Send product information', 'Build rapport']
        },
        {
          stage: 'Consultation Scheduled',
          description: 'Discovery call or meeting scheduled',
          nextActions: ['Prepare presentation', 'Research client needs', 'Send calendar reminder']
        },
        {
          stage: 'Proposal Sent',
          description: 'Customized insurance proposal delivered',
          nextActions: ['Follow up within 48h', 'Answer questions', 'Handle objections']
        },
        {
          stage: 'Closed Won',
          description: 'Client signed and policy issued',
          nextActions: ['Start onboarding sequence', 'Send welcome email', 'Schedule review']
        },
        {
          stage: 'Onboarding',
          description: 'Client onboarding sequence in progress',
          nextActions: ['Monitor email engagement', 'Track onboarding progress', 'Schedule support calls']
        },
        {
          stage: 'Active Client',
          description: 'Onboarding completed, active long-term client',
          nextActions: ['Annual review', 'Referral outreach', 'Cross-sell opportunities']
        },
        {
          stage: 'Closed Lost',
          description: 'Opportunity lost or client declined',
          nextActions: ['Document reason', 'Add to nurture list', 'Set future follow-up']
        }
      ]
    },
    recruiting: {
      name: 'Recruiting Pipeline',
      stages: [
        {
          stage: 'New',
          description: 'New recruiting prospect assigned',
          nextActions: ['Initial call within 4 hours', 'Invite to opportunity webinar', 'Send starter kit']
        },
        {
          stage: 'Opportunity Webinar',
          description: 'Attended or scheduled for business overview',
          nextActions: ['Follow up post-webinar', 'Answer questions', 'Build value']
        },
        {
          stage: '1:1 Call',
          description: 'Personal consultation scheduled or completed',
          nextActions: ['Assess fit', 'Present opportunity', 'Address concerns']
        },
        {
          stage: 'Enrolled Distributor',
          description: 'Joined the team and started training',
          nextActions: ['Start recruit onboarding', 'Send welcome package', 'Assign mentor']
        },
        {
          stage: 'Onboarding',
          description: 'New recruit onboarding and fast-start training in progress',
          nextActions: ['Monitor training progress', 'Track module completion', 'Schedule mentor calls']
        },
        {
          stage: 'Active Distributor',
          description: 'Onboarding completed, active team member',
          nextActions: ['Set monthly goals', 'Advanced training', 'Team leadership development']
        },
        {
          stage: 'Not Joined',
          description: 'Decided not to pursue opportunity',
          nextActions: ['Stay in touch', 'Add to newsletter', 'Future opportunity follow-up']
        }
      ]
    }
  };

  getPipelines(): Record<string, Pipeline> {
    return this.pipelines;
  }

  async getDealsInPipeline(pipeline: 'insurance' | 'recruiting', assignedToId?: string): Promise<CrmDeal[]> {
    const query = db
      .select()
      .from(crmDeals)
      .where(and(
        eq(crmDeals.pipeline, pipeline),
        eq(crmDeals.status, 'active')
      ))
      .orderBy(desc(crmDeals.createdAt));

    if (assignedToId) {
      query.where(and(
        eq(crmDeals.pipeline, pipeline),
        eq(crmDeals.assignedToId, assignedToId),
        eq(crmDeals.status, 'active')
      ));
    }

    return await query;
  }

  async createDealFromHotLead(lead: Lead, assignedMember: TeamMember): Promise<CrmDeal> {
    const pipeline = lead.source === 'recruiting' ? 'recruiting' : 'insurance';
    const initialStage = 'New';
    
    const dealData: InsertCrmDeal = {
      leadId: lead.id,
      assignedToId: assignedMember.id,
      title: `${lead.name} - ${this.formatDealTitle(lead)}`,
      pipeline,
      stage: initialStage,
      value: this.estimateDealValue(lead),
      priority: this.determinePriority(lead),
      source: lead.source,
      tags: [...(lead.tags || []), 'HotLead', `Score:${lead.leadScore}`],
      notes: `🔥 HOT LEAD: Auto-created from lead with score ${lead.leadScore}. Initial contact required within ${pipeline === 'recruiting' ? '4 hours' : '2 hours'}.`,
      nextFollowupDate: new Date(Date.now() + (pipeline === 'recruiting' ? 4 : 2) * 60 * 60 * 1000),
      metadata: {
        leadScore: lead.leadScore,
        leadSource: lead.source,
        interests: lead.interests,
        utmParams: {
          source: lead.utmSource,
          medium: lead.utmMedium,
          campaign: lead.utmCampaign
        }
      }
    };

    const [deal] = await db
      .insert(crmDeals)
      .values(dealData)
      .returning();

    console.log(`💼 CRM Deal created: ${deal.title} (${pipeline}) - Assigned to ${assignedMember.name}`);
    console.log(`📊 Deal value: $${(deal.value / 100).toFixed(2)} | Priority: ${deal.priority} | Next follow-up: ${deal.nextFollowupDate}`);

    return deal;
  }

  async moveDealToNextStage(dealId: string, notes?: string): Promise<CrmDeal> {
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!deal) {
      throw new Error('Deal not found');
    }

    const pipeline = this.pipelines[deal.pipeline];
    if (!pipeline) {
      throw new Error('Invalid pipeline');
    }

    const currentStageIndex = pipeline.stages.findIndex(s => s.stage === deal.stage);
    if (currentStageIndex === -1) {
      throw new Error('Current stage not found in pipeline');
    }

    // Don't move if already at the end
    if (currentStageIndex >= pipeline.stages.length - 2) { // -2 because we have both won/lost endings
      throw new Error('Deal is already at final stage');
    }

    const nextStage = pipeline.stages[currentStageIndex + 1].stage;
    
    return await this.updateDealStage(dealId, nextStage, notes);
  }

  async updateDealStage(dealId: string, newStage: string, notes?: string): Promise<CrmDeal> {
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!deal) {
      throw new Error('Deal not found');
    }

    // Validate stage exists in pipeline
    const pipeline = this.pipelines[deal.pipeline];
    const validStages = pipeline.stages.map(s => s.stage);
    if (!validStages.includes(newStage)) {
      throw new Error(`Invalid stage '${newStage}' for ${deal.pipeline} pipeline`);
    }

    // Update stage history
    const stageHistory = deal.dealStageHistory || [];
    stageHistory.push({
      stage: newStage,
      timestamp: new Date().toISOString(),
      notes: notes || `Moved to ${newStage}`
    });

    // Update next follow-up date based on stage
    const nextFollowupDate = this.getNextFollowupDate(newStage, deal.pipeline);

    const [updatedDeal] = await db
      .update(crmDeals)
      .set({
        stage: newStage,
        dealStageHistory: stageHistory,
        nextFollowupDate,
        lastContactedAt: new Date(),
        updatedAt: new Date(),
        ...(notes && { notes: `${deal.notes || ''}\n\n${new Date().toISOString()}: ${notes}`.trim() })
      })
      .where(eq(crmDeals.id, dealId))
      .returning();

    console.log(`📈 Deal ${dealId} moved to: ${newStage}`);
    if (notes) console.log(`📝 Notes added: ${notes}`);

    // Check if this stage triggers onboarding
    await this.checkOnboardingTriggers(updatedDeal, newStage);

    return updatedDeal;
  }

  async updateDealValue(dealId: string, newValue: number): Promise<void> {
    await db
      .update(crmDeals)
      .set({
        value: newValue,
        updatedAt: new Date()
      })
      .where(eq(crmDeals.id, dealId));

    console.log(`💰 Deal ${dealId} value updated to: $${(newValue / 100).toFixed(2)}`);
  }

  async getDealsByMember(memberId: string): Promise<CrmDeal[]> {
    return await db
      .select()
      .from(crmDeals)
      .where(and(
        eq(crmDeals.assignedToId, memberId),
        eq(crmDeals.status, 'active')
      ))
      .orderBy(desc(crmDeals.nextFollowupDate));
  }

  async getOverdueDeals(): Promise<CrmDeal[]> {
    return await db
      .select()
      .from(crmDeals)
      .where(and(
        eq(crmDeals.status, 'active'),
        sql`${crmDeals.nextFollowupDate} < NOW()`
      ))
      .orderBy(asc(crmDeals.nextFollowupDate));
  }

  async getPipelineMetrics(pipeline: 'insurance' | 'recruiting'): Promise<PipelineMetrics> {
    // Get all deals in pipeline
    const deals = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.pipeline, pipeline));

    const activeDeals = deals.filter(d => d.status === 'active');
    const closedWon = deals.filter(d => d.stage === 'Closed Won');
    const totalDeals = deals.length;
    const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

    // Stage distribution
    const stageDistribution: Record<string, number> = {};
    activeDeals.forEach(deal => {
      stageDistribution[deal.stage] = (stageDistribution[deal.stage] || 0) + 1;
    });

    return {
      totalDeals,
      totalValue,
      averageDealValue: totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0,
      conversionRate: totalDeals > 0 ? (closedWon.length / totalDeals) * 100 : 0,
      stageDistribution,
      avgTimeInPipeline: this.calculateAverageTimeInPipeline(deals)
    };
  }

  async closeDeal(dealId: string, won: boolean, finalValue?: number, notes?: string): Promise<CrmDeal> {
    const newStage = won ? 'Closed Won' : 'Closed Lost';
    const newStatus = won ? 'won' : 'lost';

    const updates: any = {
      stage: newStage,
      status: newStatus,
      updatedAt: new Date(),
      lastContactedAt: new Date()
    };

    if (finalValue !== undefined) {
      updates.value = finalValue;
    }

    if (notes) {
      const [deal] = await db
        .select()
        .from(crmDeals)
        .where(eq(crmDeals.id, dealId))
        .limit(1);
      
      if (deal) {
        updates.notes = `${deal.notes || ''}\n\n${new Date().toISOString()}: DEAL ${won ? 'WON' : 'LOST'} - ${notes}`.trim();
      }
    }

    // Update stage history
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (deal) {
      const stageHistory = deal.dealStageHistory || [];
      stageHistory.push({
        stage: newStage,
        timestamp: new Date().toISOString(),
        notes: `Deal ${won ? 'won' : 'lost'}${finalValue ? ` - Final value: $${(finalValue / 100).toFixed(2)}` : ''}${notes ? ` - ${notes}` : ''}`
      });
      updates.dealStageHistory = stageHistory;
    }

    const [updatedDeal] = await db
      .update(crmDeals)
      .set(updates)
      .where(eq(crmDeals.id, dealId))
      .returning();

    console.log(`🎯 Deal ${dealId} CLOSED: ${won ? 'WON' : 'LOST'}${finalValue ? ` - $${(finalValue / 100).toFixed(2)}` : ''}`);

    return updatedDeal;
  }

  // Private helper methods
  private formatDealTitle(lead: Lead): string {
    const titles = {
      'insurance': 'Life Insurance Consultation',
      'retirement': 'Retirement Planning Session',
      'recruiting': 'Distributor Opportunity Discussion', 
      'quiz': 'Coverage Assessment Follow-up',
      'newsletter': 'Financial Planning Consultation'
    };
    return titles[lead.source as keyof typeof titles] || 'Financial Services Consultation';
  }

  private estimateDealValue(lead: Lead): number {
    // Base values in cents for different lead types
    const baseValues = {
      'insurance': 500000, // $5,000 average policy
      'retirement': 1000000, // $10,000 planning fee
      'recruiting': 2000000, // $20,000 lifetime value
      'quiz': 300000, // $3,000 assessment follow-up
      'newsletter': 250000 // $2,500 general consultation
    };

    const baseValue = baseValues[lead.source as keyof typeof baseValues] || 500000;
    
    // Apply lead score multiplier (0.5x to 2x based on score)
    const scoreMultiplier = Math.max(0.5, Math.min(2.0, (lead.leadScore || 25) / 50));
    
    // Apply source-specific bonuses
    let sourceBonus = 1.0;
    if (lead.phone) sourceBonus += 0.2; // Phone provided = higher intent
    if ((lead.interests?.length || 0) > 2) sourceBonus += 0.1; // Multiple interests
    
    return Math.round(baseValue * scoreMultiplier * sourceBonus);
  }

  private determinePriority(lead: Lead): 'low' | 'medium' | 'high' {
    const score = lead.leadScore || 0;
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  private getNextFollowupDate(stage: string, pipeline: string): Date {
    // Define follow-up intervals for different stages (in hours)
    const followupIntervals: Record<string, Record<string, number>> = {
      insurance: {
        'New': 2, // 2 hours for hot leads
        'Engaged': 24, // 1 day
        'Consultation Scheduled': 0, // Scheduled event
        'Proposal Sent': 48, // 2 days
        'Closed Won': 0, // Immediate onboarding trigger
        'Onboarding': 24, // 1 day check-in during onboarding
        'Active Client': 168, // 1 week for first review
        'Closed Lost': 2160 // 90 days (re-engagement)
      },
      recruiting: {
        'New': 4, // 4 hours for recruiting leads
        'Opportunity Webinar': 24, // 1 day after webinar
        '1:1 Call': 0, // Scheduled event
        'Enrolled Distributor': 0, // Immediate onboarding trigger
        'Onboarding': 24, // 1 day check-in during onboarding
        'Active Distributor': 168, // 1 week for first team check-in
        'Not Joined': 720 // 30 days (future opportunity)
      }
    };

    const hours = followupIntervals[pipeline]?.[stage] || 48;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private calculateAverageTimeInPipeline(deals: CrmDeal[]): number {
    const closedDeals = deals.filter(d => d.status === 'won' || d.status === 'lost');
    
    if (closedDeals.length === 0) return 0;

    const totalDays = closedDeals.reduce((sum, deal) => {
      const created = new Date(deal.createdAt);
      const updated = new Date(deal.updatedAt);
      const daysDiff = Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return sum + daysDiff;
    }, 0);

    return Math.round(totalDays / closedDeals.length);
  }

  // Public method to get stage recommendations for a deal
  async getStageRecommendations(dealId: string): Promise<string[]> {
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!deal) return [];

    const pipeline = this.pipelines[deal.pipeline];
    const currentStageData = pipeline.stages.find(s => s.stage === deal.stage);
    
    return currentStageData?.nextActions || [];
  }

  // Onboarding trigger logic
  private async checkOnboardingTriggers(deal: CrmDeal, newStage: string): Promise<void> {
    const triggerStages = ['Closed Won', 'Enrolled Distributor'];
    
    if (!triggerStages.includes(newStage)) {
      return; // Not a trigger stage
    }

    try {
      // Get lead information
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, deal.leadId))
        .limit(1);

      if (!lead) {
        console.error(`❌ Lead not found for deal ${deal.id}`);
        return;
      }

      // Get assigned team member
      const [assignedMember] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, deal.assignedToId))
        .limit(1);

      if (!assignedMember) {
        console.error(`❌ Assigned team member not found for deal ${deal.id}`);
        return;
      }

      // Import onboarding service dynamically to avoid circular imports
      const { onboardingService } = await import('./onboarding-service');
      
      // Start onboarding sequence
      await onboardingService.startOnboarding(deal, lead, assignedMember);
      
      console.log(`🎯 Onboarding sequence triggered for deal ${deal.id} (${newStage})`);
    } catch (error) {
      console.error(`❌ Failed to trigger onboarding for deal ${deal.id}:`, error);
    }
  }

  // Public method to manually trigger onboarding (for testing/admin use)
  async triggerOnboarding(dealId: string): Promise<void> {
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!deal) {
      throw new Error('Deal not found');
    }

    await this.checkOnboardingTriggers(deal, deal.stage);
  }

  // Public method to get deals requiring follow-up today
  async getTodaysFollowups(memberId?: string): Promise<CrmDeal[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const query = db
      .select()
      .from(crmDeals)
      .where(and(
        eq(crmDeals.status, 'active'),
        sql`${crmDeals.nextFollowupDate} >= ${startOfDay}`,
        sql`${crmDeals.nextFollowupDate} < ${endOfDay}`
      ))
      .orderBy(asc(crmDeals.nextFollowupDate));

    if (memberId) {
      query.where(and(
        eq(crmDeals.status, 'active'),
        eq(crmDeals.assignedToId, memberId),
        sql`${crmDeals.nextFollowupDate} >= ${startOfDay}`,
        sql`${crmDeals.nextFollowupDate} < ${endOfDay}`
      ));
    }

    return await query;
  }
}

export const crmService = new FortuneFirstCrmService();