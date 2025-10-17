import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
}

interface DeleteUserDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: DeleteUserDialogProps) {
  const { user: currentUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState<"deactivate" | "delete">("deactivate");
  const isSelf = currentUser?.id === user.id;

  const handleDelete = async () => {
    if (isSelf) {
      toast.error("Bạn không thể xóa tài khoản của chính mình");
      return;
    }

    setIsDeleting(true);
    try {
      if (deleteType === "deactivate") {
        // Soft delete - deactivate user
        const { error } = await supabase
          .from("profiles")
          .update({ is_active: false })
          .eq("id", user.id);

        if (error) throw error;
        toast.success("Đã vô hiệu hóa user thành công!");
      } else {
        // Hard delete - delete user completely
        // First delete from user_roles
        await supabase.from("user_roles").delete().eq("user_id", user.id);

        // Then delete from profiles (this will cascade to auth.users via FK)
        const { error } = await supabase
          .from("profiles")
          .delete()
          .eq("id", user.id);

        if (error) throw error;
        toast.success("Đã xóa user thành công!");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Có lỗi xảy ra khi xóa user");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa User</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc muốn xóa user <strong>{user.username}</strong>?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isSelf ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Bạn không thể xóa tài khoản của chính mình
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <RadioGroup value={deleteType} onValueChange={(value: any) => setDeleteType(value)}>
              <div className="flex items-center space-x-2 rounded-lg border p-4">
                <RadioGroupItem value="deactivate" id="deactivate" />
                <Label htmlFor="deactivate" className="flex-1 cursor-pointer">
                  <div className="font-medium">Vô hiệu hóa (Khuyến nghị)</div>
                  <div className="text-sm text-muted-foreground">
                    User sẽ không thể đăng nhập nhưng dữ liệu được giữ lại
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 rounded-lg border p-4">
                <RadioGroupItem value="delete" id="delete" />
                <Label htmlFor="delete" className="flex-1 cursor-pointer">
                  <div className="font-medium text-destructive">Xóa vĩnh viễn</div>
                  <div className="text-sm text-muted-foreground">
                    Xóa hoàn toàn user và tất cả dữ liệu liên quan (không thể khôi phục)
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {deleteType === "delete" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả dữ liệu
                  liên quan đến user này sẽ bị xóa vĩnh viễn.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || isSelf}
          >
            {isDeleting
              ? "Đang xử lý..."
              : deleteType === "deactivate"
              ? "Vô hiệu hóa"
              : "Xóa vĩnh viễn"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
