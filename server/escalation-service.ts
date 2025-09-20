import { 
  type Lead, 
  type TeamMember, 
  type LeadAssignment,
  leadAssignments,
  teamMembers,
  leads
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, lt } from "drizzle-orm";
import { routingService } from "./routing-service";
import { notificationService } from "./notification-service";

export interface EscalationRule {
  timeoutHours: number;
  escalationLevel: number;
  action: 'notify' | 'reassign' | 'escalate_to_manager';
  target?: 'assigned_member' | 'manager' | 'team_lead';
}

export interface EscalationResult {
  success: boolean;
  action: string;
  escalationLevel: number;
  reassignedTo?: TeamMember;
  notificationsSent: number;
  error?: string;
}

export interface EscalationService {
  // Core escalation monitoring
  checkForOverdueAssignments(): Promise<LeadAssignment[]>;
  processOverdueAssignments(): Promise<EscalationResult[]>;
  escalateAssignment(assignmentId: string, escalationLevel?: number): Promise<EscalationResult>;
  
  // Escalation configuration
  getEscalationRules(): EscalationRule[];
  scheduleAutomaticEscalation(assignmentId: string): Promise<void>;
  
  // Manual escalation triggers
  manualEscalation(assignmentId: string, reason: string, escalatedBy: string): Promise<EscalationResult>;
  
  // Reporting and monitoring
  getEscalationMetrics(): Promise<EscalationMetrics>;
}

export interface EscalationMetrics {
  totalOverdueAssignments: number;
  escalationsByLevel: Record<number, number>;
  avgResponseTime: number;
  memberPerformance: Array<{
    memberId: string;
    name: string;
    overdueCount: number;
    avgResponseTime: number;
  }>;
}

export class FortuneFirstEscalationService implements EscalationService {
  private escalationRules: EscalationRule[] = [
    {
      timeoutHours: 2, // Hot leads need immediate attention
      escalationLevel: 1,
      action: 'notify',
      target: 'assigned_member'
    },
    {
      timeoutHours: 8, // First escalation after 8 hours
      escalationLevel: 2,
      action: 'notify',
      target: 'manager'
    },
    {
      timeoutHours: 24, // Reassign after 24 hours
      escalationLevel: 3,
      action: 'reassign'
    },
    {
      timeoutHours: 48, // Manager intervention after 48 hours
      escalationLevel: 4,
      action: 'escalate_to_manager'
    }
  ];

  async checkForOverdueAssignments(): Promise<LeadAssignment[]> {
    console.log('🔍 Checking for overdue assignments...');
    
    const overdueAssignments = await db
      .select({
        assignment: leadAssignments,
        lead: leads,
        teamMember: teamMembers
      })
      .from(leadAssignments)
      .innerJoin(leads, eq(leadAssignments.leadId, leads.id))
      .innerJoin(teamMembers, eq(leadAssignments.assignedToId, teamMembers.id))
      .where(and(
        eq(leadAssignments.status, 'assigned'),
        lt(leadAssignments.responseDeadline, sql`NOW()`)
      ))
      .orderBy(asc(leadAssignments.responseDeadline));

    console.log(`📊 Found ${overdueAssignments.length} overdue assignments`);

    return overdueAssignments.map(row => ({
      ...row.assignment,
      // Add computed properties for easier access
      lead: row.lead,
      teamMember: row.teamMember
    })) as LeadAssignment[];
  }

