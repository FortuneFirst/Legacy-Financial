import { Lead } from "@shared/schema";
import { emailService } from "./email-service";
import { storage } from "./storage";
import { notificationService } from "./notification-service";

// Nurture journey stages
export type NurtureStage = "NewLead" | "Nurturing" | "Engaged" | "Hot" | "Warm" | "Cold";
export type NurtureJourneyType = "prospect" | "recruit";

export interface NurtureEmail {
  emailId: string;
  dayOffset: number;
  subject: string;
  html: string;
  text: string;
  journeyType: NurtureJourneyType;
  trackingParams?: {
    ctaLinks: string[];
    scoringEvents: { eventType: string; points: number }[];
  };
}

export interface ScheduledEmail {
  emailId: string;
  scheduledFor: string;
}

export interface EngagementEvent {
  eventType: string;
  timestamp: string;
  points: number;
}

export interface NurtureService {
  startNurtureJourney(lead: Lead): Promise<void>;
  processScheduledEmails(): Promise<void>;
  trackEngagementEvent(leadId: string, eventType: string): Promise<void>;
  updateLeadStage(leadId: string, newStage: NurtureStage): Promise<void>;
  checkForHotLeads(): Promise<Lead[]>;
}

export class FortuneFirstNurtureService implements NurtureService {
  private baseUrl = process.env.FRONTEND_URL || 'https://fortune-first.replit.app';

  // Lead scoring points system
  private scoringSystem = {
    email_open: 10,
    email_click: 20, 
    consultation_booking: 30,
    webinar_registration: 30,
    pdf_download: 15,
    page_visit: 5,
    phone_provided: 10,
    calendar_book: 50,
    webinar_attend: 40
  };

  async startNurtureJourney(lead: Lead): Promise<void> {
    console.log(`
🎯 STARTING NURTURE JOURNEY
Lead: ${lead.name} (${lead.email})
Source: ${lead.source}
Journey Type: ${this.determineJourneyType(lead)}
==========================================
    `);

    const journeyType = this.determineJourneyType(lead);
    const emails = this.getNurtureEmailSequence(journeyType);
    const scheduledEmails: ScheduledEmail[] = [];

    // Schedule all emails for this journey
    for (const email of emails) {
      const scheduledFor = new Date(Date.now() + email.dayOffset * 24 * 60 * 60 * 1000);
      scheduledEmails.push({
        emailId: email.emailId,
        scheduledFor: scheduledFor.toISOString()
      });
    }

    // Update lead with nurture journey data
    await storage.updateLeadNurtureJourney(lead.id!, {
      nurtureStage: "Nurturing",
      nurtureJourneyType: journeyType,
      nurtureStartedAt: new Date(),
      scheduledEmails: scheduledEmails,
      nurtureEmailsSent: [],
      engagementEvents: []
    });

    console.log(`✅ Nurture journey started with ${emails.length} emails scheduled for ${lead.email}`);
  }

  async processScheduledEmails(): Promise<void> {
    console.log(`
📅 PROCESSING SCHEDULED EMAILS
Current time: ${new Date().toISOString()}
==========================================
    `);

    const leadsWithScheduledEmails = await storage.getLeadsWithScheduledEmails();
    const now = new Date();

    for (const lead of leadsWithScheduledEmails) {
      if (!lead.scheduledEmails?.length) continue;

      const dueEmails = lead.scheduledEmails.filter(
        scheduled => new Date(scheduled.scheduledFor) <= now
      );

      for (const scheduledEmail of dueEmails) {
        await this.sendNurtureEmail(lead, scheduledEmail.emailId);
        
        // Remove sent email from scheduled list
        await storage.updateScheduledEmails(
          lead.id!,
          lead.scheduledEmails.filter(s => s.emailId !== scheduledEmail.emailId)
        );
      }
    }
  }

  async trackEngagementEvent(leadId: string, eventType: string): Promise<void> {
    const points = this.scoringSystem[eventType as keyof typeof this.scoringSystem] || 0;
    
    console.log(`
📊 ENGAGEMENT EVENT TRACKED
Lead ID: ${leadId}
Event: ${eventType}
Points: +${points}
Timestamp: ${new Date().toISOString()}
    `);

    // Update lead score and add engagement event
    await storage.updateLeadScore(leadId, points);
    await storage.addEngagementEvent(leadId, {
      eventType,
      timestamp: new Date().toISOString(),
      points
    });

    // Check if lead has become hot (50+ points)
    const lead = await storage.getLeadById(leadId);
    if (lead && (lead.leadScore || 0) >= 50) {
      await this.updateLeadStage(leadId, "Hot");
      await notificationService.sendHotLeadAlert(lead);
      console.log(`🔥 Lead ${lead.email} is now HOT with ${lead.leadScore} points!`);
    }
  }

  async updateLeadStage(leadId: string, newStage: NurtureStage): Promise<void> {
    await storage.updateLeadStage(leadId, newStage);
    console.log(`📈 Lead stage updated: ${leadId} → ${newStage}`);
  }

  async checkForHotLeads(): Promise<Lead[]> {
    const hotLeads = await storage.getHighValueLeads(50);
    console.log(`🔥 Found ${hotLeads.length} hot leads (50+ points)`);
    return hotLeads;
  }

  private determineJourneyType(lead: Lead): NurtureJourneyType {
    // Recruiting sources get recruit journey
    if (lead.source === 'recruiting') {
      return 'recruit';
    }
    
    // Check for recruit interest in tags
    if (lead.tags?.some(tag => tag.includes('Interest:Recruit'))) {
      return 'recruit';
    }
    
    // Default to prospect journey for insurance, retirement, quiz, newsletter
    return 'prospect';
  }

