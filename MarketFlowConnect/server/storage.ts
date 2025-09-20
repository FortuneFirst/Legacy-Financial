import { 
  type Lead, type InsertLead, type Newsletter, type InsertNewsletter, 
  type OnboardingSequence, type InsertOnboardingSequence,
  type ClientRecord, type InsertClientRecord, type RecruitRecord, type InsertRecruitRecord,
  type RetentionCampaign, type InsertRetentionCampaign, type Referral, type InsertReferral,
  type RecognitionAchievement, type InsertRecognitionAchievement, type NpsSurvey, type InsertNpsSurvey,
  type VipEliteClub, type InsertVipEliteClub,
  leads, newsletterSubscribers, onboardingSequences, clientRecords, recruitRecords, 
  retentionCampaigns, referrals, recognitionAchievements, npsSurveys, vipEliteClub
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, type InferInsertModel, and, gte, lt, desc } from "drizzle-orm";
import { leadTaggingService } from "./lead-tagging-service";

export interface IStorage {
  // Lead management
  createLead(lead: InsertLead, utmParams?: any): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  getLeadsBySource(source: string): Promise<Lead[]>;
  getLeadById(leadId: string): Promise<Lead | null>;
  updateLeadScore(leadId: string, points: number): Promise<void>;
  getHighValueLeads(minScore: number): Promise<Lead[]>;
  
  // Nurture journey management
  updateLeadNurtureJourney(leadId: string, nurtureData: {
    nurtureStage: string;
    nurtureJourneyType: string;
    nurtureStartedAt: Date;
    scheduledEmails: Array<{emailId: string, scheduledFor: string}>;
    nurtureEmailsSent: string[];
    engagementEvents: Array<{eventType: string, timestamp: string, points: number}>;
  }): Promise<void>;
  getLeadsWithScheduledEmails(): Promise<Lead[]>;
  updateScheduledEmails(leadId: string, scheduledEmails: Array<{emailId: string, scheduledFor: string}>): Promise<void>;
  addEngagementEvent(leadId: string, event: {eventType: string, timestamp: string, points: number}): Promise<void>;
  addSentNurtureEmail(leadId: string, emailId: string): Promise<void>;
  updateLastNurtureEmail(leadId: string, emailId: string): Promise<void>;
  updateLeadStage(leadId: string, newStage: string): Promise<void>;
  
  // Newsletter management
  subscribeNewsletter(subscriber: InsertNewsletter): Promise<Newsletter>;
  getNewsletterSubscribers(): Promise<Newsletter[]>;
  isEmailSubscribed(email: string): Promise<boolean>;
  
  // Onboarding tracking methods
  createOnboardingSequence(sequence: InsertOnboardingSequence): Promise<OnboardingSequence>;
  getOnboardingSequence(dealId: string): Promise<OnboardingSequence | null>;
  updateOnboardingProgress(sequenceId: string, updates: Partial<OnboardingSequence>): Promise<void>;
  getActiveOnboardingSequences(): Promise<OnboardingSequence[]>;
  getOnboardingSequencesForScheduling(): Promise<OnboardingSequence[]>;
  markOnboardingEmailSent(sequenceId: string, day: number): Promise<void>;
  completeOnboardingSequence(sequenceId: string): Promise<void>;
  
  // ===== RETENTION & REFERRAL ENGINE STORAGE METHODS =====
  
  // Client Record Management
  createClientRecord(clientData: InsertClientRecord): Promise<ClientRecord>;
  getClientRecord(clientId: string): Promise<ClientRecord | null>;
  getClientRecordByLead(leadId: string): Promise<ClientRecord | null>;
  updateClientRecord(clientId: string, updates: Partial<ClientRecord>): Promise<void>;
  getActiveClientRecords(): Promise<ClientRecord[]>;
  getClientsForRetention(criteria: {
    anniversaryDue?: boolean;
    birthdayDue?: boolean;
    crossSellEligible?: boolean;
    atRisk?: boolean;
  }): Promise<ClientRecord[]>;
  
