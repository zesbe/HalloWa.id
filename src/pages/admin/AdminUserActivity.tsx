import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, Users, MessageSquare, Calendar, Clock, 
  DollarSign, Smartphone, Send, Bot, TrendingUp, 
  TrendingDown, ArrowUpRight, ArrowDownRight, 
  Radio, CheckCircle, XCircle, RefreshCw,
  FileText, BarChart3, Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ActivityData {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsers: number;
  avgMessagesPerUser: number;
  avgDevicesPerUser: number;
  engagementRate: number;
  topActiveUsers: Array<{
    name: string;
    email: string;
    messageCount: number;
    deviceCount: number;
    lastActive: string;
    subscriptionStatus: string;
  }>;
  activityByHour: { hour: number; count: number }[];
  totalBroadcasts: number;
  totalAutoPostSchedules: number;
  activeAutoPostSchedules: number;
  totalPayments: number;
  completedPayments: number;
  totalRevenue: number;
  totalDevices: number;
  connectedDevices: number;
  disconnectedDevices: number;
  totalChatbotRules: number;
  activeChatbotRules: number;
  totalContacts: number;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    user: string;
  }>;
  userGrowth: Array<{
    date: string;
    count: number;
  }>;
  broadcastStats: {
    sent: number;
    failed: number;
    pending: number;
  };
  messageStats: {
    total: number;
    today: number;
    thisWeek: number;
  };
}