  private async sendNurtureEmail(lead: Lead, emailId: string): Promise<void> {
    const journeyType = lead.nurtureJourneyType as NurtureJourneyType || this.determineJourneyType(lead);
    const emailTemplate = this.getNurtureEmailTemplate(emailId, journeyType, lead);
    
    if (!emailTemplate) {
      console.error(`❌ Email template not found: ${emailId}`);
      return;
    }

    console.log(`
📧 SENDING NURTURE EMAIL
To: ${lead.email}
Email: ${emailId}
Subject: ${emailTemplate.subject}
Journey: ${journeyType}
    `);

    // Log the email (in production, integrate with email provider)
    console.log(`
📧 NURTURE EMAIL SENT
To: ${lead.email}
Subject: ${emailTemplate.subject}

${emailTemplate.text}
    `);

    // Update lead with sent email tracking
    await storage.addSentNurtureEmail(lead.id!, emailId);
    await storage.updateLastNurtureEmail(lead.id!, emailId);

    // Track email send event for scoring
    await this.trackEngagementEvent(lead.id!, 'email_open');
  }

  private getNurtureEmailSequence(journeyType: NurtureJourneyType): NurtureEmail[] {
    if (journeyType === 'recruit') {
      return this.getRecruitJourneyEmails();
    }
    return this.getProspectJourneyEmails();
  }

  private getProspectJourneyEmails(): NurtureEmail[] {
    return [
      {
        emailId: 'prospect_day1_wealth_building',
        dayOffset: 1,
        subject: '3 Ways Life Insurance Builds Wealth (Not Just Protection)',
        html: '', // Will be populated by template method
        text: '',
        journeyType: 'prospect'
      },
      {
        emailId: 'prospect_day3_case_study',
        dayOffset: 3,
        subject: 'How Anil protected his family and built wealth',
        html: '',
        text: '',
        journeyType: 'prospect'
      },
      {
        emailId: 'prospect_day5_objection_handling',
        dayOffset: 5,
        subject: 'Is life insurance really worth it?',
        html: '',
        text: '',
        journeyType: 'prospect'
      },
      {
        emailId: 'prospect_day7_consultation_push',
        dayOffset: 7,
        subject: 'Ready to see your personalized plan?',
        html: '',
        text: '',
        journeyType: 'prospect'
      }
    ];
  }

  private getRecruitJourneyEmails(): NurtureEmail[] {
    return [
      {
        emailId: 'recruit_day2_business_overview',
        dayOffset: 2,
        subject: "Here's how our business really works",
        html: '',
        text: '',
        journeyType: 'recruit'
      },
      {
        emailId: 'recruit_day4_success_story',
        dayOffset: 4,
        subject: 'From 9-to-5 to financial freedom',
        html: '',
        text: '',
        journeyType: 'recruit'
      },
      {
        emailId: 'recruit_day6_community_support',
        dayOffset: 6,
        subject: "You won't be doing this alone",
        html: '',
        text: '',
        journeyType: 'recruit'
      },
      {
        emailId: 'recruit_day8_urgency_push',
        dayOffset: 8,
        subject: "Seats closing for this week's info session",
        html: '',
        text: '',
        journeyType: 'recruit'
      },
      {
        emailId: 'recruit_day10_call_invite',
        dayOffset: 10,
        subject: 'Want to talk 1-on-1 about your goals?',
        html: '',
        text: '',
        journeyType: 'recruit'
      }
    ];
  }

  private getNurtureEmailTemplate(emailId: string, journeyType: NurtureJourneyType, lead: Lead): NurtureEmail | null {
    const firstName = lead.name.split(' ')[0];
    
    switch (emailId) {
      // PROSPECT JOURNEY EMAILS
      case 'prospect_day1_wealth_building':
        return this.getProspectDay1Template(firstName);
      case 'prospect_day3_case_study':
        return this.getProspectDay3Template(firstName);
      case 'prospect_day5_objection_handling':
        return this.getProspectDay5Template(firstName);
      case 'prospect_day7_consultation_push':
        return this.getProspectDay7Template(firstName);
      
      // RECRUIT JOURNEY EMAILS
      case 'recruit_day2_business_overview':
        return this.getRecruitDay2Template(firstName);
      case 'recruit_day4_success_story':
        return this.getRecruitDay4Template(firstName);
      case 'recruit_day6_community_support':
        return this.getRecruitDay6Template(firstName);
      case 'recruit_day8_urgency_push':
        return this.getRecruitDay8Template(firstName);
      case 'recruit_day10_call_invite':
        return this.getRecruitDay10Template(firstName);
      
      default:
        return null;
    }
  }

  // PROSPECT JOURNEY EMAIL TEMPLATES

  private getProspectDay1Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, here's how life insurance builds wealth</h2>
        
        <p>Most people think life insurance is just about protection. But smart families use it as a wealth-building tool too.</p>
        
        <p>Here are 3 powerful ways life insurance creates wealth:</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">1. Index Universal Life (IUL) Policies</h3>
          <p style="color: #6b7280;">Your cash value grows with market gains, but you're protected from losses. Think S&P 500 upside without the downside risk.</p>
          
          <h3 style="color: #374151;">2. Whole Life Policies</h3>
          <p style="color: #6b7280;">Guaranteed growth plus dividends from mutual insurance companies. It's like having a savings account that also protects your family.</p>
          
