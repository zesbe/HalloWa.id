import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, FileText, Star, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminLandingContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // About Section
  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutContent, setAboutContent] = useState("");

  // Features
  const [features, setFeatures] = useState<any[]>([]);

  // Contact
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      setLoading(true);

      // Fetch sections
      const { data: sections } = await supabase
        .from("landing_sections")
        .select("*")
        .eq("section_key", "about")
        .single();

      if (sections) {
        setAboutTitle(sections.title || "");
        setAboutContent(sections.content || "");
      }

      // Fetch features
      const { data: featuresData } = await supabase
        .from("landing_features")
        .select("*")
        .order("order_index");

      if (featuresData) {
        setFeatures(featuresData);
      }

      // Fetch contact
      const { data: contact } = await supabase
        .from("landing_contact")
        .select("*")
        .single();

      if (contact) {
        setContactEmail(contact.email || "");
        setContactPhone(contact.phone || "");
        setContactAddress(contact.address || "");
      }

    } catch (error: any) {
      console.error("Error fetching content:", error);
      toast.error("Gagal memuat konten");
    } finally {
      setLoading(false);
    }
  };

  const saveAboutSection = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from("landing_sections")
        .upsert({
          section_key: "about",
          title: aboutTitle,
          content: aboutContent
        }, {
          onConflict: "section_key"
        });

      if (error) throw error;

      toast.success("Section About berhasil disimpan");
    } catch (error: any) {
      console.error("Error saving about:", error);
      toast.error("Gagal menyimpan section About");
    } finally {
      setSaving(false);
    }
  };

  const saveFeature = async (index: number) => {
    try {
      setSaving(true);
      const feature = features[index];

      const { error } = await supabase
        .from("landing_features")
        .upsert({
          id: feature.id,
          title: feature.title,
          description: feature.description,
          icon: feature.icon,
          order_index: index
        });

      if (error) throw error;

      toast.success("Fitur berhasil disimpan");
    } catch (error: any) {
      console.error("Error saving feature:", error);
      toast.error("Gagal menyimpan fitur");
    } finally {
      setSaving(false);
    }
  };

  const addFeature = async () => {
    try {
      const { data, error } = await supabase
        .from("landing_features")
        .insert({
          title: "Fitur Baru",
          description: "Deskripsi fitur",
          icon: "Star",
          order_index: features.length
        })
        .select()
        .single();

      if (error) throw error;

      setFeatures([...features, data]);
      toast.success("Fitur baru ditambahkan");
    } catch (error: any) {
      console.error("Error adding feature:", error);
      toast.error("Gagal menambah fitur");
    }
  };

  const deleteFeature = async (id: string) => {
    if (!confirm("Yakin ingin menghapus fitur ini?")) return;

    try {
      const { error } = await supabase
        .from("landing_features")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setFeatures(features.filter(f => f.id !== id));
      toast.success("Fitur berhasil dihapus");
    } catch (error: any) {
      console.error("Error deleting feature:", error);
      toast.error("Gagal menghapus fitur");
    }
  };

  const saveContact = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from("landing_contact")
        .upsert({
          id: 1,
          email: contactEmail,
          phone: contactPhone,
          address: contactAddress
        });

      if (error) throw error;

      toast.success("Informasi kontak berhasil disimpan");
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast.error("Gagal menyimpan informasi kontak");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📝 Kelola Konten Landing Page</h1>
        <p className="text-muted-foreground">
          Edit konten yang ditampilkan di halaman landing page
        </p>
      </div>

      <Tabs defaultValue="about" className="space-y-6">
        <TabsList>
          <TabsTrigger value="about">
            <FileText className="w-4 h-4 mr-2" />
            Tentang
          </TabsTrigger>
          <TabsTrigger value="features">
            <Star className="w-4 h-4 mr-2" />
            Fitur
          </TabsTrigger>
          <TabsTrigger value="contact">
            <Mail className="w-4 h-4 mr-2" />
            Kontak
          </TabsTrigger>
        </TabsList>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>Section Tentang Kami</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Judul</label>
                <Input
                  value={aboutTitle}
                  onChange={(e) => setAboutTitle(e.target.value)}
                  placeholder="Masukkan judul section"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Konten</label>
                <Textarea
                  value={aboutContent}
                  onChange={(e) => setAboutContent(e.target.value)}
                  placeholder="Masukkan konten section"
                  rows={8}
                />
              </div>
              <Button onClick={saveAboutSection} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Simpan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <div className="space-y-4">
            {features.map((feature, index) => (
              <Card key={feature.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Fitur #{index + 1}</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteFeature(feature.id)}
                    >
                      Hapus
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Judul</label>
                    <Input
                      value={feature.title}
                      onChange={(e) => {
                        const newFeatures = [...features];
                        newFeatures[index].title = e.target.value;
                        setFeatures(newFeatures);
                      }}
                      placeholder="Judul fitur"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Deskripsi</label>
                    <Textarea
                      value={feature.description}
                      onChange={(e) => {
                        const newFeatures = [...features];
                        newFeatures[index].description = e.target.value;
                        setFeatures(newFeatures);
                      }}
                      placeholder="Deskripsi fitur"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Icon (Lucide Icon Name)</label>
                    <Input
                      value={feature.icon}
                      onChange={(e) => {
                        const newFeatures = [...features];
                        newFeatures[index].icon = e.target.value;
                        setFeatures(newFeatures);
                      }}
                      placeholder="Contoh: Star, Zap, Check"
                    />
                  </div>
                  <Button onClick={() => saveFeature(index)} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Simpan
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Button onClick={addFeature} variant="outline" className="w-full">
              Tambah Fitur Baru
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Kontak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Telepon</label>
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+62 xxx-xxxx-xxxx"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Alamat</label>
                <Textarea
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="Alamat lengkap"
                  rows={3}
                />
              </div>
              <Button onClick={saveContact} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Simpan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
