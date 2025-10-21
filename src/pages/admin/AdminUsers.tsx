import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, User, Mail, Calendar } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  subscription?: {
    plan_name: string;
    status: string;
    expires_at: string | null;
  } | null;
}

export const AdminUsers = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch all users with their profiles, roles, and subscriptions in one query
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          created_at
        `);

      if (profilesError) throw profilesError;
      if (!profiles) return;

      // Fetch all user roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Fetch all subscriptions with plans
      const { data: subscriptionsData } = await supabase
        .from("user_subscriptions")
        .select(`
          user_id,
          status,
          expires_at,
          plans (
            name
          )
        `)
        .eq("status", "active");

      const usersData: UserData[] = profiles.map((profile) => {
        const roleData = rolesData?.find(r => r.user_id === profile.id);
        const subscriptionData = subscriptionsData?.find(s => s.user_id === profile.id);

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email || "No email",
          role: roleData?.role || "user",
          created_at: profile.created_at,
          subscription: subscriptionData ? {
            plan_name: (subscriptionData.plans as any)?.name || "No Plan",
            status: subscriptionData.status,
            expires_at: subscriptionData.expires_at,
          } : null,
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Gagal memuat data users");
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === "admin" ? "user" : "admin";
      
      await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      toast.success(`Role berhasil diubah menjadi ${newRole}`);
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Gagal mengubah role");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola User</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Manage users dan permissions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar User</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">User</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden lg:table-cell">Subscription</TableHead>
                      <TableHead className="hidden lg:table-cell">Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Terdaftar</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              user.role === "admin" ? "bg-orange-500" : "bg-blue-500"
                            }`}>
                              {user.role === "admin" ? (
                                <Shield className="w-4 h-4 text-white" />
                              ) : (
                                <User className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{user.full_name || "No Name"}</div>
                              <div className="text-xs text-muted-foreground md:hidden truncate">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => toggleRole(user.id, user.role)}
                          >
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {user.subscription ? (
                            <Badge variant="outline">{user.subscription.plan_name}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">No Plan</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {user.subscription ? (
                            <Badge
                              variant={
                                user.subscription.status === "active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {user.subscription.status}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">{new Date(user.created_at).toLocaleDateString("id-ID")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleRole(user.id, user.role)}
                            className="whitespace-nowrap"
                          >
                            {user.role === "admin" ? "Set User" : "Set Admin"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
