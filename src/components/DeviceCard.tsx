import { useSwipeable } from "react-swipeable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Info, Database, RotateCcw, LogOut, Trash2, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
  api_key: string | null;
  server_id: string | null;
  is_multidevice: boolean;
}

interface DeviceCardProps {
  device: Device;
  onConnect: (device: Device) => void;
  onDetail: (device: Device) => void;
  onClearSession: (device: Device) => void;
  onRelog: (device: Device) => void;
  onLogout: (device: Device) => void;
  onDelete: (id: string) => void;
  onCopyApiKey: (apiKey: string) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
}

export function DeviceCard({
  device,
  onConnect,
  onDetail,
  onClearSession,
  onRelog,
  onLogout,
  onDelete,
  onCopyApiKey,
  getStatusColor,
  getStatusText,
}: DeviceCardProps) {
  const [showActions, setShowActions] = useState(false);

  const handlers = useSwipeable({
    onSwipedLeft: () => setShowActions(true),
    onSwipedRight: () => setShowActions(false),
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <div className="relative overflow-hidden" {...handlers}>
      <Card
        className={cn(
          "transition-transform duration-300 ease-out",
          showActions && "translate-x-[-120px]"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{device.device_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {device.is_multidevice && (
                  <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">
                    Multidevice
                  </Badge>
                )}
                <Badge className={cn(getStatusColor(device.status), "text-[10px] px-1.5 py-0")}>
                  {getStatusText(device.status)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>API Key:</span>
              <div className="flex items-center gap-1">
                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                  {device.api_key?.substring(0, 8)}...
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onCopyApiKey(device.api_key || '')}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Server:</span>
              <span className="font-mono text-[10px]">{device.server_id || '-'}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {device.status === "disconnected" && (
              <Button
                size="sm"
                onClick={() => onConnect(device)}
                className="bg-blue-500 hover:bg-blue-600 text-white text-xs flex-1"
              >
                <QrCode className="w-3 h-3 mr-1" />
                Connect
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDetail(device)}
              className="flex-1"
            >
              <Info className="w-3 h-3 mr-1" />
              Detail
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Swipe Actions */}
      {showActions && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center gap-1 pr-2">
          {device.status === "connected" && (
            <>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  onClearSession(device);
                  setShowActions(false);
                }}
                className="h-10 w-10 border-purple-500 text-purple-500"
              >
                <Database className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  onLogout(device);
                  setShowActions(false);
                }}
                className="h-10 w-10 border-blue-500 text-blue-500"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="destructive"
            onClick={() => {
              onDelete(device.id);
              setShowActions(false);
            }}
            className="h-10 w-10 bg-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