  // Recruit Record Management
  createRecruitRecord(recruitData: InsertRecruitRecord): Promise<RecruitRecord>;
  getRecruitRecord(recruitId: string): Promise<RecruitRecord | null>;
  getRecruitRecordByLead(leadId: string): Promise<RecruitRecord | null>;
  updateRecruitRecord(recruitId: string, updates: Partial<RecruitRecord>): Promise<void>;
  getActiveRecruitRecords(): Promise<RecruitRecord[]>;
  getRecruitsForRetention(criteria: {
    inactiveCheck?: boolean;
    trainingDue?: boolean;
    fastStartEligible?: boolean;
    recognitionEligible?: boolean;
  }): Promise<RecruitRecord[]>;
  
  // Retention Campaign Management
  createRetentionCampaign(campaignData: InsertRetentionCampaign): Promise<RetentionCampaign>;
  getRetentionCampaign(campaignId: string): Promise<RetentionCampaign | null>;
  getScheduledCampaigns(dueDate?: Date): Promise<RetentionCampaign[]>;
  updateCampaignStatus(campaignId: string, status: string, timestamps?: Record<string, Date>): Promise<void>;
  getCampaignsByTarget(targetType: 'client' | 'recruit', targetId: string): Promise<RetentionCampaign[]>;
  getCampaignMetrics(campaignType?: string, dateRange?: { start: Date; end: Date }): Promise<any>;
  
  // Referral Management
  createReferral(referralData: InsertReferral): Promise<Referral>;
  getReferral(referralId: string): Promise<Referral | null>;
  updateReferralStatus(referralId: string, status: string, metadata?: Record<string, any>): Promise<void>;
  getReferralsByReferrer(referrerType: 'client' | 'recruit', referrerId: string): Promise<Referral[]>;
  getPendingReferrals(): Promise<Referral[]>;
  getReferralMetrics(): Promise<{
    totalSubmitted: number;
    totalConverted: number;
    conversionRate: number;
    rewardsPending: number;
  }>;
  
  // Recognition & Achievement Management
  createRecognitionAchievement(achievementData: InsertRecognitionAchievement): Promise<RecognitionAchievement>;
  getRecognitionAchievement(achievementId: string): Promise<RecognitionAchievement | null>;
  getAchievementsByTarget(targetType: 'client' | 'recruit', targetId: string): Promise<RecognitionAchievement[]>;
  getRecentAchievements(hours?: number): Promise<RecognitionAchievement[]>;
  getLeaderboard(targetType: 'client' | 'recruit', period: 'monthly' | 'yearly'): Promise<any[]>;
  
  // NPS Survey Management
  createNpsSurvey(surveyData: InsertNpsSurvey): Promise<NpsSurvey>;
  getNpsSurvey(surveyId: string): Promise<NpsSurvey | null>;
  updateNpsSurveyResponse(surveyId: string, response: {
    npsScore: number;
    npsCategory: string;
    feedback?: string;
    improvementSuggestions?: string;
  }): Promise<void>;
  getScheduledSurveys(): Promise<NpsSurvey[]>;
  getPendingNpsFollowUps(): Promise<NpsSurvey[]>;
  getNpsMetrics(): Promise<{
    averageScore: number;
    responseRate: number;
    promoters: number;
    detractors: number;
    passives: number;
  }>;
  
  // VIP Elite Club Management
  createVipMembership(membershipData: InsertVipEliteClub): Promise<VipEliteClub>;
  getVipMembership(membershipId: string): Promise<VipEliteClub | null>;
  getVipMembershipByTarget(targetType: 'client' | 'recruit', targetId: string): Promise<VipEliteClub | null>;
  updateVipMembership(membershipId: string, updates: Partial<VipEliteClub>): Promise<void>;
  getActiveVipMembers(clubType?: string): Promise<VipEliteClub[]>;
  getVipMembersForRenewal(): Promise<VipEliteClub[]>;
}

