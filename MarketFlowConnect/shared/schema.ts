import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, index, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  source: text("source").notNull(), // 'quiz', 'insurance', 'retirement', 'recruiting', 'newsletter'
  interests: jsonb("interests").$type<string[]>().default([]),
  quizAnswers: jsonb("quiz_answers").$type<Record<string, string>>(),
  employmentStatus: text("employment_status"),
  // ActiveCampaign integration fields
  tags: jsonb("tags").$type<string[]>().default([]),
  leadScore: integer("lead_score").default(0),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  activeCampaignId: text("activecampaign_id"),
  // Nurture Journey fields
  nurtureStage: text("nurture_stage").default("NewLead"), // NewLead, Nurturing, Engaged, Hot, Warm, Cold
  nurtureJourneyType: text("nurture_journey_type"), // 'prospect' | 'recruit'
  nurtureStartedAt: timestamp("nurture_started_at"),
  lastNurtureEmail: text("last_nurture_email"),
  nurtureEmailsSent: jsonb("nurture_emails_sent").$type<string[]>().default([]),
  scheduledEmails: jsonb("scheduled_emails").$type<Array<{emailId: string, scheduledFor: string}>>().default([]),
  engagementEvents: jsonb("engagement_events").$type<Array<{eventType: string, timestamp: string, points: number}>>().default([]),
  lastEngagement: timestamp("last_engagement").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sourceIdx: index("leads_source_idx").on(table.source),
  nurtureStageIdx: index("leads_nurture_stage_idx").on(table.nurtureStage),
}));

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  nurtureStage: true,
  nurtureJourneyType: true,
  nurtureStartedAt: true,
  lastNurtureEmail: true,
  nurtureEmailsSent: true,
  scheduledEmails: true,
  engagementEvents: true,
  lastEngagement: true,
}).extend({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
  source: z.enum(['quiz', 'insurance', 'retirement', 'recruiting', 'newsletter']),
  interests: z.array(z.string()).optional(),
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  subscribed: timestamp("subscribed").defaultNow(),
});

export const insertNewsletterSchema = createInsertSchema(newsletterSubscribers).omit({
  id: true,
  subscribed: true,
}).extend({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
});

export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type Newsletter = typeof newsletterSubscribers.$inferSelect;

// Team Members table - for lead routing and assignment
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  role: text("role").notNull(), // 'advisor' | 'recruiter' | 'manager'
  department: text("department").notNull(), // 'insurance' | 'recruiting'
  territories: jsonb("territories").$type<string[]>().default([]), // States/regions assigned
  specializations: jsonb("specializations").$type<string[]>().default([]), // Product specializations
  maxLeadsPerDay: integer("max_leads_per_day").default(10),
  currentLeadCount: integer("current_lead_count").default(0),
  isActive: integer("is_active").default(1), // Boolean as integer: 1=active, 0=inactive
  lastAssignedAt: timestamp("last_assigned_at"),
  notificationPreferences: jsonb("notification_preferences").$type<{
    email: boolean;
    sms: boolean;
    slack: boolean;
  }>().default({ email: true, sms: true, slack: false }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  roleIdx: index("team_members_role_idx").on(table.role),
  departmentIdx: index("team_members_department_idx").on(table.department),
  isActiveIdx: index("team_members_is_active_idx").on(table.isActive),
}));

// CRM Deals table - for pipeline management
export const crmDeals = pgTable("crm_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  assignedToId: varchar("assigned_to_id").notNull().references(() => teamMembers.id),
  title: text("title").notNull(),
  pipeline: text("pipeline").notNull(), // 'insurance' | 'recruiting'
  stage: text("stage").notNull(),
  value: integer("value").default(0), // Potential deal value in cents
  priority: text("priority").default("medium"), // 'low' | 'medium' | 'high'
  source: text("source").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  notes: text("notes"),
  nextFollowupDate: timestamp("next_followup_date"),
  lastContactedAt: timestamp("last_contacted_at"),
  dealStageHistory: jsonb("deal_stage_history").$type<Array<{
    stage: string;
    timestamp: string;
    notes?: string;
  }>>().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  status: text("status").default("active"), // 'active' | 'won' | 'lost' | 'paused'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  leadIdx: index("crm_deals_lead_idx").on(table.leadId),
  assignedIdx: index("crm_deals_assigned_idx").on(table.assignedToId),
  pipelineIdx: index("crm_deals_pipeline_idx").on(table.pipeline),
  stageIdx: index("crm_deals_stage_idx").on(table.stage),
  statusIdx: index("crm_deals_status_idx").on(table.status),
  nextFollowupIdx: index("crm_deals_next_followup_idx").on(table.nextFollowupDate),
}));

// Lead Assignments table - for tracking lead ownership and routing
export const leadAssignments = pgTable("lead_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  assignedToId: varchar("assigned_to_id").notNull().references(() => teamMembers.id),
  assignedById: varchar("assigned_by_id").references(() => teamMembers.id), // Who assigned it (can be null for auto-assignment)
  assignmentReason: text("assignment_reason").notNull(), // 'territory' | 'round_robin' | 'manual' | 'escalation'
  priority: text("priority").default("normal"), // 'low' | 'normal' | 'high' | 'urgent'
  status: text("status").default("assigned"), // 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'reassigned'
  responseDeadline: timestamp("response_deadline").notNull(),
  firstContactedAt: timestamp("first_contacted_at"),
  lastContactedAt: timestamp("last_contacted_at"),
  contactAttempts: integer("contact_attempts").default(0),
  escalationLevel: integer("escalation_level").default(0), // 0=no escalation, 1=first level, etc.
  escalatedAt: timestamp("escalated_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  leadIdx: index("lead_assignments_lead_idx").on(table.leadId),
  assignedIdx: index("lead_assignments_assigned_idx").on(table.assignedToId),
  statusIdx: index("lead_assignments_status_idx").on(table.status),
  deadlineIdx: index("lead_assignments_deadline_idx").on(table.responseDeadline),
  escalationIdx: index("lead_assignments_escalation_idx").on(table.escalationLevel),
}));

