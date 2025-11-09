import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Clock, Zap } from "lucide-react";

interface BroadcastSafetyWarningProps {
  contactCount: number;
  delaySeconds: number;
  delayType: string;
}

export function BroadcastSafetyWarning({ 
  contactCount, 
  delaySeconds,
  delayType 
}: BroadcastSafetyWarningProps) {
  // Calculate risk level
  const getRiskLevel = () => {
    if (delayType === 'auto') {
      return { level: 'low', color: 'bg-success', icon: Shield };
    }
    
    if (contactCount > 100 && delaySeconds < 3) {
      return { level: 'high', color: 'bg-destructive', icon: AlertTriangle };
    }
    
    if (contactCount > 50 && delaySeconds < 5) {
      return { level: 'medium', color: 'bg-warning', icon: Clock };
    }
    
    if (contactCount > 30 && delaySeconds < 3) {
      return { level: 'medium', color: 'bg-warning', icon: Clock };
    }
    
    return { level: 'low', color: 'bg-success', icon: Shield };
  };

  const risk = getRiskLevel();
  const Icon = risk.icon;

  // Calculate estimated time
  const estimatedMinutes = Math.ceil((contactCount * delaySeconds) / 60);
  const estimatedTime = estimatedMinutes < 60 
    ? `${estimatedMinutes} menit` 
    : `${Math.floor(estimatedMinutes / 60)} jam ${estimatedMinutes % 60} menit`;

  // Safety recommendations
  const getRecommendation = () => {
    if (risk.level === 'high') {
      return {
        title: "⚠️ Risiko Tinggi Terkena Banned!",
        description: "Jumlah pesan terlalu banyak dengan delay terlalu cepat. WhatsApp bisa mendeteksi sebagai spam.",
        suggestions: [
          "Gunakan mode 'Auto' untuk delay optimal",
          "Atau naikkan delay manual minimal 5-8 detik",
          "Pertimbangkan membagi menjadi beberapa broadcast",
          "Aktifkan randomize delay untuk tampak lebih natural"
        ]
      };
    }
    
    if (risk.level === 'medium') {
      return {
        title: "⚡ Risiko Sedang",
        description: "Delay bisa lebih aman untuk jumlah kontak ini.",
        suggestions: [
          "Pertimbangkan mode 'Auto' untuk keamanan maksimal",
          "Atau naikkan delay ke 5-8 detik",
          "Aktifkan randomize delay"
        ]
      };
    }
    
    return {
      title: "✅ Pengiriman Aman",
      description: "Setting delay sudah optimal untuk menghindari spam detection.",
      suggestions: [
        `Estimasi waktu pengiriman: ${estimatedTime}`,
        "Sistem akan menambah variasi waktu otomatis",
        "Broadcast akan di-pause setiap 20 pesan"
      ]
    };
  };

  const recommendation = getRecommendation();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className={`${risk.color} text-white`}>
          <Icon className="w-3 h-3 mr-1" />
          {risk.level === 'high' ? 'Risiko Tinggi' : risk.level === 'medium' ? 'Risiko Sedang' : 'Aman'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {contactCount} penerima • {delaySeconds}s delay
        </span>
      </div>

      <Alert variant={risk.level === 'high' ? 'destructive' : 'default'} className="border-l-4">
        <Icon className="h-4 w-4" />
        <AlertTitle className="text-sm font-semibold mb-1">
          {recommendation.title}
        </AlertTitle>
        <AlertDescription className="text-xs space-y-2">
          <p>{recommendation.description}</p>
          <ul className="list-disc pl-4 space-y-1">
            {recommendation.suggestions.map((suggestion, idx) => (
              <li key={idx}>{suggestion}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>

      {delayType === 'auto' && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-primary">Mode Auto Aktif</p>
              <p className="text-muted-foreground">
                Sistem akan menyesuaikan delay otomatis berdasarkan jumlah penerima:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                <li>1-20 kontak: 3-5 detik</li>
                <li>21-50 kontak: 5-8 detik</li>
                <li>51-100 kontak: 8-12 detik</li>
                <li>100+ kontak: 12-20 detik dengan pause setiap 20 pesan</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
