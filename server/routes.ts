import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertNewsletterSchema } from "@shared/schema";
import { PDFService } from "./pdf-service";
import { leadTaggingService } from "./lead-tagging-service";
import { engagementService } from "./engagement-service";
import { routingService } from "./routing-service";
import { crmService } from "./crm-service";
import { escalationService } from "./escalation-service";
import { retentionService } from "./retention-service";
import { 
  insertTeamMemberSchema, insertCrmDealSchema, insertLeadAssignmentSchema,
  insertRetentionCampaignSchema, insertReferralSchema, insertRecognitionAchievementSchema,
  insertNpsSurveySchema, insertVipEliteClubSchema,
  insertAbTestSchema, insertConversionEventSchema, insertAttributionTouchpointSchema,
  insertCampaignMetricsSchema, insertPerformanceAlertSchema, insertUserBehaviorTrackingSchema
} from "@shared/schema";
import { analyticsService } from "./analytics-service";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create lead endpoint with immediate engagement flow
  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      
      // Extract UTM parameters from query string for lead attribution
      const utmParams = leadTaggingService.extractUTMParameters(req);
      
      // Create lead with enhanced tagging and scoring
      const lead = await storage.createLead(leadData, utmParams);
      
      // Log lead creation for ActiveCampaign webhook integration
      console.log(`Fortune First Lead Created: ${lead.email} from ${lead.source} with score ${lead.leadScore}`);
      console.log(`Tags: ${lead.tags?.join(', ')}`);
      
      // 🚀 TRIGGER IMMEDIATE ENGAGEMENT FLOW (Step 2)
      try {
        // Execute immediate engagement flow asynchronously to not block response
        engagementService.triggerImmediateEngagement(lead).catch(error => {
          console.error(`❌ Engagement flow failed for lead ${lead.email}:`, error);
        });
        
        console.log(`✅ Immediate engagement flow initiated for ${lead.email}`);
      } catch (error) {
        console.error(`❌ Failed to initiate engagement flow for ${lead.email}:`, error);
        // Don't fail the lead creation if engagement flow fails
      }

      // 🎯 TRIGGER LEAD ROUTING & ASSIGNMENT (Step 5)
      try {
        // Route hot leads immediately (≥50 points)
        if ((lead.leadScore || 0) >= 50) {
          console.log(`🔥 HOT LEAD DETECTED: ${lead.name} (${lead.leadScore} points) - Initiating routing...`);
          
          // Execute routing asynchronously to not block response
          routingService.routeAndAssignLead(lead).then(result => {
            if (result.success) {
              console.log(`✅ Hot lead successfully routed to ${result.assignedMember?.name}`);
              if (result.crmDeal) {
                console.log(`💼 CRM Deal created: ${result.crmDeal.title}`);
              }
            } else {
              console.error(`❌ Failed to route hot lead: ${result.error}`);
            }
          }).catch(error => {
            console.error(`❌ Lead routing error for ${lead.email}:`, error);
          });
        } else {
          console.log(`📝 Regular lead created: ${lead.name} (${lead.leadScore} points) - Added to nurture flow`);
        }
      } catch (error) {
        console.error(`❌ Failed to initiate lead routing for ${lead.email}:`, error);
        // Don't fail the lead creation if routing fails
      }
      
      // TODO: Send to ActiveCampaign webhook when available
      // await sendToActiveCampaign(lead);
      
      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid lead data", details: error.errors });
      }
      console.error("Error creating lead:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get leads by source
  app.get("/api/leads/:source", async (req, res) => {
    try {
      const { source } = req.params;
      const leads = await storage.getLeadsBySource(source);
      res.json(leads);
    } catch (error) {
      console.error("Error getting leads:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all leads
  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error getting leads:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Newsletter subscription
  app.post("/api/newsletter", async (req, res) => {
    try {
      const subscriberData = insertNewsletterSchema.parse(req.body);
      const subscriber = await storage.subscribeNewsletter(subscriberData);
      res.status(201).json(subscriber);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid subscriber data", details: error.errors });
      }
      console.error("Error subscribing to newsletter:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get newsletter subscribers
  app.get("/api/newsletter", async (req, res) => {
    try {
      const subscribers = await storage.getNewsletterSubscribers();
      res.json(subscribers);
    } catch (error) {
      console.error("Error getting subscribers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PDF Download Routes
  app.get("/api/pdf/insurance-guide", async (req, res) => {
    try {
      const pdfBuffer = PDFService.generateInsuranceGuide();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Top-5-Life-Insurance-Strategies.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating insurance guide:", error);
      res.status(500).json({ error: "Error generating PDF" });
    }
  });

  app.get("/api/pdf/retirement-checklist", async (req, res) => {
    try {
      const pdfBuffer = PDFService.generateRetirementChecklist();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Retirement-Security-Checklist.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating retirement checklist:", error);
      res.status(500).json({ error: "Error generating PDF" });
    }
  });

  app.get("/api/pdf/distributor-kit", async (req, res) => {
    try {
      const pdfBuffer = PDFService.generateDistributorKit();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Distributor-Success-Starter-Kit.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating distributor kit:", error);
      res.status(500).json({ error: "Error generating PDF" });
    }
  });

  // Test engagement flow endpoint (for development/testing)
  app.post("/api/test-engagement/:leadId", async (req, res) => {
    try {
      const { leadId } = req.params;
      const leads = await storage.getLeads();
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      await engagementService.testEngagementFlow(lead);
      res.json({ message: "Engagement flow test completed", leadId });
    } catch (error) {
      console.error("Error testing engagement flow:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Engagement tracking endpoint for webhooks/pixels
  app.post("/api/engagement-event", async (req, res) => {
    try {
      const { leadId, eventType } = req.body;
      
      if (!leadId || !eventType) {
        return res.status(400).json({ error: "leadId and eventType are required" });
      }
      
      await engagementService.handleEngagementEvent(leadId, eventType);
      res.json({ message: "Engagement event tracked", leadId, eventType });
    } catch (error) {
      console.error("Error tracking engagement event:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Nurture journey endpoints
  app.post("/api/nurture/start/:leadId", async (req, res) => {
    try {
      const { leadId } = req.params;
      const leads = await storage.getLeads();
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const { nurtureService } = await import("./nurture-service");
      await nurtureService.startNurtureJourney(lead);
      res.json({ message: "Nurture journey started", leadId });
    } catch (error) {
      console.error("Error starting nurture journey:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/nurture/process-scheduled", async (req, res) => {
    try {
      const { nurtureService } = await import("./nurture-service");
      await nurtureService.processScheduledEmails();
      res.json({ message: "Scheduled emails processed" });
    } catch (error) {
      console.error("Error processing scheduled emails:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/nurture/hot-leads", async (req, res) => {
    try {
      const { nurtureService } = await import("./nurture-service");
      const hotLeads = await nurtureService.checkForHotLeads();
      res.json(hotLeads);
    } catch (error) {
      console.error("Error getting hot leads:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/nurture/stage/:leadId", async (req, res) => {
    try {
      const { leadId } = req.params;
      const { stage } = req.body;
      
      if (!stage) {
        return res.status(400).json({ error: "stage is required" });
      }
      
      const { nurtureService } = await import("./nurture-service");
      await nurtureService.updateLeadStage(leadId, stage);
      res.json({ message: "Lead stage updated", leadId, stage });
    } catch (error) {
      console.error("Error updating lead stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Fallback campaign trigger endpoint (for testing/manual execution)
  app.post("/api/fallback-campaign/:leadId", async (req, res) => {
    try {
      const { leadId } = req.params;
      const leads = await storage.getLeads();
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      await engagementService.scheduleFallbackCampaign(lead, 0); // Immediate execution for testing
      res.json({ message: "Fallback campaign scheduled", leadId });
    } catch (error) {
      console.error("Error scheduling fallback campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===============================
  // LEAD ROUTING & CRM ENDPOINTS
  // ===============================

  // Team Member Management
  app.post("/api/team-members", async (req, res) => {
    try {
      const memberData = insertTeamMemberSchema.parse(req.body);
      const member = await routingService.createTeamMember(memberData);
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid team member data", details: error.errors });
      }
      console.error("Error creating team member:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/team-members", async (req, res) => {
    try {
      const { department } = req.query;
      const members = await routingService.getActiveTeamMembers(
        department as 'insurance' | 'recruiting' | undefined
      );
      res.json(members);
    } catch (error) {
      console.error("Error getting team members:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/team-members/:memberId/availability", async (req, res) => {
    try {
      const { memberId } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: "isActive must be a boolean" });
      }
      
      await routingService.updateTeamMemberAvailability(memberId, isActive);
      res.json({ message: "Team member availability updated", memberId, isActive });
    } catch (error) {
      console.error("Error updating team member availability:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Lead Assignment and Routing
  app.post("/api/leads/:leadId/route", async (req, res) => {
    try {
      const { leadId } = req.params;
      const leads = await storage.getLeads();
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const result = await routingService.routeAndAssignLead(lead);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error routing lead:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/leads/:leadId/reassign", async (req, res) => {
    try {
      const { leadId } = req.params;
      const { newMemberId, reason } = req.body;
      
      if (!newMemberId || !reason) {
        return res.status(400).json({ error: "newMemberId and reason are required" });
      }
      
      const result = await routingService.reassignLead(leadId, newMemberId, reason);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error reassigning lead:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/team-members/:memberId/assignments", async (req, res) => {
    try {
      const { memberId } = req.params;
      const assignments = await routingService.getTeamMemberAssignments(memberId);
      res.json(assignments);
    } catch (error) {
      console.error("Error getting team member assignments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // CRM Deal Management
  app.get("/api/crm/pipelines", async (req, res) => {
    try {
      const pipelines = crmService.getPipelines();
      res.json(pipelines);
    } catch (error) {
      console.error("Error getting pipelines:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/crm/deals", async (req, res) => {
    try {
      const { pipeline, assignedToId } = req.query;
      const deals = await crmService.getDealsInPipeline(
        pipeline as 'insurance' | 'recruiting',
        assignedToId as string | undefined
      );
      res.json(deals);
    } catch (error) {
      console.error("Error getting deals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/crm/deals", async (req, res) => {
    try {
      const dealData = insertCrmDealSchema.parse(req.body);
      // This would require additional logic to get the assigned member
      // For now, we'll return an error suggesting to use lead routing instead
      res.status(400).json({ 
        error: "Direct deal creation not supported. Use lead routing to automatically create deals for hot leads." 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid deal data", details: error.errors });
      }
      console.error("Error creating deal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/crm/deals/:dealId/stage", async (req, res) => {
    try {
      const { dealId } = req.params;
      const { newStage, notes } = req.body;
      
      if (!newStage) {
        return res.status(400).json({ error: "newStage is required" });
      }
      
      const updatedDeal = await crmService.updateDealStage(dealId, newStage, notes);
      res.json(updatedDeal);
    } catch (error) {
      console.error("Error updating deal stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/crm/deals/:dealId/value", async (req, res) => {
    try {
      const { dealId } = req.params;
      const { newValue } = req.body;
      
      if (typeof newValue !== 'number' || newValue < 0) {
        return res.status(400).json({ error: "newValue must be a positive number" });
      }
      
      await crmService.updateDealValue(dealId, newValue);
      res.json({ message: "Deal value updated", dealId, newValue });
    } catch (error) {
      console.error("Error updating deal value:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/crm/deals/:dealId/close", async (req, res) => {
    try {
      const { dealId } = req.params;
      const { won, finalValue, notes } = req.body;
      
      if (typeof won !== 'boolean') {
        return res.status(400).json({ error: "won must be a boolean" });
      }
      
      const closedDeal = await crmService.closeDeal(dealId, won, finalValue, notes);
      res.json(closedDeal);
    } catch (error) {
      console.error("Error closing deal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/crm/deals/overdue", async (req, res) => {
    try {
      const overdueDeals = await crmService.getOverdueDeals();
      res.json(overdueDeals);
    } catch (error) {
      console.error("Error getting overdue deals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/crm/deals/today-followups", async (req, res) => {
    try {
      const { memberId } = req.query;
      const followups = await crmService.getTodaysFollowups(memberId as string | undefined);
      res.json(followups);
    } catch (error) {
      console.error("Error getting today's followups:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/crm/metrics/:pipeline", async (req, res) => {
    try {
      const { pipeline } = req.params;
      if (pipeline !== 'insurance' && pipeline !== 'recruiting') {
        return res.status(400).json({ error: "Pipeline must be 'insurance' or 'recruiting'" });
      }
      
      const metrics = await crmService.getPipelineMetrics(pipeline);
      res.json(metrics);
    } catch (error) {
      console.error("Error getting pipeline metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/crm/deals/:dealId/recommendations", async (req, res) => {
    try {
      const { dealId } = req.params;
      const recommendations = await crmService.getStageRecommendations(dealId);
      res.json({ dealId, recommendations });
    } catch (error) {
      console.error("Error getting stage recommendations:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Escalation Management
  app.get("/api/escalation/overdue", async (req, res) => {
    try {
      const overdueAssignments = await escalationService.checkForOverdueAssignments();
      res.json(overdueAssignments);
    } catch (error) {
      console.error("Error checking overdue assignments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/escalation/process", async (req, res) => {
    try {
      const results = await escalationService.processOverdueAssignments();
      res.json({
        message: "Overdue assignments processed",
        results,
        processed: results.length,
        successful: results.filter(r => r.success).length
      });
    } catch (error) {
      console.error("Error processing overdue assignments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/escalation/assignments/:assignmentId/escalate", async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { escalationLevel } = req.body;
      
      const result = await escalationService.escalateAssignment(assignmentId, escalationLevel);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error escalating assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/escalation/assignments/:assignmentId/manual", async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { reason, escalatedBy } = req.body;
      
      if (!reason || !escalatedBy) {
        return res.status(400).json({ error: "reason and escalatedBy are required" });
      }
      
      const result = await escalationService.manualEscalation(assignmentId, reason, escalatedBy);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error performing manual escalation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/escalation/metrics", async (req, res) => {
    try {
      const metrics = await escalationService.getEscalationMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting escalation metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/escalation/assignments/:assignmentId/status", async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const status = await escalationService.getAssignmentEscalationStatus(assignmentId);
      res.json(status);
    } catch (error) {
      console.error("Error getting assignment escalation status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test routing endpoint (for development/testing)
  app.post("/api/test-routing/:leadId", async (req, res) => {
    try {
      const { leadId } = req.params;
      const leads = await storage.getLeads();
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const result = await routingService.routeAndAssignLead(lead);
      res.json({ 
        message: "Test routing completed", 
        leadId, 
        result 
      });
    } catch (error) {
      console.error("Error testing routing:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // System monitoring endpoints
  app.get("/api/system/routing-status", async (req, res) => {
    try {
      const teamMembers = await routingService.getActiveTeamMembers();
      const overdueAssignments = await escalationService.checkForOverdueAssignments();
      const escalationMetrics = await escalationService.getEscalationMetrics();
      
      res.json({
        activeTeamMembers: teamMembers.length,
        overdueAssignments: overdueAssignments.length,
        escalationMetrics,
        systemStatus: 'operational'
      });
    } catch (error) {
      console.error("Error getting routing status:", error);
      res.status(500).json({ error: "Internal server error", systemStatus: 'error' });
    }
  });

  // ===============================
  // RETENTION & REFERRAL ENGINE API ROUTES
  // ===============================

  // Retention Campaign Management
  app.get("/api/retention/campaigns", async (req, res) => {
    try {
      const { targetType, targetId, campaignType, status } = req.query;
      const campaigns = await retentionService.getRetentionCampaigns({
        targetType: targetType as 'client' | 'recruit',
        targetId: targetId as string,
        campaignType: campaignType as string,
        status: status as string
      });
      res.json(campaigns);
    } catch (error) {
      console.error("Error getting retention campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/campaigns", async (req, res) => {
    try {
      const campaignData = insertRetentionCampaignSchema.parse(req.body);
      const campaign = await retentionService.createRetentionCampaign(campaignData);
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid campaign data", details: error.errors });
      }
      console.error("Error creating retention campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/campaigns/process", async (req, res) => {
    try {
      await retentionService.processScheduledRetentionCampaigns();
      res.json({ message: "Retention campaigns processed successfully" });
    } catch (error) {
      console.error("Error processing retention campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Client Retention Automations
  app.post("/api/retention/client/schedule-annual-reviews", async (req, res) => {
    try {
      await retentionService.scheduleAnnualReviewReminders();
      res.json({ message: "Annual review reminders scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling annual reviews:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/client/schedule-birthday-campaigns", async (req, res) => {
    try {
      await retentionService.scheduleBirthdayLifeEventCampaigns();
      res.json({ message: "Birthday campaigns scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling birthday campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/client/schedule-cross-sell", async (req, res) => {
    try {
      await retentionService.scheduleCrossSellUpsellNudges();
      res.json({ message: "Cross-sell/upsell campaigns scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling cross-sell campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/client/schedule-anniversaries", async (req, res) => {
    try {
      await retentionService.scheduleClientAnniversaryRecognition();
      res.json({ message: "Anniversary recognition scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling anniversary recognition:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Client Referral Campaigns
  app.post("/api/retention/client/schedule-referrals", async (req, res) => {
    try {
      await retentionService.scheduleClientReferralCampaigns();
      res.json({ message: "Client referral campaigns scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling client referral campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // MLM Recruit Retention Automations
  app.post("/api/retention/recruit/send-weekly-recognition", async (req, res) => {
    try {
      await retentionService.sendWeeklyRecognitionEmail();
      res.json({ message: "Weekly recognition emails sent successfully" });
    } catch (error) {
      console.error("Error sending weekly recognition:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/recruit/process-engagement", async (req, res) => {
    try {
      await retentionService.processEngagementTracker();
      res.json({ message: "Engagement tracker processed successfully" });
    } catch (error) {
      console.error("Error processing engagement tracker:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/recruit/schedule-training", async (req, res) => {
    try {
      await retentionService.scheduleOngoingTrainingDrip();
      res.json({ message: "Training drip campaigns scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling training campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/recruit/process-fast-start", async (req, res) => {
    try {
      await retentionService.processFastStartIncentives();
      res.json({ message: "Fast start incentives processed successfully" });
    } catch (error) {
      console.error("Error processing fast start incentives:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Recruit Referral/Duplication Engine
  app.post("/api/retention/recruit/generate-recognition", async (req, res) => {
    try {
      await retentionService.generateRecognitionAutomation();
      res.json({ message: "Recognition automation generated successfully" });
    } catch (error) {
      console.error("Error generating recognition automation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/recruit/schedule-anniversary-recognition", async (req, res) => {
    try {
      await retentionService.scheduleAnniversaryRecognition();
      res.json({ message: "Anniversary recognition scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling anniversary recognition:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/recruit/generate-leaderboard", async (req, res) => {
    try {
      await retentionService.generateMonthlyLeaderboard();
      res.json({ message: "Monthly leaderboard generated successfully" });
    } catch (error) {
      console.error("Error generating leaderboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/recruit/award-badges", async (req, res) => {
    try {
      await retentionService.awardPerformanceBadges();
      res.json({ message: "Performance badges awarded successfully" });
    } catch (error) {
      console.error("Error awarding badges:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Referral Management
  app.post("/api/retention/referrals", async (req, res) => {
    try {
      const referralData = insertReferralSchema.parse(req.body);
      const referral = await retentionService.processReferralSubmission(referralData);
      res.status(201).json(referral);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid referral data", details: error.errors });
      }
      console.error("Error processing referral:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/retention/referrals", async (req, res) => {
    try {
      const { referrerType, referrerId, status } = req.query;
      const referrals = await retentionService.getReferrals({
        referrerType: referrerType as 'client' | 'recruit',
        referrerId: referrerId as string,
        status: status as string
      });
      res.json(referrals);
    } catch (error) {
      console.error("Error getting referrals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/retention/referrals/:referralId", async (req, res) => {
    try {
      const { referralId } = req.params;
      const { status, rewardStatus, assignedToId, notes } = req.body;
      
      const updatedReferral = await retentionService.updateReferralStatus(referralId, {
        status,
        rewardStatus,
        assignedToId,
        notes
      });
      
      res.json(updatedReferral);
    } catch (error) {
      console.error("Error updating referral:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // NPS/Feedback Survey Management
  app.post("/api/retention/nps/schedule-surveys", async (req, res) => {
    try {
      await retentionService.scheduleNpsFeedbackSurveys();
      res.json({ message: "NPS surveys scheduled successfully" });
    } catch (error) {
      console.error("Error scheduling NPS surveys:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/nps/process-responses", async (req, res) => {
    try {
      await retentionService.processNpsSurveyResponses();
      res.json({ message: "NPS responses processed successfully" });
    } catch (error) {
      console.error("Error processing NPS responses:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/nps/:surveyId/response", async (req, res) => {
    try {
      const { surveyId } = req.params;
      const { npsScore, feedback, improvementSuggestions } = req.body;
      
      if (typeof npsScore !== 'number' || npsScore < 0 || npsScore > 10) {
        return res.status(400).json({ error: "NPS score must be between 0 and 10" });
      }
      
      const survey = await retentionService.submitNpsSurveyResponse(surveyId, {
        npsScore,
        feedback,
        improvementSuggestions
      });
      
      res.json(survey);
    } catch (error) {
      console.error("Error submitting NPS response:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Social Proof & Testimonials
  app.post("/api/retention/testimonials/request", async (req, res) => {
    try {
      await retentionService.automateTestimonialRequests();
      res.json({ message: "Testimonial requests automated successfully" });
    } catch (error) {
      console.error("Error automating testimonial requests:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // VIP Elite Club Management
  app.post("/api/retention/vip/manage-club", async (req, res) => {
    try {
      await retentionService.manageVipEliteClub();
      res.json({ message: "VIP Elite Club managed successfully" });
    } catch (error) {
      console.error("Error managing VIP Elite Club:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/retention/vip/members", async (req, res) => {
    try {
      const { clubType, status } = req.query;
      const members = await retentionService.getVipMembers({
        clubType: clubType as string,
        status: status as string
      });
      res.json(members);
    } catch (error) {
      console.error("Error getting VIP members:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Recognition & Achievement Management
  app.get("/api/retention/achievements", async (req, res) => {
    try {
      const { targetType, targetId, achievementType, recent } = req.query;
      
      if (recent === 'true') {
        const hours = parseInt(req.query.hours as string) || 24;
        const achievements = await retentionService.getRecentAchievements(hours);
        res.json(achievements);
      } else {
        const achievements = await retentionService.getAchievements({
          targetType: targetType as 'client' | 'recruit',
          targetId: targetId as string,
          achievementType: achievementType as string
        });
        res.json(achievements);
      }
    } catch (error) {
      console.error("Error getting achievements:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/retention/achievements", async (req, res) => {
    try {
      const achievementData = insertRecognitionAchievementSchema.parse(req.body);
      const achievement = await retentionService.createAchievement(achievementData);
      res.status(201).json(achievement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid achievement data", details: error.errors });
      }
      console.error("Error creating achievement:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Leaderboards & Performance
  app.get("/api/retention/leaderboard/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const { period = 'monthly' } = req.query;
      
      if (type !== 'client' && type !== 'recruit') {
        return res.status(400).json({ error: "Type must be 'client' or 'recruit'" });
      }
      
      const leaderboard = await retentionService.getTopPerformers(
        type as 'client' | 'recruit',
        period as 'monthly' | 'yearly'
      );
      
      res.json(leaderboard);
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Retention Metrics & Analytics
  app.get("/api/retention/metrics", async (req, res) => {
    try {
      const metrics = await retentionService.getRetentionMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting retention metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/retention/metrics/campaigns", async (req, res) => {
    try {
      const { campaignType, startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const metrics = await retentionService.getCampaignMetrics(campaignType as string, dateRange);
      res.json(metrics);
    } catch (error) {
      console.error("Error getting campaign metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/retention/metrics/referrals", async (req, res) => {
    try {
      const metrics = await retentionService.getReferralMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting referral metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/retention/metrics/nps", async (req, res) => {
    try {
      const metrics = await retentionService.getNpsMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting NPS metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Client & Recruit Record Management
  app.get("/api/retention/clients", async (req, res) => {
    try {
      const { advisorId, status, retentionStage } = req.query;
      const clients = await retentionService.getClientRecords({
        advisorId: advisorId as string,
        status: status as string,
        retentionStage: retentionStage as string
      });
      res.json(clients);
    } catch (error) {
      console.error("Error getting client records:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/retention/recruits", async (req, res) => {
    try {
      const { mentorId, status, engagementLevel } = req.query;
      const recruits = await retentionService.getRecruitRecords({
        mentorId: mentorId as string,
        status: status as string,
        engagementLevel: engagementLevel as string
      });
      res.json(recruits);
    } catch (error) {
      console.error("Error getting recruit records:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Automated Retention Job Triggers (for cron/scheduled tasks)
  app.post("/api/retention/jobs/run-all", async (req, res) => {
    try {
      console.log('🚀 Running all retention automation jobs...');
      
      // Run all retention automations in parallel for efficiency
      await Promise.allSettled([
        // Client retention automations
        retentionService.scheduleAnnualReviewReminders(),
        retentionService.scheduleBirthdayLifeEventCampaigns(),
        retentionService.scheduleCrossSellUpsellNudges(),
        retentionService.scheduleClientAnniversaryRecognition(),
        retentionService.scheduleClientReferralCampaigns(),
        
        // Recruit retention automations
        retentionService.sendWeeklyRecognitionEmail(),
        retentionService.processEngagementTracker(),
        retentionService.scheduleOngoingTrainingDrip(),
        retentionService.processFastStartIncentives(),
        
        // Recruit referral/duplication engine
        retentionService.generateRecognitionAutomation(),
        retentionService.scheduleAnniversaryRecognition(),
        retentionService.generateMonthlyLeaderboard(),
        retentionService.awardPerformanceBadges(),
        
        // Shared enhancements
        retentionService.scheduleNpsFeedbackSurveys(),
        retentionService.processNpsSurveyResponses(),
        retentionService.automateTestimonialRequests(),
        retentionService.manageVipEliteClub(),
        
        // Process scheduled campaigns
        retentionService.processScheduledRetentionCampaigns()
      ]);
      
      console.log('✅ All retention automation jobs completed');
      res.json({ 
        message: "All retention automation jobs completed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error running retention jobs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test retention system endpoint
  app.post("/api/retention/test/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const { targetId } = req.body;
      
      let result: any;
      
      switch (type) {
        case 'client-referral':
          result = await retentionService.scheduleClientReferralCampaigns();
          break;
        case 'weekly-recognition':
          result = await retentionService.sendWeeklyRecognitionEmail();
          break;
        case 'nps-survey':
          result = await retentionService.scheduleNpsFeedbackSurveys();
          break;
        case 'vip-club':
          result = await retentionService.manageVipEliteClub();
          break;
        default:
          return res.status(400).json({ error: "Invalid test type" });
      }
      
      res.json({ 
        message: `Test ${type} completed successfully`,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error testing ${req.params.type}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== ANALYTICS & OPTIMIZATION API ROUTES =====

  // Dashboard Metrics
  app.get("/api/analytics/dashboard", async (req, res) => {
    try {
      const metrics = await analyticsService.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting dashboard metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Lead Performance Metrics
  app.get("/api/analytics/leads/performance", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const metrics = await analyticsService.getLeadPerformanceMetrics(dateRange);
      res.json(metrics);
    } catch (error) {
      console.error("Error getting lead performance metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Funnel Analytics
  app.get("/api/analytics/funnel", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const funnel = await analyticsService.getFunnelAnalytics(dateRange);
      res.json(funnel);
    } catch (error) {
      console.error("Error getting funnel analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Engagement Analytics
  app.get("/api/analytics/engagement", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const engagement = await analyticsService.getEngagementAnalytics(dateRange);
      res.json(engagement);
    } catch (error) {
      console.error("Error getting engagement analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sales Performance Metrics
  app.get("/api/analytics/sales", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const sales = await analyticsService.getSalesPerformanceMetrics(dateRange);
      res.json(sales);
    } catch (error) {
      console.error("Error getting sales performance metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Retention Metrics
  app.get("/api/analytics/retention", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const retention = await analyticsService.getRetentionMetrics(dateRange);
      res.json(retention);
    } catch (error) {
      console.error("Error getting retention metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // A/B Testing Framework Routes
  app.post("/api/analytics/ab-tests", async (req, res) => {
    try {
      const testData = insertAbTestSchema.parse(req.body);
      const test = await analyticsService.createAbTest(testData);
      res.status(201).json(test);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid test data", details: error.errors });
      }
      console.error("Error creating A/B test:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/ab-tests/:testId/start", async (req, res) => {
    try {
      const { testId } = req.params;
      await analyticsService.startAbTest(testId);
      res.json({ message: "Test started successfully" });
    } catch (error) {
      console.error("Error starting A/B test:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/ab-tests/:testId/stop", async (req, res) => {
    try {
      const { testId } = req.params;
      const { reason } = req.body;
      await analyticsService.stopAbTest(testId, reason);
      res.json({ message: "Test stopped successfully" });
    } catch (error) {
      console.error("Error stopping A/B test:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/ab-tests/:testId/enroll", async (req, res) => {
    try {
      const { testId } = req.params;
      const { leadId, sessionId } = req.body;
      const result = await analyticsService.enrollInAbTest(testId, leadId, sessionId);
      res.json(result);
    } catch (error) {
      console.error("Error enrolling in A/B test:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/ab-tests/:testId/convert", async (req, res) => {
    try {
      const { testId } = req.params;
      const { participantId, conversionValue } = req.body;
      await analyticsService.recordConversion(testId, participantId, conversionValue);
      res.json({ message: "Conversion recorded successfully" });
    } catch (error) {
      console.error("Error recording conversion:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/analytics/ab-tests/:testId/results", async (req, res) => {
    try {
      const { testId } = req.params;
      const results = await analyticsService.getAbTestResults(testId);
      res.json(results);
    } catch (error) {
      console.error("Error getting A/B test results:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Event Tracking Routes
  app.post("/api/analytics/events/conversion", async (req, res) => {
    try {
      const eventData = insertConversionEventSchema.parse(req.body);
      const event = await analyticsService.recordConversionEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      console.error("Error recording conversion event:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/events/attribution", async (req, res) => {
    try {
      const touchpointData = insertAttributionTouchpointSchema.parse(req.body);
      const touchpoint = await analyticsService.recordAttributionTouchpoint(touchpointData);
      res.status(201).json(touchpoint);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid touchpoint data", details: error.errors });
      }
      console.error("Error recording attribution touchpoint:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/events/behavior", async (req, res) => {
    try {
      const behaviorData = insertUserBehaviorTrackingSchema.parse(req.body);
      const behavior = await analyticsService.recordUserBehavior(behaviorData);
      res.status(201).json(behavior);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid behavior data", details: error.errors });
      }
      console.error("Error recording user behavior:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/events/campaign-metrics", async (req, res) => {
    try {
      const metricsData = insertCampaignMetricsSchema.parse(req.body);
      const metrics = await analyticsService.recordCampaignMetrics(metricsData);
      res.status(201).json(metrics);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid metrics data", details: error.errors });
      }
      console.error("Error recording campaign metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Advanced Analytics Routes
  app.get("/api/analytics/predictive", async (req, res) => {
    try {
      const predictive = await analyticsService.getPredictiveAnalytics();
      res.json(predictive);
    } catch (error) {
      console.error("Error getting predictive analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/analytics/attribution", async (req, res) => {
    try {
      const { leadId } = req.query;
      const attribution = await analyticsService.getAttributionAnalysis(leadId as string);
      res.json(attribution);
    } catch (error) {
      console.error("Error getting attribution analysis:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/analytics/behavior", async (req, res) => {
    try {
      const { timeframe = 'week' } = req.query;
      const behavior = await analyticsService.getBehavioralAnalysis(timeframe as 'day' | 'week' | 'month');
      res.json(behavior);
    } catch (error) {
      console.error("Error getting behavioral analysis:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/analytics/roi/:campaignId", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const roi = await analyticsService.calculateROI(campaignId, dateRange);
      res.json({ campaignId, roi });
    } catch (error) {
      console.error("Error calculating ROI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Real-time Monitoring Routes
  app.get("/api/analytics/alerts", async (req, res) => {
    try {
      const alerts = await analyticsService.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error getting active alerts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/alerts", async (req, res) => {
    try {
      const alertData = insertPerformanceAlertSchema.parse(req.body);
      const alert = await analyticsService.createPerformanceAlert(alertData);
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid alert data", details: error.errors });
      }
      console.error("Error creating performance alert:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/alerts/:alertId/acknowledge", async (req, res) => {
    try {
      const { alertId } = req.params;
      const { teamMemberId } = req.body;
      await analyticsService.acknowledgeAlert(alertId, teamMemberId);
      res.json({ message: "Alert acknowledged successfully" });
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/analytics/monitoring/check-anomalies", async (req, res) => {
    try {
      await analyticsService.checkPerformanceAnomalies();
      res.json({ message: "Anomaly check completed" });
    } catch (error) {
      console.error("Error checking performance anomalies:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reporting Routes
  app.get("/api/analytics/reports/weekly", async (req, res) => {
    try {
      const report = await analyticsService.generateWeeklyReport();
      res.json(report);
    } catch (error) {
      console.error("Error generating weekly report:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/analytics/reports/monthly", async (req, res) => {
    try {
      const report = await analyticsService.generateMonthlyReport();
      res.json(report);
    } catch (error) {
      console.error("Error generating monthly report:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/analytics/reports/quarterly", async (req, res) => {
    try {
      const report = await analyticsService.generateQuarterlyReport();
      res.json(report);
    } catch (error) {
      console.error("Error generating quarterly report:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics Job Triggers (for scheduled tasks)
  app.post("/api/analytics/jobs/run-monitoring", async (req, res) => {
    try {
      console.log('🚀 Running analytics monitoring jobs...');
      
      await Promise.allSettled([
        analyticsService.checkPerformanceAnomalies(),
        // Add other monitoring jobs here
      ]);
      
      console.log('✅ Analytics monitoring jobs completed');
      res.json({ 
        message: "Analytics monitoring jobs completed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error running analytics monitoring jobs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test analytics endpoint
  app.post("/api/analytics/test/:type", async (req, res) => {
    try {
      const { type } = req.params;
      
      let result: any;
      
      switch (type) {
        case 'dashboard':
          result = await analyticsService.getDashboardMetrics();
          break;
        case 'funnel':
          result = await analyticsService.getFunnelAnalytics();
          break;
        case 'predictive':
          result = await analyticsService.getPredictiveAnalytics();
          break;
        case 'alerts':
          result = await analyticsService.checkPerformanceAnomalies();
          break;
        default:
          return res.status(400).json({ error: "Invalid test type" });
      }
      
      res.json({ 
        message: `Analytics test ${type} completed successfully`,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error testing analytics ${req.params.type}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