// Routing Counters table - for round-robin implementation
export const routingCounters = pgTable("routing_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  department: text("department").notNull(), // 'insurance' | 'recruiting'
  routingType: text("routing_type").notNull(), // 'round_robin' | 'territory'
  lastAssignedMemberId: varchar("last_assigned_member_id").references(() => teamMembers.id),
  assignmentCount: integer("assignment_count").default(0),
  resetDate: timestamp("reset_date").defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  departmentTypeIdx: index("routing_counters_dept_type_idx").on(table.department, table.routingType),
}));

// Insert schemas for new tables
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
  currentLeadCount: true,
  lastAssignedAt: true,
}).extend({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
  role: z.enum(['advisor', 'recruiter', 'manager']),
  department: z.enum(['insurance', 'recruiting']),
  territories: z.array(z.string()).optional(),
  specializations: z.array(z.string()).optional(),
  maxLeadsPerDay: z.number().min(1).max(50).optional(),
});

export const insertCrmDealSchema = createInsertSchema(crmDeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  dealStageHistory: true,
}).extend({
  pipeline: z.enum(['insurance', 'recruiting']),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['active', 'won', 'lost', 'paused']).optional(),
});

export const insertLeadAssignmentSchema = createInsertSchema(leadAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  firstContactedAt: true,
  lastContactedAt: true,
  escalatedAt: true,
}).extend({
  assignmentReason: z.enum(['territory', 'round_robin', 'manual', 'escalation']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['assigned', 'accepted', 'in_progress', 'completed', 'reassigned']).optional(),
});

// Type exports
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;
export type CrmDeal = typeof crmDeals.$inferSelect;

export type InsertLeadAssignment = z.infer<typeof insertLeadAssignmentSchema>;
export type LeadAssignment = typeof leadAssignments.$inferSelect;

export type RoutingCounter = typeof routingCounters.$inferSelect;

// Onboarding Sequences table - for tracking client/recruit onboarding progress
export const onboardingSequences = pgTable("onboarding_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull().references(() => crmDeals.id),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  assignedToId: varchar("assigned_to_id").notNull().references(() => teamMembers.id),
  onboardingType: text("onboarding_type").notNull(), // 'insurance_client' | 'mlm_recruit'
  currentStage: text("current_stage").notNull().default('welcome'), // 'welcome' | 'education' | 'support' | 'referral' | 'complete'
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  scheduledEmails: jsonb("scheduled_emails").$type<Array<{
    emailId: string;
    scheduledFor: string;
    day: number;
    subject: string;
    sent: boolean;
    sentAt?: string;
  }>>().default([]),
  completedSteps: jsonb("completed_steps").$type<string[]>().default([]),
  badges: jsonb("badges").$type<Array<{
    badgeId: string;
    name: string;
    description: string;
    earnedAt: string;
  }>>().default([]),
  smsReminders: jsonb("sms_reminders").$type<Array<{
    reminderId: string;
    message: string;
    scheduledFor: string;
    sent: boolean;
    sentAt?: string;
  }>>().default([]),
  feedbackSurvey: jsonb("feedback_survey").$type<{
    sent: boolean;
    sentAt?: string;
    completed: boolean;
    completedAt?: string;
    rating?: number;
    feedback?: string;
  }>(),
  upsellOpportunities: jsonb("upsell_opportunities").$type<Array<{
    opportunityId: string;
    name: string;
    description: string;
    presentedAt: string;
    status: 'pending' | 'accepted' | 'declined';
  }>>().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  status: text("status").default("active"), // 'active' | 'completed' | 'paused' | 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  dealIdx: index("onboarding_sequences_deal_idx").on(table.dealId),
  leadIdx: index("onboarding_sequences_lead_idx").on(table.leadId),
  assignedIdx: index("onboarding_sequences_assigned_idx").on(table.assignedToId),
  typeIdx: index("onboarding_sequences_type_idx").on(table.onboardingType),
  statusIdx: index("onboarding_sequences_status_idx").on(table.status),
  stageIdx: index("onboarding_sequences_stage_idx").on(table.currentStage),
}));

