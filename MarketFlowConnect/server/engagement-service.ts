import { Lead } from "@shared/schema";
import { emailService } from "./email-service";
import { smsService } from "./sms-service";
import { notificationService } from "./notification-service";
import { nurtureService } from "./nurture-service";

export interface EngagementFlow {
  sendInstantConfirmation: boolean;
  sendSMSFollowup: boolean;
  sendInternalNotification: boolean;
  scheduleFallbackCampaign: boolean;
  startNurtureJourney: boolean;
}

export interface EngagementService {
  triggerImmediateEngagement(lead: Lead): Promise<void>;
  scheduleFallbackCampaign(lead: Lead, delayHours?: number): Promise<void>;
  handleEngagementEvent(leadId: string, eventType: string): Promise<void>;
}

export class FortuneFirstEngagementService implements EngagementService {
  
  async triggerImmediateEngagement(lead: Lead): Promise<void> {
    const flow = this.determineEngagementFlow(lead);
    
    console.log(`
🚀 TRIGGERING IMMEDIATE ENGAGEMENT FLOW
Lead: ${lead.name} (${lead.email})
Source: ${lead.source}
Score: ${lead.leadScore}
Flow: ${JSON.stringify(flow, null, 2)}
    `);

    const promises: Promise<void>[] = [];

    // 1. Send instant confirmation email (always)
    if (flow.sendInstantConfirmation) {
      promises.push(this.sendInstantConfirmation(lead));
    }

    // 2. Send SMS follow-up for high-value leads with phone numbers
    if (flow.sendSMSFollowup) {
      promises.push(this.sendSMSFollowup(lead));
    }

    // 3. Send internal notification to team
    if (flow.sendInternalNotification) {
      promises.push(this.sendInternalNotification(lead));
    }

    // Execute all engagement actions in parallel
    await Promise.all(promises);

    // 4. Start nurture journey (async, doesn't block)
    if (flow.startNurtureJourney) {
      nurtureService.startNurtureJourney(lead).catch(error => {
        console.error('Error starting nurture journey:', error);
      });
    }

    // 5. Schedule fallback campaign (async, doesn't block) - only for non-nurture leads
    if (flow.scheduleFallbackCampaign) {
      this.scheduleFallbackCampaign(lead, 24).catch(error => {
        console.error('Error scheduling fallback campaign:', error);
      });
    }

    console.log(`✅ Immediate engagement flow completed for ${lead.email}`);
  }

  async scheduleFallbackCampaign(lead: Lead, delayHours: number = 24): Promise<void> {
    // In production, this would integrate with a job queue (Redis/Bull, AWS SQS, etc.)
    console.log(`
📅 SCHEDULING FALLBACK CAMPAIGN
Lead: ${lead.name} (${lead.email})
Delay: ${delayHours} hours
Scheduled for: ${new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString()}
    `);

    // TODO: Integrate with job scheduler
    // await this.jobQueue.add('fallback-campaign', {
    //   leadId: lead.id,
    //   scheduledFor: new Date(Date.now() + delayHours * 60 * 60 * 1000)
    // });

    // For demo purposes, simulate the fallback with a timeout
    setTimeout(async () => {
      try {
        await this.executeFallbackCampaign(lead);
      } catch (error) {
        console.error('Error executing fallback campaign:', error);
      }
    }, delayHours * 60 * 60 * 1000); // Convert hours to milliseconds
  }

  async handleEngagementEvent(leadId: string, eventType: string): Promise<void> {
    // This would be called by webhooks or tracking pixels
    console.log(`
📊 ENGAGEMENT EVENT TRACKED
Lead ID: ${leadId}
Event: ${eventType}
Timestamp: ${new Date().toISOString()}
    `);

    // Delegate to nurture service for comprehensive engagement tracking
    try {
      await nurtureService.trackEngagementEvent(leadId, eventType);
      console.log(`✅ Engagement event processed by nurture service`);
    } catch (error) {
      console.error(`❌ Failed to process engagement event:`, error);
    }
  }

  private determineEngagementFlow(lead: Lead): EngagementFlow {
    const isHighValue = smsService.isHighValueLead(lead);
    const isHotLead = (lead.leadScore || 0) >= 50;
    const isNurtureCandidate = this.isNurtureCandidate(lead);
    
    return {
      sendInstantConfirmation: true, // Always send confirmation
      sendSMSFollowup: isHighValue, // Only for high-value leads with phones
      sendInternalNotification: true, // Always notify team
      startNurtureJourney: isNurtureCandidate, // Start nurture for qualified leads
      scheduleFallbackCampaign: !isHotLead && !isNurtureCandidate // Skip fallback for hot leads and nurture candidates
    };
  }

  private isNurtureCandidate(lead: Lead): boolean {
    // Start nurture journey for leads from specific sources
    const nurtureEligibleSources = ['insurance', 'retirement', 'recruiting', 'quiz'];
    
    // Only start nurture if lead isn't already hot (immediate follow-up takes priority)
    const isHotLead = (lead.leadScore || 0) >= 50;
    
    return nurtureEligibleSources.includes(lead.source) && !isHotLead;
  }

  private async sendInstantConfirmation(lead: Lead): Promise<void> {
    try {
      await emailService.sendInstantConfirmation(lead);
      console.log(`✅ Instant confirmation email sent to ${lead.email}`);
    } catch (error) {
      console.error(`❌ Failed to send confirmation email to ${lead.email}:`, error);
      throw error;
    }
  }

  private async sendSMSFollowup(lead: Lead): Promise<void> {
    try {
      await smsService.sendHighValueLeadFollowup(lead);
      console.log(`✅ SMS follow-up sent to ${lead.phone}`);
    } catch (error) {
      console.error(`❌ Failed to send SMS to ${lead.phone}:`, error);
      throw error;
    }
  }

  private async sendInternalNotification(lead: Lead): Promise<void> {
    try {
      const isHotLead = (lead.leadScore || 0) >= 50;
      
      if (isHotLead) {
        await notificationService.sendHotLeadAlert(lead);
        console.log(`🔥 Hot lead alert sent for ${lead.email}`);
      } else {
        await notificationService.sendNewLeadAlert(lead);
        console.log(`🚨 New lead alert sent for ${lead.email}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send internal notification for ${lead.email}:`, error);
      throw error;
    }
  }

  private async executeFallbackCampaign(lead: Lead): Promise<void> {
    console.log(`
🔄 EXECUTING FALLBACK CAMPAIGN
Lead: ${lead.name} (${lead.email})
Reason: 24h non-opener follow-up
    `);

    try {
      await emailService.sendFallbackCampaign(lead);
      console.log(`✅ Fallback campaign email sent to ${lead.email}`);
      
      // TODO: Update lead tags to track fallback campaign
      // await this.updateLeadTags(lead.id, ['Campaign:FallbackSent']);
      
    } catch (error) {
      console.error(`❌ Failed to send fallback campaign to ${lead.email}:`, error);
    }
  }

  // Helper method for testing the complete flow
  async testEngagementFlow(lead: Lead): Promise<void> {
    console.log(`
🧪 TESTING COMPLETE ENGAGEMENT FLOW
Lead: ${lead.name} (${lead.email})
Source: ${lead.source}
Score: ${lead.leadScore}
Phone: ${lead.phone || 'N/A'}
==========================================
    `);

    await this.triggerImmediateEngagement(lead);

    console.log(`
==========================================
✅ TEST COMPLETED for ${lead.email}
Check logs above for detailed execution trace
    `);
  }
}

export const engagementService = new FortuneFirstEngagementService();