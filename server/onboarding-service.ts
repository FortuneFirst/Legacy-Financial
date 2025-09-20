import { 
  type CrmDeal, 
  type Lead, 
  type TeamMember,
  type OnboardingSequence,
  type InsertOnboardingSequence,
  onboardingSequences,
  crmDeals,
  leads
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, lt } from "drizzle-orm";
import { emailService } from "./email-service";
import { smsService } from "./sms-service";
import { crmService } from "./crm-service";

export interface OnboardingTemplate {
  day: number;
  emailId: string;
  subject: string;
  delay: number; // hours from start
}

export interface OnboardingService {
  // Main onboarding flow management
  startOnboarding(deal: CrmDeal, lead: Lead, assignedMember: TeamMember): Promise<OnboardingSequence>;
  processScheduledEmails(): Promise<void>;
  processScheduledSMSReminders(): Promise<void>;
  
  // Progress tracking
  markStepCompleted(onboardingId: string, step: string): Promise<void>;
  advanceToNextStage(onboardingId: string, nextStage: string): Promise<void>;
  completeOnboarding(onboardingId: string): Promise<void>;
  
  // Gamification & engagement
  awardBadge(onboardingId: string, badgeId: string, name: string, description: string): Promise<void>;
  scheduleUpsellOpportunity(onboardingId: string, opportunity: {name: string, description: string}): Promise<void>;
  sendFeedbackSurvey(onboardingId: string): Promise<void>;
  
  // Monitoring & analytics
  getActiveOnboardingSequences(): Promise<OnboardingSequence[]>;
  getOnboardingMetrics(): Promise<OnboardingMetrics>;
  getOverdueOnboardingTasks(): Promise<OnboardingSequence[]>;
}

export interface OnboardingMetrics {
  totalActive: number;
  completionRate: number;
  averageCompletionTime: number;
  insuranceClientStats: {
    active: number;
    completed: number;
    averageDays: number;
  };
  mlmRecruitStats: {
    active: number;
    completed: number;
    averageDays: number;
  };
  badgesAwarded: number;
  feedbackSurveyResponses: number;
}

export class FortuneFirstOnboardingService implements OnboardingService {
  // Define onboarding templates for both paths
  private insuranceClientTemplate: OnboardingTemplate[] = [
    {
      day: 0,
      emailId: 'insurance_welcome',
      subject: 'Welcome to Fortune First – Your Plan is in Motion!',
      delay: 0 // immediate
    },
    {
      day: 2,
      emailId: 'insurance_education',
      subject: 'How to Get the Most From Your New Policy',
      delay: 48 // 48 hours = 2 days
    },
    {
      day: 5,
      emailId: 'insurance_support_team',
      subject: 'Meet Your Support Team',
      delay: 120 // 120 hours = 5 days
    },
    {
      day: 7,
      emailId: 'insurance_referral',
      subject: 'Do you know someone who needs this too?',
      delay: 168 // 168 hours = 7 days
    }
  ];

  private mlmRecruitTemplate: OnboardingTemplate[] = [
    {
      day: 0,
      emailId: 'recruit_welcome',
      subject: 'Welcome to the Team – Let\'s Get Started!',
      delay: 0 // immediate
    },
    {
      day: 1,
      emailId: 'recruit_training_day1',
      subject: 'Your 7-Day Fast Start Training',
      delay: 24 // 24 hours = 1 day
    },
    {
      day: 3,
      emailId: 'recruit_toolkit',
      subject: 'Your Prospecting Toolkit',
      delay: 72 // 72 hours = 3 days
    },
    {
      day: 5,
      emailId: 'recruit_mentor',
      subject: 'Meet Your Upline Mentor',
      delay: 120 // 120 hours = 5 days
    },
    {
      day: 7,
      emailId: 'recruit_story',
      subject: 'Are You Ready to Share Your Story?',
      delay: 168 // 168 hours = 7 days
    }
  ];

