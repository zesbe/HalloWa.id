import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Plus, Edit, Trash2, Copy, Star } from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: string;
  message_template: string;
  description: string;
  variables: string[];
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");

  const [formData, setFormData] = useState({
    name: "",
    category: "general",
    message_template: "",
    description: "",
    variables: [] as string[],
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("broadcast_templates")
        .select("*")
        .order("usage_count", { ascending: false });

      if (error) throw error;
      const typedData = (data || []).map(t => ({
        ...t,
        variables: Array.isArray(t.variables) ? t.variables : []
      }));
      setTemplates(typedData as Template[]);
    } catch (error: any) {
      toast.error("Gagal memuat template: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  const handleSaveTemplate = async () => {
    try {
      const variables = extractVariables(formData.message_template);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");

      if (editingTemplate) {
        const { error } = await supabase
          .from("broadcast_templates")
          .update({
            ...formData,
            variables,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template berhasil diperbarui!");
      } else {
        const { error } = await supabase
          .from("broadcast_templates")
          .insert({
            ...formData,
            variables,
            created_by: user.id,
          });

        if (error) throw error;
        toast.success("Template berhasil dibuat!");
      }

      setShowCreateDialog(false);
      setEditingTemplate(null);
      fetchTemplates();
      resetForm();
    } catch (error: any) {
      toast.error("Gagal menyimpan template: " + error.message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus template ini?")) return;

    try {
      const { error } = await supabase
        .from("broadcast_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Template berhasil dihapus");
      fetchTemplates();
    } catch (error: any) {
      toast.error("Gagal menghapus template: " + error.message);
    }
  };

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");

      const { error } = await supabase
        .from("broadcast_templates")
        .insert({
          name: `${template.name} (Salinan)`,
          category: template.category,
          message_template: template.message_template,
          description: template.description,
          variables: template.variables,
          created_by: user.id,
        });

      if (error) throw error;
      toast.success("Template berhasil diduplikat!");
      fetchTemplates();
    } catch (error: any) {
      toast.error("Gagal menduplikat template: " + error.message);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      message_template: template.message_template,
      description: template.description || "",
      variables: template.variables || [],
    });
    setShowCreateDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "general",
      message_template: "",
      description: "",
      variables: [],
    });
  };

  const filteredTemplates = filterCategory === "all"
    ? templates
    : templates.filter(t => t.category === filterCategory);

  const categoryLabels: Record<string, string> = {
    subscription: "Langganan",
    payment: "Pembayaran",
    onboarding: "Onboarding",
    marketing: "Marketing",
    general: "Umum",
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              Template Broadcast
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Kelola template pesan yang dapat digunakan kembali untuk broadcast dan pengingat
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) {
              setEditingTemplate(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Buat Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Edit" : "Buat"} Template</DialogTitle>
                <DialogDescription>
                  {editingTemplate ? "Perbarui" : "Buat"} template pesan dengan variabel dinamis
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Template *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="contoh: Pesan Selamat Datang"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subscription">Langganan</SelectItem>
                        <SelectItem value="payment">Pembayaran</SelectItem>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="general">Umum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Deskripsi singkat tentang template ini"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Template Pesan *</Label>
                  <Textarea
                    id="message"
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    placeholder="Halo {{nama}}, langganan Anda berakhir pada {{tanggal}}..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gunakan {'{{variabel}}'} untuk konten dinamis. Variabel akan diekstrak secara otomatis.
                  </p>
                  {formData.message_template && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-muted-foreground">Variabel:</span>
                      {extractVariables(formData.message_template).map(v => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={!formData.name || !formData.message_template}
                    className="flex-1"
                  >
                    {editingTemplate ? "Perbarui" : "Buat"} Template
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      setEditingTemplate(null);
                      resetForm();
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="filter" className="text-sm">Filter berdasarkan Kategori</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger id="filter" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    <SelectItem value="subscription">Langganan</SelectItem>
                    <SelectItem value="payment">Pembayaran</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="general">Umum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        {loading ? (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">Memuat template...</div>
          </Card>
        ) : filteredTemplates.length === 0 ? (
          <Card className="p-8">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                {filterCategory === "all" ? "Tidak ada template" : "Tidak ada template dalam kategori ini"}
              </p>
              <Button onClick={() => setShowCreateDialog(true)} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Buat Template Pertama Anda
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                        {template.name}
                        {template.usage_count > 10 && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            Popular
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {template.description || "Tidak ada deskripsi"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {categoryLabels[template.category] || template.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {template.message_template}
                    </p>
                  </div>

                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Variabel:</span>
                      {template.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Digunakan {template.usage_count} kali</span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                      className="gap-1 flex-1 sm:flex-none"
                    >
                      <Edit className="w-3 h-3" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateTemplate(template)}
                      className="gap-1 flex-1 sm:flex-none"
                    >
                      <Copy className="w-3 h-3" />
                      <span className="hidden sm:inline">Duplikat</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="gap-1 flex-1 sm:flex-none text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Hapus</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
