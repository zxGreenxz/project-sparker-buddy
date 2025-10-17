import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UserPermissions } from "@/lib/permission-utils";

export function useUserPermissions(userId?: string) {
  return useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("user_permissions")
        .select("page_id, permissions")
        .eq("user_id", userId);

      if (error) throw error;

      // Convert array to object
      const permissionsObj: UserPermissions = {};
      data?.forEach((item) => {
        permissionsObj[item.page_id] = item.permissions as Record<string, boolean>;
      });

      return permissionsObj;
    },
    enabled: !!userId,
  });
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: {
      userId: string;
      permissions: UserPermissions;
    }) => {
      const { userId, permissions } = values;

      // Delete all existing permissions for this user
      await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId);

      // Insert new permissions
      const permissionsArray = Object.entries(permissions).map(
        ([pageId, perms]) => ({
          user_id: userId,
          page_id: pageId,
          permissions: perms,
        })
      );

      if (permissionsArray.length > 0) {
        const { error } = await supabase
          .from("user_permissions")
          .insert(permissionsArray);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user-permissions", variables.userId],
      });
      toast({ title: "Đã cập nhật quyền thành công" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi khi cập nhật quyền",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
