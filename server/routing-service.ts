import { 
  type Lead, 
  type TeamMember, 
  type CrmDeal, 
  type LeadAssignment,
  type RoutingCounter,
  type InsertTeamMember,
  type InsertCrmDeal,
  type InsertLeadAssignment,
  teamMembers,
  crmDeals,
  leadAssignments,
  routingCounters,
  insertTeamMemberSchema,
  insertCrmDealSchema,
  insertLeadAssignmentSchema
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, isNull } from "drizzle-orm";
import { notificationService } from "./notification-service";

export interface RoutingRule {
  type: 'territory' | 'round_robin' | 'manual';
  criteria?: {
    states?: string[];
    sources?: string[];
    specializations?: string[];
  };
}

export interface AssignmentResult {
  success: boolean;
  assignedMember?: TeamMember;
  assignment?: LeadAssignment;
  crmDeal?: CrmDeal;
  error?: string;
  escalated?: boolean;
}

export interface RoutingService {
  // Team member management
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  getActiveTeamMembers(department?: 'insurance' | 'recruiting'): Promise<TeamMember[]>;
  updateTeamMemberAvailability(memberId: string, isActive: boolean): Promise<void>;
  
  // Lead routing and assignment
  routeAndAssignLead(lead: Lead): Promise<AssignmentResult>;
  reassignLead(leadId: string, newMemberId: string, reason: string): Promise<AssignmentResult>;
  escalateLead(assignmentId: string, escalationLevel: number): Promise<AssignmentResult>;
  
  // CRM deal management
  createCrmDeal(lead: Lead, assignedMember: TeamMember): Promise<CrmDeal>;
  updateDealStage(dealId: string, newStage: string, notes?: string): Promise<void>;
  
  // Round-robin implementation
  getNextRoundRobinMember(department: 'insurance' | 'recruiting'): Promise<TeamMember | null>;
  updateRoundRobinCounter(department: 'insurance' | 'recruiting', memberId: string): Promise<void>;
}

export class FortuneFirstRoutingService implements RoutingService {
  // Team member management
  async createTeamMember(insertMember: InsertTeamMember): Promise<TeamMember> {
    const [member] = await db
      .insert(teamMembers)
      .values(insertMember)
      .returning();
    
    console.log(`✅ Created team member: ${member.name} (${member.role} - ${member.department})`);
    return member;
  }

  async getActiveTeamMembers(department?: 'insurance' | 'recruiting'): Promise<TeamMember[]> {
    return await db
      .select()
      .from(teamMembers)
      .where(
        department 
          ? and(eq(teamMembers.isActive, 1), eq(teamMembers.department, department))
          : eq(teamMembers.isActive, 1)
      );
  }

  async updateTeamMemberAvailability(memberId: string, isActive: boolean): Promise<void> {
    await db
      .update(teamMembers)
      .set({ isActive: isActive ? 1 : 0 })
      .where(eq(teamMembers.id, memberId));
    
    console.log(`📝 Updated team member ${memberId} availability: ${isActive ? 'active' : 'inactive'}`);
  }

