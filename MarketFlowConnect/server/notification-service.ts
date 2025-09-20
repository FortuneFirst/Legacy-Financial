import { Lead, TeamMember, CrmDeal, LeadAssignment } from "@shared/schema";

export interface InternalNotification {
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  recipient?: string; // Specific recipient email
}

export interface NotificationService {
  sendNewLeadAlert(lead: Lead): Promise<void>;
  sendHotLeadAlert(lead: Lead): Promise<void>;
  sendLeadAssignmentAlert(lead: Lead, assignedMember: TeamMember, assignment: LeadAssignment, crmDeal?: CrmDeal): Promise<void>;
  sendEscalationAlert(lead: Lead, assignment: LeadAssignment, escalationLevel: number): Promise<void>;
  sendOverdueAssignmentAlert(assignment: LeadAssignment, lead: Lead, assignedMember: TeamMember): Promise<void>;
  sendDealStageNotification(deal: CrmDeal, newStage: string, assignedMember: TeamMember): Promise<void>;
}

export class FortuneFirstNotificationService implements NotificationService {
  private teamEmail = process.env.TEAM_EMAIL || 'team@fortunefirst.com';
  private baseUrl = process.env.FRONTEND_URL || 'https://fortune-first.replit.app';

  async sendNewLeadAlert(lead: Lead): Promise<void> {
    const notification = this.getNewLeadNotification(lead);
    
    // Log the internal notification (in production, send actual email to team)
    console.log(`
🚨 INTERNAL TEAM ALERT
${notification.subject}

${notification.message}
    `);
    
    // TODO: Integrate with email provider for internal notifications
    // await this.emailProvider.send({
    //   to: this.teamEmail,
    //   subject: notification.subject,
    //   html: this.formatNotificationHTML(notification, lead),
    //   text: notification.message
    // });
  }

  async sendHotLeadAlert(lead: Lead): Promise<void> {
    const notification = this.getHotLeadNotification(lead);
    
    console.log(`
🔥 HOT LEAD ALERT - URGENT
${notification.subject}

${notification.message}
    `);
    
    // TODO: Send urgent notification (email + SMS to team)
    // Also consider Slack webhook integration for immediate alerts
  }

  async sendLeadAssignmentAlert(
    lead: Lead, 
    assignedMember: TeamMember, 
    assignment: LeadAssignment, 
    crmDeal?: CrmDeal
  ): Promise<void> {
    const notification = this.getLeadAssignmentNotification(lead, assignedMember, assignment, crmDeal);
    
    console.log(`
🎯 LEAD ASSIGNMENT ALERT
${notification.subject}

${notification.message}
    `);

    // Send personalized notification to assigned team member
    await this.sendPersonalizedAssignmentNotification(lead, assignedMember, assignment, crmDeal);
    
    // TODO: Send email to assigned member
    // TODO: Send SMS if member has phone and SMS notifications enabled
    // TODO: Send Slack notification if integrated
  }

  async sendEscalationAlert(lead: Lead, assignment: LeadAssignment, escalationLevel: number): Promise<void> {
    const notification = this.getEscalationNotification(lead, assignment, escalationLevel);
    
    console.log(`
⚠️ ESCALATION ALERT - LEVEL ${escalationLevel}
${notification.subject}

${notification.message}
    `);
    
    // TODO: Send to manager/escalation contact
    // TODO: Integrate with Slack for urgent escalations
  }

  async sendOverdueAssignmentAlert(
    assignment: LeadAssignment, 
    lead: Lead, 
    assignedMember: TeamMember
  ): Promise<void> {
    const notification = this.getOverdueAssignmentNotification(assignment, lead, assignedMember);
    
    console.log(`
🚨 OVERDUE ASSIGNMENT ALERT
${notification.subject}

${notification.message}
    `);
    
    // TODO: Send to team member and manager
    // TODO: Trigger escalation process
  }

  async sendDealStageNotification(
    deal: CrmDeal, 
    newStage: string, 
    assignedMember: TeamMember
  ): Promise<void> {
    const notification = this.getDealStageNotification(deal, newStage, assignedMember);
    
    console.log(`
💼 CRM DEAL UPDATE
${notification.subject}

${notification.message}
    `);
    
    // TODO: Send to assigned member and manager for important stages
  }