  async processOverdueAssignments(): Promise<EscalationResult[]> {
    console.log('🚨 Processing overdue assignments...');
    
    const overdueAssignments = await this.checkForOverdueAssignments();
    const results: EscalationResult[] = [];

    for (const assignment of overdueAssignments) {
      try {
        const result = await this.escalateAssignment(assignment.id);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to escalate assignment ${assignment.id}:`, error);
        results.push({
          success: false,
          action: 'escalate',
          escalationLevel: assignment.escalationLevel + 1,
          notificationsSent: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`✅ Processed ${results.length} escalations:
      - Successful: ${results.filter(r => r.success).length}
      - Failed: ${results.filter(r => !r.success).length}`);

    return results;
  }

  async escalateAssignment(assignmentId: string, targetLevel?: number): Promise<EscalationResult> {
    console.log(`⬆️ Escalating assignment: ${assignmentId}`);
    
    // Get the assignment with related data
    const assignmentData = await db
      .select({
        assignment: leadAssignments,
        lead: leads,
        teamMember: teamMembers
      })
      .from(leadAssignments)
      .innerJoin(leads, eq(leadAssignments.leadId, leads.id))
      .innerJoin(teamMembers, eq(leadAssignments.assignedToId, teamMembers.id))
      .where(eq(leadAssignments.id, assignmentId))
      .limit(1);

    if (!assignmentData.length) {
      return {
        success: false,
        action: 'escalate',
        escalationLevel: 0,
        notificationsSent: 0,
        error: 'Assignment not found'
      };
    }

    const { assignment, lead, teamMember } = assignmentData[0];
    const currentLevel = assignment.escalationLevel;
    const newLevel = targetLevel ?? currentLevel + 1;
    
    // Determine escalation action based on level
    const rule = this.getEscalationRuleForLevel(newLevel);
    if (!rule) {
      return {
        success: false,
        action: 'escalate',
        escalationLevel: newLevel,
        notificationsSent: 0,
        error: 'No escalation rule found for level'
      };
    }

    console.log(`📋 Applying escalation rule: Level ${newLevel} - ${rule.action}`);

    let notificationsSent = 0;
    let reassignedTo: TeamMember | undefined;
    let actionDescription = rule.action;

    // Execute the escalation action
    switch (rule.action) {
      case 'notify':
        await this.sendEscalationNotifications(assignment, lead, teamMember, newLevel, rule);
        notificationsSent = 1;
        break;

      case 'reassign':
        const reassignResult = await this.reassignToNextAvailable(assignment, lead, teamMember);
        if (reassignResult.success) {
          reassignedTo = reassignResult.newMember;
          actionDescription = 'reassign_to_available';
          notificationsSent = 1;
        } else {
          // Fall back to manager notification if reassignment fails
          await this.notifyManager(assignment, lead, teamMember, newLevel);
          actionDescription = 'notify_manager_fallback';
          notificationsSent = 1;
        }
        break;

      case 'escalate_to_manager':
        const managerResult = await this.escalateToManager(assignment, lead, teamMember, newLevel);
        if (managerResult.success) {
          reassignedTo = managerResult.manager;
          actionDescription = 'escalate_to_manager';
          notificationsSent = 1;
        }
        break;
    }

    // Update the assignment record
    await db
      .update(leadAssignments)
      .set({
        escalationLevel: newLevel,
        escalatedAt: new Date(),
        updatedAt: new Date(),
        ...(rule.action === 'reassign' && reassignedTo && {
          assignedToId: reassignedTo.id,
          status: 'reassigned'
        })
      })
      .where(eq(leadAssignments.id, assignmentId));

    const result: EscalationResult = {
      success: true,
      action: actionDescription,
      escalationLevel: newLevel,
      reassignedTo,
      notificationsSent,
    };

    console.log(`✅ Escalation completed: ${actionDescription} (Level ${newLevel})`);
    
    return result;
  }

  async manualEscalation(assignmentId: string, reason: string, escalatedBy: string): Promise<EscalationResult> {
    console.log(`🔧 Manual escalation triggered by: ${escalatedBy}`);
    console.log(`📝 Reason: ${reason}`);

    const result = await this.escalateAssignment(assignmentId);
    
    if (result.success) {
      // Add manual escalation note
      await db
        .update(leadAssignments)
        .set({
          notes: sql`COALESCE(notes, '') || ${`\n\nMANUAL ESCALATION: ${reason}\nBy: ${escalatedBy}\nTime: ${new Date().toISOString()}`}`,
          updatedAt: new Date()
        })
        .where(eq(leadAssignments.id, assignmentId));
    }

    return result;
  }

  getEscalationRules(): EscalationRule[] {
    return this.escalationRules;
  }

  async scheduleAutomaticEscalation(assignmentId: string): Promise<void> {
    // In production, this would integrate with a job scheduler (Redis/Bull, AWS SQS, etc.)
    console.log(`📅 Scheduling automatic escalation for assignment: ${assignmentId}`);
    
    // For demo purposes, we'll use setTimeout for the first escalation check
    setTimeout(async () => {
      try {
        const assignment = await db
          .select()
          .from(leadAssignments)
          .where(eq(leadAssignments.id, assignmentId))
          .limit(1);

        if (assignment.length && assignment[0].status === 'assigned') {
          const hoursOverdue = (Date.now() - new Date(assignment[0].responseDeadline).getTime()) / (1000 * 60 * 60);
          
          if (hoursOverdue > 0) {
            console.log(`⏰ Auto-escalation triggered for ${assignmentId} (${hoursOverdue.toFixed(1)}h overdue)`);
            await this.escalateAssignment(assignmentId);
          }
        }
      } catch (error) {
        console.error(`❌ Auto-escalation failed for ${assignmentId}:`, error);
      }
    }, 2 * 60 * 60 * 1000); // Check in 2 hours

    // TODO: In production, replace with proper job scheduler
    // await this.jobQueue.add('check-escalation', {
    //   assignmentId,
    //   checkTime: new Date(Date.now() + 2 * 60 * 60 * 1000)
    // });
  }

  async getEscalationMetrics(): Promise<EscalationMetrics> {
    console.log('📊 Calculating escalation metrics...');

    // Get overdue assignments
    const overdueAssignments = await this.checkForOverdueAssignments();
    
    // Get escalation level distribution
    const escalationsByLevel: Record<number, number> = {};
    const allAssignments = await db
      .select()
      .from(leadAssignments)
      .where(sql`${leadAssignments.escalationLevel} > 0`);

    allAssignments.forEach(assignment => {
      const level = assignment.escalationLevel;
      escalationsByLevel[level] = (escalationsByLevel[level] || 0) + 1;
    });

    // Calculate member performance
    const memberPerformance = await this.calculateMemberPerformance();

    // Calculate average response time
    const avgResponseTime = await this.calculateAverageResponseTime();

    return {
      totalOverdueAssignments: overdueAssignments.length,
      escalationsByLevel,
      avgResponseTime,
      memberPerformance
    };
  }

  // Private helper methods
  private getEscalationRuleForLevel(level: number): EscalationRule | undefined {
    return this.escalationRules.find(rule => rule.escalationLevel === level) ||
           this.escalationRules[this.escalationRules.length - 1]; // Default to highest rule
  }

  private async sendEscalationNotifications(
    assignment: LeadAssignment,
    lead: Lead,
    teamMember: TeamMember,
    escalationLevel: number,
    rule: EscalationRule
  ): Promise<void> {
    if (rule.target === 'assigned_member' || escalationLevel === 1) {
      // Notify the assigned team member
      await notificationService.sendOverdueAssignmentAlert(assignment, lead, teamMember);
    }

    if (rule.target === 'manager' || escalationLevel >= 2) {
      // Notify manager
      await this.notifyManager(assignment, lead, teamMember, escalationLevel);
    }

    // Send escalation alert to management system
    await notificationService.sendEscalationAlert(lead, assignment, escalationLevel);
  }

  private async reassignToNextAvailable(
    assignment: LeadAssignment,
    lead: Lead,
    currentMember: TeamMember
  ): Promise<{ success: boolean; newMember?: TeamMember }> {
    console.log('🔄 Attempting to reassign to next available team member...');

    // Get next available team member in same department
    const availableMembers = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.department, currentMember.department),
        eq(teamMembers.isActive, 1),
        sql`${teamMembers.id} != ${currentMember.id}`, // Not the current member
        sql`${teamMembers.currentLeadCount} < ${teamMembers.maxLeadsPerDay}` // Has capacity
      ))
      .orderBy(asc(teamMembers.currentLeadCount), asc(teamMembers.lastAssignedAt));

    if (!availableMembers.length) {
      console.log('⚠️ No available team members for reassignment');
      return { success: false };
    }

    const newMember = availableMembers[0];
    
    // Use routing service to handle the reassignment
    const reassignResult = await routingService.reassignLead(
      lead.id,
      newMember.id,
      'escalation'
    );

    if (reassignResult.success) {
      console.log(`✅ Lead reassigned from ${currentMember.name} to ${newMember.name}`);
      return { success: true, newMember };
    }

    return { success: false };
  }

  private async escalateToManager(
    assignment: LeadAssignment,
    lead: Lead,
    teamMember: TeamMember,
    escalationLevel: number
  ): Promise<{ success: boolean; manager?: TeamMember }> {
    console.log('👔 Escalating to manager...');

    // Find manager in the same department
    const [manager] = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.department, teamMember.department),
        eq(teamMembers.role, 'manager'),
        eq(teamMembers.isActive, 1)
      ))
      .limit(1);

    if (!manager) {
      console.log('⚠️ No manager found for escalation');
      await this.notifyManager(assignment, lead, teamMember, escalationLevel);
      return { success: false };
    }

    // Reassign to manager
    const reassignResult = await routingService.reassignLead(
      lead.id,
      manager.id,
      'escalation'
    );

    if (reassignResult.success) {
      console.log(`👔 Lead escalated to manager: ${manager.name}`);
      return { success: true, manager };
    }

    return { success: false };
  }

  private async notifyManager(
    assignment: LeadAssignment,
    lead: Lead,
    teamMember: TeamMember,
    escalationLevel: number
  ): Promise<void> {
    // Send escalation notification
    await notificationService.sendEscalationAlert(lead, assignment, escalationLevel);
    
    console.log(`📧 Manager notification sent for escalation level ${escalationLevel}`);
  }

  private async calculateMemberPerformance(): Promise<Array<{
    memberId: string;
    name: string;
    overdueCount: number;
    avgResponseTime: number;
  }>> {
    // Get all team members with their assignment statistics
    const memberStats = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        assignments: sql<number>`COUNT(${leadAssignments.id})`.as('assignments'),
        overdueCount: sql<number>`COUNT(CASE WHEN ${leadAssignments.responseDeadline} < NOW() AND ${leadAssignments.status} = 'assigned' THEN 1 END)`.as('overdueCount'),
        avgResponseTime: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${leadAssignments.firstContactedAt} - ${leadAssignments.createdAt})) / 3600), 0)`.as('avgResponseTime')
      })
      .from(teamMembers)
      .leftJoin(leadAssignments, eq(teamMembers.id, leadAssignments.assignedToId))
      .where(eq(teamMembers.isActive, 1))
      .groupBy(teamMembers.id, teamMembers.name);

    return memberStats.map(stat => ({
      memberId: stat.id,
      name: stat.name,
      overdueCount: Number(stat.overdueCount) || 0,
      avgResponseTime: Number(stat.avgResponseTime) || 0
    }));
  }