          <h3 style="color: #374151;">3. Tax-Free Retirement Income</h3>
          <p style="color: #6b7280;">Withdraw your contributions tax-free, then borrow against cash value for retirement income. No 401(k) limits or penalties.</p>
        </div>
        
        <p>The key is starting early and structuring it correctly. That's where proper guidance makes all the difference.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=prospect_day1" 
             style="background-color: #10b981; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;"
             data-tracking="consultation_booking">
            📅 See How This Works For Your Family
          </a>
        </div>
        
        <p>Tomorrow I'll share a real case study showing exactly how this worked for one of my clients.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Advisor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Licensed Insurance Professional</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName}, here's how life insurance builds wealth

Most people think life insurance is just about protection. But smart families use it as a wealth-building tool too.

Here are 3 powerful ways life insurance creates wealth:

1. Index Universal Life (IUL) Policies
Your cash value grows with market gains, but you're protected from losses. Think S&P 500 upside without the downside risk.

2. Whole Life Policies  
Guaranteed growth plus dividends from mutual insurance companies. It's like having a savings account that also protects your family.

3. Tax-Free Retirement Income
Withdraw your contributions tax-free, then borrow against cash value for retirement income. No 401(k) limits or penalties.

The key is starting early and structuring it correctly. That's where proper guidance makes all the difference.

See how this works for your family: ${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=prospect_day1

Tomorrow I'll share a real case study showing exactly how this worked for one of my clients.

Your Fortune First Advisor
Licensed Insurance Professional`;

    return {
      emailId: 'prospect_day1_wealth_building',
      dayOffset: 1,
      subject: '3 Ways Life Insurance Builds Wealth (Not Just Protection)',
      html,
      text,
      journeyType: 'prospect'
    };
  }

  private getProspectDay3Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, here's how Anil built wealth while protecting his family</h2>
        
        <p>I want to share a real story that shows the power of strategic life insurance planning.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Client Case Study: Anil (Software Engineer, Age 32)</h3>
          
          <p><strong>The Challenge:</strong> Anil wanted to protect his growing family but also needed a way to build wealth outside of his 401(k).</p>
          
          <p><strong>The Solution:</strong> We structured an IUL policy with:</p>
          <ul style="color: #6b7280;">
            <li>$750,000 death benefit for family protection</li>
            <li>$500/month premium (less than his car payment)</li>
            <li>Cash value tied to S&P 500 performance</li>
            <li>0% floor (no losses in down markets)</li>
          </ul>
          
          <p><strong>The Results (After 8 Years):</strong></p>
          <ul style="color: #10b981; font-weight: bold;">
            <li>$127,000 in cash value accumulated</li>
            <li>Family fully protected with $750K coverage</li>
            <li>Tax-free access to funds for opportunities</li>
            <li>On track for $50K+ annual retirement income</li>
          </ul>
        </div>
        
        <p>What made this work? <strong>Starting early</strong> and <strong>proper structuring.</strong> Anil's policy was designed for maximum cash accumulation while maintaining protection.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=prospect_day3" 
             style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;"
             data-tracking="consultation_booking">
            💡 See How You Compare to Anil
          </a>
        </div>
        
        <p>The key insight: This isn't just insurance—it's a financial tool that grows wealth while protecting your family.</p>
        
        <p>In my next email, I'll address the biggest myths that stop people from using this strategy.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Advisor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Licensed Insurance Professional</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName}, here's how Anil built wealth while protecting his family

I want to share a real story that shows the power of strategic life insurance planning.

CLIENT CASE STUDY: Anil (Software Engineer, Age 32)

The Challenge: Anil wanted to protect his growing family but also needed a way to build wealth outside of his 401(k).

The Solution: We structured an IUL policy with:
• $750,000 death benefit for family protection
• $500/month premium (less than his car payment)  
• Cash value tied to S&P 500 performance
• 0% floor (no losses in down markets)

The Results (After 8 Years):
• $127,000 in cash value accumulated
• Family fully protected with $750K coverage
• Tax-free access to funds for opportunities
• On track for $50K+ annual retirement income

What made this work? Starting early and proper structuring. Anil's policy was designed for maximum cash accumulation while maintaining protection.

See how you compare to Anil: ${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=prospect_day3

The key insight: This isn't just insurance—it's a financial tool that grows wealth while protecting your family.

In my next email, I'll address the biggest myths that stop people from using this strategy.

Your Fortune First Advisor
Licensed Insurance Professional`;

    return {
      emailId: 'prospect_day3_case_study',
      dayOffset: 3,
      subject: 'How Anil protected his family and built wealth',
      html,
      text,
      journeyType: 'prospect'
    };
  }

  private getProspectDay5Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, let's bust the biggest life insurance myths</h2>
        
