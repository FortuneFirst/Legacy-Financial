import { Lead } from "@shared/schema";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailService {
  sendInstantConfirmation(lead: Lead): Promise<void>;
  sendFallbackCampaign(lead: Lead): Promise<void>;
  sendOnboardingEmail(type: 'insurance' | 'recruiting', day: number, recipientName: string, recipientEmail: string, advisorName: string): Promise<void>;
}

export class FortuneFirstEmailService implements EmailService {
  private baseUrl = process.env.FRONTEND_URL || 'https://fortune-first.replit.app';

  async sendInstantConfirmation(lead: Lead): Promise<void> {
    const template = this.getConfirmationTemplate(lead);
    
    // Log the email for now (in production, integrate with email provider)
    console.log(`
📧 INSTANT CONFIRMATION EMAIL
To: ${lead.email}
Subject: ${template.subject}

${template.text}
    `);
    
    // TODO: Integrate with email provider (SendGrid, AWS SES, etc.)
    // await this.emailProvider.send({
    //   to: lead.email,
    //   subject: template.subject,
    //   html: template.html,
    //   text: template.text
    // });
  }

  async sendFallbackCampaign(lead: Lead): Promise<void> {
    const template = this.getFallbackTemplate(lead);
    
    console.log(`
📧 FALLBACK CAMPAIGN EMAIL
To: ${lead.email}
Subject: ${template.subject}

${template.text}
    `);
    
    // TODO: Integrate with email provider
  }

  async sendOnboardingEmail(
    type: 'insurance' | 'recruiting', 
    day: number, 
    recipientName: string, 
    recipientEmail: string, 
    advisorName: string
  ): Promise<void> {
    const template = this.getOnboardingTemplate(type, day, recipientName, advisorName);
    
    console.log(`
📧 ONBOARDING EMAIL (${type.toUpperCase()} - Day ${day})
To: ${recipientEmail}
Subject: ${template.subject}

${template.text}
    `);
    
    // TODO: Integrate with email provider
  }

  private getConfirmationTemplate(lead: Lead): EmailTemplate {
    const firstName = lead.name.split(' ')[0];
    
    switch (lead.source) {
      case 'insurance':
        return this.getInsuranceConfirmationTemplate(firstName);
      case 'retirement':
        return this.getRetirementConfirmationTemplate(firstName);
      case 'recruiting':
        return this.getRecruitingConfirmationTemplate(firstName);
      case 'quiz':
        return this.getInsuranceConfirmationTemplate(firstName); // Quiz leads get insurance template
      default:
        return this.getGenericConfirmationTemplate(firstName);
    }
  }

  private getInsuranceConfirmationTemplate(firstName: string): EmailTemplate {
    const subject = "Here's your free guide to protecting your family's future";
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, thank you for reaching out!</h2>
        
        <p>I'm excited to share your free Life Insurance Guide with you. This comprehensive resource will help you understand how to protect your family while building wealth for the future.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/api/pdf/insurance-guide" 
             style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            📄 Download Your Free Guide
          </a>
        </div>
        
        <p>Over the next few days, I'll send you practical tips to help you protect your family and grow your wealth. These insights have helped hundreds of families secure their financial future.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/consultation" 
             style="background-color: #10b981; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">
            📅 Book a Free 15-min Consultation
          </a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Advisor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Licensed Insurance Professional</p>
          <p style="margin: 5px 0; color: #6b7280;">Protecting families • Building wealth • Securing futures</p>
        </div>
      </div>
    `;
    
    const text = `Hi ${firstName}, thank you for reaching out!

I'm excited to share your free Life Insurance Guide with you. Download it here: ${this.baseUrl}/api/pdf/insurance-guide

Over the next few days, I'll send you practical tips to help you protect your family and grow your wealth.

Ready to get started? Book a free 15-minute consultation: ${this.baseUrl}/consultation

Your Fortune First Advisor
Licensed Insurance Professional`;

    return { subject, html, text };
  }

  private getRetirementConfirmationTemplate(firstName: string): EmailTemplate {
    const subject = "Your retirement checklist is ready";
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, your Retirement Security Checklist is here!</h2>
        
        <p>Thank you for requesting your personalized retirement planning resource. This checklist will help you evaluate whether you're on track for a secure retirement.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/api/pdf/retirement-checklist" 
             style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            📋 Download Your Retirement Checklist
          </a>
        </div>
        
        <p>Over the next few days, I'll share proven strategies to help you maximize your retirement income and ensure your golden years are truly golden.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/consultation" 
             style="background-color: #10b981; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">
            📅 Schedule Your Retirement Review
          </a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Advisor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Retirement Planning Specialist</p>
          <p style="margin: 5px 0; color: #6b7280;">Securing retirement dreams • Building legacy wealth</p>
        </div>
      </div>
    `;
    
    const text = `Hi ${firstName}, your Retirement Security Checklist is here!

Download your personalized checklist: ${this.baseUrl}/api/pdf/retirement-checklist

Over the next few days, I'll share proven strategies to help you maximize your retirement income and ensure your golden years are truly golden.

Schedule your retirement review: ${this.baseUrl}/consultation

Your Fortune First Advisor
Retirement Planning Specialist`;

    return { subject, html, text };
  }