export const AdminUserActivity = () => {
  const [data, setData] = useState<ActivityData>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    newUsers: 0,
    avgMessagesPerUser: 0,
    avgDevicesPerUser: 0,
    engagementRate: 0,
    topActiveUsers: [],
    activityByHour: [],
    totalBroadcasts: 0,
    totalAutoPostSchedules: 0,
    activeAutoPostSchedules: 0,
    totalPayments: 0,
    completedPayments: 0,
    totalRevenue: 0,
    totalDevices: 0,
    connectedDevices: 0,
    disconnectedDevices: 0,
    totalChatbotRules: 0,
    activeChatbotRules: 0,
    totalContacts: 0,
    recentActivity: [],
    userGrowth: [],
    broadcastStats: { sent: 0, failed: 0, pending: 0 },
    messageStats: { total: 0, today: 0, thisWeek: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    fetchActivityData();
  }, [period]);

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      const daysAgo = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Active users (with subscriptions)
      const { count: activeUsers } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const inactiveUsers = (totalUsers || 0) - (activeUsers || 0);

      // New users in period
      const { count: newUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", daysAgo);

      // Message statistics
      const { count: totalMessages } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true })
        .gte("created_at", daysAgo);

      const { count: todayMessages } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());

      const { count: weekMessages } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo);

      // Total devices and status
      const { count: totalDevices } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true });

      const { count: connectedDevices } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("status", "connected");

      const disconnectedDevices = (totalDevices || 0) - (connectedDevices || 0);

      // Broadcasts statistics
      const { count: totalBroadcasts } = await supabase
        .from("broadcasts")
        .select("*", { count: "exact", head: true });

      const { data: broadcastsData } = await supabase
        .from("broadcasts")
        .select("status");

      const broadcastStats = {
        sent: broadcastsData?.filter(b => b.status === 'completed').length || 0,
        failed: broadcastsData?.filter(b => b.status === 'failed').length || 0,
        pending: broadcastsData?.filter(b => b.status === 'pending' || b.status === 'draft').length || 0
      };

      // Auto Post Schedules
      const { count: totalAutoPostSchedules } = await supabase
        .from("auto_post_schedules")
        .select("*", { count: "exact", head: true });

      const { count: activeAutoPostSchedules } = await supabase
        .from("auto_post_schedules")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Payments
      const { count: totalPayments } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true });

      const { count: completedPayments, data: completedPaymentsData } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "completed");

      const totalRevenue = completedPaymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Chatbot Rules
      const { count: totalChatbotRules } = await supabase
        .from("chatbot_rules")
        .select("*", { count: "exact", head: true });

      const { count: activeChatbotRules } = await supabase
        .from("chatbot_rules")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Contacts
      const { count: totalContacts } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });

      const avgMessagesPerUser = totalUsers ? (totalMessages || 0) / totalUsers : 0;
      const avgDevicesPerUser = totalUsers ? (totalDevices || 0) / totalUsers : 0;
      
      // Engagement rate (users with messages / total users)
      const { data: usersWithMessages } = await supabase
        .from("message_history")
        .select("user_id")
        .gte("created_at", daysAgo);

      const uniqueActiveUsers = new Set(usersWithMessages?.map(m => m.user_id)).size;
      const engagementRate = totalUsers ? (uniqueActiveUsers / totalUsers) * 100 : 0;

      // Top active users
      const { data: messages } = await supabase
        .from("message_history")
        .select("user_id")
        .gte("created_at", daysAgo);

      const userMessageCounts = messages?.reduce((acc: any, msg) => {
        acc[msg.user_id] = (acc[msg.user_id] || 0) + 1;
        return acc;
      }, {});

      const topUserIds = Object.entries(userMessageCounts || {})
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 10)
        .map(([userId]) => userId);

      const { data: topUsers } = await supabase
        .from("profiles")
        .select("id, full_name, email, updated_at")
        .in("id", topUserIds);

      const { data: userDevices } = await supabase
        .from("devices")
        .select("user_id")
        .in("user_id", topUserIds);

      const { data: userSubscriptions } = await supabase
        .from("user_subscriptions")
        .select("user_id, status")
        .in("user_id", topUserIds);

      const deviceCounts = userDevices?.reduce((acc: any, device) => {
        acc[device.user_id] = (acc[device.user_id] || 0) + 1;
        return acc;
      }, {});

      const subscriptionMap = userSubscriptions?.reduce((acc: any, sub) => {
        acc[sub.user_id] = sub.status;
        return acc;
      }, {});

      const topActiveUsers = topUsers?.map(user => ({
        name: user.full_name || "Unknown",
        email: user.email || "N/A",
        messageCount: userMessageCounts?.[user.id] || 0,
        deviceCount: deviceCounts?.[user.id] || 0,
        lastActive: user.updated_at,
        subscriptionStatus: subscriptionMap?.[user.id] || "inactive"
      })) || [];

      // Activity by hour
      const { data: recentMessages } = await supabase
        .from("message_history")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const hourCounts = recentMessages?.reduce((acc: any, msg) => {
        const hour = new Date(msg.created_at).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});

      const activityByHour = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourCounts?.[i] || 0
      }));

      // User growth (last 30 days)
      const { data: userProfiles } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true });

      const growthByDate: Record<string, number> = {};
      userProfiles?.forEach(profile => {
        const date = new Date(profile.created_at).toISOString().split('T')[0];
        growthByDate[date] = (growthByDate[date] || 0) + 1;
      });

      let cumulative = 0;
      const userGrowth = Object.entries(growthByDate).map(([date, count]) => {
        cumulative += count;
        return { date, count: cumulative };
      });

      // Recent activity (from various tables)
      const recentActivity: Array<{
        type: string;
        description: string;
        timestamp: string;
        user: string;
      }> = [];

      // Fetch recent broadcasts
      const { data: recentBroadcasts } = await supabase
        .from("broadcasts")
        .select("name, created_at, user_id, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(5);

      recentBroadcasts?.forEach(b => {
        recentActivity.push({
          type: "broadcast",
          description: `Broadcast "${b.name}" dibuat`,
          timestamp: b.created_at,
          user: (b.profiles as any)?.full_name || "Unknown"
        });
      });

      // Fetch recent payments
      const { data: recentPayments } = await supabase
        .from("payments")
        .select("order_id, created_at, status, amount, user_id, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(5);

      recentPayments?.forEach(p => {
        recentActivity.push({
          type: "payment",
          description: `Pembayaran ${p.status} - Rp ${Number(p.amount).toLocaleString('id-ID')}`,
          timestamp: p.created_at,
          user: (p.profiles as any)?.full_name || "Unknown"
        });
      });

      // Fetch recent devices
      const { data: recentDevices } = await supabase
        .from("devices")
        .select("device_name, created_at, status, user_id, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(5);

      recentDevices?.forEach(d => {
        recentActivity.push({
          type: "device",
          description: `Perangkat "${d.device_name}" - ${d.status}`,
          timestamp: d.created_at,
          user: (d.profiles as any)?.full_name || "Unknown"
        });
      });

      // Sort recent activity by timestamp
      recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const limitedRecentActivity = recentActivity.slice(0, 15);

      setData({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        inactiveUsers,
        newUsers: newUsers || 0,
        avgMessagesPerUser,
        avgDevicesPerUser,
        engagementRate,
        topActiveUsers,
        activityByHour,
        totalBroadcasts: totalBroadcasts || 0,
        totalAutoPostSchedules: totalAutoPostSchedules || 0,
        activeAutoPostSchedules: activeAutoPostSchedules || 0,
        totalPayments: totalPayments || 0,
        completedPayments: completedPayments || 0,
        totalRevenue,
        totalDevices: totalDevices || 0,
        connectedDevices: connectedDevices || 0,
        disconnectedDevices,
        totalChatbotRules: totalChatbotRules || 0,
        activeChatbotRules: activeChatbotRules || 0,
        totalContacts: totalContacts || 0,
        recentActivity: limitedRecentActivity,
        userGrowth,
        broadcastStats,
        messageStats: {
          total: totalMessages || 0,
          today: todayMessages || 0,
          thisWeek: weekMessages || 0
        }
      });
    } catch (error) {
      console.error("Error fetching activity data:", error);
      toast.error("Gagal memuat data aktivitas");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    toast.info("Memperbarui data...");
    fetchActivityData();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Memuat data aktivitas...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Activity className="w-8 h-8 text-primary" />
              Aktivitas Pengguna
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Pantau engagement dan pola aktivitas pengguna secara real-time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Pilih periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Hari Terakhir</SelectItem>
                <SelectItem value="30">30 Hari Terakhir</SelectItem>
                <SelectItem value="90">90 Hari Terakhir</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Pengguna</TabsTrigger>
            <TabsTrigger value="activity">Aktivitas</TabsTrigger>
            <TabsTrigger value="revenue">Pendapatan</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Total Pengguna
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalUsers}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="default" className="text-xs">
                      {data.activeUsers} aktif
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {data.inactiveUsers} tidak aktif
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Pengguna Baru
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.newUsers}</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {period} hari terakhir
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Engagement Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {data.engagementRate.toFixed(1)}%
                    {data.engagementRate > 50 ? (
                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pengguna aktif
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Total Pesan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.messageStats.total}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {data.messageStats.today} hari ini
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Perangkat
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalDevices}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="text-xs bg-green-500">
                      <Radio className="w-3 h-3 mr-1" />
                      {data.connectedDevices}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {data.disconnectedDevices}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Broadcast
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalBroadcasts}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="text-xs bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {data.broadcastStats.sent}
                    </Badge>
                    <Badge variant="destructive" className="text-xs">
                      <XCircle className="w-3 h-3 mr-1" />
                      {data.broadcastStats.failed}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Auto Post
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalAutoPostSchedules}</div>
                  <Badge className="text-xs mt-2">
                    {data.activeAutoPostSchedules} aktif
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    Chatbot Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalChatbotRules}</div>
                  <Badge className="text-xs mt-2">
                    {data.activeChatbotRules} aktif
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Activity by Hour Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Aktivitas per Jam (24 Jam Terakhir)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-1 h-40">
                  {data.activityByHour.map((item) => {
                    const maxCount = Math.max(...data.activityByHour.map(d => d.count), 1);
                    const height = (item.count / maxCount) * 100;
                    return (
                      <div key={item.hour} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className="w-full bg-gradient-to-t from-primary to-primary/50 rounded-t hover:from-primary/80 hover:to-primary/30 transition-all cursor-pointer relative group"
                          style={{ height: `${height}%`, minHeight: item.count > 0 ? '8px' : '2px' }}
                        >
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {item.hour}:00 - {item.count} pesan
                          </div>
                        </div>
                        {item.hour % 4 === 0 && (
                          <span className="text-xs text-muted-foreground font-medium">
                            {item.hour}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Aktivitas Terbaru
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.recentActivity.slice(0, 10).map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'broadcast' ? 'bg-blue-500/10 text-blue-500' :
                        activity.type === 'payment' ? 'bg-green-500/10 text-green-500' :
                        'bg-orange-500/10 text-orange-500'
                      }`}>
                        {activity.type === 'broadcast' && <Send className="w-4 h-4" />}
                        {activity.type === 'payment' && <DollarSign className="w-4 h-4" />}
                        {activity.type === 'device' && <Smartphone className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">{activity.user}</p>
                          <span className="text-xs text-muted-foreground">•</span>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.timestamp).toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Top Active Users */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Top 10 Pengguna Paling Aktif
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topActiveUsers.map((user, index) => (
                    <div key={user.email} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                          index === 1 ? 'bg-gray-300/20 text-gray-600' :
                          index === 2 ? 'bg-orange-500/20 text-orange-600' :
                          'bg-primary/10 text-primary'
                        }`}>
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            {user.messageCount}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Smartphone className="w-3 h-3 mr-1" />
                            {user.deviceCount}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={`text-xs ${
                              user.subscriptionStatus === 'active' 
                                ? 'bg-green-500' 
                                : 'bg-gray-500'
                            }`}
                          >
                            {user.subscriptionStatus === 'active' ? 'Aktif' : 'Tidak Aktif'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {new Date(user.lastActive).toLocaleDateString("id-ID")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Growth Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Pertumbuhan Pengguna (30 Hari Terakhir)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end justify-between gap-1">
                  {data.userGrowth.length > 0 ? (
                    data.userGrowth.map((item, index) => {
                      const maxCount = Math.max(...data.userGrowth.map(d => d.count), 1);
                      const height = (item.count / maxCount) * 100;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1 group">
                          <div
                            className="w-full bg-gradient-to-t from-green-500 to-green-300 rounded-t hover:from-green-600 hover:to-green-400 transition-all cursor-pointer relative"
                            style={{ height: `${height}%`, minHeight: '4px' }}
                          >
                            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              {new Date(item.date).toLocaleDateString("id-ID")}
                              <br />
                              {item.count} pengguna
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center w-full">
                      Tidak ada data pertumbuhan pengguna
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Rata-rata Pesan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.avgMessagesPerUser.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per pengguna
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Rata-rata Perangkat
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.avgDevicesPerUser.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per pengguna
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Total Kontak
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.totalContacts}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Di semua pengguna
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Activity Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Feed Aktivitas Lengkap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.recentActivity.map((activity, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        activity.type === 'broadcast' ? 'bg-blue-500' :
                        activity.type === 'payment' ? 'bg-green-500' :
                        'bg-orange-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {activity.type === 'broadcast' ? 'Broadcast' :
                             activity.type === 'payment' ? 'Pembayaran' : 'Perangkat'}
                          </Badge>
                          <p className="text-sm">{activity.description}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">{activity.user}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString("id-ID", {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total Pendapatan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    Rp {data.totalRevenue.toLocaleString('id-ID')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dari pembayaran selesai
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Total Pembayaran
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalPayments}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="text-xs bg-green-500">
                      {data.completedPayments} selesai
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {data.totalPayments - data.completedPayments} pending
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Rata-rata per Transaksi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    Rp {data.completedPayments > 0 
                      ? (data.totalRevenue / data.completedPayments).toLocaleString('id-ID', { maximumFractionDigits: 0 })
                      : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per pembayaran selesai
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminUserActivity;
