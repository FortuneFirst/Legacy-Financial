import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { 
  DashboardMetrics, 
  LeadPerformanceMetrics, 
  FunnelAnalytics, 
  EngagementAnalytics, 
  SalesPerformanceMetrics, 
  RetentionMetrics 
} from "@/types/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, FunnelChart, Funnel,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, RadialBarChart, RadialBar
} from "recharts";
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Target, AlertTriangle,
  Calendar as CalendarIcon, Download, Filter, RefreshCw, Eye, MousePointer,
  MessageCircle, Mail, Phone, Trophy, Award, Zap, BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ===== ANALYTICS DASHBOARD COMPONENT =====

export default function Analytics() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState("30d");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Trigger refresh of all queries
      window.location.reload();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Fetch dashboard metrics
  const { data: dashboardMetrics, isLoading: loadingDashboard } = useQuery<DashboardMetrics>({
    queryKey: ["/api/analytics/dashboard"],
    refetchInterval: autoRefresh ? 30000 : false
  });

  // Fetch funnel analytics
  const { data: funnelData, isLoading: loadingFunnel } = useQuery<FunnelAnalytics>({
    queryKey: ["/api/analytics/funnel", dateRange],
    queryFn: () => fetch(`/api/analytics/funnel?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`).then(r => r.json())
  });

  // Fetch lead performance metrics
  const { data: leadMetrics, isLoading: loadingLeads } = useQuery<LeadPerformanceMetrics>({
    queryKey: ["/api/analytics/leads/performance", dateRange],
    queryFn: () => fetch(`/api/analytics/leads/performance?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`).then(r => r.json())
  });

  // Fetch engagement analytics
  const { data: engagementData, isLoading: loadingEngagement } = useQuery<EngagementAnalytics>({
    queryKey: ["/api/analytics/engagement", dateRange],
    queryFn: () => fetch(`/api/analytics/engagement?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`).then(r => r.json())
  });

  // Fetch sales performance
  const { data: salesData, isLoading: loadingSales } = useQuery<SalesPerformanceMetrics>({
    queryKey: ["/api/analytics/sales", dateRange],
    queryFn: () => fetch(`/api/analytics/sales?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`).then(r => r.json())
  });

  // Fetch retention metrics
  const { data: retentionData, isLoading: loadingRetention } = useQuery<RetentionMetrics>({
    queryKey: ["/api/analytics/retention", dateRange],
    queryFn: () => fetch(`/api/analytics/retention?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`).then(r => r.json())
  });

  // Fetch active alerts
  const { data: alerts, isLoading: loadingAlerts } = useQuery<any[]>({
    queryKey: ["/api/analytics/alerts"],
    refetchInterval: 10000 // Check for alerts every 10 seconds
  });

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="analytics-dashboard">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="page-title">
              Analytics & Optimization Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Real-time insights into lead generation, sales performance, and optimization opportunities
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-4 lg:mt-0">
            {/* Date Range Selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-[240px] justify-start text-left font-normal")}
                  data-testid="date-range-selector"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => range && setDateRange(range as { from: Date; to: Date })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {/* Auto Refresh Toggle */}
            <Button
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              data-testid="auto-refresh-toggle"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", autoRefresh && "animate-spin")} />
              Auto Refresh
            </Button>

            {/* Export Button */}
            <Button variant="outline" data-testid="export-button">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Active Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="mb-6">
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800 dark:text-red-200">Active Performance Alerts</AlertTitle>
              <AlertDescription className="text-red-700 dark:text-red-300">
                {alerts.length} performance issues detected. 
                <Button variant="link" className="p-0 h-auto text-red-600 underline ml-2">
                  View Details
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Real-time Metrics Overview */}
        {dashboardMetrics?.realTimeMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Visitors</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="active-visitors">
                  {dashboardMetrics.realTimeMetrics.activeVisitors}
                </div>
                <p className="text-xs text-muted-foreground">Currently online</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Leads</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="today-leads">
                  {dashboardMetrics.realTimeMetrics.todayLeads}
                </div>
                <p className="text-xs text-muted-foreground">New leads today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="today-conversions">
                  {dashboardMetrics.realTimeMetrics.todayConversions}
                </div>
                <p className="text-xs text-muted-foreground">Deals closed today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Live Conversion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600" data-testid="live-conversion-rate">
                  {dashboardMetrics.realTimeMetrics.liveConversionRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Real-time rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600" data-testid="active-campaigns">
                  {dashboardMetrics.realTimeMetrics.activeCampaigns}
                </div>
                <p className="text-xs text-muted-foreground">Running campaigns</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads">Lead Performance</TabsTrigger>
            <TabsTrigger value="funnel" data-testid="tab-funnel">Funnel Analysis</TabsTrigger>
            <TabsTrigger value="engagement" data-testid="tab-engagement">Engagement</TabsTrigger>
            <TabsTrigger value="sales" data-testid="tab-sales">Sales</TabsTrigger>
            <TabsTrigger value="retention" data-testid="tab-retention">Retention</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lead Score Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Lead Score Distribution</CardTitle>
                  <CardDescription>Quality breakdown of incoming leads</CardDescription>
                </CardHeader>
                <CardContent>
                  {leadMetrics?.leadScoreDistribution && (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={leadMetrics.leadScoreDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ scoreRange, count }) => `${scoreRange}: ${count}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {leadMetrics.leadScoreDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top Performing Sources */}
              <Card>
                <CardHeader>
                  <CardTitle>Lead Source Performance</CardTitle>
                  <CardDescription>Conversion rates by acquisition channel</CardDescription>
                </CardHeader>
                <CardContent>
                  {leadMetrics?.sourcePerformance && (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={leadMetrics.sourcePerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="source" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="conversionRate" fill="#8884d8" name="Conversion Rate %" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Campaign ROI Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Campaign ROI Performance</CardTitle>
                  <CardDescription>Return on investment by campaign</CardDescription>
                </CardHeader>
                <CardContent>
                  {engagementData?.campaignROI && (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={engagementData.campaignROI}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="campaignName" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="roi" fill="#00C49F" name="ROI %" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Sales by Product Type */}
              <Card>
                <CardHeader>
                  <CardTitle>Insurance Sales Breakdown</CardTitle>
                  <CardDescription>Sales distribution by product type</CardDescription>
                </CardHeader>
                <CardContent>
                  {salesData?.insuranceSales?.salesByProductType && (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(salesData.insuranceSales.salesByProductType).map(([product, sales]) => ({ product, sales }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ product, sales }) => `${product}: ${sales}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="sales"
                        >
                          {Object.entries(salesData.insuranceSales.salesByProductType).map(([_, sales], index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Lead Performance Tab */}
          <TabsContent value="leads" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-blue-600">
                    {leadMetrics?.totalLeads || 0}
                  </CardTitle>
                  <CardDescription>Total Leads Generated</CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-green-600">
                    ${((leadMetrics?.costPerLead?.quiz || 25) / 100).toFixed(2)}
                  </CardTitle>
                  <CardDescription>Average Cost Per Lead</CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-purple-600">
                    {Object.values(leadMetrics?.conversionRateBySource || {}).reduce((a, b) => a + b, 0) / Object.keys(leadMetrics?.conversionRateBySource || {}).length || 0}%
                  </CardTitle>
                  <CardDescription>Average Conversion Rate</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* Detailed source performance table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Source Performance</CardTitle>
                <CardDescription>Complete breakdown of lead performance by source</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Source</th>
                        <th className="text-left p-2">Total Leads</th>
                        <th className="text-left p-2">Conversion Rate</th>
                        <th className="text-left p-2">Avg Lead Score</th>
                        <th className="text-left p-2">Cost Per Lead</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadMetrics?.sourcePerformance?.map((source: any) => (
                        <tr key={source.source} className="border-b">
                          <td className="p-2 font-medium">{source.source}</td>
                          <td className="p-2">{source.totalLeads}</td>
                          <td className="p-2">
                            <Badge variant={source.conversionRate > 20 ? "default" : "secondary"}>
                              {source.conversionRate.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="p-2">{source.avgLeadScore.toFixed(1)}</td>
                          <td className="p-2">${source.costPerLead.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Funnel Analysis Tab */}
          <TabsContent value="funnel" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel Analysis</CardTitle>
                <CardDescription>Step-by-step conversion tracking from lead to client</CardDescription>
              </CardHeader>
              <CardContent>
                {funnelData?.overallFunnel && (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={funnelData.overallFunnel}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.6} 
                        name="Count"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Drop-off Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Stage Drop-off Analysis</CardTitle>
                <CardDescription>Conversion and drop-off rates by funnel stage</CardDescription>
              </CardHeader>
              <CardContent>
                {funnelData?.overallFunnel && (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={funnelData.overallFunnel}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="conversionRate" fill="#00C49F" name="Conversion Rate %" />
                      <Bar dataKey="dropOffRate" fill="#FF8042" name="Drop-off Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Email Open Rate</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {engagementData?.emailMetrics?.openRate?.toFixed(1) || 0}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Email Click Rate</CardTitle>
                  <MousePointer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {engagementData?.emailMetrics?.clickRate?.toFixed(1) || 0}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">SMS Response Rate</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {engagementData?.smsMetrics?.responseRate?.toFixed(1) || 0}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Quiz Completion</CardTitle>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {engagementData?.quizCompletionRate?.toFixed(1) || 0}%
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-green-600">
                    {salesData?.insuranceSales?.totalSales || 0}
                  </CardTitle>
                  <CardDescription>Insurance Sales</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-blue-600">
                    {salesData?.recruitmentMetrics?.totalRecruits || 0}
                  </CardTitle>
                  <CardDescription>New Recruits</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-purple-600">
                    ${salesData?.insuranceSales?.avgDealSize?.toFixed(0) || 0}
                  </CardTitle>
                  <CardDescription>Avg Deal Size</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-orange-600">
                    {salesData?.insuranceSales?.conversionRate?.toFixed(1) || 0}%
                  </CardTitle>
                  <CardDescription>Sales Conversion Rate</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* Team Performance Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle>Team Performance Leaderboard</CardTitle>
                <CardDescription>Top performing team members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {salesData?.teamPerformance?.map((member: any, index: number) => (
                    <div key={member.teamMemberId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                          {index < 3 ? <Trophy className="w-4 h-4 text-yellow-600" /> : <Award className="w-4 h-4 text-gray-600" />}
                        </div>
                        <div>
                          <p className="font-medium">{member.teamMemberName}</p>
                          <p className="text-sm text-gray-600">{member.totalDeals} deals</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${member.totalRevenue.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{member.conversionRate.toFixed(1)}% conversion</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Retention Tab */}
          <TabsContent value="retention" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-green-600">
                    {retentionData?.clientRetentionRate?.toFixed(1) || 0}%
                  </CardTitle>
                  <CardDescription>Client Retention Rate</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-blue-600">
                    {retentionData?.recruitRetentionRate?.toFixed(1) || 0}%
                  </CardTitle>
                  <CardDescription>Recruit Retention Rate</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-purple-600">
                    {retentionData?.referralGenerationRate?.toFixed(1) || 0}%
                  </CardTitle>
                  <CardDescription>Referral Generation Rate</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-orange-600">
                    ${retentionData?.lifetimeValueTracking?.avgClientLTV?.toFixed(0) || 0}
                  </CardTitle>
                  <CardDescription>Avg Client LTV</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* Churn Risk Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Churn Risk Analysis</CardTitle>
                <CardDescription>High-risk clients and recruits requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {retentionData?.churnPrediction?.map((entity: any) => (
                    <div key={entity.entityId} className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-red-800">{entity.entityType.toUpperCase()}: {entity.entityId}</p>
                        <p className="text-sm text-red-600">Risk Factors: {entity.riskFactors.join(', ')}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive">
                          {(entity.churnProbability * 100).toFixed(0)}% Risk
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}