  private getRecruitingConfirmationTemplate(firstName: string): EmailTemplate {
    const subject = "Welcome to your Distributor Success Starter Kit";
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, excited to share this with you!</h2>
        
        <p>Welcome to an opportunity that combines purpose with prosperity. Your Distributor Success Starter Kit contains everything you need to understand how you can build wealth while helping families protect their future.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/api/pdf/distributor-kit" 
             style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            🚀 Download Your Starter Kit
          </a>
        </div>
        
        <p>Join our next live webinar where we break down how this opportunity works, what kind of income potential exists, and how our proven system supports your success from day one.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/webinar" 
             style="background-color: #10b981; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">
            🎯 Save My Webinar Spot
          </a>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">What You'll Discover:</h3>
          <ul style="color: #6b7280;">
            <li>How to earn while making a meaningful impact</li>
            <li>Our proven training and mentorship system</li>
            <li>Income potential and growth opportunities</li>
            <li>Why timing is everything in this industry</li>
          </ul>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Mentor</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Distributor Success Coach</p>
          <p style="margin: 5px 0; color: #6b7280;">Building teams • Creating freedom • Changing lives</p>
        </div>
      </div>
    `;
    
    const text = `Hi ${firstName}, excited to share this with you!

Welcome to an opportunity that combines purpose with prosperity. Download your Distributor Success Starter Kit: ${this.baseUrl}/api/pdf/distributor-kit

Join our next live webinar where we break down how this opportunity works: ${this.baseUrl}/webinar

What You'll Discover:
• How to earn while making a meaningful impact
• Our proven training and mentorship system  
• Income potential and growth opportunities
• Why timing is everything in this industry

Your Fortune First Mentor
Distributor Success Coach`;

    return { subject, html, text };
  }

  private getGenericConfirmationTemplate(firstName: string): EmailTemplate {
    const subject = "Welcome to Fortune First - Your resources are ready";
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Hi ${firstName}, thank you for joining Fortune First!</h2>
        
        <p>We're excited to help you on your journey toward financial security and prosperity. Over the next few days, you'll receive valuable insights and resources.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.baseUrl}/consultation" 
             style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            📅 Schedule Your Free Consultation
          </a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Your Fortune First Team</strong></p>
          <p style="margin: 5px 0; color: #6b7280;">Committed to your financial success</p>
        </div>
      </div>
    `;
    
    const text = `Hi ${firstName}, thank you for joining Fortune First!

We're excited to help you on your journey toward financial security and prosperity.

Schedule your free consultation: ${this.baseUrl}/consultation

Your Fortune First Team`;

    return { subject, html, text };
  }