  private getNewLeadNotification(lead: Lead): InternalNotification {
    const firstName = lead.name.split(' ')[0];
    const lastName = lead.name.split(' ').slice(1).join(' ') || '';
    const interestType = this.getInterestDescription(lead.source);
    const urgencyLevel = this.getUrgencyLevel(lead);
    
    const subject = `🚨 New Lead Alert: ${firstName} ${lastName} from ${lead.source} with score ${lead.leadScore}`;
    
    const message = `
New Fortune First Lead Details:
────────────────────────────
👤 Name: ${lead.name}
📧 Email: ${lead.email}
📱 Phone: ${lead.phone || 'Not provided'}
🎯 Source: ${lead.source}
📊 Lead Score: ${lead.leadScore}
🔖 Interest: ${interestType}
🏷️  Tags: ${lead.tags?.join(', ') || 'None'}

UTM Parameters:
• Source: ${lead.utmSource || 'N/A'}
• Medium: ${lead.utmMedium || 'N/A'}
• Campaign: ${lead.utmCampaign || 'N/A'}

🎯 Recommended Action: ${this.getRecommendedAction(lead)}

Quick Actions:
• View in CRM: ${this.baseUrl}/admin/leads/${lead.id}
• Send follow-up: ${this.baseUrl}/admin/leads/${lead.id}/follow-up
• Update score: ${this.baseUrl}/admin/leads/${lead.id}/score

Generated at: ${new Date().toLocaleString()}
────────────────────────────
    `;

    return {
      subject,
      message,
      priority: urgencyLevel
    };
  }

  private getHotLeadNotification(lead: Lead): InternalNotification {
    const firstName = lead.name.split(' ')[0];
    const lastName = lead.name.split(' ').slice(1).join(' ') || '';
    
    const subject = `🔥 HOT LEAD ALERT: ${firstName} ${lastName} - Score ${lead.leadScore} - FOLLOW UP NOW!`;
    
    const message = `
🔥 HIGH PRIORITY LEAD - IMMEDIATE ACTION REQUIRED 🔥
────────────────────────────
👤 Name: ${lead.name}
📧 Email: ${lead.email}
📱 Phone: ${lead.phone || 'Not provided'}
📊 Lead Score: ${lead.leadScore} (HOT THRESHOLD REACHED!)
🎯 Source: ${lead.source}
🕐 Created: ${new Date().toLocaleString()}

WHY THIS IS HOT:
${this.getHotLeadReasons(lead)}

IMMEDIATE ACTION REQUIRED:
✅ Call within 2 hours for best conversion rates
✅ Send personalized follow-up email
✅ Schedule consultation ASAP

Contact Details:
• Email: ${lead.email}
• Phone: ${lead.phone || 'Email only'}

Quick CRM Link: ${this.baseUrl}/admin/leads/${lead.id}
────────────────────────────
    `;

    return {
      subject,
      message,
      priority: 'high'
    };
  }

  private getInterestDescription(source: string): string {
    switch (source) {
      case 'insurance':
        return 'Life Insurance & Protection';
      case 'retirement':
        return 'Retirement Planning & Security';
      case 'recruiting':
        return 'Business Opportunity & Recruiting';
      case 'quiz':
        return 'Insurance Coverage Assessment';
      case 'newsletter':
        return 'Financial Education & Newsletter';
      default:
        return 'General Financial Services';
    }
  }

