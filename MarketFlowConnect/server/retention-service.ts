import { 
  type ClientRecord, 
  type RecruitRecord,
  type InsertClientRecord,
  type InsertRecruitRecord,
  type InsertRetentionCampaign,
  type InsertReferral,
  type InsertRecognitionAchievement,
  type InsertNpsSurvey,
  type InsertVipEliteClub,
  type RetentionCampaign,
  type Referral,
  type RecognitionAchievement,
  type NpsSurvey,
  type VipEliteClub,
  type OnboardingSequence,
  type CrmDeal,
  type Lead,
  type TeamMember,
  clientRecords,
  recruitRecords,
  retentionCampaigns,
  referrals,
  recognitionAchievements,
  npsSurveys,
  vipEliteClub,
  onboardingSequences,
  crmDeals
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, lt, gte, desc, asc } from "drizzle-orm";
import { emailService } from "./email-service";
import { smsService } from "./sms-service";

export interface RetentionMetrics {
  totalActiveClients: number;
  totalActiveRecruits: number;
  clientRetentionRate: number;
  recruitRetentionRate: number;
  avgClientLifetimeValue: number;
  totalReferralsSubmitted: number;
  referralConversionRate: number;
  npsScore: number;
  vipClubMembers: number;
}

export interface ReferralCampaignTemplate {
  type: 'client' | 'recruit';
  triggerDays: number;
  subject: string;
  incentive: string;
  template: string;
}

export interface RetentionService {
  // Client Record Management
  createClientRecord(onboardingSequence: OnboardingSequence, deal: CrmDeal, lead: Lead, advisor: TeamMember): Promise<ClientRecord>;
  createRecruitRecord(onboardingSequence: OnboardingSequence, deal: CrmDeal, lead: Lead, mentor: TeamMember): Promise<RecruitRecord>;
  
  // ===== INSURANCE/FINANCE CLIENT RETENTION AUTOMATIONS =====
  scheduleAnnualReviewReminders(): Promise<void>;
  scheduleBirthdayLifeEventCampaigns(): Promise<void>;
  scheduleCrossSellUpsellNudges(): Promise<void>;
  scheduleClientAnniversaryRecognition(): Promise<void>;
  
  // ===== CLIENT REFERRAL CAMPAIGN =====
  scheduleClientReferralCampaigns(): Promise<void>; // 30 days after onboarding
  processReferralSubmission(referralData: InsertReferral): Promise<Referral>;
  
  // ===== MLM RECRUIT RETENTION AUTOMATIONS =====
  sendWeeklyRecognitionEmail(): Promise<void>; // "This Week's Rising Stars ✨"
  processEngagementTracker(): Promise<void>; // 90-day inactive check
  scheduleOngoingTrainingDrip(): Promise<void>; // Monthly advanced modules
  processFastStartIncentives(): Promise<void>; // Reward 2 new members within 30 days
  
  // ===== RECRUIT REFERRAL/DUPLICATION ENGINE =====
  generateRecognitionAutomation(): Promise<void>; // Auto success shoutouts
  scheduleAnniversaryRecognition(): Promise<void>; // 1 year, 3 years certificates
  generateMonthlyLeaderboard(): Promise<void>; // Top 10 team builders
  awardPerformanceBadges(): Promise<void>; // Badge system
  
  // ===== SHARED ENHANCEMENTS =====
  scheduleNpsFeedbackSurveys(): Promise<void>; // Day 60 surveys
  processNpsSurveyResponses(): Promise<void>; // Handle responses and triggers
  automateTestimonialRequests(): Promise<void>; // Social proof automation
  manageVipEliteClub(): Promise<void>; // Track and manage VIP membership
  
  // Campaign Processing
  processScheduledRetentionCampaigns(): Promise<void>;
  
  // Analytics and Reporting
  getRetentionMetrics(): Promise<RetentionMetrics>;
  getTopPerformers(type: 'client' | 'recruit', period: 'monthly' | 'yearly'): Promise<any[]>;
}

export class FortuneFirstRetentionService implements RetentionService {
  
  // ==============================================
  // CLIENT/RECRUIT RECORD MANAGEMENT
  // ==============================================
  
  async createClientRecord(onboardingSequence: OnboardingSequence, deal: CrmDeal, lead: Lead, advisor: TeamMember): Promise<ClientRecord> {
    console.log(`🏠 Creating client record for ${lead.name} - ${deal.pipeline} client`);
    
    const policyStartDate = new Date();
    const anniversaryDate = new Date(policyStartDate.getFullYear() + 1, policyStartDate.getMonth(), policyStartDate.getDate());
    
    const clientData: InsertClientRecord = {
      leadId: lead.id,
      dealId: deal.id,
      onboardingSequenceId: onboardingSequence.id,
      advisorId: advisor.id,
      fullName: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      policyType: this.determinePolicyType(deal),
      policyValue: deal.value || 0,
      policyStartDate,
      anniversaryDate,
      premiumAmount: Math.round((deal.value || 0) * 0.01), // Estimate 1% of policy value as monthly premium
      lifetimeValue: deal.value || 0,
      eligibleProducts: this.determineEligibleProducts(deal.pipeline as string),
    };

    const [clientRecord] = await db
      .insert(clientRecords)
      .values(clientData)
      .returning();

    // Schedule initial retention campaigns
    await this.scheduleInitialClientCampaigns(clientRecord);
    
    console.log(`✅ Client record created: ${clientRecord.id} for ${lead.name}`);
    return clientRecord;
  }

  async createRecruitRecord(onboardingSequence: OnboardingSequence, deal: CrmDeal, lead: Lead, mentor: TeamMember): Promise<RecruitRecord> {
    console.log(`👥 Creating recruit record for ${lead.name} - MLM recruit`);
    
    const recruitData: InsertRecruitRecord = {
      leadId: lead.id,
      dealId: deal.id,
      onboardingSequenceId: onboardingSequence.id,
      mentorId: mentor.id,
      fullName: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      joinDate: new Date(),
      fastStartGoals: {
        salesGoal: 2000, // $20.00 in sales
        recruitGoal: 2, // 2 new recruits
        trainingGoal: 5, // 5 training modules
        achieved: false
      }
    };

    const [recruitRecord] = await db
      .insert(recruitRecords)
      .values(recruitData)
      .returning();

    // Schedule initial recruit campaigns
    await this.scheduleInitialRecruitCampaigns(recruitRecord);
    
    console.log(`✅ Recruit record created: ${recruitRecord.id} for ${lead.name}`);
    return recruitRecord;
  }

  // ==============================================
  // INSURANCE/FINANCE CLIENT RETENTION AUTOMATIONS
  // ==============================================
  
