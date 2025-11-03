import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Smartphone, QrCode, Trash2, RefreshCw, Copy, LogOut, Info, RotateCcw, Database, Bell, BellOff, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  requestNotificationPermission, 
  notifyDeviceConnected, 
  notifyDeviceDisconnected,
  notifyDeviceError 
} from "@/utils/notifications";
import { DeviceCard } from "@/components/DeviceCard";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  pairing_code: string | null;
  connection_method: string | null;
  phone_for_pairing: string | null;
  last_connected_at: string | null;
  api_key: string | null;
  server_id: string | null;
  webhook_url: string | null;
  is_multidevice: boolean;
}

export const Devices = () => {
  const { canAddDevice, isLimitReached, subscription, refreshUsage } = useSubscription();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [qrExpiry, setQrExpiry] = useState<number>(0);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [swipedDeviceId, setSwipedDeviceId] = useState<string | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<'qr' | 'pairing'>('qr');
  const [pairingPhone, setPairingPhone] = useState('');

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().then(granted => {
      setNotificationsEnabled(granted);
    });
  }, []);

  useEffect(() => {
    fetchDevices();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('devices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices'
        },
        (payload) => {
          console.log('Device update:', payload);
          fetchDevices();
          
          // Send notifications for device status changes
          if (payload.eventType === 'UPDATE' && notificationsEnabled) {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            const deviceName = payload.new?.device_name;
            
            if (oldStatus !== newStatus && deviceName) {
              if (newStatus === 'connected') {
                notifyDeviceConnected(deviceName);
                toast.success(`${deviceName} Terhubung! ✅`, {
                  description: 'Device berhasil connect ke WhatsApp'
                });
              } else if (newStatus === 'connecting' && oldStatus === 'connected') {
                toast.info(`${deviceName} Reconnecting... 🔄`, {
                  description: 'Device sedang mencoba reconnect otomatis'
                });
              } else if (newStatus === 'disconnected' && oldStatus === 'connected') {
                notifyDeviceDisconnected(deviceName);
                toast.warning(`${deviceName} Terputus ⚠️`, {
                  description: 'Koneksi WhatsApp terputus'
                });
              } else if (newStatus === 'error') {
                notifyDeviceError(deviceName);
                toast.error(`${deviceName} Error ❌`, {
                  description: 'Terjadi kesalahan pada device'
                });
              }
            }
          }
          
          // Auto-close dialog when connected
          if (payload.eventType === 'UPDATE' && payload.new?.status === 'connected') {
            setTimeout(() => {
              setQrDialogOpen(false);
              setConnectionStatus("idle");
            }, 1500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  // QR expiry countdown
  useEffect(() => {
    if (qrExpiry > 0 && qrDialogOpen) {
      const timer = setTimeout(() => {
        setQrExpiry(qrExpiry - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (qrExpiry === 0 && connectionStatus === "qr_ready") {
      setConnectionStatus("qr_expired");
    }
  }, [qrExpiry, qrDialogOpen, connectionStatus]);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data device");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check limit
    if (!canAddDevice()) {
      toast.error("Limit device tercapai!", {
        description: `Plan Anda hanya mengizinkan ${subscription?.plan?.max_devices || 0} device. Upgrade plan untuk menambah lebih banyak.`
      });
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("devices").insert({
        user_id: user.id,
        device_name: deviceName,
        status: "disconnected",
      });

      if (error) throw error;

      toast.success("Device berhasil ditambahkan");
      setDeviceName("");
      setDialogOpen(false);
      fetchDevices();
      refreshUsage(); // Refresh usage stats
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleConnectDevice = async (device: Device, method?: 'qr' | 'pairing', phone?: string) => {
    setSelectedDevice(device);
    setQrDialogOpen(true);
    
    // If no method specified, show selection dialog
    if (!method) {
      setConnectionStatus("idle");
      return;
    }

    setConnectionStatus("connecting");
    setQrExpiry(60);
    
    try {
      // Clear existing polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      // Update device status to 'connecting' - Railway service will detect this
      const updateData: any = { 
        status: "connecting",
        qr_code: null,
        pairing_code: null,
        connection_method: method
      };

      if (method === 'pairing' && phone) {
        updateData.phone_for_pairing = phone;
      }

      const { error } = await supabase
        .from("devices")
        .update(updateData)
        .eq("id", device.id);

      if (error) throw error;

      setConnectionStatus(method === 'qr' ? "generating_qr" : "generating_pairing");
      toast.info(method === 'qr' ? "Menghubungkan ke WhatsApp..." : "Membuat kode pairing...");

      // Poll updates from DB and fetch ephemeral codes from Edge Function (Redis)
      const interval = setInterval(async () => {
        // 1) Read latest device row
        const { data: row, error: rowError } = await supabase
          .from("devices")
          .select("*")
          .eq("id", device.id)
          .single();

        if (rowError) {
          console.error("Polling error:", rowError);
          return;
        }

        // 2) Fetch QR/Pairing codes from Edge Function (stored in Redis)
        let qrCode: string | null = null;
        let pairingCode: string | null = null;
        try {
          const { data: codes } = await supabase.functions.invoke('get-device-qr', {
            body: { deviceId: device.id },
          });
          qrCode = codes?.qrCode ?? null;
          pairingCode = codes?.pairingCode ?? null;
        } catch (fnErr) {
          // Non-fatal: just log
          console.debug('get-device-qr error (non-fatal):', fnErr);
        }

        if (row) {
          // Merge ephemeral codes into local state (do NOT write to DB)
          const merged: any = { ...row, qr_code: qrCode, pairing_code: pairingCode };
          setSelectedDevice(merged);

          // QR flow
          if (qrCode && row.status === "connecting" && method === 'qr') {
            if (connectionStatus !== "qr_ready" || merged.qr_code !== selectedDevice?.qr_code) {
              setConnectionStatus("qr_ready");
              setQrExpiry(60);
              toast.success("QR Code siap! Scan sekarang");
            }
          }

          // Pairing flow
          if (pairingCode && row.status === "connecting" && method === 'pairing') {
            if (connectionStatus !== "pairing_ready" || merged.pairing_code !== selectedDevice?.pairing_code) {
              setConnectionStatus("pairing_ready");
              toast.success("Kode pairing siap! Masukkan di WhatsApp");
            }
          }

          // Connected
          if (row.status === "connected") {
            setConnectionStatus("connected");
            toast.success("WhatsApp berhasil terhubung!");
            clearInterval(interval);
            setPollingInterval(null);
            fetchDevices();
            setTimeout(() => {
              setQrDialogOpen(false);
              setConnectionStatus("idle");
              setPairingPhone('');
            }, 1500);
          }

          // Error
          if (row.status === "error") {
            setConnectionStatus("error");
            toast.error("Connection error. Silakan coba lagi.");
            clearInterval(interval);
            setPollingInterval(null);
          }
        }
      }, 2000); // Poll every 2 seconds

      setPollingInterval(interval);

      // Auto-stop polling after 5 minutes
      setTimeout(async () => {
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
          if (connectionStatus !== "connected") {
            setConnectionStatus(method === 'qr' ? "qr_expired" : "pairing_expired");
            toast.error(method === 'qr' ? "QR Code expired. Silakan coba lagi." : "Kode pairing expired. Silakan coba lagi.");
            if (selectedDevice) {
              await supabase
                .from("devices")
                .update({ status: "disconnected", qr_code: null, pairing_code: null })
                .eq("id", selectedDevice.id);
            }
          }
        }
      }, 300000);

    } catch (error: any) {
      setConnectionStatus("error");
      toast.error(error.message);
    }
  };

  const handleRefreshQR = () => {
    if (selectedDevice) {
      // Clear existing polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      // Reconnect with same method
      const method = selectedDevice.connection_method as 'qr' | 'pairing' || 'qr';
      handleConnectDevice(selectedDevice, method, selectedDevice.phone_for_pairing || undefined);
    }
  };

  const handleCancelConnect = async () => {
    if (!selectedDevice) return;
    try {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      await supabase
        .from("devices")
        .update({ status: "disconnected", qr_code: null, pairing_code: null, connection_method: null, phone_for_pairing: null })
        .eq("id", selectedDevice.id);
    } catch (e) {
      console.error("Cancel connect error:", e);
    } finally {
      setConnectionStatus("idle");
      setQrDialogOpen(false);
    }
  };

  const handleStopConnecting = async (device: Device) => {
    try {
      await supabase
        .from("devices")
        .update({ status: "disconnected", qr_code: null, pairing_code: null, connection_method: null, phone_for_pairing: null })
        .eq("id", device.id);
      toast.success("Dibatalkan. Anda bisa scan ulang.");
      fetchDevices();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const handleClearSession = async (device: Device) => {
    if (!confirm("Yakin ingin menghapus session data? Device akan disconnect.")) return;

    try {
      await supabase
        .from("devices")
        .update({ 
          session_data: null,
          qr_code: null,
          pairing_code: null,
          status: "disconnected"
        })
        .eq("id", device.id);

      toast.success("Session data berhasil dihapus");
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogout = async (device: Device) => {
    if (!confirm("Yakin ingin logout dari device ini?")) return;

    try {
      await supabase
        .from("devices")
        .update({ 
          status: "disconnected",
          phone_number: null,
          qr_code: null
        })
        .eq("id", device.id);

      toast.success("Device logged out successfully");
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("Yakin ingin menghapus device ini?")) return;

    try {
      const { error } = await supabase.from("devices").delete().eq("id", deviceId);
      if (error) throw error;

      toast.success("Device berhasil dihapus");
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleRelog = (device: Device) => {
    handleLogout(device);
    setTimeout(() => handleConnectDevice(device), 1000);
  };

  const handleDetail = (device: Device) => {
    setSelectedDevice(device);
    setDetailDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500 text-white";
      case "connecting":
        return "bg-yellow-500 text-white";
      default:
        return "bg-red-500 text-white";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Terkoneksi";
      case "connecting":
        return "Connecting...";
      default:
        return "Tidak Terkoneksi";
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-1 md:mb-2">Device Management</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Kelola semua perangkat WhatsApp yang terhubung
            </p>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant={notificationsEnabled ? "default" : "outline"}
              size="icon"
              className="shrink-0"
              onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotificationsEnabled(granted);
                if (granted) {
                  toast.success("Notifikasi diaktifkan");
                } else {
                  toast.error("Notifikasi ditolak");
                }
              }}
              title={notificationsEnabled ? "Notifikasi aktif" : "Aktifkan notifikasi"}
            >
              {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-gradient-to-r from-primary to-secondary text-white flex-1"
                  disabled={isLimitReached('devices')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Tambah Device</span>
                  <span className="sm:hidden">Tambah</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Device Baru</DialogTitle>
                  <DialogDescription>
                    Buat device baru untuk menghubungkan WhatsApp Anda
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateDevice} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceName">Nama Device</Label>
                    <Input
                      id="deviceName"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="Contoh: WhatsApp Bisnis 1"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">Buat Device</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLimitReached('devices') && subscription && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Limit device tercapai ({devices.length}/{subscription.plan.max_devices}). 
              Upgrade plan untuk menambah lebih banyak device.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div className="h-6 bg-muted animate-pulse rounded w-32" />
                  <div className="h-6 bg-muted animate-pulse rounded w-32" />
                  <div className="h-6 bg-muted animate-pulse rounded w-24" />
                  <div className="h-6 bg-muted animate-pulse rounded w-32" />
                  <div className="h-6 bg-muted animate-pulse rounded w-24" />
                  <div className="h-6 bg-muted animate-pulse rounded w-40" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b">
                    <div className="h-10 bg-muted animate-pulse rounded w-32" />
                    <div className="h-10 bg-muted animate-pulse rounded w-40" />
                    <div className="h-10 bg-muted animate-pulse rounded w-24" />
                    <div className="h-10 bg-muted animate-pulse rounded w-32" />
                    <div className="h-10 bg-muted animate-pulse rounded w-24" />
                    <div className="flex gap-2">
                      <div className="h-10 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-10 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : devices.length === 0 ? (
          <Card>
            <CardContent classN
