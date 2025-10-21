import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, User, Search, Trash2, Plus, Edit, Download, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  is_group: boolean;
  group_members: any;
  created_at: string;
}

export const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    is_group: false,
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = contacts.filter((contact) =>
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone_number.includes(searchQuery)
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
      setFilteredContacts(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat kontak");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus kontak ini?")) return;

    try {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;

      toast.success("Kontak berhasil dihapus");
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) {
      toast.error("Pilih kontak terlebih dahulu");
      return;
    }
    if (!confirm(`Yakin ingin menghapus ${selectedContacts.length} kontak?`)) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", selectedContacts);
      if (error) throw error;

      toast.success(`${selectedContacts.length} kontak berhasil dihapus`);
      setSelectedContacts([]);
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        device_id: "", // Will be set later when syncing
        name: formData.name,
        phone_number: formData.phone_number,
        is_group: formData.is_group,
      });

      if (error) throw error;

      toast.success("Kontak berhasil ditambahkan");
      setAddDialogOpen(false);
      setFormData({ name: "", phone_number: "", is_group: false });
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContact) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .update({
          name: formData.name,
          phone_number: formData.phone_number,
          is_group: formData.is_group,
        })
        .eq("id", currentContact.id);

      if (error) throw error;

      toast.success("Kontak berhasil diperbarui");
      setEditDialogOpen(false);
      setCurrentContact(null);
      setFormData({ name: "", phone_number: "", is_group: false });
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openEditDialog = (contact: Contact) => {
    setCurrentContact(contact);
    setFormData({
      name: contact.name || "",
      phone_number: contact.phone_number,
      is_group: contact.is_group,
    });
    setEditDialogOpen(true);
  };

  const handleExportContacts = () => {
    const csv = [
      ["Name", "Phone Number", "Type"],
      ...contacts.map((c) => [
        c.name || "",
        c.phone_number,
        c.is_group ? "Group" : "Individual",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Kontak berhasil diekspor");
  };

  const toggleSelectContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map((c) => c.id));
    }
  };

  const stats = {
    total: contacts.length,
    groups: contacts.filter((c) => c.is_group).length,
    individuals: contacts.filter((c) => !c.is_group).length,
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Contacts</h1>
            <p className="text-muted-foreground">
              Kelola semua kontak yang tersinkron dari device
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportContacts} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Kontak</DialogTitle>
                  <DialogDescription>
                    Tambahkan kontak baru secara manual
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddContact} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Nomor Telepon</Label>
                    <Input
                      id="phone"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      placeholder="628123456789"
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_group"
                      checked={formData.is_group}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_group: checked as boolean })
                      }
                    />
                    <Label htmlFor="is_group">Ini adalah grup</Label>
                  </div>
                  <Button type="submit" className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Tambah Kontak
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Kontak</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Individu</CardDescription>
              <CardTitle className="text-3xl">{stats.individuals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Grup</CardDescription>
              <CardTitle className="text-3xl">{stats.groups}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kontak..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {selectedContacts.length > 0 && (
            <Button onClick={handleBulkDelete} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus ({selectedContacts.length})
            </Button>
          )}
        </div>

        {filteredContacts.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedContacts.length === filteredContacts.length}
              onCheckedChange={toggleSelectAll}
            />
            <Label className="cursor-pointer" onClick={toggleSelectAll}>
              Pilih Semua ({filteredContacts.length})
            </Label>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleSelectContact(contact.id)}
                    />
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
                      {contact.is_group ? (
                        <Users className="w-5 h-5 text-primary" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm truncate">
                        {contact.name || contact.phone_number}
                      </CardTitle>
                      <CardDescription className="text-xs truncate">
                        {contact.phone_number}
                      </CardDescription>
                    </div>
                  </div>
                  {contact.is_group && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      Group
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  onClick={() => openEditDialog(contact)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  onClick={() => handleDelete(contact.id)}
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Kontak</DialogTitle>
              <DialogDescription>
                Perbarui informasi kontak
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditContact} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nama</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Nomor Telepon</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="628123456789"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-is_group"
                  checked={formData.is_group}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_group: checked as boolean })
                  }
                />
                <Label htmlFor="edit-is_group">Ini adalah grup</Label>
              </div>
              <Button type="submit" className="w-full">
                <Edit className="w-4 h-4 mr-2" />
                Update Kontak
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {filteredContacts.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {searchQuery ? "Tidak ada kontak yang ditemukan" : "Belum ada kontak tersinkron"}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Contacts;
