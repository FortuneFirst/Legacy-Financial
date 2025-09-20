export interface LeadTaggingService {
  assignTagsBasedOnSource(source: string): string[];
  calculateInitialLeadScore(source: string, interests?: string[]): number;
}

export class FortuneFirstLeadTaggingService implements LeadTaggingService {
  assignTagsBasedOnSource(source: string): string[] {
    const tags: string[] = [];
    
    switch (source) {
      case 'insurance':
        tags.push('Interest:Insurance', 'LeadMagnet:InsuranceGuide');
        break;
      case 'retirement':
        tags.push('Interest:Retirement', 'LeadMagnet:RetirementChecklist');
        break;
      case 'recruiting':
        tags.push('Interest:Recruit', 'LeadMagnet:DistributorKit', 'Pipeline:MLM');
        break;
      case 'quiz':
        tags.push('Interest:Insurance', 'LeadMagnet:CoverageGuide', 'Source:Quiz');
        break;
      case 'newsletter':
        tags.push('Interest:Newsletter', 'Engagement:Subscriber');
        break;
    }
    
    // Add general Fortune First tags
    tags.push('Source:FortuneFirst', `SourceSpecific:${source}`);
    
    // Add initial stage tag for all new leads
    tags.push('Stage:NewLead');
    
    return tags;
  }

  // Enhanced tagging system for different engagement stages
  getStageProgressionTags(): Record<string, string[]> {
    return {
      'NewLead': ['Stage:NewLead'],
      'Engaged': ['Stage:Engaged'],
      'Nurturing': ['Stage:Nurturing'],
      'Consultation': ['Stage:Consultation'],
      'Proposal': ['Stage:Proposal'],
      'Converted': ['Stage:Converted'],
      'Lost': ['Stage:Lost'],
      'Inactive': ['Stage:Inactive']
    };
  }

  // Engagement-based tags for tracking behavior
  getEngagementTags(): Record<string, string[]> {
    return {
      'email_open': ['Engagement:EmailOpen'],
      'email_click': ['Engagement:EmailClick'],
      'pdf_download': ['Engagement:PDFDownload'],
      'page_visit': ['Engagement:PageVisit'],
      'form_submit': ['Engagement:FormSubmit'],
      'phone_provided': ['Engagement:PhoneProvided'],
      'sms_reply': ['Engagement:SMSReply'],
      'calendar_book': ['Engagement:CalendarBook'],
      'consultation_complete': ['Engagement:ConsultationComplete'],
      'webinar_register': ['Engagement:WebinarRegister'],
      'webinar_attend': ['Engagement:WebinarAttend']
    };
  }

  // Source-specific tags for campaign tracking
  getSourceTags(): Record<string, string[]> {
    return {
      'FBLeadAd': ['Source:FBLeadAd'],
      'Website': ['Source:Website'],
      'GoogleAds': ['Source:GoogleAds'],
      'Referral': ['Source:Referral'],
      'ColdList': ['Source:ColdList'],
      'Event': ['Source:Event'],
      'Webinar': ['Source:Webinar']
    };
  }
  
  calculateInitialLeadScore(source: string, interests?: string[]): number {
    let score = 0;
    
    // Base points by source (higher intent sources get more points)
    switch (source) {
      case 'recruiting':
        score += 25; // High intent - career opportunity
        break;
      case 'retirement':
        score += 20; // High intent - planning need
        break;
      case 'insurance':
        score += 15; // Medium-high intent - protection need
        break;
      case 'quiz':
        score += 10; // Medium intent - exploring options
        break;
      case 'newsletter':
        score += 5; // Lower intent - information seeking
        break;
    }
    
    // Bonus points for specific interests
    if (interests?.length) {
      score += interests.length * 2; // 2 points per interest
    }
    
    return score;
  }
  
  extractUTMParameters(request: any): {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  } {
    const query = request.query || {};
    return {
      utmSource: query.utm_source,
      utmMedium: query.utm_medium,
      utmCampaign: query.utm_campaign,
      utmTerm: query.utm_term,
      utmContent: query.utm_content,
    };
  }
  
  // Lead scoring actions for future use
  getActionPoints(): Record<string, number> {
    return {
      'email_open': 5,
      'email_click': 10,
      'pdf_download': 15,
      'page_visit': 3,
      'form_submit': 20,
      'phone_provided': 10,
      'calendar_book': 30,
      'consultation_complete': 50
    };
  }
}

export const leadTaggingService = new FortuneFirstLeadTaggingService();