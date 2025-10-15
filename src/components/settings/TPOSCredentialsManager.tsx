import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, RefreshCw, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Credential {
  id: string;
  name: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export function TPOSCredentialsManager() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('tpos_credentials')
        .select('id, name, username, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCredentials(data || []);
    } catch (error) {
      console.error('Error loading credentials:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách tài khoản",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !username.trim() || !password.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('tpos_credentials')
        .insert({
          name: name.trim(),
          username: username.trim(),
          password: password.trim(),
          is_active: credentials.length === 0, // First credential is active by default
        });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã lưu tài khoản",
      });

      setName("");
      setUsername("");
      setPassword("");
      setShowForm(false);
      loadCredentials();
    } catch (error: any) {
      console.error('Error saving credential:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể lưu tài khoản",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa tài khoản này?")) return;

    try {
      const { error } = await (supabase as any)
        .from('tpos_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã xóa tài khoản",
      });

      loadCredentials();
    } catch (error) {
      console.error('Error deleting credential:', error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa tài khoản",
        variant: "destructive",
      });
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      // Deactivate all first
      await (supabase as any)
        .from('tpos_credentials')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // Activate selected one
      const { error } = await (supabase as any)
        .from('tpos_credentials')
        .update({ is_active: true })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã đặt làm tài khoản mặc định",
      });

      loadCredentials();
    } catch (error) {
      console.error('Error setting active credential:', error);
      toast({
        title: "Lỗi",
        description: "Không thể đặt tài khoản mặc định",
        variant: "destructive",
      });
    }
  };

  const handleRefreshToken = async (credentialId: string) => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-tpos-token', {
        body: { credentialId }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Thành công",
          description: "Đã cập nhật token mới",
        });
      } else {
        throw new Error(data.message || 'Failed to refresh token');
      }
    } catch (error: any) {
      console.error('Error refreshing token:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật token",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quản lý tài khoản TPOS</CardTitle>
        <CardDescription>
          Lưu tài khoản để tự động cập nhật token sau 7 ngày
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Tài khoản được đánh dấu sẽ tự động dùng để refresh token cho cả TPOS và Facebook Bearer Token
          </AlertDescription>
        </Alert>

        {/* List of saved credentials */}
        <div className="space-y-2">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cred.name}</span>
                  {cred.is_active && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Đang dùng
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{cred.username}</div>
              </div>
              <div className="flex items-center gap-2">
                {!cred.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetActive(cred.id)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Đặt làm mặc định
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRefreshToken(cred.id)}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Token
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(cred.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new credential form */}
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Thêm tài khoản mới
          </Button>
        ) : (
          <div className="space-y-4 p-4 border rounded-lg">
            <div>
              <Label htmlFor="cred-name">Tên tài khoản</Label>
              <Input
                id="cred-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Tài khoản chính"
              />
            </div>
            <div>
              <Label htmlFor="cred-username">Username</Label>
              <Input
                id="cred-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username TPOS"
              />
            </div>
            <div>
              <Label htmlFor="cred-password">Password</Label>
              <Input
                id="cred-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password TPOS"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading} className="flex-1">
                {loading ? "Đang lưu..." : "Lưu"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setName("");
                  setUsername("");
                  setPassword("");
                }}
              >
                Hủy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