        <p>I hear the same objections every week. Let me address the top 3 myths that stop smart people from building wealth with life insurance:</p>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="color: #dc2626; margin-top: 0;">❌ MYTH #1: "Life insurance is too expensive"</h3>
          <p><strong>REALITY:</strong> A properly structured policy costs less than most people spend on coffee and subscriptions. We're talking $300-600/month for significant wealth building.</p>
          <p style="color: #6b7280;">Think about it: You pay $150+ for your phone, $80+ for internet, $50+ for streaming. This is your family's financial foundation.</p>
        </div>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="color: #dc2626; margin-top: 0;">❌ MYTH #2: "It's too complicated to understand"</h3>
          <p><strong>REALITY:</strong> The concept is simple—pay premium, build cash value, access funds tax-free. Yes, there are details, but that's what advisors are for.</p>
          <p style="color: #6b7280;">You don't need to understand how your car engine works to drive. You just need a good mechanic when needed.</p>
        </div>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="color: #dc2626; margin-top: 0;">❌ MYTH #3: "I'm young, I don't need it yet"</h3>
          <p><strong>REALITY:</strong> This is exactly WHEN you need it! Young = lower premiums + more time for compound growth. Waiting costs you thousands.</p>
          <p style="color: #6b7280;">A 25-year-old pays $300/month. A 35-year-old pays $450/month for the same policy. Time is your biggest asset.</p>
        </div>
        
        <p>Here's the truth: The families building generational wealth aren't smarter—they just started sooner and ignored the myths.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=prospect_day5" 
             style="background-color: #10b981; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;"
             data-tracking="consultation_booking">
            🎯 Schedule a Quick Reality Check Call
          </a>
        </div>
        
        <p>Don't let myths cost you wealth. Let's have a real conversation about your situation.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Advisor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Licensed Insurance Professional</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName}, let's bust the biggest life insurance myths

I hear the same objections every week. Let me address the top 3 myths that stop smart people from building wealth with life insurance:

❌ MYTH #1: "Life insurance is too expensive"
REALITY: A properly structured policy costs less than most people spend on coffee and subscriptions. We're talking $300-600/month for significant wealth building.

Think about it: You pay $150+ for your phone, $80+ for internet, $50+ for streaming. This is your family's financial foundation.

❌ MYTH #2: "It's too complicated to understand"
REALITY: The concept is simple—pay premium, build cash value, access funds tax-free. Yes, there are details, but that's what advisors are for.

You don't need to understand how your car engine works to drive. You just need a good mechanic when needed.

❌ MYTH #3: "I'm young, I don't need it yet"
REALITY: This is exactly WHEN you need it! Young = lower premiums + more time for compound growth. Waiting costs you thousands.

A 25-year-old pays $300/month. A 35-year-old pays $450/month for the same policy. Time is your biggest asset.

Here's the truth: The families building generational wealth aren't smarter—they just started sooner and ignored the myths.

Schedule a quick reality check call: ${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=prospect_day5

Don't let myths cost you wealth. Let's have a real conversation about your situation.

Your Fortune First Advisor
Licensed Insurance Professional`;

    return {
      emailId: 'prospect_day5_objection_handling',
      dayOffset: 5,
      subject: 'Is life insurance really worth it?',
      html,
      text,
      journeyType: 'prospect'
    };
  }

  private getProspectDay7Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, ready to see your personalized wealth-building plan?</h2>
        
        <p>Over the past week, you've learned:</p>
        <ul style="color: #6b7280;">
          <li>✅ How life insurance builds wealth (3 powerful strategies)</li>
          <li>✅ Real case study showing $127K in accumulated value</li>
          <li>✅ Truth about common myths holding people back</li>
        </ul>
        
        <p>Now it's time to see how this applies to YOUR specific situation.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h3 style="color: #065f46; margin-top: 0;">🎯 Here's what we'll cover in your 15-minute consultation:</h3>
          <ul style="color: #374151;">
            <li><strong>Your Protection Gap:</strong> How much coverage your family actually needs</li>
            <li><strong>Wealth Building Strategy:</strong> IUL vs Whole Life for your goals</li>
            <li><strong>Premium Structure:</strong> Monthly investment that fits your budget</li>
            <li><strong>Timeline Analysis:</strong> How starting now vs later affects your results</li>
          </ul>
        </div>
        
        <p>This isn't a sales pitch. It's a financial analysis session where you'll get:</p>
        <ul style="color: #10b981;">
          <li>📊 Personalized illustration showing your wealth accumulation</li>
          <li>📈 Comparison of different policy types</li>
          <li>💡 Clear next steps (even if it's waiting)</li>
          <li>🎁 Free financial planning resources</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=prospect_day7" 
             style="background-color: #3b82f6; color: white; padding: 18px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 18px;"
             data-tracking="consultation_booking">
            📅 Book My Free 15-Minute Consultation
          </a>
        </div>
        
        <p style="color: #6b7280; font-style: italic;">⏰ Limited spots available this week. Most consultations lead to clarity, regardless of whether you move forward.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #4b5563; text-align: center;">
            <strong>"The best time to plant a tree was 20 years ago. The second best time is now."</strong><br>
            <em>— Ancient Proverb</em>
          </p>
        </div>
        
        <p>Don't let another year go by wondering "what if." Let's create your plan.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Advisor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Licensed Insurance Professional</p>
          <p style="margin: 5px 0; color: #6b7280;">Building wealth • Protecting families • Securing futures</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName}, ready to see your personalized wealth-building plan?

Over the past week, you've learned:
✅ How life insurance builds wealth (3 powerful strategies)
✅ Real case study showing $127K in accumulated value  
✅ Truth about common myths holding people back

Now it's time to see how this applies to YOUR specific situation.

🎯 Here's what we'll cover in your 15-minute consultation:
• Your Protection Gap: How much coverage your family actually needs
• Wealth Building Strategy: IUL vs Whole Life for your goals
• Premium Structure: Monthly investment that fits your budget
• Timeline Analysis: How starting now vs later affects your results

This isn't a sales pitch. It's a financial analysis session where you'll get:
📊 Personalized illustration showing your wealth accumulation
📈 Comparison of different policy types
💡 Clear next steps (even if it's waiting)
🎁 Free financial planning resources

Book your free consultation: ${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=prospect_day7

⏰ Limited spots available this week. Most consultations lead to clarity, regardless of whether you move forward.

"The best time to plant a tree was 20 years ago. The second best time is now." — Ancient Proverb

Don't let another year go by wondering "what if." Let's create your plan.

Your Fortune First Advisor
Licensed Insurance Professional
Building wealth • Protecting families • Securing futures`;

    return {
      emailId: 'prospect_day7_consultation_push',
      dayOffset: 7,
      subject: 'Ready to see your personalized plan?',
      html,
      text,
      journeyType: 'prospect'
    };
  }

  // RECRUIT JOURNEY EMAIL TEMPLATES

  private getRecruitDay2Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, here's how our business really works</h2>
        
        <p>Thanks for your interest in the Fortune First opportunity. Let me give you the straight facts about what we do and how you can build real income with us.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #065f46; margin-top: 0;">🎯 Our Business Model (Simple Overview):</h3>
          <ol style="color: #374151;">
            <li><strong>You help families:</strong> Connect people with life insurance and financial products they need</li>
            <li><strong>You earn commissions:</strong> Get paid for every policy you help secure (industry standard: $1,000-$5,000+ per case)</li>
            <li><strong>You build a team:</strong> Train others to do the same and earn overrides on their production</li>
            <li><strong>You create freedom:</strong> Build recurring income that grows whether you're working or not</li>
          </ol>
        </div>
        
        <p>Watch this 4-minute video to see exactly how it works:</p>
        
        <div style="text-align: center; margin: 30px 0; background-color: #1f2937; padding: 20px; border-radius: 8px;">
          <a href="${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day2" 
             style="color: white; text-decoration: none;"
             data-tracking="webinar_registration">
            <div style="font-size: 48px; margin-bottom: 10px;">▶️</div>
            <div style="font-size: 18px; font-weight: bold;">Watch: How Fortune First Distributors Build Wealth</div>
            <div style="font-size: 14px; color: #9ca3af; margin-top: 5px;">(4 minutes - real distributor interviews)</div>
          </a>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">💡 What Makes This Different:</h3>
          <ul style="color: #6b7280;">
            <li>You're selling protection people actually need (not junk)</li>
            <li>Warm leads provided through our marketing system</li>
            <li>Full training and certification support included</li>
            <li>Work from anywhere with your own schedule</li>
            <li>Multiple income streams (sales + team building + renewals)</li>
          </ul>
        </div>
        
        <p>This isn't get-rich-quick. It's build-wealth-consistently through helping families while creating your own financial freedom.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day2" 
             style="background-color: #10b981; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;"
             data-tracking="webinar_registration">
            🎯 Watch Full Business Overview Video
          </a>
        </div>
        
        <p>In my next email, I'll share a real success story from someone who started exactly where you are now.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Mentor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Distributor Success Coach</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName}, here's how our business really works

