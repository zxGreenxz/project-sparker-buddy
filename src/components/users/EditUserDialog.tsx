import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const editUserSchema = z.object({
  displayName: z.string().optional(),
  avatarUrl: z.string().url("URL không hợp lệ").optional().or(z.literal("")),
  isActive: z.boolean(),
  role: z.enum(["admin", "moderator", "user"]),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface User {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  role: string | null;
}

interface EditUserDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: EditUserDialogProps) {
  const { user: currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSelf = currentUser?.id === user.id;

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      displayName: user.display_name || "",
      avatarUrl: user.avatar_url || "",
      isActive: user.is_active,
      role: (user.role as any) || "user",
    },
  });

  useEffect(() => {
    form.reset({
      displayName: user.display_name || "",
      avatarUrl: user.avatar_url || "",
      isActive: user.is_active,
      role: (user.role as any) || "user",
    });
  }, [user, form]);

  const onSubmit = async (data: EditUserFormData) => {
    setIsSubmitting(true);
    try {
      // Prevent admin from demoting themselves
      if (isSelf && user.role === "admin" && data.role !== "admin") {
        toast.error("Bạn không thể tự hạ cấp quyền admin của chính mình");
        setIsSubmitting(false);
        return;
      }

      // Prevent admin from deactivating themselves
      if (isSelf && !data.isActive) {
        toast.error("Bạn không thể tự vô hiệu hóa tài khoản của chính mình");
        setIsSubmitting(false);
        return;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: data.displayName || null,
          avatar_url: data.avatarUrl || null,
          is_active: data.isActive,
        } as any)
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update role if changed
      if (data.role !== user.role) {
        // Check if user has a role entry
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingRole) {
          // Update existing role
          const { error: roleError } = await supabase
            .from("user_roles")
            .update({ role: data.role } as any)
            .eq("user_id", user.id);

          if (roleError) throw roleError;
        } else {
          // Insert new role
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({
              user_id: user.id,
              role: data.role,
            } as any);

          if (roleError) throw roleError;
        }
      }

      toast.success("Cập nhật user thành công!");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Có lỗi xảy ra khi cập nhật user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa User</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin cho {user.username}
          </DialogDescription>
        </DialogHeader>

        {isSelf && user.role === "admin" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Bạn đang chỉnh sửa tài khoản của chính mình. Không thể tự hạ cấp
              quyền admin hoặc vô hiệu hóa tài khoản.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormItem>
              <FormLabel>Username</FormLabel>
              <Input value={user.username || "N/A"} disabled />
            </FormItem>

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên hiển thị</FormLabel>
                  <FormControl>
                    <Input placeholder="Nguyễn Văn A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/avatar.jpg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSelf && user.role === "admin"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Trạng thái</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      {field.value ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSelf}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