export class DatabaseStorage implements IStorage {
  async createLead(insertLead: InsertLead, utmParams?: any): Promise<Lead> {
    // Auto-assign tags based on source
    const autoTags = leadTaggingService.assignTagsBasedOnSource(insertLead.source);
    
    // Calculate initial lead score
    const initialScore = leadTaggingService.calculateInitialLeadScore(
      insertLead.source, 
      insertLead.interests
    );
    
    const payload: InferInsertModel<typeof leads> = {
      name: insertLead.name,
      email: insertLead.email,
      phone: insertLead.phone,
      source: insertLead.source,
      interests: insertLead.interests,
      quizAnswers: insertLead.quizAnswers,
      employmentStatus: insertLead.employmentStatus,
      // ActiveCampaign integration fields
      tags: autoTags,
      leadScore: initialScore,
      utmSource: utmParams?.utmSource,
      utmMedium: utmParams?.utmMedium,
      utmCampaign: utmParams?.utmCampaign,
      utmTerm: utmParams?.utmTerm,
      utmContent: utmParams?.utmContent,
      lastEngagement: new Date(),
    };
    
    const [lead] = await db
      .insert(leads)
      .values(payload)
      .returning();
      
    console.log(`Created lead with score ${initialScore} and tags:`, autoTags);
    
    return lead;
  }

  async updateLeadScore(leadId: string, points: number): Promise<void> {
    await db
      .update(leads)
      .set({ 
        leadScore: sql`COALESCE(lead_score, 0) + ${points}`,
        lastEngagement: new Date()
      })
      .where(eq(leads.id, leadId));
  }