  async scheduleAnnualReviewReminders(): Promise<void> {
    console.log('📅 Scheduling annual review reminders...');
    
    // Get clients whose anniversary is coming up in 30 days
    const upcomingAnniversaries = await db
      .select()
      .from(clientRecords)
      .where(and(
        eq(clientRecords.status, 'active'),
        sql`anniversary_date BETWEEN NOW() + INTERVAL '25 days' AND NOW() + INTERVAL '35 days'`
      ));

    for (const client of upcomingAnniversaries) {
      const campaignData: InsertRetentionCampaign = {
        targetType: 'client',
        targetId: client.id,
        campaignType: 'anniversary',
        campaignName: 'Annual Policy Review Reminder',
        templateId: 'annual_review_reminder',
        subject: `${client.fullName.split(' ')[0]}, it's time to review your plan 📋`,
        triggerDate: new Date(),
        scheduledFor: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days from now
        personalizations: {
          firstName: client.fullName.split(' ')[0],
          policyType: client.policyType,
          anniversaryDate: client.anniversaryDate,
          premiumAmount: (client.premiumAmount || 0) / 100,
          advisorId: client.advisorId
        },
        channels: { email: true, sms: true }
      };

      await db.insert(retentionCampaigns).values(campaignData);
      console.log(`📋 Scheduled annual review for ${client.fullName}`);
    }
  }

  async scheduleBirthdayLifeEventCampaigns(): Promise<void> {
    console.log('🎂 Scheduling birthday and life event campaigns...');
    
    // Get clients with birthdays in the next 7 days
    const upcomingBirthdays = await db
      .select()
      .from(clientRecords)
      .where(and(
        eq(clientRecords.status, 'active'),
        sql`birthday IS NOT NULL AND EXTRACT(DOY FROM TO_DATE('2024-' || birthday, 'YYYY-MM-DD')) BETWEEN EXTRACT(DOY FROM NOW()) AND EXTRACT(DOY FROM NOW() + INTERVAL '7 days')`
      ));

    for (const client of upcomingBirthdays) {
      const campaignData: InsertRetentionCampaign = {
        targetType: 'client',
        targetId: client.id,
        campaignType: 'birthday',
        campaignName: 'Birthday Celebration & Policy Growth',
        templateId: 'birthday_celebration',
        subject: `Happy Birthday ${client.fullName.split(' ')[0]}! 🎉 See how your policy has grown`,
        triggerDate: new Date(),
        scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        personalizations: {
          firstName: client.fullName.split(' ')[0],
          policyGrowth: this.calculatePolicyGrowth(client),
          videoUrl: 'https://fortune-first.com/policy-growth-video',
          advisorId: client.advisorId
        },
        channels: { email: true, sms: false }
      };

      await db.insert(retentionCampaigns).values(campaignData);
      console.log(`🎂 Scheduled birthday campaign for ${client.fullName}`);
    }
  }

  async scheduleCrossSellUpsellNudges(): Promise<void> {
    console.log('💰 Scheduling cross-sell/upsell nudges...');
    
    // Get clients eligible for upselling (Term → Whole Life/IUL, Life → Retirement)
    const eligibleClients = await db
      .select()
      .from(clientRecords)
      .where(and(
        eq(clientRecords.status, 'active'),
        sql`jsonb_array_length(eligible_products) > 0`
      ));

    for (const client of eligibleClients) {
      // Determine the best upsell opportunity
      const upsellProduct = this.determineNextProduct(client);
      
      if (upsellProduct) {
        const campaignData: InsertRetentionCampaign = {
          targetType: 'client',
          targetId: client.id,
          campaignType: 'cross_sell',
          campaignName: `${upsellProduct.name} Upsell Opportunity`,
          templateId: 'cross_sell_upsell',
          subject: `${client.fullName.split(' ')[0]}, enhance your protection with ${upsellProduct.name}`,
          triggerDate: new Date(),
          scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
          personalizations: {
            firstName: client.fullName.split(' ')[0],
            currentPolicy: client.policyType,
            recommendedProduct: upsellProduct.name,
            benefits: upsellProduct.benefits,
            advisorId: client.advisorId
          },
          channels: { email: true, sms: false }
        };

        await db.insert(retentionCampaigns).values(campaignData);
        console.log(`💰 Scheduled ${upsellProduct.name} upsell for ${client.fullName}`);
      }
    }
  }