// Insert schema for onboarding sequences
export const insertOnboardingSequenceSchema = createInsertSchema(onboardingSequences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
}).extend({
  onboardingType: z.enum(['insurance_client', 'mlm_recruit']),
  currentStage: z.enum(['welcome', 'education', 'training', 'support', 'referral', 'mentor', 'story', 'complete']).optional(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional(),
});

// Type exports for onboarding
export type InsertOnboardingSequence = z.infer<typeof insertOnboardingSequenceSchema>;
export type OnboardingSequence = typeof onboardingSequences.$inferSelect;

// ==============================================
// RETENTION & REFERRAL ENGINE TABLES
// ==============================================

// Client Records table - tracks insurance clients post-onboarding for retention
export const clientRecords = pgTable("client_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  dealId: varchar("deal_id").notNull().references(() => crmDeals.id),
  onboardingSequenceId: varchar("onboarding_sequence_id").notNull().references(() => onboardingSequences.id),
  advisorId: varchar("advisor_id").notNull().references(() => teamMembers.id),
  
  // Client Information
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  birthday: text("birthday"), // MM-DD format
  
  // Policy Information
  policyType: text("policy_type").notNull(), // 'term_life' | 'whole_life' | 'iul' | 'annuity' | 'retirement'
  policyNumber: text("policy_number"),
  policyValue: integer("policy_value").default(0), // in cents
  policyStartDate: timestamp("policy_start_date").notNull(),
  anniversaryDate: timestamp("anniversary_date").notNull(),
  premiumAmount: integer("premium_amount").default(0), // monthly premium in cents
  
  // Retention Tracking
  retentionStage: text("retention_stage").default("active"), // 'active' | 'at_risk' | 'churned' | 'upgraded'
  lastContactDate: timestamp("last_contact_date"),
  nextReviewDate: timestamp("next_review_date"),
  lifetimeValue: integer("lifetime_value").default(0), // in cents
  
  // Cross-sell/Upsell Tracking
  eligibleProducts: jsonb("eligible_products").$type<string[]>().default([]),
  upsellHistory: jsonb("upsell_history").$type<Array<{
    product: string;
    presentedAt: string;
    status: 'presented' | 'interested' | 'declined' | 'purchased';
    value?: number;
  }>>().default([]),
  
  // Engagement Tracking
  lastEngagement: timestamp("last_engagement").defaultNow(),
  engagementScore: integer("engagement_score").default(100), // 0-100
  communicationPreferences: jsonb("communication_preferences").$type<{
    email: boolean;
    sms: boolean;
    phone: boolean;
    preferredTime: string;
  }>().default({ email: true, sms: true, phone: true, preferredTime: 'morning' }),
  
  // Referral Tracking
  referralsSent: integer("referrals_sent").default(0),
  referralsConverted: integer("referrals_converted").default(0),
  referralRewards: integer("referral_rewards").default(0), // total rewards in cents
  
  status: text("status").default("active"), // 'active' | 'inactive' | 'churned'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  leadIdx: index("client_records_lead_idx").on(table.leadId),
  advisorIdx: index("client_records_advisor_idx").on(table.advisorId),
  statusIdx: index("client_records_status_idx").on(table.status),
  policyTypeIdx: index("client_records_policy_type_idx").on(table.policyType),
  anniversaryIdx: index("client_records_anniversary_idx").on(table.anniversaryDate),
  retentionStageIdx: index("client_records_retention_stage_idx").on(table.retentionStage),
}));

// Recruit Records table - tracks MLM recruits post-onboarding for retention
export const recruitRecords = pgTable("recruit_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  dealId: varchar("deal_id").notNull().references(() => crmDeals.id),
  onboardingSequenceId: varchar("onboarding_sequence_id").notNull().references(() => onboardingSequences.id),
  mentorId: varchar("mentor_id").notNull().references(() => teamMembers.id),
  
  // Recruit Information
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  birthday: text("birthday"), // MM-DD format
  joinDate: timestamp("join_date").notNull(),
  
  // Performance Tracking
  currentRank: text("current_rank").default("Associate"), // 'Associate' | 'Senior Associate' | 'Manager' | 'Senior Manager' | 'Director'
  rankHistory: jsonb("rank_history").$type<Array<{
    rank: string;
    achievedAt: string;
    maintainedUntil?: string;
  }>>().default([]),
  
  // Sales Performance
  monthlyPersonalSales: integer("monthly_personal_sales").default(0), // in cents
  monthlyTeamSales: integer("monthly_team_sales").default(0), // in cents
  totalPersonalSales: integer("total_personal_sales").default(0), // lifetime in cents
  totalTeamSales: integer("total_team_sales").default(0), // lifetime in cents
  
  // Team Building
  personalRecruits: integer("personal_recruits").default(0),
  teamSize: integer("team_size").default(0), // total downline
  activeTeamMembers: integer("active_team_members").default(0),
  generationsBuilt: integer("generations_built").default(0),
  
  // Engagement Tracking
  lastLogin: timestamp("last_login"),
  lastSale: timestamp("last_sale"),
  lastTrainingCompleted: timestamp("last_training_completed"),
  engagementLevel: text("engagement_level").default("active"), // 'active' | 'declining' | 'inactive' | 'at_risk'
  inactivityDays: integer("inactivity_days").default(0),
  
  // Fast Start Tracking
  fastStartGoals: jsonb("fast_start_goals").$type<{
    salesGoal: number;
    recruitGoal: number;
    trainingGoal: number;
    achieved: boolean;
    completedAt?: string;
  }>(),
  
  // Recognition & Achievements
  totalBadges: integer("total_badges").default(0),
  recognitionLevel: text("recognition_level").default("bronze"), // 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  
  // Duplication/Referral Tracking
  recruitmentsSent: integer("recruitments_sent").default(0),
  recruitmentsConverted: integer("recruitments_converted").default(0),
  
  status: text("status").default("active"), // 'active' | 'inactive' | 'churned' | 'paused'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  leadIdx: index("recruit_records_lead_idx").on(table.leadId),
  mentorIdx: index("recruit_records_mentor_idx").on(table.mentorId),
  statusIdx: index("recruit_records_status_idx").on(table.status),
  rankIdx: index("recruit_records_rank_idx").on(table.currentRank),
  engagementIdx: index("recruit_records_engagement_idx").on(table.engagementLevel),
  inactivityIdx: index("recruit_records_inactivity_idx").on(table.inactivityDays),
}));