  private async calculateAverageResponseTime(): Promise<number> {
    const result = await db
      .select({
        avgHours: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${leadAssignments.firstContactedAt} - ${leadAssignments.createdAt})) / 3600), 0)`.as('avgHours')
      })
      .from(leadAssignments)
      .where(sql`${leadAssignments.firstContactedAt} IS NOT NULL`);

    return Number(result[0]?.avgHours) || 0;
  }

  // Public method to check if an assignment needs escalation
  async checkAssignmentForEscalation(assignmentId: string): Promise<boolean> {
    const [assignment] = await db
      .select()
      .from(leadAssignments)
      .where(eq(leadAssignments.id, assignmentId))
      .limit(1);

    if (!assignment || assignment.status !== 'assigned') {
      return false;
    }

    const hoursOverdue = (Date.now() - new Date(assignment.responseDeadline).getTime()) / (1000 * 60 * 60);
    return hoursOverdue > 0;
  }

  // Public method for getting escalation status of an assignment
  async getAssignmentEscalationStatus(assignmentId: string): Promise<{
    isOverdue: boolean;
    hoursOverdue: number;
    escalationLevel: number;
    nextEscalationAction: string;
  }> {
    const [assignment] = await db
      .select()
      .from(leadAssignments)
      .where(eq(leadAssignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return {
        isOverdue: false,
        hoursOverdue: 0,
        escalationLevel: 0,
        nextEscalationAction: 'none'
      };
    }

    const hoursOverdue = Math.max(0, (Date.now() - new Date(assignment.responseDeadline).getTime()) / (1000 * 60 * 60));
    const nextRule = this.getEscalationRuleForLevel(assignment.escalationLevel + 1);

    return {
      isOverdue: hoursOverdue > 0,
      hoursOverdue,
      escalationLevel: assignment.escalationLevel,
      nextEscalationAction: nextRule?.action || 'none'
    };
  }
}

export const escalationService = new FortuneFirstEscalationService();