  private getUrgencyLevel(lead: Lead): 'low' | 'medium' | 'high' {
    const score = lead.leadScore || 0;
    
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  private getRecommendedAction(lead: Lead): string {
    const score = lead.leadScore || 0;
    const hasPhone = !!lead.phone;
    
    if (score >= 50) {
      return hasPhone 
        ? '🔥 CALL IMMEDIATELY - Hot lead ready for consultation'
        : '📧 Send urgent personalized email follow-up';
    }
    
    if (score >= 20) {
      return hasPhone 
        ? '📞 Call within 24 hours while interest is warm'
        : '📧 Send targeted email sequence based on interest';
    }
    
    if (lead.source === 'recruiting') {
      return '📧 Add to recruiting nurture sequence, invite to next webinar';
    }
    
    return '📧 Add to appropriate nurture sequence, monitor engagement';
  }

  private getHotLeadReasons(lead: Lead): string {
    const reasons: string[] = [];
    const score = lead.leadScore || 0;
    
    if (score >= 50) {
      reasons.push(`• Lead score of ${score} indicates high intent`);
    }
    
    if (lead.phone) {
      reasons.push('• Provided phone number (higher conversion likelihood)');
    }
    
    if (lead.source === 'recruiting') {
      reasons.push('• Business opportunity lead (high lifetime value)');
    }
    
    if (lead.source === 'retirement') {
      reasons.push('• Retirement planning need (urgent financial decision)');
    }
    
    if (lead.interests && lead.interests.length > 2) {
      reasons.push(`• Multiple interests (${lead.interests.length}) indicate serious consideration`);
    }
    
    return reasons.length > 0 ? reasons.join('\n') : '• High lead score threshold reached';
  }

  // Enhanced notification methods for routing and assignments
  private async sendPersonalizedAssignmentNotification(
    lead: Lead,
    assignedMember: TeamMember,
    assignment: LeadAssignment,
    crmDeal?: CrmDeal
  ): Promise<void> {
    const isHotLead = (lead.leadScore || 0) >= 50;
    const urgencyText = isHotLead ? 'HOT LEAD - URGENT' : 'New Lead Assignment';
    const timeframe = lead.source === 'recruiting' ? '4 hours' : (isHotLead ? '2 hours' : '24 hours');
    
    console.log(`
📱 PERSONALIZED ASSIGNMENT NOTIFICATION
TO: ${assignedMember.name} (${assignedMember.email})
──────────────────────────────────────────────

${isHotLead ? '🔥' : '🎯'} ${urgencyText}: ${lead.name} assigned to you!

👤 Contact: ${lead.name}
📧 Email: ${lead.email}
📱 Phone: ${lead.phone || 'Not provided'}
📊 Score: ${lead.leadScore} points
🎯 Source: ${lead.source}
⏱️  Response deadline: ${timeframe}

${isHotLead ? '🚨 HIGH PRIORITY - Call within ' + timeframe + ' for best conversion!' : ''}

${crmDeal ? `💼 CRM Deal Created: ${crmDeal.title}
💰 Estimated Value: $${((crmDeal.value || 0) / 100).toFixed(2)}
📈 Pipeline: ${crmDeal.pipeline}
📅 Next Follow-up: ${crmDeal.nextFollowupDate}

` : ''}🎯 IMMEDIATE NEXT STEPS:
${this.getNextStepsForAssignment(lead, assignedMember)}

Quick Actions:
• View Assignment: ${this.baseUrl}/assignments/${assignment.id}
${crmDeal ? `• Manage Deal: ${this.baseUrl}/crm/deals/${crmDeal.id}` : ''}
• Contact Lead: ${lead.email}${lead.phone ? ` | ${lead.phone}` : ''}

Assignment Details:
• Reason: ${assignment.assignmentReason}
• Priority: ${assignment.priority}
• Deadline: ${assignment.responseDeadline}

──────────────────────────────────────────────
    `);

    // TODO: In production, send actual email/SMS to assignedMember
    if (assignedMember.notificationPreferences?.email) {
      // await this.sendEmail(assignedMember.email, subject, content);
    }
    
    if (assignedMember.notificationPreferences?.sms && assignedMember.phone && isHotLead) {
      // await this.sendSMS(assignedMember.phone, smsContent);
    }
  }

  private getLeadAssignmentNotification(
    lead: Lead,
    assignedMember: TeamMember,
    assignment: LeadAssignment,
    crmDeal?: CrmDeal
  ): InternalNotification {
    const isHotLead = (lead.leadScore || 0) >= 50;
    const subject = `${isHotLead ? '🔥 HOT' : '🎯'} Lead Assigned: ${lead.name} → ${assignedMember.name}`;
    
    const message = `
LEAD ASSIGNMENT NOTIFICATION
═══════════════════════════════════

📋 Assignment Details:
• Lead: ${lead.name} (${lead.email})
• Assigned to: ${assignedMember.name} (${assignedMember.department})
• Score: ${lead.leadScore} points
• Source: ${lead.source}
• Reason: ${assignment.assignmentReason}
• Priority: ${assignment.priority}

${crmDeal ? `💼 CRM Deal Created:
• Title: ${crmDeal.title}
• Value: $${((crmDeal.value || 0) / 100).toFixed(2)}
• Pipeline: ${crmDeal.pipeline}
• Stage: ${crmDeal.stage}

` : ''}⏰ Response Required By: ${assignment.responseDeadline}

Team Lead Contact: ${assignedMember.email}${assignedMember.phone ? ` | ${assignedMember.phone}` : ''}

Generated at: ${new Date().toLocaleString()}
    `;

    return {
      subject,
      message,
      priority: isHotLead ? 'high' : 'medium',
      recipient: assignedMember.email
    };
  }

  private getEscalationNotification(
    lead: Lead,
    assignment: LeadAssignment,
    escalationLevel: number
  ): InternalNotification {
    const subject = `⚠️ ESCALATION LEVEL ${escalationLevel}: ${lead.name} - Assignment Overdue`;
    
    const message = `
ASSIGNMENT ESCALATION ALERT
═══════════════════════════════════

🚨 LEVEL ${escalationLevel} ESCALATION 🚨

Lead Details:
• Name: ${lead.name}
• Email: ${lead.email}
• Phone: ${lead.phone || 'Not provided'}
• Score: ${lead.leadScore} points
• Source: ${lead.source}

Assignment Details:
• Assignment ID: ${assignment.id}
• Originally assigned: ${assignment.createdAt}
• Deadline was: ${assignment.responseDeadline}
• Hours overdue: ${Math.round((Date.now() - new Date(assignment.responseDeadline).getTime()) / (1000 * 60 * 60))}

ESCALATION REASON:
${escalationLevel === 1 ? 'No initial contact within deadline' : 
  escalationLevel === 2 ? 'No response after first escalation' : 
  'Multiple escalation failures - Manager intervention required'}

IMMEDIATE ACTION REQUIRED:
${escalationLevel < 3 ? 
  '• Contact assigned team member immediately\n• Review lead assignment process\n• Consider reassignment' :
  '• Manager review required\n• Process evaluation needed\n• Immediate reassignment recommended'}

Generated at: ${new Date().toLocaleString()}
    `;

    return {
      subject,
      message,
      priority: 'high'
    };
  }

  private getOverdueAssignmentNotification(
    assignment: LeadAssignment,
    lead: Lead,
    assignedMember: TeamMember
  ): InternalNotification {
    const hoursOverdue = Math.round((Date.now() - new Date(assignment.responseDeadline).getTime()) / (1000 * 60 * 60));
    const subject = `🚨 OVERDUE: ${lead.name} assignment (${hoursOverdue}h past deadline)`;
    
    const message = `
OVERDUE ASSIGNMENT ALERT
═══════════════════════════════════

⏰ ASSIGNMENT PAST DEADLINE ⏰

Lead Information:
• Name: ${lead.name}
• Email: ${lead.email}
• Phone: ${lead.phone || 'Not provided'}
• Score: ${lead.leadScore} points
• Source: ${lead.source}

Assignment Details:
• Assigned to: ${assignedMember.name}
• Department: ${assignedMember.department}
• Contact: ${assignedMember.email}
• Deadline was: ${assignment.responseDeadline}
• Hours overdue: ${hoursOverdue}

REQUIRED ACTIONS:
• Contact ${assignedMember.name} immediately
• Check lead status and progress
• Consider reassignment if no response
• Escalate to manager if needed

Escalation will automatically trigger in 2 hours if no action taken.

Generated at: ${new Date().toLocaleString()}
    `;

    return {
      subject,
      message,
      priority: 'high'
    };
  }

  private getDealStageNotification(
    deal: CrmDeal,
    newStage: string,
    assignedMember: TeamMember
  ): InternalNotification {
    const subject = `💼 Deal Update: ${deal.title} → ${newStage}`;
    
    const message = `
CRM DEAL STAGE UPDATE
═══════════════════════════════════

Deal Information:
• Title: ${deal.title}
• Pipeline: ${deal.pipeline}
• Previous Stage: ${deal.stage} → New Stage: ${newStage}
• Value: $${((deal.value || 0) / 100).toFixed(2)}
• Priority: ${deal.priority}

Assigned Team Member:
• Name: ${assignedMember.name}
• Department: ${assignedMember.department}
• Contact: ${assignedMember.email}

${deal.nextFollowupDate ? `📅 Next Follow-up: ${deal.nextFollowupDate}` : ''}

${this.getStageSpecificActions(newStage, deal.pipeline)}

Updated at: ${new Date().toLocaleString()}
    `;

    return {
      subject,
      message,
      priority: this.getDealStagePriority(newStage)
    };
  }

  private getNextStepsForAssignment(lead: Lead, assignedMember: TeamMember): string {
    const steps = [];
    const isHotLead = (lead.leadScore || 0) >= 50;
    const isRecruiting = lead.source === 'recruiting';
    
    if (isHotLead) {
      steps.push(`1. CALL IMMEDIATELY (within ${isRecruiting ? '4' : '2'} hours)`);
      steps.push('2. Send personalized follow-up email');
      if (isRecruiting) {
        steps.push('3. Invite to next opportunity webinar');
        steps.push('4. Send distributor starter kit');
      } else {
        steps.push('3. Schedule consultation appointment');
        steps.push('4. Prepare needs assessment');
      }
    } else {
      steps.push('1. Call or email within 24 hours');
      steps.push('2. Qualify interest and needs');
      if (isRecruiting) {
        steps.push('3. Assess business opportunity fit');
        steps.push('4. Schedule webinar invitation');
      } else {
        steps.push('3. Schedule discovery call');
        steps.push('4. Send relevant resources');
      }
    }
    
    return steps.join('\n');
  }

  private getStageSpecificActions(stage: string, pipeline: string): string {
    const actions: Record<string, Record<string, string>> = {
      insurance: {
        'New': 'Next: Make initial contact and assess needs',
        'Engaged': 'Next: Schedule consultation and gather requirements',
        'Consultation Scheduled': 'Next: Prepare presentation materials',
        'Proposal Sent': 'Next: Follow up within 48 hours',
        'Closed Won': 'Next: Begin onboarding process',
        'Closed Lost': 'Next: Document reason and add to nurture'
      },
      recruiting: {
        'New': 'Next: Initial contact and webinar invitation',
        'Opportunity Webinar': 'Next: Follow up and answer questions',
        '1:1 Call': 'Next: Present opportunity and assess fit',
        'Enrolled Distributor': 'Next: Complete onboarding and training',
        'Not Joined': 'Next: Add to future opportunity follow-up'
      }
    };

    return actions[pipeline]?.[stage] || 'Continue with standard follow-up process';
  }

  private getDealStagePriority(stage: string): 'low' | 'medium' | 'high' {
    const highPriorityStages = ['Proposal Sent', 'Closed Won', 'Closed Lost', '1:1 Call', 'Enrolled Distributor'];
    const mediumPriorityStages = ['Engaged', 'Consultation Scheduled', 'Opportunity Webinar'];
    
    if (highPriorityStages.includes(stage)) return 'high';
    if (mediumPriorityStages.includes(stage)) return 'medium';
    return 'low';
  }

  private formatNotificationHTML(notification: InternalNotification, lead?: Lead): string {
    const priorityColor = notification.priority === 'high' ? '#dc2626' : 
                         notification.priority === 'medium' ? '#ea580c' : '#16a34a';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px;">
        <div style="background-color: white; border-radius: 8px; padding: 24px; border-left: 4px solid ${priorityColor};">
          <h2 style="color: ${priorityColor}; margin-top: 0;">${notification.subject}</h2>
          <pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; background-color: #f3f4f6; padding: 16px; border-radius: 4px;">
${notification.message}
          </pre>
          ${lead ? `<div style="margin-top: 20px; text-align: center;">
            <a href="${this.baseUrl}/admin/leads/${lead.id}" 
               style="background-color: ${priorityColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Lead in CRM
            </a>
          </div>` : ''}
        </div>
      </div>
    `;
  }
}

export const notificationService = new FortuneFirstNotificationService();