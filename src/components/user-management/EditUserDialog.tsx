import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpdateUser, UserProfile } from "@/hooks/use-users";
import { useUserPermissions, useUpdateUserPermissions } from "@/hooks/use-user-permissions";
import { PERMISSION_TEMPLATES, AppRole } from "@/lib/permissions-config";
import { PermissionMatrix } from "./PermissionMatrix";
import { applyPermissionTemplate, UserPermissions } from "@/lib/permission-utils";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  username: z.string().min(3, "Username phải có ít nhất 3 ký tự"),
  full_name: z.string().min(1, "Vui lòng nhập họ tên"),
  is_active: z.boolean(),
  role: z.enum(["admin", "manager", "staff", "viewer"]),
});

interface EditUserDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [customPermissions, setCustomPermissions] = useState<UserPermissions>({});
  
  const updateUserMutation = useUpdateUser();
  const updatePermissionsMutation = useUpdateUserPermissions();
  const { data: userPermissions } = useUserPermissions(user?.id);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      full_name: "",
      is_active: true,
      role: "viewer",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username || "",
        full_name: user.full_name || "",
        is_active: user.is_active,
        role: (user.role || "viewer") as any,
      });
      
      // Load custom permissions
      if (userPermissions) {
        setCustomPermissions(userPermissions);
      } else {
        // If no custom permissions, use role template
        setCustomPermissions(applyPermissionTemplate((user.role || "viewer") as AppRole));
      }
    }
  }, [user, userPermissions, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    // Update basic info and role
    await updateUserMutation.mutateAsync({
      userId: user.id,
      ...values,
    });

    // Update permissions if on permissions tab
    if (activeTab === "permissions") {
      await updatePermissionsMutation.mutateAsync({
        userId: user.id,
        permissions: customPermissions,
      });
    }

    onOpenChange(false);
  };

  const applyTemplate = (role: AppRole) => {
    const templatePerms = applyPermissionTemplate(role);
    setCustomPermissions(templatePerms);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa thành viên</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Thông tin cơ bản</TabsTrigger>
                <TabsTrigger value="role">Vai trò</TabsTrigger>
                <TabsTrigger value="permissions">Phân quyền chi tiết</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Họ và tên</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Trạng thái hoạt động</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Cho phép thành viên này đăng nhập hệ thống
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="role" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vai trò</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn vai trò" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PERMISSION_TEMPLATES).map(([key, value]) => (
                            <SelectItem key={key} value={key}>
                              <div>
                                <div className="font-medium">{value.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {value.description}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">Mô tả vai trò</h4>
                  <p className="text-sm text-muted-foreground">
                    {PERMISSION_TEMPLATES[field.value as AppRole]?.description}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">
                    Tùy chỉnh quyền chi tiết
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate("admin")}
                    >
                      Admin
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate("manager")}
                    >
                      Manager
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate("staff")}
                    >
                      Staff
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate("viewer")}
                    >
                      Viewer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomPermissions({})}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <PermissionMatrix
                  permissions={customPermissions}
                  onChange={setCustomPermissions}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending || updatePermissionsMutation.isPending}
              >
                {updateUserMutation.isPending || updatePermissionsMutation.isPending
                  ? "Đang lưu..."
                  : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