Thanks for your interest in the Fortune First opportunity. Let me give you the straight facts about what we do and how you can build real income with us.

🎯 Our Business Model (Simple Overview):
1. You help families: Connect people with life insurance and financial products they need
2. You earn commissions: Get paid for every policy you help secure (industry standard: $1,000-$5,000+ per case)
3. You build a team: Train others to do the same and earn overrides on their production
4. You create freedom: Build recurring income that grows whether you're working or not

Watch this 4-minute video to see exactly how it works: ${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day2

💡 What Makes This Different:
• You're selling protection people actually need (not junk)
• Warm leads provided through our marketing system
• Full training and certification support included
• Work from anywhere with your own schedule
• Multiple income streams (sales + team building + renewals)

This isn't get-rich-quick. It's build-wealth-consistently through helping families while creating your own financial freedom.

Watch the full business overview: ${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day2

In my next email, I'll share a real success story from someone who started exactly where you are now.

Your Fortune First Mentor
Distributor Success Coach`;

    return {
      emailId: 'recruit_day2_business_overview',
      dayOffset: 2,
      subject: "Here's how our business really works",
      html,
      text,
      journeyType: 'recruit'
    };
  }

  private getRecruitDay4Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, from 9-to-5 to financial freedom</h2>
        
        <p>I want to share Maya's story. She started with Fortune First 18 months ago while working full-time as a marketing manager.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h3 style="color: #065f46; margin-top: 0;">📈 Maya's Journey: 18 Month Results</h3>
          
          <p><strong>Month 1-3:</strong> Part-time while learning the system</p>
          <ul style="color: #374151;">
            <li>Completed certification training</li>
            <li>First sale: $2,100 commission (life insurance policy)</li>
            <li>Average: $3,200/month while keeping day job</li>
          </ul>
          
          <p><strong>Month 4-9:</strong> Building momentum and confidence</p>
          <ul style="color: #374151;">
            <li>Consistent $8,000-12,000/month in sales</li>
            <li>Started building a small team (3 recruits)</li>
            <li>Realized she could replace her salary</li>
          </ul>
          
          <p><strong>Month 10-18:</strong> Full-time freedom</p>
          <ul style="color: #374151;">
            <li>Left corporate job after hitting $15K+ months consistently</li>
            <li>Team of 12 distributors generating override income</li>
            <li>Current monthly income: $22,000-28,000</li>
            <li>Works 25-30 hours/week from home office</li>
          </ul>
        </div>
        
        <p><strong>What Maya says about the lifestyle change:</strong></p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; font-style: italic;">
          <p style="margin: 0; color: #4b5563; font-size: 16px;">
            "I used to stress about asking for vacation days. Now I take my kids to school every morning and pick them up. 
            I make more in a month than I used to make in a quarter, and I'm actually helping families protect their future. 
            It's not just about money—it's about purpose and freedom."
          </p>
          <p style="margin: 10px 0 0 0; color: #6b7280; text-align: right;">— Maya S., Fortune First Distributor</p>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">💰 The Income Breakdown:</h3>
          <ul style="color: #6b7280;">
            <li><strong>Direct Sales:</strong> $12,000-18,000/month (her personal production)</li>
            <li><strong>Team Overrides:</strong> $8,000-10,000/month (from her 12-person team)</li>
            <li><strong>Renewal Income:</strong> $2,000+/month (growing every month from past sales)</li>
            <li><strong>Bonuses & Incentives:</strong> $1,000-3,000/month (company rewards)</li>
          </ul>
        </div>
        
        <p>Maya's not special. She's disciplined, coachable, and committed. Most importantly, she followed the system we'll teach you.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day4" 
             style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;"
             data-tracking="webinar_registration">
            🎯 Reserve My Spot in Next Week's Info Session
          </a>
        </div>
        
        <p>Ready to write your own success story? The next info session shows you exactly how to get started.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Mentor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Distributor Success Coach</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName}, from 9-to-5 to financial freedom

I want to share Maya's story. She started with Fortune First 18 months ago while working full-time as a marketing manager.

📈 Maya's Journey: 18 Month Results

Month 1-3: Part-time while learning the system
• Completed certification training
• First sale: $2,100 commission (life insurance policy)  
• Average: $3,200/month while keeping day job

Month 4-9: Building momentum and confidence
• Consistent $8,000-12,000/month in sales
• Started building a small team (3 recruits)
• Realized she could replace her salary

Month 10-18: Full-time freedom
• Left corporate job after hitting $15K+ months consistently
• Team of 12 distributors generating override income
• Current monthly income: $22,000-28,000
• Works 25-30 hours/week from home office

What Maya says about the lifestyle change:

"I used to stress about asking for vacation days. Now I take my kids to school every morning and pick them up. I make more in a month than I used to make in a quarter, and I'm actually helping families protect their future. It's not just about money—it's about purpose and freedom."
— Maya S., Fortune First Distributor

💰 The Income Breakdown:
• Direct Sales: $12,000-18,000/month (her personal production)
• Team Overrides: $8,000-10,000/month (from her 12-person team)
• Renewal Income: $2,000+/month (growing every month from past sales)
• Bonuses & Incentives: $1,000-3,000/month (company rewards)

Maya's not special. She's disciplined, coachable, and committed. Most importantly, she followed the system we'll teach you.

Reserve your spot in next week's info session: ${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day4

Ready to write your own success story? The next info session shows you exactly how to get started.

Your Fortune First Mentor
Distributor Success Coach`;

    return {
      emailId: 'recruit_day4_success_story',
      dayOffset: 4,
      subject: 'From 9-to-5 to financial freedom',
      html,
      text,
      journeyType: 'recruit'
    };
  }

  private getRecruitDay6Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, you won't be doing this alone</h2>
        
        <p>One concern I hear often: "What if I don't know what I'm doing?" or "What if I fail?"</p>
        
        <p>Here's the truth: <strong>Nobody starts knowing everything.</strong> But with Fortune First, you're never figuring it out alone.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #065f46; margin-top: 0;">🤝 Your Complete Support System:</h3>
          
          <div style="margin: 15px 0;">
            <h4 style="color: #374151; margin: 10px 0;">1. Personal Mentorship</h4>
            <p style="color: #6b7280; margin: 5px 0;">You'll be assigned a successful mentor who's walked this path. Weekly 1-on-1 calls to review your progress and solve challenges.</p>
          </div>
          
          <div style="margin: 15px 0;">
            <h4 style="color: #374151; margin: 10px 0;">2. Comprehensive Training System</h4>
            <p style="color: #6b7280; margin: 5px 0;">12-week certification program covering sales, product knowledge, client relationships, and team building. Online modules + live practice sessions.</p>
          </div>
          
          <div style="margin: 15px 0;">
            <h4 style="color: #374151; margin: 10px 0;">3. Proven Sales System</h4>
            <p style="color: #6b7280; margin: 5px 0;">Scripts, presentations, follow-up sequences—everything tested and proven by top producers. You don't reinvent the wheel.</p>
          </div>
          
          <div style="margin: 15px 0;">
            <h4 style="color: #374151; margin: 10px 0;">4. Active Community</h4>
            <p style="color: #6b7280; margin: 5px 0;">Private Facebook group with 500+ distributors sharing wins, asking questions, and supporting each other. Plus monthly team calls.</p>
          </div>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">📚 What You'll Master in Your First 90 Days:</h3>
          <ul style="color: #6b7280;">
            <li><strong>Week 1-2:</strong> Product knowledge and licensing requirements</li>
            <li><strong>Week 3-4:</strong> Prospecting and initial conversations</li>
            <li><strong>Week 5-8:</strong> Presenting solutions and closing sales</li>
            <li><strong>Week 9-12:</strong> Building your team and scaling income</li>
          </ul>
        </div>
        
        <p><strong>Real feedback from new distributors:</strong></p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 3px solid #10b981;">
          <p style="margin: 0; color: #4b5563; font-style: italic;">
            "I was terrified I'd fail. But my mentor held my hand through every step. After 60 days, I made my first $5K month. The system works if you work it."
          </p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">— James T., New Distributor</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 3px solid #10b981;">
          <p style="margin: 0; color: #4b5563; font-style: italic;">
            "I had zero sales experience. The community and training gave me confidence. Now I'm helping others feel the same way."
          </p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">— Sarah M., 6-Month Distributor</p>
        </div>
        
        <p>Success isn't about talent—it's about having the right system and support. We provide both.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day6" 
             style="background-color: #10b981; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;"
             data-tracking="webinar_registration">
            🎯 Meet Your Future Mentor at Our Info Session
          </a>
        </div>
        
        <p>Ready to be part of a winning team? Let's connect you with your support system.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Mentor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Distributor Success Coach</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName}, you won't be doing this alone

One concern I hear often: "What if I don't know what I'm doing?" or "What if I fail?"

Here's the truth: Nobody starts knowing everything. But with Fortune First, you're never figuring it out alone.

🤝 Your Complete Support System:

1. Personal Mentorship
You'll be assigned a successful mentor who's walked this path. Weekly 1-on-1 calls to review your progress and solve challenges.

2. Comprehensive Training System  
12-week certification program covering sales, product knowledge, client relationships, and team building. Online modules + live practice sessions.

3. Proven Sales System
Scripts, presentations, follow-up sequences—everything tested and proven by top producers. You don't reinvent the wheel.

4. Active Community
Private Facebook group with 500+ distributors sharing wins, asking questions, and supporting each other. Plus monthly team calls.

📚 What You'll Master in Your First 90 Days:
• Week 1-2: Product knowledge and licensing requirements
• Week 3-4: Prospecting and initial conversations
• Week 5-8: Presenting solutions and closing sales
• Week 9-12: Building your team and scaling income

Real feedback from new distributors:

"I was terrified I'd fail. But my mentor held my hand through every step. After 60 days, I made my first $5K month. The system works if you work it."
— James T., New Distributor

"I had zero sales experience. The community and training gave me confidence. Now I'm helping others feel the same way."
— Sarah M., 6-Month Distributor

Success isn't about talent—it's about having the right system and support. We provide both.

Meet your future mentor at our info session: ${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day6

Ready to be part of a winning team? Let's connect you with your support system.

Your Fortune First Mentor
Distributor Success Coach`;

    return {
      emailId: 'recruit_day6_community_support',
      dayOffset: 6,
      subject: "You won't be doing this alone",
      html,
      text,
      journeyType: 'recruit'
    };
  }

  private getRecruitDay8Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⏰ ${firstName}, seats closing for this week's info session</h2>
        
        <p>We're running out of spots for this week's Fortune First opportunity session.</p>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #ef4444;">
          <h3 style="color: #dc2626; margin-top: 0;">🚨 DEADLINE ALERT</h3>
          <p style="margin: 10px 0;"><strong>Info Session:</strong> This Thursday, 8 PM EST</p>
          <p style="margin: 10px 0;"><strong>Spots Remaining:</strong> 7 out of 25</p>
          <p style="margin: 10px 0;"><strong>Registration Closes:</strong> Wednesday at midnight</p>
        </div>
        
        <p>Here's what you've learned this week:</p>
        <ul style="color: #6b7280;">
          <li>✅ How the business model works ($1K-$5K+ per sale)</li>
          <li>✅ Maya's success story (9-to-5 to $22K-28K/month)</li>
          <li>✅ Complete support system (mentorship + training + community)</li>
        </ul>
        
        <p>This Thursday's session covers what you haven't seen yet:</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #065f46; margin-top: 0;">📋 Thursday Session Agenda:</h3>
          <ul style="color: #374151;">
            <li><strong>Live Q&A:</strong> Get your specific questions answered</li>
            <li><strong>Income Deep Dive:</strong> See real commission statements and team earnings</li>
            <li><strong>Getting Started:</strong> Next steps if you're ready to join</li>
            <li><strong>Investment Overview:</strong> Licensing costs and startup requirements</li>
            <li><strong>Territory Selection:</strong> Choose your market area</li>
          </ul>
        </div>
        
        <div style="background-color: #fef3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;">
            <strong>⚡ Important:</strong> We only onboard 5-7 new distributors per month to ensure proper training and support. 
            This session determines who gets the available spots for December.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day8" 
             style="background-color: #dc2626; color: white; padding: 18px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 18px;"
             data-tracking="webinar_registration">
            🔥 SECURE MY SPOT NOW
          </a>
        </div>
        
        <p style="color: #6b7280; text-align: center; font-style: italic;">
          If you miss this session, the next opportunity won't be until February 2024.
        </p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #4b5563; text-align: center;">
            <strong>"Opportunity dances with those already on the dance floor."</strong><br>
            <em>— H. Jackson Brown Jr.</em>
          </p>
        </div>
        
        <p>Don't let this opportunity pass by. Reserve your spot now.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Mentor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Distributor Success Coach</p>
        </div>
      </div>
    `;

    const text = `⏰ ${firstName}, seats closing for this week's info session

We're running out of spots for this week's Fortune First opportunity session.

🚨 DEADLINE ALERT
Info Session: This Thursday, 8 PM EST
Spots Remaining: 7 out of 25
Registration Closes: Wednesday at midnight

Here's what you've learned this week:
✅ How the business model works ($1K-$5K+ per sale)
✅ Maya's success story (9-to-5 to $22K-28K/month)
✅ Complete support system (mentorship + training + community)

This Thursday's session covers what you haven't seen yet:

📋 Thursday Session Agenda:
• Live Q&A: Get your specific questions answered
• Income Deep Dive: See real commission statements and team earnings
• Getting Started: Next steps if you're ready to join
• Investment Overview: Licensing costs and startup requirements
• Territory Selection: Choose your market area

⚡ Important: We only onboard 5-7 new distributors per month to ensure proper training and support. This session determines who gets the available spots for December.

SECURE YOUR SPOT: ${this.baseUrl}/webinar?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day8

If you miss this session, the next opportunity won't be until February 2024.

"Opportunity dances with those already on the dance floor." — H. Jackson Brown Jr.

Don't let this opportunity pass by. Reserve your spot now.

Your Fortune First Mentor
Distributor Success Coach`;

    return {
      emailId: 'recruit_day8_urgency_push',
      dayOffset: 8,
      subject: "Seats closing for this week's info session",
      html,
      text,
      journeyType: 'recruit'
    };
  }

  private getRecruitDay10Template(firstName: string): NurtureEmail {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, want to talk 1-on-1 about your goals?</h2>
        
        <p>I hope you found the info session valuable (or if you missed it, I understand life gets busy).</p>
        
        <p>Either way, I'd like to have a personal conversation with you about your goals and see if Fortune First makes sense for your situation.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #065f46; margin-top: 0;">📞 Here's what we'll discuss in 20 minutes:</h3>
          <ul style="color: #374151;">
            <li><strong>Your Current Situation:</strong> Where you are financially and professionally</li>
            <li><strong>Your Goals:</strong> What you want to achieve in the next 2-3 years</li>
            <li><strong>Fit Assessment:</strong> Whether this opportunity aligns with your goals</li>
            <li><strong>Honest Feedback:</strong> I'll tell you if this is right for you or not</li>
            <li><strong>Next Steps:</strong> If there's a fit, we'll map out your path to get started</li>
          </ul>
        </div>
        
        <p>This isn't a high-pressure sales call. I'm genuinely interested in:</p>
        <ul style="color: #6b7280;">
          <li>Understanding what you're looking for</li>
          <li>Sharing more details about our opportunity</li>
          <li>Answering questions the group session couldn't cover</li>
          <li>Being honest about whether this is a good fit</li>
        </ul>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">📊 Questions I'll Ask You:</h3>
          <ul style="color: #6b7280;">
            <li>What attracted you to this opportunity initially?</li>
            <li>What would financial freedom look like for you?</li>
            <li>How much time could you dedicate to building this?</li>
            <li>What's your biggest concern or hesitation?</li>
            <li>What questions do you have about the business?</li>
          </ul>
        </div>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 3px solid #3b82f6;">
          <p style="margin: 0; color: #4b5563; font-style: italic;">
            "The 20-minute call with my mentor was the turning point. She helped me see exactly how this could work with my schedule and goals. Best decision I've made."
          </p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">— David K., Fortune First Distributor</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day10" 
             style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;"
             data-tracking="consultation_booking">
            📅 Schedule My 1-on-1 Call
          </a>
        </div>
        
        <p>I have a few slots open this week and next. Pick a time that works for you.</p>
        
        <div style="background-color: #fef3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; text-align: center;">
            <strong>No obligation.</strong> Just a conversation between two people exploring opportunities.
          </p>
        </div>
        
        <p>Looking forward to learning more about your goals and sharing how Fortune First might help you achieve them.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Mentor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Distributor Success Coach</p>
          <p style="margin: 5px 0; color: #6b7280;">Building teams • Creating freedom • Changing lives</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName}, want to talk 1-on-1 about your goals?

I hope you found the info session valuable (or if you missed it, I understand life gets busy).

Either way, I'd like to have a personal conversation with you about your goals and see if Fortune First makes sense for your situation.

📞 Here's what we'll discuss in 20 minutes:
• Your Current Situation: Where you are financially and professionally
• Your Goals: What you want to achieve in the next 2-3 years
• Fit Assessment: Whether this opportunity aligns with your goals
• Honest Feedback: I'll tell you if this is right for you or not
• Next Steps: If there's a fit, we'll map out your path to get started

This isn't a high-pressure sales call. I'm genuinely interested in:
• Understanding what you're looking for
• Sharing more details about our opportunity
• Answering questions the group session couldn't cover
• Being honest about whether this is a good fit

📊 Questions I'll Ask You:
• What attracted you to this opportunity initially?
• What would financial freedom look like for you?
• How much time could you dedicate to building this?
• What's your biggest concern or hesitation?
• What questions do you have about the business?

"The 20-minute call with my mentor was the turning point. She helped me see exactly how this could work with my schedule and goals. Best decision I've made."
— David K., Fortune First Distributor

Schedule your 1-on-1 call: ${this.baseUrl}/consultation?utm_source=nurture&utm_medium=email&utm_campaign=recruit_day10

I have a few slots open this week and next. Pick a time that works for you.

No obligation. Just a conversation between two people exploring opportunities.

Looking forward to learning more about your goals and sharing how Fortune First might help you achieve them.

Your Fortune First Mentor
Distributor Success Coach
Building teams • Creating freedom • Changing lives`;

    return {
      emailId: 'recruit_day10_call_invite',
      dayOffset: 10,
      subject: 'Want to talk 1-on-1 about your goals?',
      html,
      text,
      journeyType: 'recruit'
    };
  }
}

export const nurtureService = new FortuneFirstNurtureService();