import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Smartphone, QrCode, Trash2, RefreshCw, Copy, LogOut, Info, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
  api_key: string | null;
  server_id: string | null;
  webhook_url: string | null;
  is_multidevice: boolean;
}

export const Devices = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      ws?.close();
    };
  }, [ws]);

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
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleConnectDevice = async (device: Device) => {
    setSelectedDevice(device);
    setQrDialogOpen(true);
    
    try {
      toast.info("Connecting to WhatsApp...");
      
      // Create WebSocket connection to Baileys edge function
      const wsUrl = `wss://ierdfxgeectqoekugyvb.supabase.co/functions/v1/whatsapp-baileys?deviceId=${device.id}`;
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        toast.success("Connected to WhatsApp server");
      };
      
      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data);
        
        if (data.type === 'qr') {
          setSelectedDevice(prev => prev ? { ...prev, qr_code: data.qr } : null);
          toast.success("QR Code generated! Scan dengan WhatsApp Anda");
        } else if (data.type === 'connected') {
          toast.success("WhatsApp connected successfully!");
          setQrDialogOpen(false);
          fetchDevices();
        } else if (data.type === 'error') {
          toast.error(data.error);
        }
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error("Connection error");
      };
      
      websocket.onclose = () => {
        console.log('WebSocket closed');
      };
      
      setWs(websocket);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogout = async (device: Device) => {
    if (!confirm("Yakin ingin logout dari device ini?")) return;

    try {
      // Send logout message via WebSocket if connected
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'logout' }));
      }
      
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
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Device Management</h1>
            <p className="text-muted-foreground">
              Kelola semua perangkat WhatsApp yang terhubung
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary text-white">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Device
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

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Smartphone className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Belum ada device</h3>
              <p className="text-muted-foreground mb-4">
                Mulai dengan menambahkan device WhatsApp pertama Anda
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Device Pertama
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Server ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Webhook Media</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{device.device_name}</span>
                          {device.is_multidevice && (
                            <Badge className="bg-green-500 text-white w-fit text-xs">
                              Multidevice
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {device.api_key?.substring(0, 8)}...
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(device.api_key || '')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{device.server_id || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(device.status)}>
                          {getStatusText(device.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {device.webhook_url || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {device.status === "disconnected" && (
                            <Button
                              size="sm"
                              onClick={() => handleConnectDevice(device)}
                              className="bg-blue-500 hover:bg-blue-600 text-white"
                            >
                              Scan QR
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDetail(device)}
                            className="border-orange-500 text-orange-500 hover:bg-orange-50"
                          >
                            <Info className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteDevice(device.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Hapus
                          </Button>
                          {device.status === "connected" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRelog(device)}
                                className="border-pink-500 text-pink-500 hover:bg-pink-50"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLogout(device)}
                                className="border-blue-500 text-blue-500 hover:bg-blue-50"
                              >
                                <LogOut className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Buka WhatsApp di ponsel Anda dan scan QR code ini
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-6">
              {selectedDevice?.qr_code ? (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg">
                    <img
                      src={selectedDevice.qr_code}
                      alt="QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">Cara scan:</p>
                    <ol className="text-xs text-muted-foreground space-y-1 text-left">
                      <li>1. Buka WhatsApp di ponsel Anda</li>
                      <li>2. Tap Menu atau Settings</li>
                      <li>3. Tap Linked Devices</li>
                      <li>4. Tap Link a Device</li>
                      <li>5. Arahkan ponsel ke layar ini untuk scan</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Generating QR code...</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Device Details</DialogTitle>
              <DialogDescription>
                Informasi lengkap device WhatsApp
              </DialogDescription>
            </DialogHeader>
            {selectedDevice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Device Name</Label>
                    <p className="font-medium">{selectedDevice.device_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={getStatusColor(selectedDevice.status)}>
                      {getStatusText(selectedDevice.status)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone Number</Label>
                    <p className="font-medium">{selectedDevice.phone_number || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Server ID</Label>
                    <p className="font-medium">{selectedDevice.server_id || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">API Key</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                        {selectedDevice.api_key}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(selectedDevice.api_key || '')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {selectedDevice.last_connected_at && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Last Connected</Label>
                      <p className="font-medium">
                        {new Date(selectedDevice.last_connected_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Devices;