// Retention Campaigns table - tracks scheduled retention campaigns
export const retentionCampaigns = pgTable("retention_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target Information
  targetType: text("target_type").notNull(), // 'client' | 'recruit'
  targetId: varchar("target_id").notNull(), // clientRecords.id or recruitRecords.id
  campaignType: text("campaign_type").notNull(), // 'anniversary' | 'birthday' | 'cross_sell' | 'recognition' | 'reactivation' | 'training'
  
  // Campaign Details
  campaignName: text("campaign_name").notNull(),
  templateId: text("template_id").notNull(),
  subject: text("subject").notNull(),
  triggerDate: timestamp("trigger_date").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  
  // Execution Details
  status: text("status").default("scheduled"), // 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed'
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  
  // Campaign Data
  personalizations: jsonb("personalizations").$type<Record<string, any>>().default({}),
  channels: jsonb("channels").$type<{
    email: boolean;
    sms: boolean;
    phone?: boolean;
  }>().default({ email: true, sms: false }),
  
  // Performance Tracking
  engagementScore: integer("engagement_score").default(0), // 0-100
  conversionTracked: integer("conversion_tracked").default(0), // boolean as integer
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  targetIdx: index("retention_campaigns_target_idx").on(table.targetType, table.targetId),
  typeIdx: index("retention_campaigns_type_idx").on(table.campaignType),
  statusIdx: index("retention_campaigns_status_idx").on(table.status),
  scheduledIdx: index("retention_campaigns_scheduled_idx").on(table.scheduledFor),
}));

// Referrals table - tracks all referral submissions and conversions
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Referrer Information  
  referrerType: text("referrer_type").notNull(), // 'client' | 'recruit'
  referrerId: varchar("referrer_id").notNull(), // clientRecords.id or recruitRecords.id
  referrerName: text("referrer_name").notNull(),
  referrerEmail: text("referrer_email").notNull(),
  
  // Referred Person Information
  referredName: text("referred_name").notNull(),
  referredEmail: text("referred_email").notNull(),
  referredPhone: text("referred_phone"),
  relationship: text("relationship"), // 'family' | 'friend' | 'colleague' | 'other'
  
  // Referral Details
  referralSource: text("referral_source").notNull(), // 'email_campaign' | 'website_form' | 'manual' | 'phone'
  referralCampaignId: varchar("referral_campaign_id").references(() => retentionCampaigns.id),
  interests: jsonb("interests").$type<string[]>().default([]),
  notes: text("notes"),
  
  // Processing Status
  status: text("status").default("submitted"), // 'submitted' | 'contacted' | 'qualified' | 'converted' | 'declined'
  assignedToId: varchar("assigned_to_id").references(() => teamMembers.id),
  contactedAt: timestamp("contacted_at"),
  qualifiedAt: timestamp("qualified_at"),
  convertedAt: timestamp("converted_at"),
  
  // Reward Tracking
  rewardType: text("reward_type"), // 'gift_card' | 'charity_donation' | 'cash' | 'product_credit'
  rewardAmount: integer("reward_amount").default(0), // in cents
  rewardStatus: text("reward_status").default("pending"), // 'pending' | 'approved' | 'sent' | 'completed'
  rewardSentAt: timestamp("reward_sent_at"),
  
  // Conversion Tracking
  leadId: varchar("lead_id").references(() => leads.id), // if converted to lead
  dealId: varchar("deal_id").references(() => crmDeals.id), // if converted to deal
  conversionValue: integer("conversion_value").default(0), // in cents
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  referrerIdx: index("referrals_referrer_idx").on(table.referrerType, table.referrerId),
  statusIdx: index("referrals_status_idx").on(table.status),
  assignedIdx: index("referrals_assigned_idx").on(table.assignedToId),
  emailIdx: index("referrals_email_idx").on(table.referredEmail),
}));

// Recognition Achievements table - tracks badges, awards, and recognition
export const recognitionAchievements = pgTable("recognition_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target Information
  targetType: text("target_type").notNull(), // 'client' | 'recruit'
  targetId: varchar("target_id").notNull(), // clientRecords.id or recruitRecords.id
  targetName: text("target_name").notNull(),
  
  // Achievement Details
  achievementType: text("achievement_type").notNull(), // 'badge' | 'rank' | 'milestone' | 'recognition' | 'anniversary'
  achievementId: text("achievement_id").notNull(), // unique identifier for achievement
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconUrl: text("icon_url"),
  category: text("category"), // 'sales' | 'recruitment' | 'training' | 'service' | 'milestone'
  
  // Achievement Data
  level: text("level").default("bronze"), // 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  points: integer("points").default(0),
  requirements: jsonb("requirements").$type<Record<string, any>>().default({}),
  metricValue: integer("metric_value").default(0), // the value that earned the achievement
  
  // Timing
  earnedAt: timestamp("earned_at").defaultNow(),
  validUntil: timestamp("valid_until"), // for time-limited achievements
  
  // Recognition & Sharing
  isPublic: integer("is_public").default(1), // boolean as integer
  sharedInFeed: integer("shared_in_feed").default(0), // boolean as integer
  socialProofUsed: integer("social_proof_used").default(0), // boolean as integer
  
  // Notification Status
  notificationSent: integer("notification_sent").default(0), // boolean as integer
  certificateGenerated: integer("certificate_generated").default(0), // boolean as integer
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  targetIdx: index("recognition_achievements_target_idx").on(table.targetType, table.targetId),
  typeIdx: index("recognition_achievements_type_idx").on(table.achievementType),
  categoryIdx: index("recognition_achievements_category_idx").on(table.category),
  earnedIdx: index("recognition_achievements_earned_idx").on(table.earnedAt),
}));

