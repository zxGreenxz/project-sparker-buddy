import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  email?: string;
  role?: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Merge profiles with roles
      const usersWithRoles = profiles?.map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || 'viewer',
        };
      });

      return usersWithRoles || [];
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      email: string;
      password: string;
      username: string;
      full_name: string;
      role: string;
    }) => {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            username: values.username,
            full_name: values.full_name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Không thể tạo user");

      // Insert role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: values.role,
        });

      if (roleError) throw roleError;

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Đã tạo thành viên thành công" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi khi tạo thành viên",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      userId: string;
      username?: string;
      full_name?: string;
      is_active?: boolean;
      role?: string;
    }) => {
      const { userId, role, ...profileData } = values;

      // Update profile if there are profile fields
      if (Object.keys(profileData).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileData)
          .eq("id", userId);

        if (profileError) throw profileError;
      }

      // Update role if provided
      if (role) {
        // Delete existing role
        await supabase.from("user_roles").delete().eq("user_id", userId);

        // Insert new role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: role,
          });

        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Đã cập nhật thành viên thành công" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi khi cập nhật thành viên",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      // Deleting from profiles will cascade to user_roles and user_permissions
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Đã xóa thành viên thành công" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi khi xóa thành viên",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
