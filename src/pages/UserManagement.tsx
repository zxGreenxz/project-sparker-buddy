import { useState } from "react";
import { Plus, Users, UserCheck, UserX, Shield } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useUsers, UserProfile } from "@/hooks/use-users";
import { CreateUserDialog } from "@/components/user-management/CreateUserDialog";
import { EditUserDialog } from "@/components/user-management/EditUserDialog";
import { UserTable } from "@/components/user-management/UserTable";
import { useIsAdmin } from "@/hooks/use-user-role";
import { Navigate } from "react-router-dom";

export default function UserManagement() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: users = [], isLoading } = useUsers();
  const { isAdmin, isLoading: isLoadingRole } = useIsAdmin();

  // Protect route - only admins can access
  if (!isLoadingRole && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
    admins: users.filter((u) => u.role === "admin").length,
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quản lý thành viên</h1>
            <p className="text-muted-foreground mt-1">
              Quản lý người dùng và phân quyền hệ thống
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm thành viên
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng thành viên</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Đang hoạt động</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tạm khóa</CardTitle>
              <UserX className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inactive}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quản trị viên</CardTitle>
              <Shield className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.admins}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Danh sách thành viên</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Tìm kiếm theo tên, username, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Đang tải...
              </div>
            ) : (
              <UserTable users={filteredUsers} onEdit={setEditUser} />
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <CreateUserDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />

        <EditUserDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
        />
      </div>
    </Layout>
  );
}
