import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingUp,
  MessageSquare,
  Users,
  Send,
  Calendar,
  Activity,
  Smartphone
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface AnalyticsData {
  totalMessages: number;
  totalBroadcasts: number;
  totalContacts: number;
  totalDevices: number;
  connectedDevices: number;
  messagesThisMonth: number;
  broadcastsThisMonth: number;
  messagesByDay: { date: string; count: number }[];
  messagesByDevice: { device: string; count: number }[];
  messagesByType: { type: string; count: number }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export const Analytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalMessages: 0,
    totalBroadcasts: 0,
    totalContacts: 0,
    totalDevices: 0,
    connectedDevices: 0,
    messagesThisMonth: 0,
    broadcastsThisMonth: 0,
    messagesByDay: [],
    messagesByDevice: [],
    messagesByType: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Total Messages
      const { count: messagesCount } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Total Broadcasts
      const { count: broadcastsCount } = await supabase
        .from("broadcasts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Total Contacts
      const { count: contactsCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Devices
      const { data: devices } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", user.id);

      const connectedCount = devices?.filter(d => d.status === "connected").length || 0;

      // Messages This Month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: messagesThisMonthCount } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString());

      const { count: broadcastsThisMonthCount } = await supabase
        .from("broadcasts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString());

      // Messages by Day (last 7 days)
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);

      const { data: messagesByDay } = await supabase
        .from("message_history")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", last7Days.toISOString())
        .order("created_at", { ascending: true });

      const dayCount: Record<string, number> = {};
      messagesByDay?.forEach(msg => {
        const date = new Date(msg.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        dayCount[date] = (dayCount[date] || 0) + 1;
      });

      const messagesByDayData = Object.entries(dayCount).map(([date, count]) => ({
        date,
        count
      }));

      // Messages by Device
      const { data: messagesByDevice } = await supabase
        .from("message_history")
        .select("device_id, devices(device_name)")
        .eq("user_id", user.id);

      const deviceCount: Record<string, number> = {};
      messagesByDevice?.forEach((msg: any) => {
        const deviceName = msg.devices?.device_name || "Unknown";
        deviceCount[deviceName] = (deviceCount[deviceName] || 0) + 1;
      });

      const messagesByDeviceData = Object.entries(deviceCount).map(([device, count]) => ({
        device,
        count
      }));

      // Messages by Type
      const { data: messagesByType } = await supabase
        .from("message_history")
        .select("message_type")
        .eq("user_id", user.id);

      const typeCount: Record<string, number> = {};
      messagesByType?.forEach(msg => {
        const type = msg.message_type || "text";
        typeCount[type] = (typeCount[type] || 0) + 1;
      });

      const messagesByTypeData = Object.entries(typeCount).map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count
      }));

      setAnalytics({
        totalMessages: messagesCount || 0,
        totalBroadcasts: broadcastsCount || 0,
        totalContacts: contactsCount || 0,
        totalDevices: devices?.length || 0,
        connectedDevices: connectedCount,
        messagesThisMonth: messagesThisMonthCount || 0,
        broadcastsThisMonth: broadcastsThisMonthCount || 0,
        messagesByDay: messagesByDayData,
        messagesByDevice: messagesByDeviceData,
        messagesByType: messagesByTypeData
      });

    } catch (error: any) {
      toast.error("Gagal memuat data analytics");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Activity className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor performa dan aktivitas WhatsApp Anda
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Pesan"
            value={analytics.totalMessages}
            icon={MessageSquare}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Broadcasts"
            value={analytics.totalBroadcasts}
            icon={Send}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="Total Kontak"
            value={analytics.totalContacts}
            icon={Users}
            trend={{ value: 15, isPositive: true }}
          />
          <StatCard
            title="Device Aktif"
            value={`${analytics.connectedDevices}/${analytics.totalDevices}`}
            icon={Smartphone}
          />
        </div>

        {/* Monthly Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Bulan Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pesan Terkirim</p>
                      <p className="text-2xl font-bold">{analytics.messagesThisMonth}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                      <Send className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Broadcast Dibuat</p>
                      <p className="text-2xl font-bold">{analytics.broadcastsThisMonth}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Messages by Type Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Tipe Pesan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.messagesByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analytics.messagesByType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.messagesByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6">
          {/* Messages Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tren Pesan (7 Hari Terakhir)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.messagesByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.messagesByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--foreground))" />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Pesan"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada data untuk ditampilkan
                </div>
              )}
            </CardContent>
          </Card>

          {/* Messages by Device */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Pesan per Device
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.messagesByDevice.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.messagesByDevice}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="device" stroke="hsl(var(--foreground))" />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Pesan" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada data untuk ditampilkan
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Analytics;