// NPS Surveys table - tracks Net Promoter Score surveys and feedback
export const npsSurveys = pgTable("nps_surveys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target Information
  targetType: text("target_type").notNull(), // 'client' | 'recruit'
  targetId: varchar("target_id").notNull(), // clientRecords.id or recruitRecords.id
  targetName: text("target_name").notNull(),
  targetEmail: text("target_email").notNull(),
  
  // Survey Details
  surveyType: text("survey_type").default("day_60"), // 'day_60' | 'annual' | 'post_service' | 'exit'
  campaignId: varchar("campaign_id").references(() => retentionCampaigns.id),
  
  // Survey Status
  status: text("status").default("scheduled"), // 'scheduled' | 'sent' | 'completed' | 'expired'
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  
  // Survey Response
  npsScore: integer("nps_score"), // 0-10
  npsCategory: text("nps_category"), // 'detractor' | 'passive' | 'promoter' (calculated)
  feedback: text("feedback"),
  improvementSuggestions: text("improvement_suggestions"),
  
  // Follow-up Actions
  followUpRequired: integer("follow_up_required").default(0), // boolean as integer
  followUpType: text("follow_up_type"), // 'advisor_contact' | 'referral_invite' | 'escalation'
  followUpCompleted: integer("follow_up_completed").default(0), // boolean as integer
  followUpCompletedAt: timestamp("follow_up_completed_at"),
  
  // Additional Data
  surveyData: jsonb("survey_data").$type<Record<string, any>>().default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  targetIdx: index("nps_surveys_target_idx").on(table.targetType, table.targetId),
  statusIdx: index("nps_surveys_status_idx").on(table.status),
  scoreIdx: index("nps_surveys_score_idx").on(table.npsScore),
  categoryIdx: index("nps_surveys_category_idx").on(table.npsCategory),
}));

// VIP Elite Club table - tracks membership in exclusive programs
export const vipEliteClub = pgTable("vip_elite_club", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Member Information
  memberType: text("member_type").notNull(), // 'client' | 'recruit'
  memberId: varchar("member_id").notNull(), // clientRecords.id or recruitRecords.id
  memberName: text("member_name").notNull(),
  memberEmail: text("member_email").notNull(),
  
  // Membership Details
  clubType: text("club_type").notNull(), // 'vip_client' | 'elite_producer' | 'top_recruiter' | 'diamond_circle'
  qualificationCriteria: jsonb("qualification_criteria").$type<{
    requirement: string;
    value: number;
    achieved: boolean;
  }[]>().default([]),
  
  // Membership Status
  status: text("status").default("active"), // 'active' | 'inactive' | 'suspended' | 'expired'
  joinedAt: timestamp("joined_at").defaultNow(),
  lastQualified: timestamp("last_qualified").defaultNow(),
  renewalDate: timestamp("renewal_date"),
  
  // Benefits & Perks
  benefitsAccessed: jsonb("benefits_accessed").$type<Array<{
    benefitId: string;
    benefitName: string;
    accessedAt: string;
    value?: number;
  }>>().default([]),
  totalBenefitsValue: integer("total_benefits_value").default(0), // in cents
  
  // Exclusive Access
  exclusiveEvents: jsonb("exclusive_events").$type<string[]>().default([]),
  specialRates: jsonb("special_rates").$type<Record<string, number>>().default({}),
  prioritySupport: integer("priority_support").default(1), // boolean as integer
  
  // Performance Metrics (for qualification renewal)
  qualificationMetrics: jsonb("qualification_metrics").$type<Record<string, any>>().default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  memberIdx: index("vip_elite_club_member_idx").on(table.memberType, table.memberId),
  clubTypeIdx: index("vip_elite_club_type_idx").on(table.clubType),
  statusIdx: index("vip_elite_club_status_idx").on(table.status),
  renewalIdx: index("vip_elite_club_renewal_idx").on(table.renewalDate),
}));

// Insert schemas for retention tables
export const insertClientRecordSchema = createInsertSchema(clientRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastEngagement: true,
}).extend({
  policyType: z.enum(['term_life', 'whole_life', 'iul', 'annuity', 'retirement']),
  retentionStage: z.enum(['active', 'at_risk', 'churned', 'upgraded']).optional(),
  status: z.enum(['active', 'inactive', 'churned']).optional(),
});

export const insertRecruitRecordSchema = createInsertSchema(recruitRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  currentRank: z.enum(['Associate', 'Senior Associate', 'Manager', 'Senior Manager', 'Director']).optional(),
  engagementLevel: z.enum(['active', 'declining', 'inactive', 'at_risk']).optional(),
  recognitionLevel: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']).optional(),
  status: z.enum(['active', 'inactive', 'churned', 'paused']).optional(),
});