  async getHighValueLeads(minScore: number = 50): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(sql`lead_score >= ${minScore}`)
      .orderBy(sql`lead_score DESC`);
  }

  async getLeads(): Promise<Lead[]> {
    return await db.select().from(leads);
  }

  async getLeadsBySource(source: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.source, source));
  }

  async subscribeNewsletter(insertNewsletter: InsertNewsletter): Promise<Newsletter> {
    try {
      const [subscriber] = await db
        .insert(newsletterSubscribers)
        .values({
          email: insertNewsletter.email
        })
        .returning();
      return subscriber;
    } catch (error: any) {
      // Handle duplicate email gracefully (PostgreSQL unique constraint violation)
      if (error.code === '23505') {
        // Email already exists, return existing subscription
        const [existing] = await db
          .select()
          .from(newsletterSubscribers)
          .where(eq(newsletterSubscribers.email, insertNewsletter.email))
          .limit(1);
        return existing;
      }
      throw error;
    }
  }

  async getNewsletterSubscribers(): Promise<Newsletter[]> {
    return await db.select().from(newsletterSubscribers);
  }

  async isEmailSubscribed(email: string): Promise<boolean> {
    const result = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email.toLowerCase().trim()))
      .limit(1);
    return result.length > 0;
  }

  // Nurture journey methods
  async getLeadById(leadId: string): Promise<Lead | null> {
    const result = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async updateLeadNurtureJourney(leadId: string, nurtureData: {
    nurtureStage: string;
    nurtureJourneyType: string;
    nurtureStartedAt: Date;
    scheduledEmails: Array<{emailId: string, scheduledFor: string}>;
    nurtureEmailsSent: string[];
    engagementEvents: Array<{eventType: string, timestamp: string, points: number}>;
  }): Promise<void> {
    await db
      .update(leads)
      .set({
        nurtureStage: nurtureData.nurtureStage,
        nurtureJourneyType: nurtureData.nurtureJourneyType,
        nurtureStartedAt: nurtureData.nurtureStartedAt,
        scheduledEmails: nurtureData.scheduledEmails,
        nurtureEmailsSent: nurtureData.nurtureEmailsSent,
        engagementEvents: nurtureData.engagementEvents,
        lastEngagement: new Date()
      })
      .where(eq(leads.id, leadId));
  }

  async getLeadsWithScheduledEmails(): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(sql`scheduled_emails IS NOT NULL AND jsonb_array_length(scheduled_emails) > 0`);
  }

  async updateScheduledEmails(leadId: string, scheduledEmails: Array<{emailId: string, scheduledFor: string}>): Promise<void> {
    await db
      .update(leads)
      .set({
        scheduledEmails: scheduledEmails,
        lastEngagement: new Date()
      })
      .where(eq(leads.id, leadId));
  }

  async addEngagementEvent(leadId: string, event: {eventType: string, timestamp: string, points: number}): Promise<void> {
    const lead = await this.getLeadById(leadId);
    if (!lead) return;

    const existingEvents = lead.engagementEvents || [];
    const updatedEvents = [...existingEvents, event];

    await db
      .update(leads)
      .set({
        engagementEvents: updatedEvents,
        lastEngagement: new Date()
      })
      .where(eq(leads.id, leadId));
  }

  async addSentNurtureEmail(leadId: string, emailId: string): Promise<void> {
    const lead = await this.getLeadById(leadId);
    if (!lead) return;

    const existingEmails = lead.nurtureEmailsSent || [];
    if (!existingEmails.includes(emailId)) {
      const updatedEmails = [...existingEmails, emailId];

      await db
        .update(leads)
        .set({
          nurtureEmailsSent: updatedEmails,
          lastEngagement: new Date()
        })
        .where(eq(leads.id, leadId));
    }
  }

  async updateLastNurtureEmail(leadId: string, emailId: string): Promise<void> {
    await db
      .update(leads)
      .set({
        lastNurtureEmail: emailId,
        lastEngagement: new Date()
      })
      .where(eq(leads.id, leadId));
  }

  async updateLeadStage(leadId: string, newStage: string): Promise<void> {
    await db
      .update(leads)
      .set({
        nurtureStage: newStage,
        lastEngagement: new Date()
      })
      .where(eq(leads.id, leadId));
  }

  // Onboarding tracking methods
  async createOnboardingSequence(insertSequence: InsertOnboardingSequence): Promise<OnboardingSequence> {
    const [sequence] = await db
      .insert(onboardingSequences)
      .values(insertSequence)
      .returning();
    return sequence;
  }

  async getOnboardingSequence(dealId: string): Promise<OnboardingSequence | null> {
    const result = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.dealId, dealId))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  }

  async updateOnboardingProgress(sequenceId: string, updates: Partial<OnboardingSequence>): Promise<void> {
    await db
      .update(onboardingSequences)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, sequenceId));
  }

  async getActiveOnboardingSequences(): Promise<OnboardingSequence[]> {
    return await db
      .select()
      .from(onboardingSequences)
      .where(sql`status = 'active'`);
  }

  async getOnboardingSequencesForScheduling(): Promise<OnboardingSequence[]> {
    const now = new Date();
    return await db
      .select()
      .from(onboardingSequences)
      .where(sql`
        status = 'active' AND 
        scheduled_emails IS NOT NULL AND 
        jsonb_array_length(scheduled_emails) > 0
      `);
  }

  async markOnboardingEmailSent(sequenceId: string, day: number): Promise<void> {
    const sequence = await db
      .select()
      .from(onboardingSequences)
      .where(eq(onboardingSequences.id, sequenceId))
      .limit(1);

    if (sequence.length > 0) {
      const current = sequence[0];
      const sentEmails = current.emailsSent || [];
      const dayKey = `day-${day}`;
      
      if (!sentEmails.includes(dayKey)) {
        const updatedEmails = [...sentEmails, dayKey];
        
        await db
          .update(onboardingSequences)
          .set({
            emailsSent: updatedEmails,
            lastEmailSent: new Date(),
            updatedAt: new Date()
          })
          .where(eq(onboardingSequences.id, sequenceId));
      }
    }
  }

  async completeOnboardingSequence(sequenceId: string): Promise<void> {
    await db
      .update(onboardingSequences)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(onboardingSequences.id, sequenceId));
  }
}

export const storage = new DatabaseStorage();