  async startOnboarding(deal: CrmDeal, lead: Lead, assignedMember: TeamMember): Promise<OnboardingSequence> {
    // Determine onboarding type based on deal pipeline
    const onboardingType = deal.pipeline === 'insurance' ? 'insurance_client' : 'mlm_recruit';
    const template = onboardingType === 'insurance_client' 
      ? this.insuranceClientTemplate 
      : this.mlmRecruitTemplate;
    
    console.log(`
🎯 STARTING ONBOARDING SEQUENCE
Type: ${onboardingType}
Deal: ${deal.title}
Lead: ${lead.name} (${lead.email})
Assigned to: ${assignedMember.name}
Template: ${template.length} emails scheduled
    `);

    // Schedule all emails
    const scheduledEmails = template.map(t => ({
      emailId: t.emailId,
      scheduledFor: new Date(Date.now() + t.delay * 60 * 60 * 1000).toISOString(),
      day: t.day,
      subject: t.subject,
      sent: false
    }));

    // Create onboarding sequence record
    const onboardingData: InsertOnboardingSequence = {
      dealId: deal.id,
      leadId: lead.id,
      assignedToId: assignedMember.id,
      onboardingType: onboardingType as 'insurance_client' | 'mlm_recruit',
      currentStage: 'welcome',
      scheduledEmails,
      completedSteps: [],
      badges: [],
      smsReminders: this.scheduleSMSReminders(onboardingType, lead.phone),
      feedbackSurvey: {
        sent: false,
        completed: false
      },
      upsellOpportunities: [],
      metadata: {
        dealPipeline: deal.pipeline,
        dealValue: deal.value,
        startReason: 'deal_closed_won'
      }
    };

    const [onboardingSequence] = await db
      .insert(onboardingSequences)
      .values(onboardingData)
      .returning();

    // Update CRM deal stage to 'Onboarding'
    await crmService.updateDealStage(
      deal.id, 
      'Onboarding', 
      `Started ${onboardingType} onboarding sequence`
    );

    // Send first email immediately (Day 0)
    await this.sendOnboardingEmail(onboardingSequence, template[0]);
    await this.markEmailAsSent(onboardingSequence.id, template[0].emailId);

    // Award welcome badge
    await this.awardBadge(
      onboardingSequence.id,
      'welcome_badge',
      onboardingType === 'insurance_client' ? 'Welcome New Client' : 'Welcome Team Member',
      onboardingType === 'insurance_client' 
        ? 'Successfully completed client onboarding setup'
        : 'Successfully joined the Fortune First team'
    );

    console.log(`✅ Onboarding sequence ${onboardingSequence.id} started for ${lead.name}`);
    
    return onboardingSequence;
  }