export const insertRetentionCampaignSchema = createInsertSchema(retentionCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  deliveredAt: true,
  openedAt: true,
  clickedAt: true,
}).extend({
  targetType: z.enum(['client', 'recruit']),
  campaignType: z.enum(['anniversary', 'birthday', 'cross_sell', 'recognition', 'reactivation', 'training']),
  status: z.enum(['scheduled', 'sent', 'delivered', 'opened', 'clicked', 'failed']).optional(),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  contactedAt: true,
  qualifiedAt: true,
  convertedAt: true,
  rewardSentAt: true,
}).extend({
  referrerType: z.enum(['client', 'recruit']),
  referralSource: z.enum(['email_campaign', 'website_form', 'manual', 'phone']),
  status: z.enum(['submitted', 'contacted', 'qualified', 'converted', 'declined']).optional(),
  rewardType: z.enum(['gift_card', 'charity_donation', 'cash', 'product_credit']).optional(),
  rewardStatus: z.enum(['pending', 'approved', 'sent', 'completed']).optional(),
});

export const insertRecognitionAchievementSchema = createInsertSchema(recognitionAchievements).omit({
  id: true,
  createdAt: true,
  earnedAt: true,
}).extend({
  targetType: z.enum(['client', 'recruit']),
  achievementType: z.enum(['badge', 'rank', 'milestone', 'recognition', 'anniversary']),
  level: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']).optional(),
});

export const insertNpsSurveySchema = createInsertSchema(npsSurveys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  completedAt: true,
  followUpCompletedAt: true,
}).extend({
  targetType: z.enum(['client', 'recruit']),
  surveyType: z.enum(['day_60', 'annual', 'post_service', 'exit']).optional(),
  status: z.enum(['scheduled', 'sent', 'completed', 'expired']).optional(),
  npsCategory: z.enum(['detractor', 'passive', 'promoter']).optional(),
});

export const insertVipEliteClubSchema = createInsertSchema(vipEliteClub).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  joinedAt: true,
  lastQualified: true,
}).extend({
  memberType: z.enum(['client', 'recruit']),
  clubType: z.enum(['vip_client', 'elite_producer', 'top_recruiter', 'diamond_circle']),
  status: z.enum(['active', 'inactive', 'suspended', 'expired']).optional(),
});

// Type exports for retention system
export type InsertClientRecord = z.infer<typeof insertClientRecordSchema>;
export type ClientRecord = typeof clientRecords.$inferSelect;

export type InsertRecruitRecord = z.infer<typeof insertRecruitRecordSchema>;
export type RecruitRecord = typeof recruitRecords.$inferSelect;

export type InsertRetentionCampaign = z.infer<typeof insertRetentionCampaignSchema>;
export type RetentionCampaign = typeof retentionCampaigns.$inferSelect;

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

export type InsertRecognitionAchievement = z.infer<typeof insertRecognitionAchievementSchema>;
export type RecognitionAchievement = typeof recognitionAchievements.$inferSelect;

export type InsertNpsSurvey = z.infer<typeof insertNpsSurveySchema>;
export type NpsSurvey = typeof npsSurveys.$inferSelect;

export type InsertVipEliteClub = z.infer<typeof insertVipEliteClubSchema>;
export type VipEliteClub = typeof vipEliteClub.$inferSelect;

// ===== ANALYTICS & OPTIMIZATION TABLES =====

// A/B Tests & Experiments
export const abTests = pgTable("ab_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'landing_page', 'email_campaign', 'sms_campaign', 'quiz_flow'
  targetAudience: text("target_audience").notNull(), // 'all', 'insurance_leads', 'recruiting_leads', 'existing_clients'
  testConfig: jsonb("test_config").$type<{
    variations: Array<{
      id: string;
      name: string;
      weight: number; // percentage allocation
      config: Record<string, any>; // variation-specific config
    }>;
    successMetrics: Array<{
      metric: string; // 'conversion_rate', 'email_open_rate', 'lead_score_improvement'
      target?: number; // target value for this metric
    }>;
    minimumSampleSize: number;
    confidenceLevel: number; // 0.95 for 95% confidence
  }>().notNull(),
  status: text("status").default("draft"), // 'draft', 'active', 'paused', 'completed', 'stopped'
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  winnerVariationId: varchar("winner_variation_id"),
  winnerDeclaredAt: timestamp("winner_declared_at"),
  statisticalSignificance: jsonb("statistical_significance").$type<{
    confidenceLevel: number;
    pValue: number;
    isSignificant: boolean;
    sampleSizes: Record<string, number>;
    conversionRates: Record<string, number>;
  }>(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("ab_tests_status_idx").on(table.status),
  typeIdx: index("ab_tests_type_idx").on(table.type),
  dateIdx: index("ab_tests_date_idx").on(table.startDate, table.endDate),
}));

// A/B Test Participants
export const abTestParticipants = pgTable("ab_test_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull().references(() => abTests.id),
  leadId: varchar("lead_id").references(() => leads.id),
  userId: varchar("user_id"), // For existing clients/recruits
  variationId: varchar("variation_id").notNull(),
  sessionId: varchar("session_id"), // Browser session for anonymous tracking
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  convertedAt: timestamp("converted_at"),
  conversionValue: integer("conversion_value").default(0), // Value in cents
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  testVariationIdx: index("ab_participants_test_variation_idx").on(table.testId, table.variationId),
  leadIdx: index("ab_participants_lead_idx").on(table.leadId),
  convertedIdx: index("ab_participants_converted_idx").on(table.convertedAt),
}));

