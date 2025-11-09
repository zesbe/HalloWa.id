import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Reminder {
  id: string;
  date: string;
  type: string;
  message: string;
}

interface ContactRemindersProps {
  contactId: string;
  reminders: Reminder[];
  contactName: string;
  onRemindersUpdate: () => void;
}

export function ContactReminders({ contactId, reminders, contactName, onRemindersUpdate }: ContactRemindersProps) {
  const [open, setOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({
    date: "",
    type: "custom",
    message: ""
  });

  const handleAddReminder = async () => {
    if (!newReminder.date || !newReminder.message) {
      toast.error("Tanggal dan pesan reminder harus diisi");
      return;
    }

    try {
      const newReminders = [
        ...reminders,
        {
          id: crypto.randomUUID(),
          ...newReminder
        }
      ];

      const { error } = await supabase
        .from("contacts")
        .update({ reminders: newReminders as any })
        .eq("id", contactId);

      if (error) throw error;

      toast.success("Reminder berhasil ditambahkan");
      setNewReminder({ date: "", type: "custom", message: "" });
      onRemindersUpdate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      const updatedReminders = reminders.filter(r => r.id !== reminderId);
      
      const { error } = await supabase
        .from("contacts")
        .update({ reminders: updatedReminders as any })
        .eq("id", contactId);

      if (error) throw error;

      toast.success("Reminder berhasil dihapus");
      onRemindersUpdate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const sortedReminders = [...reminders].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          {reminders.length > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
              {reminders.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reminder untuk {contactName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Add New Reminder */}
          <div className="space-y-3 p-4 border rounded-lg bg-accent/50">
            <h4 className="font-semibold text-sm">Tambah Reminder Baru</h4>
            <div className="space-y-2">
              <Label htmlFor="reminder-date">Tanggal</Label>
              <Input
                id="reminder-date"
                type="date"
                value={newReminder.date}
                onChange={(e) => setNewReminder({ ...newReminder, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-type">Tipe</Label>
              <Input
                id="reminder-type"
                value={newReminder.type}
                onChange={(e) => setNewReminder({ ...newReminder, type: e.target.value })}
                placeholder="Contoh: Follow up, Meeting, Ulang tahun"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-message">Pesan Reminder</Label>
              <Input
                id="reminder-message"
                value={newReminder.message}
                onChange={(e) => setNewReminder({ ...newReminder, message: e.target.value })}
                placeholder="Contoh: Follow up order produk premium"
              />
            </div>
            <Button onClick={handleAddReminder} className="w-full" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Reminder
            </Button>
          </div>

          {/* Existing Reminders */}
          {sortedReminders.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Reminder Aktif</h4>
              {sortedReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-start justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(reminder.date), "d MMMM yyyy", { locale: localeId })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {reminder.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{reminder.message}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteReminder(reminder.id)}
                    className="ml-2"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada reminder untuk kontak ini</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