  // Lead routing and assignment - The core routing logic
  async routeAndAssignLead(lead: Lead): Promise<AssignmentResult> {
    try {
      console.log(`
🎯 ROUTING LEAD: ${lead.name}
Department: ${lead.source === 'recruiting' ? 'recruiting' : 'insurance'}
Score: ${lead.leadScore}
Source: ${lead.source}
      `);

      const department = lead.source === 'recruiting' ? 'recruiting' : 'insurance';
      
      // Determine routing strategy
      let assignedMember: TeamMember | null = null;
      let assignmentReason: 'territory' | 'round_robin' | 'manual' | 'escalation' = 'round_robin';

      // 1. Try territory-based routing first (for insurance)
      if (department === 'insurance') {
        assignedMember = await this.findTerritoryMember(lead);
        if (assignedMember) {
          assignmentReason = 'territory';
        }
      }

      // 2. Fall back to round-robin if no territory match
      if (!assignedMember) {
        assignedMember = await this.getNextRoundRobinMember(department);
        assignmentReason = 'round_robin';
      }

      if (!assignedMember) {
        return {
          success: false,
          error: `No available ${department} team members for assignment`
        };
      }

      // 3. Create the lead assignment
      const assignment = await this.createLeadAssignment(lead, assignedMember, assignmentReason);
      
      // 4. Create CRM deal for hot leads (≥50 points)
      let crmDeal: CrmDeal | undefined;
      if ((lead.leadScore || 0) >= 50) {
        crmDeal = await this.createCrmDeal(lead, assignedMember);
      }

      // 5. Update round-robin counter if used
      if (assignmentReason === 'round_robin') {
        await this.updateRoundRobinCounter(department, assignedMember.id);
      }

      // 6. Update team member stats
      await this.updateTeamMemberStats(assignedMember.id);

      // 7. Send routing notifications
      await this.sendRoutingNotifications(lead, assignedMember, assignment, crmDeal);

      console.log(`✅ Lead successfully routed to ${assignedMember.name} (${assignmentReason})`);

      return {
        success: true,
        assignedMember,
        assignment,
        crmDeal
      };

    } catch (error) {
      console.error('❌ Error routing lead:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown routing error'
      };
    }
  }

  async reassignLead(leadId: string, newMemberId: string, reason: string): Promise<AssignmentResult> {
    try {
      // Get the current assignment
      const currentAssignment = await db
        .select()
        .from(leadAssignments)
        .where(eq(leadAssignments.leadId, leadId))
        .orderBy(desc(leadAssignments.createdAt))
        .limit(1);

      if (!currentAssignment.length) {
        return {
          success: false,
          error: 'No existing assignment found'
        };
      }

      // Mark current assignment as reassigned
      await db
        .update(leadAssignments)
        .set({ 
          status: 'reassigned',
          updatedAt: new Date()
        })
        .where(eq(leadAssignments.id, currentAssignment[0].id));

      // Get the new team member
      const [newMember] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, newMemberId))
        .limit(1);

      if (!newMember) {
        return {
          success: false,
          error: 'New team member not found'
        };
      }

      // Create new assignment
      const [lead] = await db.query.leads.findMany({
        where: (leads, { eq }) => eq(leads.id, leadId),
        limit: 1
      });

      if (!lead) {
        return {
          success: false,
          error: 'Lead not found'
        };
      }

      const newAssignment = await this.createLeadAssignment(
        lead, 
        newMember, 
        'manual',
        currentAssignment[0].escalationLevel
      );

      console.log(`🔄 Lead reassigned from ${currentAssignment[0].assignedToId} to ${newMember.name}`);