// Conversion Events & Funnel Tracking
export const conversionEvents = pgTable("conversion_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // 'page_view', 'form_submit', 'email_open', 'email_click', 'quiz_complete', 'deal_created', 'deal_won'
  entityType: text("entity_type").notNull(), // 'lead', 'client', 'recruit', 'anonymous'
  entityId: varchar("entity_id"), // ID of the entity (lead.id, clientRecord.id, etc.)
  sessionId: varchar("session_id"), // Browser session
  pageUrl: text("page_url"),
  campaignId: varchar("campaign_id"), // Related campaign
  utmParams: jsonb("utm_params").$type<{
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  }>(),
  eventData: jsonb("event_data").$type<Record<string, any>>().default({}),
  eventValue: integer("event_value").default(0), // Monetary value in cents
  deviceInfo: jsonb("device_info").$type<{
    userAgent?: string;
    deviceType?: string; // 'desktop', 'mobile', 'tablet'
    browserName?: string;
    osName?: string;
  }>(),
  geoData: jsonb("geo_data").$type<{
    country?: string;
    state?: string;
    city?: string;
    timezone?: string;
  }>(),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  eventTypeIdx: index("conversion_events_type_idx").on(table.eventType),
  entityIdx: index("conversion_events_entity_idx").on(table.entityType, table.entityId),
  timestampIdx: index("conversion_events_timestamp_idx").on(table.timestamp),
  campaignIdx: index("conversion_events_campaign_idx").on(table.campaignId),
}));

// Attribution Tracking (Multi-Touch Attribution)
export const attributionTouchpoints = pgTable("attribution_touchpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  touchpointType: text("touchpoint_type").notNull(), // 'first_touch', 'middle_touch', 'last_touch'
  channelType: text("channel_type").notNull(), // 'organic_search', 'paid_search', 'social_media', 'email', 'direct', 'referral'
  campaignId: varchar("campaign_id"),
  utmParams: jsonb("utm_params").$type<{
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  }>(),
  touchpointData: jsonb("touchpoint_data").$type<{
    pageUrl?: string;
    referrerUrl?: string;
    adGroupId?: string;
    keywordId?: string;
    creativeId?: string;
    placementId?: string;
  }>(),
  attributionWeight: integer("attribution_weight").default(100), // Percentage attribution (0-100)
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  leadIdx: index("attribution_touchpoints_lead_idx").on(table.leadId),
  channelIdx: index("attribution_touchpoints_channel_idx").on(table.channelType),
  timestampIdx: index("attribution_touchpoints_timestamp_idx").on(table.timestamp),
}));

// Campaign Performance Metrics
export const campaignMetrics = pgTable("campaign_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  campaignType: text("campaign_type").notNull(), // 'email', 'sms', 'ad_campaign', 'social_media', 'content_marketing'
  campaignName: text("campaign_name").notNull(),
  metricType: text("metric_type").notNull(), // 'impressions', 'clicks', 'opens', 'conversions', 'revenue'
  metricValue: integer("metric_value").notNull(),
  metricCost: integer("metric_cost").default(0), // Cost in cents
  dateRange: jsonb("date_range").$type<{
    startDate: string;
    endDate: string;
  }>().notNull(),
  segmentData: jsonb("segment_data").$type<{
    audience?: string;
    deviceType?: string;
    geoLocation?: string;
    timeOfDay?: string;
  }>(),
  calculatedMetrics: jsonb("calculated_metrics").$type<{
    costPerClick?: number;
    costPerLead?: number;
    conversionRate?: number;
    roi?: number;
    roas?: number; // Return on Ad Spend
  }>(),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  campaignIdx: index("campaign_metrics_campaign_idx").on(table.campaignId),
  typeIdx: index("campaign_metrics_type_idx").on(table.campaignType, table.metricType),
  timestampIdx: index("campaign_metrics_timestamp_idx").on(table.timestamp),
}));

// Real-time Analytics Events
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventCategory: text("event_category").notNull(), // 'user_behavior', 'system_alert', 'performance_metric', 'anomaly_detection'
  eventAction: text("event_action").notNull(), // 'page_view', 'form_abandon', 'conversion_spike', 'performance_drop'
  eventLabel: text("event_label"),
  eventValue: integer("event_value"),
  userId: varchar("user_id"),
  sessionId: varchar("session_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  processed: integer("processed").default(0), // Boolean: 0=unprocessed, 1=processed
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  categoryActionIdx: index("analytics_events_category_action_idx").on(table.eventCategory, table.eventAction),
  timestampIdx: index("analytics_events_timestamp_idx").on(table.timestamp),
  processedIdx: index("analytics_events_processed_idx").on(table.processed),
}));

// Performance Alerts
export const performanceAlerts = pgTable("performance_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: text("alert_type").notNull(), // 'conversion_drop', 'cost_spike', 'traffic_anomaly', 'campaign_performance'
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  title: text("title").notNull(),
  description: text("description").notNull(),
  metricData: jsonb("metric_data").$type<{
    metricName: string;
    currentValue: number;
    expectedValue: number;
    threshold: number;
    percentageChange: number;
  }>().notNull(),
  affectedEntities: jsonb("affected_entities").$type<{
    campaigns?: string[];
    channels?: string[];
    segments?: string[];
  }>(),
  actionsTaken: jsonb("actions_taken").$type<string[]>().default([]),
  status: text("status").default("active"), // 'active', 'acknowledged', 'resolved', 'false_positive'
  assignedTo: varchar("assigned_to").references(() => teamMembers.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  typeIdx: index("performance_alerts_type_idx").on(table.alertType),
  severityIdx: index("performance_alerts_severity_idx").on(table.severity),
  statusIdx: index("performance_alerts_status_idx").on(table.status),
  createdIdx: index("performance_alerts_created_idx").on(table.createdAt),
}));