  private getFallbackTemplate(lead: Lead): EmailTemplate {
    const firstName = lead.name.split(' ')[0];
    
    switch (lead.source) {
      case 'insurance':
        return {
          subject: `Did you get your guide, ${firstName}?`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">Hi ${firstName}, just checking in...</h2>
              <p>I wanted to make sure you received your free Life Insurance Guide. Sometimes emails can end up in the wrong folder!</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${this.baseUrl}/api/pdf/insurance-guide" 
                   style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  📄 Download Your Guide Here
                </a>
              </div>
              <p>If you have any questions, just reply to this email. I'm here to help!</p>
            </div>
          `,
          text: `Hi ${firstName}, just checking in... I wanted to make sure you received your free Life Insurance Guide. Download it here: ${this.baseUrl}/api/pdf/insurance-guide`
        };
      case 'retirement':
        return {
          subject: `Your retirement checklist is waiting, ${firstName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">Hi ${firstName}, don't miss out...</h2>
              <p>Your Retirement Security Checklist is ready for download. This valuable resource will help you evaluate if you're on track for retirement.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${this.baseUrl}/api/pdf/retirement-checklist" 
                   style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  📋 Get Your Checklist
                </a>
              </div>
            </div>
          `,
          text: `Hi ${firstName}, your Retirement Security Checklist is ready: ${this.baseUrl}/api/pdf/retirement-checklist`
        };
      case 'recruiting':
        return {
          subject: `${firstName}, your opportunity awaits...`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">Hi ${firstName}, ready to get started?</h2>
              <p>Your Distributor Success Starter Kit is ready! Don't let this opportunity pass by.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${this.baseUrl}/api/pdf/distributor-kit" 
                   style="background-color: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  🚀 Download Your Kit
                </a>
              </div>
            </div>
          `,
          text: `Hi ${firstName}, your Distributor Success Starter Kit is ready: ${this.baseUrl}/api/pdf/distributor-kit`
        };
      default:
        return {
          subject: `${firstName}, we're here when you're ready`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">Hi ${firstName}, just checking in...</h2>
              <p>We're here to help you with your financial planning needs. Feel free to reach out anytime!</p>
            </div>
          `,
          text: `Hi ${firstName}, we're here to help you with your financial planning needs.`
        };
    }
  }

  private getOnboardingTemplate(type: 'insurance' | 'recruiting', day: number, firstName: string, advisorName: string): EmailTemplate {
    if (type === 'insurance') {
      switch (day) {
        case 0:
          return {
            subject: "Welcome to Fortune First – Your Plan is in Motion!",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>🎉 Welcome to Fortune First, ${firstName}!</h2><p>Congratulations on securing your family's financial future! Your dedicated advisor ${advisorName} will guide you through this journey.</p><p>Over the next week, you'll receive valuable information to help you maximize your policy benefits.</p></div>`,
            text: `🎉 Welcome to Fortune First, ${firstName}! Your dedicated advisor ${advisorName} will guide you. Over the next week, you'll receive valuable information to maximize your policy benefits.`
          };
        case 2:
          return {
            subject: "How to Get the Most From Your New Policy",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>📚 Maximizing Your Policy Benefits</h2><p>Hi ${firstName}, let me share insights about your powerful policy benefits including cash value, riders, and annual reviews.</p></div>`,
            text: `📚 Hi ${firstName}, your policy includes cash value growth, valuable riders, and annual review benefits to maximize your protection.`
          };
        case 5:
          return {
            subject: "Meet Your Support Team",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>🤝 Your Fortune First Support Team</h2><p>Hi ${firstName}, meet your dedicated support contacts for billing (1-800-FORTUNE), claims (1-800-CLAIMS1), and general support.</p></div>`,
            text: `🤝 Hi ${firstName}, your support team: Billing (1-800-FORTUNE), Claims (1-800-CLAIMS1), General Support (1-800-SUPPORT), and your advisor ${advisorName}.`
          };
        case 7:
          return {
            subject: "Do you know someone who needs this too?",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>💝 Share the Protection</h2><p>Hi ${firstName}, you probably know someone who could benefit from this same protection. For each referral, receive a $100 Amazon gift card!</p></div>`,
            text: `💝 Hi ${firstName}, share this protection with others! Earn $100 Amazon gift card for each successful referral.`
          };
        default:
          throw new Error(`Invalid insurance onboarding day: ${day}`);
      }
    } else {
      switch (day) {
        case 0:
          return {
            subject: "Welcome to the Team – Let's Get Started!",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>🎉 Welcome to Fortune First Team, ${firstName}!</h2><p>Your first 3 steps: 1) Join private team group, 2) Complete profile setup, 3) Schedule welcome call with ${advisorName}.</p></div>`,
            text: `🎉 Welcome ${firstName}! First steps: 1) Join team group, 2) Complete profile, 3) Schedule call with ${advisorName}.`
          };
        case 1:
          return {
            subject: "Your 7-Day Fast Start Training",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>🎯 Day 1: Fast Start Training</h2><p>Hi ${firstName}, complete Training Module #1 on Success Mindset - discover your WHY and overcome fears about sharing.</p></div>`,
            text: `🎯 Hi ${firstName}, complete Training Module #1: Success Mindset. Discover your WHY and learn to share effectively.`
          };
        case 3:
          return {
            subject: "Your Prospecting Toolkit",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>🛠️ Complete Prospecting Toolkit</h2><p>Hi ${firstName}, download scripts for phone calls, social media templates, and presentation materials used by top producers.</p></div>`,
            text: `🛠️ Hi ${firstName}, download your prospecting toolkit: phone scripts, social media templates, and presentation materials.`
          };
        case 5:
          return {
            subject: "Meet Your Upline Mentor",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>👨‍🏫 Meet Your Mentor</h2><p>Hi ${firstName}, meet ${advisorName} - your dedicated mentor. Schedule your 1:1 success call to create your 90-day action plan.</p></div>`,
            text: `👨‍🏫 Hi ${firstName}, meet your mentor ${advisorName}. Schedule your 1:1 call to create your success plan.`
          };
        case 7:
          return {
            subject: "Are You Ready to Share Your Story?",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>📣 Time to Share Your Story!</h2><p>Hi ${firstName}, you've completed fast start training! Make your first post, have your first conversation, and submit your first win.</p></div>`,
            text: `📣 Hi ${firstName}, training complete! Make your first post, have a conversation, and submit your first win.`
          };
        default:
          throw new Error(`Invalid recruiting onboarding day: ${day}`);
      }
    }
  }
}

export const emailService = new FortuneFirstEmailService();