  async processScheduledEmails(): Promise<void> {
    // Get all onboarding sequences with pending emails
    const sequences = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.status, 'active'));

    const now = new Date();
    let emailsSent = 0;

    for (const sequence of sequences) {
      if (!sequence.scheduledEmails) continue;

      const pendingEmails = sequence.scheduledEmails.filter(email => 
        !email.sent && new Date(email.scheduledFor) <= now
      );

      for (const email of pendingEmails) {
        try {
          const template = this.getEmailTemplate(sequence.onboardingType, email.emailId);
          await this.sendOnboardingEmail(sequence, template, email);
          await this.markEmailAsSent(sequence.id, email.emailId);
          
          emailsSent++;
          console.log(`📧 Sent onboarding email: ${email.subject} to sequence ${sequence.id}`);
          
          // Check if this email triggers stage advancement
          await this.checkStageAdvancement(sequence, email);
          
          // Check if this is the final email
          if (email.emailId.includes('referral') || email.emailId.includes('story')) {
            setTimeout(() => this.scheduleFeedbackSurvey(sequence.id), 7 * 24 * 60 * 60 * 1000); // 7 days later
          }
          
        } catch (error) {
          console.error(`❌ Failed to send onboarding email ${email.emailId}:`, error);
        }
      }
    }

    if (emailsSent > 0) {
      console.log(`📨 Processed ${emailsSent} scheduled onboarding emails`);
    }
  }

  async processScheduledSMSReminders(): Promise<void> {
    const sequences = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.status, 'active'));

    const now = new Date();
    let smsSent = 0;

    for (const sequence of sequences) {
      if (!sequence.smsReminders) continue;

      const pendingSMS = sequence.smsReminders.filter(sms => 
        !sms.sent && new Date(sms.scheduledFor) <= now
      );

      for (const sms of pendingSMS) {
        try {
          // Get lead info for SMS
          const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.id, sequence.leadId))
            .limit(1);

          if (lead && lead.phone) {
            await this.sendOnboardingSMS(lead, sms.message);
            await this.markSMSAsSent(sequence.id, sms.reminderId);
            smsSent++;
            console.log(`📱 Sent onboarding SMS to ${lead.name}: ${sms.message}`);
          }
        } catch (error) {
          console.error(`❌ Failed to send onboarding SMS:`, error);
        }
      }
    }

    if (smsSent > 0) {
      console.log(`📲 Processed ${smsSent} scheduled onboarding SMS reminders`);
    }
  }

  async markStepCompleted(onboardingId: string, step: string): Promise<void> {
    const [sequence] = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.id, onboardingId))
      .limit(1);

    if (!sequence) return;

    const completedSteps = [...(sequence.completedSteps || []), step];

    await db
      .update(onboardingSequences)
      .set({
        completedSteps,
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, onboardingId));

    console.log(`✅ Onboarding step completed: ${step} for sequence ${onboardingId}`);
  }

  async advanceToNextStage(onboardingId: string, nextStage: string): Promise<void> {
    await db
      .update(onboardingSequences)
      .set({
        currentStage: nextStage,
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, onboardingId));

    console.log(`📈 Onboarding sequence ${onboardingId} advanced to stage: ${nextStage}`);
  }

  async completeOnboarding(onboardingId: string): Promise<void> {
    const [sequence] = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.id, onboardingId))
      .limit(1);

    if (!sequence) return;

    // Update onboarding as complete
    await db
      .update(onboardingSequences)
      .set({
        status: 'completed',
        currentStage: 'complete',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, onboardingId));

    // Update CRM deal to final stage
    const finalStage = sequence.onboardingType === 'insurance_client' ? 'Active Client' : 'Active Distributor';
    await crmService.updateDealStage(
      sequence.dealId,
      finalStage,
      'Onboarding sequence completed successfully'
    );

    // Award completion badge
    await this.awardBadge(
      onboardingId,
      'completion_badge',
      sequence.onboardingType === 'insurance_client' ? 'Onboarded Client' : 'Active Distributor',
      'Successfully completed the full onboarding sequence'
    );

    console.log(`🎯 Onboarding sequence ${onboardingId} completed and moved to ${finalStage}`);
  }

  async awardBadge(onboardingId: string, badgeId: string, name: string, description: string): Promise<void> {
    const [sequence] = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.id, onboardingId))
      .limit(1);

    if (!sequence) return;

    const existingBadges = sequence.badges || [];
    const newBadge = {
      badgeId,
      name,
      description,
      earnedAt: new Date().toISOString()
    };

    // Don't award duplicate badges
    if (existingBadges.some(b => b.badgeId === badgeId)) return;

    const updatedBadges = [...existingBadges, newBadge];

    await db
      .update(onboardingSequences)
      .set({
        badges: updatedBadges,
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, onboardingId));

    console.log(`🏆 Badge awarded: ${name} to sequence ${onboardingId}`);
  }

  async scheduleUpsellOpportunity(onboardingId: string, opportunity: {name: string, description: string}): Promise<void> {
    const [sequence] = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.id, onboardingId))
      .limit(1);

    if (!sequence) return;

    const existingOpportunities = sequence.upsellOpportunities || [];
    const newOpportunity = {
      opportunityId: `upsell_${Date.now()}`,
      name: opportunity.name,
      description: opportunity.description,
      presentedAt: new Date().toISOString(),
      status: 'pending' as const
    };

    const updatedOpportunities = [...existingOpportunities, newOpportunity];

    await db
      .update(onboardingSequences)
      .set({
        upsellOpportunities: updatedOpportunities,
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, onboardingId));

    console.log(`💰 Upsell opportunity scheduled: ${opportunity.name} for sequence ${onboardingId}`);
  }

  async sendFeedbackSurvey(onboardingId: string): Promise<void> {
    const [sequence] = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.id, onboardingId))
      .limit(1);

    if (!sequence || sequence.feedbackSurvey?.sent) return;

    // Get lead info
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, sequence.leadId))
      .limit(1);

    if (!lead) return;

    // Send feedback survey email
    await emailService.sendOnboardingFeedbackSurvey(lead, sequence);

    // Update feedback survey status
    await db
      .update(onboardingSequences)
      .set({
        feedbackSurvey: {
          sent: true,
          sentAt: new Date().toISOString(),
          completed: false
        },
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, onboardingId));

    console.log(`📋 Feedback survey sent for sequence ${onboardingId}`);
  }

  async getActiveOnboardingSequences(): Promise<OnboardingSequence[]> {
    return await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.status, 'active'));
  }

  async getOnboardingMetrics(): Promise<OnboardingMetrics> {
    const allSequences = await db.select().from(onboardingSequences);
    const activeSequences = allSequences.filter(s => s.status === 'active');
    const completedSequences = allSequences.filter(s => s.status === 'completed');
    
    const insuranceSequences = allSequences.filter(s => s.onboardingType === 'insurance_client');
    const mlmSequences = allSequences.filter(s => s.onboardingType === 'mlm_recruit');
    
    const totalBadges = allSequences.reduce((sum, seq) => sum + (seq.badges?.length || 0), 0);
    const feedbackResponses = allSequences.filter(s => s.feedbackSurvey?.completed).length;
    
    // Calculate average completion time for completed sequences
    const completedWithTimes = completedSequences.filter(s => s.completedAt && s.startedAt);
    const avgCompletionTime = completedWithTimes.length > 0 
      ? completedWithTimes.reduce((sum, seq) => {
          const days = Math.ceil((new Date(seq.completedAt!).getTime() - new Date(seq.startedAt).getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0) / completedWithTimes.length
      : 0;

    return {
      totalActive: activeSequences.length,
      completionRate: allSequences.length > 0 ? (completedSequences.length / allSequences.length) * 100 : 0,
      averageCompletionTime: Math.round(avgCompletionTime),
      insuranceClientStats: {
        active: insuranceSequences.filter(s => s.status === 'active').length,
        completed: insuranceSequences.filter(s => s.status === 'completed').length,
        averageDays: this.calculateAverageDays(insuranceSequences.filter(s => s.status === 'completed'))
      },
      mlmRecruitStats: {
        active: mlmSequences.filter(s => s.status === 'active').length,
        completed: mlmSequences.filter(s => s.status === 'completed').length,
        averageDays: this.calculateAverageDays(mlmSequences.filter(s => s.status === 'completed'))
      },
      badgesAwarded: totalBadges,
      feedbackSurveyResponses: feedbackResponses
    };
  }

  async getOverdueOnboardingTasks(): Promise<OnboardingSequence[]> {
    // Get sequences with overdue emails or SMS
    const overdue = await db
      .select()
      .from(onboardingSequences)
      .where(and(
        eq(onboardingSequences.status, 'active'),
        sql`${onboardingSequences.updatedAt} < NOW() - INTERVAL '24 hours'`
      ));

    return overdue.filter(seq => {
      if (!seq.scheduledEmails) return false;
      return seq.scheduledEmails.some(email => 
        !email.sent && new Date(email.scheduledFor) < new Date()
      );
    });
  }

  // Private helper methods
  private scheduleSMSReminders(onboardingType: string, phone?: string | null): Array<{
    reminderId: string;
    message: string;
    scheduledFor: string;
    sent: boolean;
  }> {
    if (!phone) return [];

    const baseMessages = onboardingType === 'insurance_client' 
      ? [
          { day: 1, message: "Welcome to Fortune First! Check your email for important policy information." },
          { day: 6, message: "Don't forget to connect with your support team - they're here to help!" },
          { day: 14, message: "How's your experience so far? We'd love your feedback!" }
        ]
      : [
          { day: 1, message: "Welcome to the team! Check your email for your first training module." },
          { day: 4, message: "Your prospecting toolkit is ready - check your email!" },
          { day: 6, message: "Ready to meet your mentor? Check your email for details." },
          { day: 14, message: "You're doing great! Time for your first feedback check-in." }
        ];

    return baseMessages.map((msg, index) => ({
      reminderId: `sms_${onboardingType}_${index}`,
      message: msg.message,
      scheduledFor: new Date(Date.now() + msg.day * 24 * 60 * 60 * 1000).toISOString(),
      sent: false
    }));
  }

  private async sendOnboardingEmail(sequence: OnboardingSequence, template: OnboardingTemplate, scheduledEmail?: any): Promise<void> {
    // Get lead and member info
    const [lead] = await db.select().from(leads).where(eq(leads.id, sequence.leadId)).limit(1);
    if (!lead) throw new Error('Lead not found');

    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, sequence.dealId)).limit(1);
    if (!deal) throw new Error('Deal not found');

    // Send the email through email service
    await emailService.sendOnboardingEmail(lead, deal, sequence, template);
  }

  private async sendOnboardingSMS(lead: Lead, message: string): Promise<void> {
    if (!lead.phone) return;
    await smsService.sendOnboardingSMS(lead, message);
  }

  private getEmailTemplate(onboardingType: string, emailId: string): OnboardingTemplate {
    const templates = onboardingType === 'insurance_client' 
      ? this.insuranceClientTemplate 
      : this.mlmRecruitTemplate;
    
    const template = templates.find(t => t.emailId === emailId);
    if (!template) throw new Error(`Template not found: ${emailId}`);
    
    return template;
  }

  private async markEmailAsSent(onboardingId: string, emailId: string): Promise<void> {
    const [sequence] = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.id, onboardingId))
      .limit(1);

    if (!sequence || !sequence.scheduledEmails) return;

    const updatedEmails = sequence.scheduledEmails.map(email => 
      email.emailId === emailId 
        ? { ...email, sent: true, sentAt: new Date().toISOString() }
        : email
    );

    await db
      .update(onboardingSequences)
      .set({
        scheduledEmails: updatedEmails,
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, onboardingId));
  }

  private async markSMSAsSent(onboardingId: string, reminderId: string): Promise<void> {
    const [sequence] = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.id, onboardingId))
      .limit(1);

    if (!sequence || !sequence.smsReminders) return;

    const updatedSMS = sequence.smsReminders.map(sms => 
      sms.reminderId === reminderId 
        ? { ...sms, sent: true, sentAt: new Date().toISOString() }
        : sms
    );

    await db
      .update(onboardingSequences)
      .set({
        smsReminders: updatedSMS,
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, onboardingId));
  }

  private async checkStageAdvancement(sequence: OnboardingSequence, email: any): Promise<void> {
    let newStage = sequence.currentStage;

    // Advance stages based on email completion
    if (email.emailId.includes('welcome')) {
      newStage = 'education';
    } else if (email.emailId.includes('education') || email.emailId.includes('training')) {
      newStage = sequence.onboardingType === 'insurance_client' ? 'support' : 'training';
    } else if (email.emailId.includes('support') || email.emailId.includes('toolkit')) {
      newStage = 'referral';
    } else if (email.emailId.includes('referral') || email.emailId.includes('mentor')) {
      newStage = sequence.onboardingType === 'insurance_client' ? 'referral' : 'mentor';
    } else if (email.emailId.includes('story')) {
      newStage = 'story';
    }

    if (newStage !== sequence.currentStage) {
      await this.advanceToNextStage(sequence.id, newStage);
    }
  }

  private async scheduleFeedbackSurvey(onboardingId: string): Promise<void> {
    setTimeout(async () => {
      await this.sendFeedbackSurvey(onboardingId);
    }, 7 * 24 * 60 * 60 * 1000); // 7 days delay
  }

  private calculateAverageDays(sequences: OnboardingSequence[]): number {
    const completedWithTimes = sequences.filter(s => s.completedAt && s.startedAt);
    if (completedWithTimes.length === 0) return 0;
    
    const totalDays = completedWithTimes.reduce((sum, seq) => {
      const days = Math.ceil((new Date(seq.completedAt!).getTime() - new Date(seq.startedAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    
    return Math.round(totalDays / completedWithTimes.length);
  }
}

export const onboardingService = new FortuneFirstOnboardingService();