// User Behavior Tracking
export const userBehaviorTracking = pgTable("user_behavior_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  sessionId: varchar("session_id").notNull(),
  behaviorType: text("behavior_type").notNull(), // 'page_sequence', 'form_interaction', 'content_engagement', 'navigation_pattern'
  behaviorData: jsonb("behavior_data").$type<{
    pageSequence?: string[];
    timeSpentPerPage?: Record<string, number>;
    scrollDepth?: Record<string, number>;
    clickHeatmap?: Array<{x: number, y: number, element: string}>;
    formInteractions?: Array<{field: string, focusTime: number, changes: number}>;
  }>().notNull(),
  deviceInfo: jsonb("device_info").$type<{
    deviceType: string;
    screenResolution: string;
    browserName: string;
    osName: string;
  }>(),
  engagementScore: integer("engagement_score").default(0), // Calculated engagement score
  conversionProbability: integer("conversion_probability").default(0), // Predicted conversion probability (0-100)
  sessionDuration: integer("session_duration"), // Duration in seconds
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  userIdx: index("user_behavior_user_idx").on(table.userId),
  sessionIdx: index("user_behavior_session_idx").on(table.sessionId),
  behaviorTypeIdx: index("user_behavior_type_idx").on(table.behaviorType),
  timestampIdx: index("user_behavior_timestamp_idx").on(table.timestamp),
}));

// Insert schemas for analytics tables
export const insertAbTestSchema = createInsertSchema(abTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  winnerDeclaredAt: true,
}).extend({
  type: z.enum(['landing_page', 'email_campaign', 'sms_campaign', 'quiz_flow']),
  targetAudience: z.enum(['all', 'insurance_leads', 'recruiting_leads', 'existing_clients']),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'stopped']).optional(),
});

export const insertAbTestParticipantSchema = createInsertSchema(abTestParticipants).omit({
  id: true,
  createdAt: true,
  enrolledAt: true,
});

export const insertConversionEventSchema = createInsertSchema(conversionEvents).omit({
  id: true,
  timestamp: true,
}).extend({
  eventType: z.enum(['page_view', 'form_submit', 'email_open', 'email_click', 'quiz_complete', 'deal_created', 'deal_won']),
  entityType: z.enum(['lead', 'client', 'recruit', 'anonymous']),
});

export const insertAttributionTouchpointSchema = createInsertSchema(attributionTouchpoints).omit({
  id: true,
  timestamp: true,
}).extend({
  touchpointType: z.enum(['first_touch', 'middle_touch', 'last_touch']),
  channelType: z.enum(['organic_search', 'paid_search', 'social_media', 'email', 'direct', 'referral']),
});

export const insertCampaignMetricsSchema = createInsertSchema(campaignMetrics).omit({
  id: true,
  timestamp: true,
}).extend({
  campaignType: z.enum(['email', 'sms', 'ad_campaign', 'social_media', 'content_marketing']),
  metricType: z.enum(['impressions', 'clicks', 'opens', 'conversions', 'revenue']),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  timestamp: true,
}).extend({
  eventCategory: z.enum(['user_behavior', 'system_alert', 'performance_metric', 'anomaly_detection']),
});

export const insertPerformanceAlertSchema = createInsertSchema(performanceAlerts).omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
}).extend({
  alertType: z.enum(['conversion_drop', 'cost_spike', 'traffic_anomaly', 'campaign_performance']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['active', 'acknowledged', 'resolved', 'false_positive']).optional(),
});

export const insertUserBehaviorTrackingSchema = createInsertSchema(userBehaviorTracking).omit({
  id: true,
  timestamp: true,
}).extend({
  behaviorType: z.enum(['page_sequence', 'form_interaction', 'content_engagement', 'navigation_pattern']),
});

// Type exports for analytics system
export type InsertAbTest = z.infer<typeof insertAbTestSchema>;
export type AbTest = typeof abTests.$inferSelect;

export type InsertAbTestParticipant = z.infer<typeof insertAbTestParticipantSchema>;
export type AbTestParticipant = typeof abTestParticipants.$inferSelect;

export type InsertConversionEvent = z.infer<typeof insertConversionEventSchema>;
export type ConversionEvent = typeof conversionEvents.$inferSelect;

export type InsertAttributionTouchpoint = z.infer<typeof insertAttributionTouchpointSchema>;
export type AttributionTouchpoint = typeof attributionTouchpoints.$inferSelect;

export type InsertCampaignMetrics = z.infer<typeof insertCampaignMetricsSchema>;
export type CampaignMetrics = typeof campaignMetrics.$inferSelect;

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

export type InsertPerformanceAlert = z.infer<typeof insertPerformanceAlertSchema>;
export type PerformanceAlert = typeof performanceAlerts.$inferSelect;

export type InsertUserBehaviorTracking = z.infer<typeof insertUserBehaviorTrackingSchema>;
export type UserBehaviorTracking = typeof userBehaviorTracking.$inferSelect;
