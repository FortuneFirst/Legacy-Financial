import { Lead } from "@shared/schema";

export interface SMSTemplate {
  message: string;
}

export interface SMSService {
  sendHighValueLeadFollowup(lead: Lead): Promise<void>;
  isHighValueLead(lead: Lead): boolean;
}

export class FortuneFirstSMSService implements SMSService {
  
  async sendHighValueLeadFollowup(lead: Lead): Promise<void> {
    if (!this.isHighValueLead(lead)) {
      console.log(`Skipping SMS for ${lead.email} - not a high-value lead`);
      return;
    }

    const template = this.getSMSTemplate(lead);
    
    // Log the SMS for now (in production, integrate with SMS provider like Twilio)
    console.log(`
📱 HIGH-VALUE LEAD SMS
To: ${lead.phone}
Message: ${template.message}
    `);
    
    // TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
    // await this.smsProvider.send({
    //   to: lead.phone,
    //   body: template.message,
    //   from: process.env.TWILIO_PHONE_NUMBER
    // });
  }

  isHighValueLead(lead: Lead): boolean {
    // High-value criteria based on Fortune First requirements
    const hasPhone = !!lead.phone;
    const hasHighScore = (lead.leadScore || 0) >= 15; // Medium-high intent threshold
    const isHighIntentSource = ['recruiting', 'retirement', 'insurance'].includes(lead.source);
    
    return hasPhone && (hasHighScore || isHighIntentSource);
  }

  private getSMSTemplate(lead: Lead): SMSTemplate {
    const firstName = lead.name.split(' ')[0];
    
    switch (lead.source) {
      case 'insurance':
      case 'quiz':
        return this.getInsuranceSMSTemplate(firstName);
      case 'retirement':
        return this.getRetirementSMSTemplate(firstName);
      case 'recruiting':
        return this.getRecruitingSMSTemplate(firstName);
      default:
        return this.getGenericSMSTemplate(firstName);
    }
  }

  private getInsuranceSMSTemplate(firstName: string): SMSTemplate {
    return {
      message: `Hi ${firstName}, thanks for requesting your Life Insurance Guide! I'll send tips your way. In the meantime, reply YES if you'd like a free consultation call this week.`
    };
  }

  private getRetirementSMSTemplate(firstName: string): SMSTemplate {
    return {
      message: `Hi ${firstName}, your Retirement Security Checklist is ready! Check your email for the download link. Reply YES if you'd like to schedule a retirement review this week.`
    };
  }

  private getRecruitingSMSTemplate(firstName: string): SMSTemplate {
    return {
      message: `Welcome ${firstName}! Excited to share our Starter Kit. Check your email for details. Reply INFO if you'd like to chat about earning with us.`
    };
  }

  private getGenericSMSTemplate(firstName: string): SMSTemplate {
    return {
      message: `Hi ${firstName}, thanks for joining Fortune First! Check your email for your resources. Reply HELP if you have any questions.`
    };
  }
}

export const smsService = new FortuneFirstSMSService();