  async scheduleClientAnniversaryRecognition(): Promise<void> {
    console.log('🏆 Scheduling client anniversary recognition...');
    
    // Get clients with milestones (1, 3, 5, 10 year anniversaries)
    const milestoneClients = await db
      .select()
      .from(clientRecords)
      .where(and(
        eq(clientRecords.status, 'active'),
        sql`EXTRACT(YEAR FROM AGE(NOW(), policy_start_date)) IN (1, 3, 5, 10)`
      ));

    for (const client of milestoneClients) {
      const years = Math.floor((Date.now() - client.policyStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      
      const campaignData: InsertRetentionCampaign = {
        targetType: 'client',
        targetId: client.id,
        campaignType: 'recognition',
        campaignName: `${years} Year Client Anniversary Recognition`,
        templateId: 'client_anniversary_recognition',
        subject: `Celebrating ${years} years of partnership! 🎖️`,
        triggerDate: new Date(),
        scheduledFor: client.anniversaryDate,
        personalizations: {
          firstName: client.fullName.split(' ')[0],
          yearsWithUs: years,
          totalValue: client.lifetimeValue / 100,
          certificateUrl: `https://fortune-first.com/certificates/${client.id}/${years}`,
          advisorId: client.advisorId
        },
        channels: { email: true, sms: false }
      };

      await db.insert(retentionCampaigns).values(campaignData);
      
      // Create recognition achievement
      const achievementData: InsertRecognitionAchievement = {
        targetType: 'client',
        targetId: client.id,
        targetName: client.fullName,
        achievementType: 'anniversary',
        achievementId: `client_${years}_year_anniversary`,
        name: `${years} Year Partnership Award`,
        description: `Celebrating ${years} years of trust and financial security`,
        category: 'milestone',
        level: years >= 10 ? 'platinum' : years >= 5 ? 'gold' : years >= 3 ? 'silver' : 'bronze',
        points: years * 10
      };

      await db.insert(recognitionAchievements).values(achievementData);
      console.log(`🏆 Scheduled ${years}-year anniversary recognition for ${client.fullName}`);
    }
  }

  // ==============================================
  // CLIENT REFERRAL CAMPAIGN
  // ==============================================
  
  async scheduleClientReferralCampaigns(): Promise<void> {
    console.log('🤝 Scheduling client referral campaigns (30 days post-onboarding)...');
    
    // Get clients who completed onboarding 30 days ago
    const eligibleClients = await db
      .select({
        client: clientRecords,
        onboarding: onboardingSequences
      })
      .from(clientRecords)
      .innerJoin(onboardingSequences, eq(onboardingSequences.id, clientRecords.onboardingSequenceId))
      .where(and(
        eq(clientRecords.status, 'active'),
        eq(onboardingSequences.status, 'completed'),
        sql`onboarding_sequences.completed_at BETWEEN NOW() - INTERVAL '35 days' AND NOW() - INTERVAL '25 days'`
      ));

    for (const { client } of eligibleClients) {
      const campaignData: InsertRetentionCampaign = {
        targetType: 'client',
        targetId: client.id,
        campaignType: 'referral',
        campaignName: 'Client Referral Campaign - 30 Days Post-Onboarding',
        templateId: 'client_referral_30day',
        subject: `${client.fullName.split(' ')[0]}, do you know someone who could use peace of mind?`,
        triggerDate: new Date(),
        scheduledFor: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        personalizations: {
          firstName: client.fullName.split(' ')[0],
          referralIncentive: '$50 Amazon Gift Card or Charity Donation',
          referralFormUrl: `https://fortune-first.com/refer?client=${client.id}`,
          advisorId: client.advisorId
        },
        channels: { email: true, sms: false }
      };

      await db.insert(retentionCampaigns).values(campaignData);
      console.log(`🤝 Scheduled referral campaign for ${client.fullName}`);
    }
  }

  async processReferralSubmission(referralData: InsertReferral): Promise<Referral> {
    console.log(`📝 Processing referral submission from ${referralData.referrerName}`);
    
    const [referral] = await db
      .insert(referrals)
      .values(referralData)
      .returning();

    // Update referrer's referral count
    if (referralData.referrerType === 'client') {
      await db
        .update(clientRecords)
        .set({ 
          referralsSent: sql`referrals_sent + 1`,
          updatedAt: new Date()
        })
        .where(eq(clientRecords.id, referralData.referrerId));
    } else {
      await db
        .update(recruitRecords)
        .set({ 
          recruitmentsSent: sql`recruitments_sent + 1`,
          updatedAt: new Date()
        })
        .where(eq(recruitRecords.id, referralData.referrerId));
    }

    console.log(`✅ Referral submitted: ${referral.id} - ${referral.referredName}`);
    return referral;
  }

  // ==============================================
  // MLM RECRUIT RETENTION AUTOMATIONS
  // ==============================================
  
  async sendWeeklyRecognitionEmail(): Promise<void> {
    console.log('⭐ Sending weekly recognition email: "This Week\'s Rising Stars ✨"');
    
    // Get top performers this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const topRecruiters = await db
      .select()
      .from(recruitRecords)
      .where(and(
        eq(recruitRecords.status, 'active'),
        gte(recruitRecords.monthlyPersonalSales, 1000) // At least $10 in sales
      ))
      .orderBy(desc(recruitRecords.monthlyPersonalSales))
      .limit(10);

    const rankAdvancements = await db
      .select()
      .from(recruitRecords)
      .where(and(
        eq(recruitRecords.status, 'active'),
        sql`jsonb_array_length(rank_history) > 0`
      ));

    if (topRecruiters.length > 0 || rankAdvancements.length > 0) {
      // Send recognition email to all active recruits
      const allRecruits = await db
        .select()
        .from(recruitRecords)
        .where(eq(recruitRecords.status, 'active'));

      const recognitionData = {
        topPerformers: topRecruiters.slice(0, 5),
        rankAdvancements: rankAdvancements.filter(r => {
          const history = r.rankHistory || [];
          return history.length > 0 && 
            new Date(history[history.length - 1].achievedAt) >= weekAgo;
        }),
        weeklyStats: {
          totalSales: topRecruiters.reduce((sum, r) => sum + (r.monthlyPersonalSales || 0), 0) / 100,
          newRecruits: topRecruiters.reduce((sum, r) => sum + (r.personalRecruits || 0), 0)
        }
      };

      // Create recognition campaign for all recruits
      for (const recruit of allRecruits) {
        const campaignData: InsertRetentionCampaign = {
          targetType: 'recruit',
          targetId: recruit.id,
          campaignType: 'recognition',
          campaignName: 'Weekly Rising Stars Recognition',
          templateId: 'weekly_rising_stars',
          subject: '⭐ This Week\'s Rising Stars - Team Recognition',
          triggerDate: new Date(),
          scheduledFor: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
          personalizations: {
            firstName: recruit.fullName.split(' ')[0],
            topPerformers: recognitionData.topPerformers,
            rankAdvancements: recognitionData.rankAdvancements,
            weeklyStats: recognitionData.weeklyStats
          },
          channels: { email: true, sms: false }
        };

        await db.insert(retentionCampaigns).values(campaignData);
      }

      console.log(`⭐ Scheduled weekly recognition emails for ${allRecruits.length} recruits`);
    }
  }

  async processEngagementTracker(): Promise<void> {
    console.log('📊 Processing 90-day engagement tracker...');
    
    // Find recruits inactive for 30+ days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const inactiveRecruits = await db
      .select()
      .from(recruitRecords)
      .where(and(
        eq(recruitRecords.status, 'active'),
        sql`(last_login IS NULL OR last_login < ${thirtyDaysAgo.toISOString()}) 
            AND (last_sale IS NULL OR last_sale < ${thirtyDaysAgo.toISOString()})`
      ));

    for (const recruit of inactiveRecruits) {
      const daysSinceActivity = Math.floor((Date.now() - Math.max(
        recruit.lastLogin?.getTime() || 0,
        recruit.lastSale?.getTime() || 0
      )) / (24 * 60 * 60 * 1000));

      // Update inactivity days
      await db
        .update(recruitRecords)
        .set({ 
          inactivityDays: daysSinceActivity,
          engagementLevel: daysSinceActivity > 60 ? 'at_risk' : 'inactive',
          updatedAt: new Date()
        })
        .where(eq(recruitRecords.id, recruit.id));

      // Schedule reactivation campaign
      const campaignData: InsertRetentionCampaign = {
        targetType: 'recruit',
        targetId: recruit.id,
        campaignType: 'reactivation',
        campaignName: 'Recruit Reactivation Campaign',
        templateId: 'recruit_reactivation',
        subject: `${recruit.fullName.split(' ')[0]}, we miss you! Let's get back on track 🎯`,
        triggerDate: new Date(),
        scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        personalizations: {
          firstName: recruit.fullName.split(' ')[0],
          daysSinceActivity,
          mentorId: recruit.mentorId,
          reactivationIncentives: this.getReactivationIncentives()
        },
        channels: { email: true, sms: true }
      };

      await db.insert(retentionCampaigns).values(campaignData);
      console.log(`📊 Scheduled reactivation for ${recruit.fullName} (${daysSinceActivity} days inactive)`);
    }
  }

  async scheduleOngoingTrainingDrip(): Promise<void> {
    console.log('📚 Scheduling ongoing training drip campaigns...');
    
    // Get active recruits who haven't received training in 30 days
    const eligibleRecruits = await db
      .select()
      .from(recruitRecords)
      .where(and(
        eq(recruitRecords.status, 'active'),
        sql`last_training_completed IS NULL OR last_training_completed < NOW() - INTERVAL '25 days'`
      ));

    const trainingModules = [
      { module: 'advanced_social_media', name: 'Advanced Social Media Strategies', level: 'intermediate' },
      { module: 'leadership_development', name: 'Leadership Development', level: 'advanced' },
      { module: 'team_building', name: 'Effective Team Building', level: 'intermediate' },
      { module: 'presentation_mastery', name: 'Presentation Mastery', level: 'advanced' }
    ];

    for (const recruit of eligibleRecruits) {
      // Select appropriate training module based on rank
      const module = this.selectTrainingModule(recruit.currentRank || 'Associate', trainingModules);
      
      const campaignData: InsertRetentionCampaign = {
        targetType: 'recruit',
        targetId: recruit.id,
        campaignType: 'training',
        campaignName: `Monthly Training: ${module.name}`,
        templateId: 'ongoing_training_drip',
        subject: `📚 New Training Available: ${module.name}`,
        triggerDate: new Date(),
        scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        personalizations: {
          firstName: recruit.fullName.split(' ')[0],
          trainingModule: module.name,
          trainingLevel: module.level,
          trainingUrl: `https://fortune-first.com/training/${module.module}`,
          mentorId: recruit.mentorId
        },
        channels: { email: true, sms: false }
      };

      await db.insert(retentionCampaigns).values(campaignData);
      console.log(`📚 Scheduled ${module.name} training for ${recruit.fullName}`);
    }
  }

  async processFastStartIncentives(): Promise<void> {
    console.log('🚀 Processing Fast-Start incentives...');
    
    // Get new recruits (joined within last 30 days) who achieved fast start goals
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const newRecruits = await db
      .select()
      .from(recruitRecords)
      .where(and(
        eq(recruitRecords.status, 'active'),
        gte(recruitRecords.joinDate, thirtyDaysAgo),
        sql`fast_start_goals->>'achieved' = 'false'`
      ));

    for (const recruit of newRecruits) {
      const goals = recruit.fastStartGoals;
      if (!goals) continue;

      // Check if goals are met
      const salesGoalMet = (recruit.monthlyPersonalSales || 0) >= goals.salesGoal;
      const recruitGoalMet = (recruit.personalRecruits || 0) >= goals.recruitGoal;
      // Training goal would need to be checked from training system
      const trainingGoalMet = true; // Simplified for now

      if (salesGoalMet && recruitGoalMet && trainingGoalMet) {
        // Award Fast Start achievement
        const achievementData: InsertRecognitionAchievement = {
          targetType: 'recruit',
          targetId: recruit.id,
          targetName: recruit.fullName,
          achievementType: 'badge',
          achievementId: 'fast_start_champion',
          name: 'Fast Start Champion',
          description: 'Achieved all fast start goals within 30 days',
          category: 'milestone',
          level: 'gold',
          points: 100
        };

        await db.insert(recognitionAchievements).values(achievementData);

        // Update fast start goals as achieved
        await db
          .update(recruitRecords)
          .set({ 
            fastStartGoals: { ...goals, achieved: true, completedAt: new Date().toISOString() },
            updatedAt: new Date()
          })
          .where(eq(recruitRecords.id, recruit.id));

        // Schedule celebration campaign
        const campaignData: InsertRetentionCampaign = {
          targetType: 'recruit',
          targetId: recruit.id,
          campaignType: 'recognition',
          campaignName: 'Fast Start Champion Recognition',
          templateId: 'fast_start_champion',
          subject: `🚀 Congratulations ${recruit.fullName.split(' ')[0]}! Fast Start Champion Achieved!`,
          triggerDate: new Date(),
          scheduledFor: new Date(Date.now() + 1 * 60 * 60 * 1000),
          personalizations: {
            firstName: recruit.fullName.split(' ')[0],
            achievementName: 'Fast Start Champion',
            bonusAmount: 100, // $100 bonus
            certificateUrl: `https://fortune-first.com/certificates/${recruit.id}/fast-start`,
            mentorId: recruit.mentorId
          },
          channels: { email: true, sms: true }
        };

        await db.insert(retentionCampaigns).values(campaignData);
        console.log(`🚀 Fast Start Champion achieved by ${recruit.fullName}`);
      }
    }
  }

  // ==============================================
  // RECRUIT REFERRAL/DUPLICATION ENGINE
  // ==============================================
  
  async generateRecognitionAutomation(): Promise<void> {
    console.log('🎉 Generating recognition automation for success shoutouts...');
    
    // Find recent achievements worthy of recognition
    const recentAchievements = await db
      .select({
        achievement: recognitionAchievements,
        recruit: recruitRecords
      })
      .from(recognitionAchievements)
      .innerJoin(recruitRecords, eq(recruitRecords.id, recognitionAchievements.targetId))
      .where(and(
        eq(recognitionAchievements.targetType, 'recruit'),
        gte(recognitionAchievements.earnedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)), // Last 24 hours
        eq(recognitionAchievements.sharedInFeed, 0) // Not yet shared
      ));

    for (const { achievement, recruit } of recentAchievements) {
      // Generate success shoutout
      const shoutoutData: InsertRetentionCampaign = {
        targetType: 'recruit',
        targetId: recruit.id,
        campaignType: 'recognition',
        campaignName: 'Success Shoutout Automation',
        templateId: 'success_shoutout',
        subject: `🎉 Team Shoutout: ${recruit.fullName} achieved ${achievement.name}!`,
        triggerDate: new Date(),
        scheduledFor: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        personalizations: {
          achieverName: recruit.fullName,
          achievementName: achievement.name,
          achievementDescription: achievement.description,
          teamMessage: this.generateTeamMessage(achievement)
        },
        channels: { email: true, sms: false }
      };

      await db.insert(retentionCampaigns).values(campaignData);

      // Mark as shared in feed
      await db
        .update(recognitionAchievements)
        .set({ sharedInFeed: 1 })
        .where(eq(recognitionAchievements.id, achievement.id));

      console.log(`🎉 Scheduled success shoutout for ${recruit.fullName} - ${achievement.name}`);
    }
  }

  async scheduleAnniversaryRecognition(): Promise<void> {
    console.log('🎖️ Scheduling anniversary recognition (1 year, 3 years)...');
    
    // Get recruits with 1 or 3 year anniversaries
    const anniversaryRecruits = await db
      .select()
      .from(recruitRecords)
      .where(and(
        eq(recruitRecords.status, 'active'),
        sql`EXTRACT(YEAR FROM AGE(NOW(), join_date)) IN (1, 3)`
      ));

    for (const recruit of anniversaryRecruits) {
      const years = Math.floor((Date.now() - recruit.joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      
      // Create anniversary achievement
      const achievementData: InsertRecognitionAchievement = {
        targetType: 'recruit',
        targetId: recruit.id,
        targetName: recruit.fullName,
        achievementType: 'anniversary',
        achievementId: `recruit_${years}_year_anniversary`,
        name: `${years} Year Team Member`,
        description: `Celebrating ${years} years of dedication and team building`,
        category: 'milestone',
        level: years >= 3 ? 'gold' : 'silver',
        points: years * 25
      };

      await db.insert(recognitionAchievements).values(achievementData);

      // Schedule anniversary campaign
      const campaignData: InsertRetentionCampaign = {
        targetType: 'recruit',
        targetId: recruit.id,
        campaignType: 'recognition',
        campaignName: `${years} Year Anniversary Recognition`,
        templateId: 'recruit_anniversary_recognition',
        subject: `🎖️ Celebrating ${years} years with Fortune First!`,
        triggerDate: new Date(),
        scheduledFor: recruit.joinDate,
        personalizations: {
          firstName: recruit.fullName.split(' ')[0],
          yearsWithTeam: years,
          totalRecruits: recruit.personalRecruits,
          totalSales: (recruit.totalPersonalSales || 0) / 100,
          certificateUrl: `https://fortune-first.com/certificates/${recruit.id}/${years}-years`,
          mentorId: recruit.mentorId
        },
        channels: { email: true, sms: false }
      };

      await db.insert(retentionCampaigns).values(campaignData);
      console.log(`🎖️ Scheduled ${years}-year anniversary recognition for ${recruit.fullName}`);
    }
  }

  async generateMonthlyLeaderboard(): Promise<void> {
    console.log('🏆 Generating monthly "Top 10 Team Builders" leaderboard...');
    
    // Get top 10 team builders for the month
    const topTeamBuilders = await db
      .select()
      .from(recruitRecords)
      .where(eq(recruitRecords.status, 'active'))
      .orderBy(
        desc(recruitRecords.personalRecruits),
        desc(recruitRecords.monthlyTeamSales)
      )
      .limit(10);

    if (topTeamBuilders.length > 0) {
      const leaderboardData = {
        month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        topBuilders: topTeamBuilders.map((recruit, index) => ({
          rank: index + 1,
          name: recruit.fullName,
          recruits: recruit.personalRecruits,
          teamSales: (recruit.monthlyTeamSales || 0) / 100,
          rank: recruit.currentRank
        }))
      };

      // Send leaderboard to all active recruits
      const allRecruits = await db
        .select()
        .from(recruitRecords)
        .where(eq(recruitRecords.status, 'active'));

      for (const recruit of allRecruits) {
        const campaignData: InsertRetentionCampaign = {
          targetType: 'recruit',
          targetId: recruit.id,
          campaignType: 'recognition',
          campaignName: 'Monthly Top 10 Team Builders Leaderboard',
          templateId: 'monthly_leaderboard',
          subject: `🏆 ${leaderboardData.month} Top 10 Team Builders`,
          triggerDate: new Date(),
          scheduledFor: new Date(Date.now() + 1 * 60 * 60 * 1000),
          personalizations: {
            firstName: recruit.fullName.split(' ')[0],
            leaderboard: leaderboardData,
            yourRank: this.findRankInList(recruit, topTeamBuilders) || 'Not in Top 10'
          },
          channels: { email: true, sms: false }
        };

        await db.insert(retentionCampaigns).values(campaignData);
      }

      console.log(`🏆 Generated monthly leaderboard for ${allRecruits.length} recruits`);
    }
  }

  async awardPerformanceBadges(): Promise<void> {
    console.log('🏅 Awarding performance-based badges...');
    
    const badges = [
      {
        id: 'sales_champion_1k',
        name: 'Sales Champion - $1K',
        criteria: { monthlyPersonalSales: 100000 }, // $1000
        description: 'Achieved $1,000 in personal sales',
        level: 'bronze' as const
      },
      {
        id: 'team_builder_5',
        name: 'Team Builder - 5 Recruits',
        criteria: { personalRecruits: 5 },
        description: 'Successfully recruited 5 team members',
        level: 'silver' as const
      },
      {
        id: 'leader_10k_team',
        name: 'Team Leader - $10K Team',
        criteria: { monthlyTeamSales: 1000000 }, // $10,000
        description: 'Led team to $10,000 in monthly sales',
        level: 'gold' as const
      }
    ];

    const eligibleRecruits = await db
      .select()
      .from(recruitRecords)
      .where(eq(recruitRecords.status, 'active'));

    for (const recruit of eligibleRecruits) {
      for (const badge of badges) {
        const meetsRequirement = Object.entries(badge.criteria).every(([key, value]) => {
          const recruitValue = (recruit as any)[key] || 0;
          return recruitValue >= value;
        });

        if (meetsRequirement) {
          // Check if badge already awarded
          const existingBadge = await db
            .select()
            .from(recognitionAchievements)
            .where(and(
              eq(recognitionAchievements.targetType, 'recruit'),
              eq(recognitionAchievements.targetId, recruit.id),
              eq(recognitionAchievements.achievementId, badge.id)
            ))
            .limit(1);

          if (existingBadge.length === 0) {
            // Award new badge
            const achievementData: InsertRecognitionAchievement = {
              targetType: 'recruit',
              targetId: recruit.id,
              targetName: recruit.fullName,
              achievementType: 'badge',
              achievementId: badge.id,
              name: badge.name,
              description: badge.description,
              category: 'sales',
              level: badge.level,
              points: badge.level === 'gold' ? 50 : badge.level === 'silver' ? 30 : 20
            };

            await db.insert(recognitionAchievements).values(achievementData);

            // Update recruit badge count
            await db
              .update(recruitRecords)
              .set({ 
                totalBadges: sql`total_badges + 1`,
                updatedAt: new Date()
              })
              .where(eq(recruitRecords.id, recruit.id));

            console.log(`🏅 Awarded ${badge.name} to ${recruit.fullName}`);
          }
        }
      }
    }
  }

  // ==============================================
  // SHARED ENHANCEMENTS
  // ==============================================
  
  async scheduleNpsFeedbackSurveys(): Promise<void> {
    console.log('📊 Scheduling NPS/feedback surveys (Day 60)...');
    
    // Get clients and recruits who are 60 days post-onboarding
    const eligibleForSurvey = await Promise.all([
      // Client surveys
      db.select({
        type: sql<'client'>`'client'`,
        record: clientRecords,
        onboarding: onboardingSequences
      })
      .from(clientRecords)
      .innerJoin(onboardingSequences, eq(onboardingSequences.id, clientRecords.onboardingSequenceId))
      .where(and(
        eq(clientRecords.status, 'active'),
        eq(onboardingSequences.status, 'completed'),
        sql`onboarding_sequences.completed_at BETWEEN NOW() - INTERVAL '65 days' AND NOW() - INTERVAL '55 days'`
      )),
      
      // Recruit surveys
      db.select({
        type: sql<'recruit'>`'recruit'`,
        record: recruitRecords,
        onboarding: onboardingSequences
      })
      .from(recruitRecords)
      .innerJoin(onboardingSequences, eq(onboardingSequences.id, recruitRecords.onboardingSequenceId))
      .where(and(
        eq(recruitRecords.status, 'active'),
        eq(onboardingSequences.status, 'completed'),
        sql`onboarding_sequences.completed_at BETWEEN NOW() - INTERVAL '65 days' AND NOW() - INTERVAL '55 days'`
      ))
    ]);

    const allEligible = [...eligibleForSurvey[0], ...eligibleForSurvey[1]];

    for (const { type, record } of allEligible) {
      const surveyData: InsertNpsSurvey = {
        targetType: type,
        targetId: record.id,
        targetName: type === 'client' ? (record as ClientRecord).fullName : (record as RecruitRecord).fullName,
        targetEmail: type === 'client' ? (record as ClientRecord).email : (record as RecruitRecord).email,
        surveyType: 'day_60',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // Expires in 2 weeks
      };

      const [survey] = await db.insert(npsSurveys).values(surveyData).returning();

      // Schedule survey campaign
      const campaignData: InsertRetentionCampaign = {
        targetType: type,
        targetId: record.id,
        campaignType: 'feedback',
        campaignName: '60-Day Experience Survey',
        templateId: 'nps_day_60_survey',
        subject: `${record.fullName.split(' ')[0]}, how are we doing? 📊`,
        triggerDate: new Date(),
        scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        personalizations: {
          firstName: record.fullName.split(' ')[0],
          surveyUrl: `https://fortune-first.com/survey/${survey.id}`,
          surveyType: '60-Day Experience',
          advisorId: type === 'client' ? (record as ClientRecord).advisorId : (record as RecruitRecord).mentorId
        },
        channels: { email: true, sms: false }
      };

      await db.insert(retentionCampaigns).values(campaignData);
      console.log(`📊 Scheduled 60-day survey for ${record.fullName}`);
    }
  }

  async processNpsSurveyResponses(): Promise<void> {
    console.log('📈 Processing NPS survey responses...');
    
    // Get completed surveys that haven't been processed
    const completedSurveys = await db
      .select()
      .from(npsSurveys)
      .where(and(
        eq(npsSurveys.status, 'completed'),
        eq(npsSurveys.followUpCompleted, 0)
      ));

    for (const survey of completedSurveys) {
      if (survey.npsScore === null) continue;

      const score = survey.npsScore;
      const category = score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor';

      // Update survey with calculated category
      await db
        .update(npsSurveys)
        .set({ 
          npsCategory: category,
          updatedAt: new Date()
        })
        .where(eq(npsSurveys.id, survey.id));

      // Process based on score
      if (score >= 8) {
        // High score → trigger referral invite
        const referralCampaignData: InsertRetentionCampaign = {
          targetType: survey.targetType,
          targetId: survey.targetId,
          campaignType: 'referral',
          campaignName: 'NPS-Triggered Referral Invitation',
          templateId: 'nps_referral_invite',
          subject: `${survey.targetName.split(' ')[0]}, help others experience what you have! 🌟`,
          triggerDate: new Date(),
          scheduledFor: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          personalizations: {
            firstName: survey.targetName.split(' ')[0],
            npsScore: score,
            referralIncentive: '$75 bonus for high-satisfaction referrals',
            referralFormUrl: `https://fortune-first.com/refer?source=nps&score=${score}`
          },
          channels: { email: true, sms: false }
        };

        await db.insert(retentionCampaigns).values(referralCampaignData);
        console.log(`🌟 Triggered referral invite for ${survey.targetName} (NPS: ${score})`);

      } else if (score <= 6) {
        // Low score → escalate to advisor
        const escalationCampaignData: InsertRetentionCampaign = {
          targetType: survey.targetType,
          targetId: survey.targetId,
          campaignType: 'escalation',
          campaignName: 'Low NPS Score Escalation',
          templateId: 'nps_low_score_escalation',
          subject: `🚨 Low NPS Alert: ${survey.targetName} (Score: ${score})`,
          triggerDate: new Date(),
          scheduledFor: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
          personalizations: {
            targetName: survey.targetName,
            npsScore: score,
            feedback: survey.feedback || 'No feedback provided',
            urgentFollowUp: true
          },
          channels: { email: true, sms: true }
        };

        await db.insert(retentionCampaigns).values(escalationCampaignData);
        console.log(`🚨 Escalated low NPS score for ${survey.targetName} (Score: ${score})`);
      }

      // Mark follow-up as completed
      await db
        .update(npsSurveys)
        .set({ 
          followUpCompleted: 1,
          followUpCompletedAt: new Date()
        })
        .where(eq(npsSurveys.id, survey.id));
    }
  }

  async automateTestimonialRequests(): Promise<void> {
    console.log('💬 Automating testimonial requests for social proof...');
    
    // Get high-satisfaction clients and recruits (NPS 8+)
    const highSatisfactionTargets = await db
      .select()
      .from(npsSurveys)
      .where(and(
        eq(npsSurveys.status, 'completed'),
        gte(npsSurveys.npsScore, 8),
        sql`created_at >= NOW() - INTERVAL '30 days'` // Recent surveys only
      ));

    for (const survey of highSatisfactionTargets) {
      // Check if we've already requested testimonial
      const existingRequest = await db
        .select()
        .from(retentionCampaigns)
        .where(and(
          eq(retentionCampaigns.targetType, survey.targetType),
          eq(retentionCampaigns.targetId, survey.targetId),
          eq(retentionCampaigns.campaignType, 'testimonial_request')
        ))
        .limit(1);

      if (existingRequest.length === 0) {
        const campaignData: InsertRetentionCampaign = {
          targetType: survey.targetType,
          targetId: survey.targetId,
          campaignType: 'testimonial_request',
          campaignName: 'Testimonial Request - High Satisfaction',
          templateId: 'testimonial_request',
          subject: `${survey.targetName.split(' ')[0]}, would you share your success story? ⭐`,
          triggerDate: new Date(),
          scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
          personalizations: {
            firstName: survey.targetName.split(' ')[0],
            npsScore: survey.npsScore,
            testimonialFormUrl: `https://fortune-first.com/testimonial?survey=${survey.id}`,
            incentive: '$25 gift card for approved testimonial'
          },
          channels: { email: true, sms: false }
        };

        await db.insert(retentionCampaigns).values(campaignData);
        console.log(`💬 Scheduled testimonial request for ${survey.targetName}`);
      }
    }
  }

  async manageVipEliteClub(): Promise<void> {
    console.log('👑 Managing VIP Elite Club membership...');
    
    // Qualify new VIP clients (3+ products OR $50K+ lifetime value)
    const qualifiedClients = await db
      .select()
      .from(clientRecords)
      .where(and(
        eq(clientRecords.status, 'active'),
        sql`(jsonb_array_length(eligible_products) >= 3 OR lifetime_value >= 5000000)` // $50K
      ));

    for (const client of qualifiedClients) {
      // Check if already a VIP member
      const existingMembership = await db
        .select()
        .from(vipEliteClub)
        .where(and(
          eq(vipEliteClub.memberType, 'client'),
          eq(vipEliteClub.memberId, client.id),
          eq(vipEliteClub.status, 'active')
        ))
        .limit(1);

      if (existingMembership.length === 0) {
        const membershipData: InsertVipEliteClub = {
          memberType: 'client',
          memberId: client.id,
          memberName: client.fullName,
          memberEmail: client.email,
          clubType: 'vip_client',
          qualificationCriteria: [
            {
              requirement: 'Lifetime Value',
              value: client.lifetimeValue / 100,
              achieved: (client.lifetimeValue || 0) >= 5000000
            },
            {
              requirement: 'Multiple Products',
              value: (client.eligibleProducts || []).length,
              achieved: (client.eligibleProducts || []).length >= 3
            }
          ],
          renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        };

        await db.insert(vipEliteClub).values(membershipData);

        // Send VIP welcome campaign
        const welcomeCampaignData: InsertRetentionCampaign = {
          targetType: 'client',
          targetId: client.id,
          campaignType: 'vip_welcome',
          campaignName: 'VIP Elite Club Welcome',
          templateId: 'vip_club_welcome',
          subject: `👑 Welcome to Fortune First VIP Elite Club, ${client.fullName.split(' ')[0]}!`,
          triggerDate: new Date(),
          scheduledFor: new Date(Date.now() + 1 * 60 * 60 * 1000),
          personalizations: {
            firstName: client.fullName.split(' ')[0],
            clubType: 'VIP Client',
            exclusiveBenefits: this.getVipBenefits(),
            vipPortalUrl: `https://fortune-first.com/vip/${client.id}`
          },
          channels: { email: true, sms: false }
        };

        await db.insert(retentionCampaigns).values(welcomeCampaignData);
        console.log(`👑 Added ${client.fullName} to VIP Elite Club`);
      }
    }

    // Qualify elite producers (recruits with consistent monthly sales)
    const eliteProducers = await db
      .select()
      .from(recruitRecords)
      .where(and(
        eq(recruitRecords.status, 'active'),
        gte(recruitRecords.monthlyPersonalSales, 500000) // $5K monthly
      ));

    for (const recruit of eliteProducers) {
      const existingMembership = await db
        .select()
        .from(vipEliteClub)
        .where(and(
          eq(vipEliteClub.memberType, 'recruit'),
          eq(vipEliteClub.memberId, recruit.id),
          eq(vipEliteClub.status, 'active')
        ))
        .limit(1);

      if (existingMembership.length === 0) {
        const membershipData: InsertVipEliteClub = {
          memberType: 'recruit',
          memberId: recruit.id,
          memberName: recruit.fullName,
          memberEmail: recruit.email,
          clubType: 'elite_producer',
          qualificationCriteria: [
            {
              requirement: 'Monthly Personal Sales',
              value: (recruit.monthlyPersonalSales || 0) / 100,
              achieved: (recruit.monthlyPersonalSales || 0) >= 500000
            }
          ],
          renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        };

        await db.insert(vipEliteClub).values(membershipData);
        console.log(`🏆 Added ${recruit.fullName} to Elite Producer Club`);
      }
    }
  }

  // ==============================================
  // CAMPAIGN PROCESSING
  // ==============================================
  
  async processScheduledRetentionCampaigns(): Promise<void> {
    console.log('⚡ Processing scheduled retention campaigns...');
    
    const now = new Date();
    const scheduledCampaigns = await db
      .select()
      .from(retentionCampaigns)
      .where(and(
        eq(retentionCampaigns.status, 'scheduled'),
        lt(retentionCampaigns.scheduledFor, now)
      ));

    console.log(`Found ${scheduledCampaigns.length} campaigns ready to send`);

    for (const campaign of scheduledCampaigns) {
      try {
        await this.executeCampaign(campaign);
        
        // Mark as sent
        await db
          .update(retentionCampaigns)
          .set({ 
            status: 'sent',
            sentAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(retentionCampaigns.id, campaign.id));
          
        console.log(`📧 Sent campaign: ${campaign.campaignName} to ${campaign.targetType} ${campaign.targetId}`);
        
      } catch (error) {
        console.error(`❌ Failed to send campaign ${campaign.id}:`, error);
        
        // Mark as failed
        await db
          .update(retentionCampaigns)
          .set({ 
            status: 'failed',
            updatedAt: new Date()
          })
          .where(eq(retentionCampaigns.id, campaign.id));
      }
    }
  }

  // ==============================================
  // ANALYTICS AND REPORTING
  // ==============================================
  
  async getRetentionMetrics(): Promise<RetentionMetrics> {
    console.log('📊 Generating retention metrics...');
    
    const [
      activeClients,
      activeRecruits,
      totalReferrals,
      convertedReferrals,
      avgNpsScore,
      vipMembers
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clientRecords).where(eq(clientRecords.status, 'active')),
      db.select({ count: sql<number>`count(*)` }).from(recruitRecords).where(eq(recruitRecords.status, 'active')),
      db.select({ count: sql<number>`count(*)` }).from(referrals),
      db.select({ count: sql<number>`count(*)` }).from(referrals).where(eq(referrals.status, 'converted')),
      db.select({ avg: sql<number>`avg(nps_score)` }).from(npsSurveys).where(sql`nps_score IS NOT NULL`),
      db.select({ count: sql<number>`count(*)` }).from(vipEliteClub).where(eq(vipEliteClub.status, 'active'))
    ]);

    const totalReferralsCount = totalReferrals[0]?.count || 0;
    const convertedReferralsCount = convertedReferrals[0]?.count || 0;

    return {
      totalActiveClients: activeClients[0]?.count || 0,
      totalActiveRecruits: activeRecruits[0]?.count || 0,
      clientRetentionRate: 92.5, // Would calculate from actual data
      recruitRetentionRate: 78.3, // Would calculate from actual data
      avgClientLifetimeValue: 75000, // Would calculate from actual data
      totalReferralsSubmitted: totalReferralsCount,
      referralConversionRate: totalReferralsCount > 0 ? (convertedReferralsCount / totalReferralsCount) * 100 : 0,
      npsScore: avgNpsScore[0]?.avg || 0,
      vipClubMembers: vipMembers[0]?.count || 0
    };
  }

  async getTopPerformers(type: 'client' | 'recruit', period: 'monthly' | 'yearly'): Promise<any[]> {
    if (type === 'client') {
      return await db
        .select()
        .from(clientRecords)
        .where(eq(clientRecords.status, 'active'))
        .orderBy(desc(clientRecords.lifetimeValue))
        .limit(10);
    } else {
      return await db
        .select()
        .from(recruitRecords)
        .where(eq(recruitRecords.status, 'active'))
        .orderBy(
          desc(recruitRecords.monthlyPersonalSales),
          desc(recruitRecords.personalRecruits)
        )
        .limit(10);
    }
  }

  // ==============================================
  // HELPER METHODS
  // ==============================================
  
  private async scheduleInitialClientCampaigns(client: ClientRecord): Promise<void> {
    // Schedule 30-day referral campaign
    const referralDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const referralCampaign: InsertRetentionCampaign = {
      targetType: 'client',
      targetId: client.id,
      campaignType: 'referral',
      campaignName: 'Initial 30-Day Referral Campaign',
      templateId: 'client_referral_30day',
      subject: `${client.fullName.split(' ')[0]}, do you know someone who could use peace of mind?`,
      triggerDate: new Date(),
      scheduledFor: referralDate,
      personalizations: {
        firstName: client.fullName.split(' ')[0],
        referralIncentive: '$50 Amazon Gift Card or Charity Donation'
      },
      channels: { email: true, sms: false }
    };

    await db.insert(retentionCampaigns).values(referralCampaign);
  }

  private async scheduleInitialRecruitCampaigns(recruit: RecruitRecord): Promise<void> {
    // Schedule fast start tracking
    const fastStartCheck = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
    
    const fastStartCampaign: InsertRetentionCampaign = {
      targetType: 'recruit',
      targetId: recruit.id,
      campaignType: 'training',
      campaignName: 'Fast Start Progress Check',
      templateId: 'fast_start_check',
      subject: `${recruit.fullName.split(' ')[0]}, how's your Fast Start journey going? 🚀`,
      triggerDate: new Date(),
      scheduledFor: fastStartCheck,
      personalizations: {
        firstName: recruit.fullName.split(' ')[0],
        goalsRemaining: 'Sales, Recruitment, Training'
      },
      channels: { email: true, sms: true }
    };

    await db.insert(retentionCampaigns).values(fastStartCampaign);
  }

  private determinePolicyType(deal: CrmDeal): 'term_life' | 'whole_life' | 'iul' | 'annuity' | 'retirement' {
    // Logic to determine policy type from deal
    const dealTitle = deal.title.toLowerCase();
    if (dealTitle.includes('whole life')) return 'whole_life';
    if (dealTitle.includes('iul')) return 'iul';
    if (dealTitle.includes('annuity')) return 'annuity';
    if (dealTitle.includes('retirement')) return 'retirement';
    return 'term_life'; // Default
  }

  private determineEligibleProducts(pipeline: string): string[] {
    if (pipeline === 'insurance') {
      return ['whole_life', 'iul', 'annuity', 'retirement_planning', 'estate_planning'];
    }
    return [];
  }

  private calculatePolicyGrowth(client: ClientRecord): string {
    // Simulate policy growth calculation
    const monthsActive = Math.floor((Date.now() - client.policyStartDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
    const growth = Math.round(monthsActive * 0.5); // 0.5% growth per month
    return `${growth}%`;
  }

  private determineNextProduct(client: ClientRecord): { name: string; benefits: string[] } | null {
    const current = client.policyType;
    const eligible = client.eligibleProducts || [];
    
    if (current === 'term_life' && eligible.includes('whole_life')) {
      return {
        name: 'Whole Life Insurance',
        benefits: ['Permanent coverage', 'Cash value growth', 'Fixed premiums', 'Tax advantages']
      };
    }
    
    if ((current === 'term_life' || current === 'whole_life') && eligible.includes('retirement_planning')) {
      return {
        name: 'Retirement Planning',
        benefits: ['Guaranteed income', 'Tax-deferred growth', 'Legacy planning', 'Market protection']
      };
    }
    
    return null;
  }

  private getReactivationIncentives(): string[] {
    return [
      'Free 1:1 mentoring session',
      'Exclusive training materials',
      'Fast track to next rank bonus',
      'Personal success planning call'
    ];
  }

  private selectTrainingModule(rank: string, modules: any[]): any {
    // Select appropriate module based on rank
    if (['Manager', 'Senior Manager', 'Director'].includes(rank)) {
      return modules.find(m => m.level === 'advanced') || modules[0];
    }
    return modules.find(m => m.level === 'intermediate') || modules[0];
  }

  private generateTeamMessage(achievement: RecognitionAchievement): string {
    return `🎉 Huge congratulations to ${achievement.targetName} for achieving ${achievement.name}! ${achievement.description} Keep up the amazing work! #TeamSuccess #Inspiration`;
  }

  private findRankInList(recruit: RecruitRecord, topList: RecruitRecord[]): number | null {
    const index = topList.findIndex(r => r.id === recruit.id);
    return index >= 0 ? index + 1 : null;
  }

  private getVipBenefits(): string[] {
    return [
      'Priority customer service',
      'Exclusive product access',
      'Enhanced rewards program',
      'VIP-only events and webinars',
      'Personalized financial planning',
      'Complimentary annual review'
    ];
  }

  private async executeCampaign(campaign: RetentionCampaign): Promise<void> {
    // This would integrate with actual email/SMS services
    console.log(`Executing campaign: ${campaign.campaignName}`);
    console.log(`Template: ${campaign.templateId}`);
    console.log(`Subject: ${campaign.subject}`);
    console.log(`Personalizations:`, campaign.personalizations);
    
    // Simulated email/SMS sending
    if (campaign.channels?.email) {
      console.log(`📧 Sending email via ${campaign.templateId} template`);
    }
    
    if (campaign.channels?.sms) {
      console.log(`📱 Sending SMS notification`);
    }
  }
}

export const retentionService = new FortuneFirstRetentionService();