// Re-export analytics types from server for frontend use
export type {
  LeadPerformanceMetrics,
  FunnelAnalytics,
  EngagementAnalytics,
  SalesPerformanceMetrics,
  RetentionMetrics,
  DashboardMetrics,
  ABTestResults,
  PredictiveAnalytics
} from '../../../server/analytics-service';

// Additional frontend-specific types for analytics component
export interface AnalyticsChartData {
  name: string;
  value: number;
  [key: string]: any;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AlertData {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
}