      return {
        success: true,
        assignedMember: newMember,
        assignment: newAssignment
      };

    } catch (error) {
      console.error('❌ Error reassigning lead:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown reassignment error'
      };
    }
  }

  async escalateLead(assignmentId: string, escalationLevel: number = 1): Promise<AssignmentResult> {
    try {
      const [assignment] = await db
        .select()
        .from(leadAssignments)
        .innerJoin(teamMembers, eq(leadAssignments.assignedToId, teamMembers.id))
        .where(eq(leadAssignments.id, assignmentId))
        .limit(1);

      if (!assignment) {
        return {
          success: false,
          error: 'Assignment not found'
        };
      }

      // Find a manager in the same department
      const [manager] = await db
        .select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.department, assignment.team_members.department),
          eq(teamMembers.role, 'manager'),
          eq(teamMembers.isActive, 1)
        ))
        .limit(1);

      if (manager) {
        // Reassign to manager
        const reassignResult = await this.reassignLead(
          assignment.lead_assignments.leadId,
          manager.id,
          'escalation'
        );

        if (reassignResult.success && reassignResult.assignment) {
          // Update escalation level
          await db
            .update(leadAssignments)
            .set({ 
              escalationLevel,
              escalatedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(leadAssignments.id, reassignResult.assignment.id));
        }

        console.log(`⬆️ Lead escalated to manager: ${manager.name} (Level ${escalationLevel})`);

        return {
          success: true,
          assignedMember: manager,
          assignment: reassignResult.assignment,
          escalated: true
        };
      } else {
        // Just mark as escalated without reassignment
        await db
          .update(leadAssignments)
          .set({ 
            escalationLevel,
            escalatedAt: new Date(),
            priority: 'urgent',
            updatedAt: new Date()
          })
          .where(eq(leadAssignments.id, assignmentId));

        console.log(`⚠️ Lead escalated but no manager available (Level ${escalationLevel})`);

        return {
          success: true,
          escalated: true
        };
      }

    } catch (error) {
      console.error('❌ Error escalating lead:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown escalation error'
      };
    }
  }

  // CRM Deal management
  async createCrmDeal(lead: Lead, assignedMember: TeamMember): Promise<CrmDeal> {
    const pipeline = lead.source === 'recruiting' ? 'recruiting' : 'insurance';
    const initialStage = this.getInitialStage(pipeline);
    
    const dealData: InsertCrmDeal = {
      leadId: lead.id,
      assignedToId: assignedMember.id,
      title: `${lead.name} - ${this.formatDealTitle(lead)}`,
      pipeline,
      stage: initialStage,
      value: this.estimateDealValue(lead),
      priority: (lead.leadScore || 0) >= 75 ? 'high' : 'medium',
      source: lead.source,
      tags: lead.tags || [],
      notes: `Initial deal created from hot lead (Score: ${lead.leadScore})`,
      nextFollowupDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    };

    const [deal] = await db
      .insert(crmDeals)
      .values(dealData)
      .returning();

    console.log(`💼 CRM Deal created: ${deal.title} - ${deal.pipeline} pipeline`);

    return deal;
  }

  async updateDealStage(dealId: string, newStage: string, notes?: string): Promise<void> {
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId))
      .limit(1);

    if (!deal) {
      throw new Error('Deal not found');
    }

    const stageHistory = deal.dealStageHistory || [];
    stageHistory.push({
      stage: newStage,
      timestamp: new Date().toISOString(),
      notes
    });

    await db
      .update(crmDeals)
      .set({
        stage: newStage,
        dealStageHistory: stageHistory,
        updatedAt: new Date(),
        ...(notes && { notes })
      })
      .where(eq(crmDeals.id, dealId));

    console.log(`📊 Deal ${dealId} moved to stage: ${newStage}`);
  }

  // Round-robin implementation
  async getNextRoundRobinMember(department: 'insurance' | 'recruiting'): Promise<TeamMember | null> {
    // Get active members for the department
    const activeMembers = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.department, department),
        eq(teamMembers.isActive, 1)
      ))
      .orderBy(asc(teamMembers.lastAssignedAt));

    if (!activeMembers.length) {
      return null;
    }

    // Get the routing counter for this department
    const [counter] = await db
      .select()
      .from(routingCounters)
      .where(and(
        eq(routingCounters.department, department),
        eq(routingCounters.routingType, 'round_robin')
      ))
      .limit(1);

    if (!counter) {
      // Initialize counter
      await db
        .insert(routingCounters)
        .values({
          department,
          routingType: 'round_robin',
          assignmentCount: 0,
          lastAssignedMemberId: null
        });
      
      return activeMembers[0];
    }

    // Find next member in rotation
    if (!counter.lastAssignedMemberId) {
      return activeMembers[0];
    }

    const lastIndex = activeMembers.findIndex(m => m.id === counter.lastAssignedMemberId);
    const nextIndex = (lastIndex + 1) % activeMembers.length;
    
    return activeMembers[nextIndex];
  }

  async updateRoundRobinCounter(department: 'insurance' | 'recruiting', memberId: string): Promise<void> {
    await db
      .update(routingCounters)
      .set({
        lastAssignedMemberId: memberId,
        assignmentCount: sql`${routingCounters.assignmentCount} + 1`,
        updatedAt: new Date()
      })
      .where(and(
        eq(routingCounters.department, department),
        eq(routingCounters.routingType, 'round_robin')
      ));
  }

  // Private helper methods
  private async findTerritoryMember(lead: Lead): Promise<TeamMember | null> {
    // This would need actual territory matching logic
    // For now, just return null to fall back to round-robin
    // In production, you'd extract state from lead data and match territories
    return null;
  }

  private async createLeadAssignment(
    lead: Lead, 
    member: TeamMember, 
    reason: 'territory' | 'round_robin' | 'manual' | 'escalation',
    escalationLevel: number = 0
  ): Promise<LeadAssignment> {
    const assignmentData: InsertLeadAssignment = {
      leadId: lead.id,
      assignedToId: member.id,
      assignmentReason: reason,
      priority: (lead.leadScore || 0) >= 75 ? 'urgent' : 
                (lead.leadScore || 0) >= 50 ? 'high' : 'normal',
      responseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    const [assignment] = await db
      .insert(leadAssignments)
      .values(assignmentData)
      .returning();

    return assignment;
  }

  private async updateTeamMemberStats(memberId: string): Promise<void> {
    await db
      .update(teamMembers)
      .set({
        currentLeadCount: sql`${teamMembers.currentLeadCount} + 1`,
        lastAssignedAt: new Date()
      })
      .where(eq(teamMembers.id, memberId));
  }

  private async sendRoutingNotifications(
    lead: Lead, 
    assignedMember: TeamMember, 
    assignment: LeadAssignment,
    crmDeal?: CrmDeal
  ): Promise<void> {
    // Enhanced notification for routing assignment
    await notificationService.sendLeadAssignmentAlert(lead, assignedMember, assignment, crmDeal);
  }

  private getInitialStage(pipeline: 'insurance' | 'recruiting'): string {
    return pipeline === 'insurance' ? 'New' : 'New';
  }

  private formatDealTitle(lead: Lead): string {
    switch (lead.source) {
      case 'insurance': return 'Life Insurance Consultation';
      case 'retirement': return 'Retirement Planning';
      case 'recruiting': return 'Distributor Opportunity';
      case 'quiz': return 'Coverage Assessment';
      default: return 'Financial Services';
    }
  }

  private estimateDealValue(lead: Lead): number {
    // Estimate deal value in cents based on lead source and score
    const baseValue = {
      'insurance': 500000, // $5,000
      'retirement': 1000000, // $10,000  
      'recruiting': 2000000, // $20,000 (higher lifetime value)
      'quiz': 300000, // $3,000
    }[lead.source] || 500000;

    // Multiply by score factor
    const scoreFactor = Math.max(0.5, (lead.leadScore || 10) / 50);
    
    return Math.round(baseValue * scoreFactor);
  }

  // Public method to get team member assignments for reporting
  async getTeamMemberAssignments(memberId: string): Promise<LeadAssignment[]> {
    return await db
      .select()
      .from(leadAssignments)
      .where(eq(leadAssignments.assignedToId, memberId))
      .orderBy(desc(leadAssignments.createdAt));
  }

  // Public method to check for overdue assignments (for escalation)
  async checkOverdueAssignments(): Promise<LeadAssignment[]> {
    return await db
      .select()
      .from(leadAssignments)
      .where(and(
        eq(leadAssignments.status, 'assigned'),
        sql`${leadAssignments.responseDeadline} < NOW()`
      ))
      .orderBy(asc(leadAssignments.responseDeadline));
  }
}

export const routingService = new FortuneFirstRoutingService();