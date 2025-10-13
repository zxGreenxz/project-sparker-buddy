import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Save, RefreshCw } from "lucide-react";

interface CRMTeam {
  Id: string;
  Name: string;
}

export function FacebookPageManager() {
  const queryClient = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [manualCrmTeamId, setManualCrmTeamId] = useState("");
  const [manualCrmTeamName, setManualCrmTeamName] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [newPageId, setNewPageId] = useState("");

  // Fetch Facebook pages
  const { data: facebookPages } = useQuery({
    queryKey: ["facebook-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_pages")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch CRM teams from TPOS - auto load
  const { data: crmTeams, isLoading: isLoadingTeams, refetch: refetchTeams } = useQuery({
    queryKey: ["crm-teams"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-crm-teams");
      if (error) throw error;
      
      // Flatten teams to include both parent and child teams
      const flattenedTeams: CRMTeam[] = [];
      if (data.value) {
        data.value.forEach((parentTeam: any) => {
          // Add children teams if they exist
          if (parentTeam.Childs && Array.isArray(parentTeam.Childs)) {
            parentTeam.Childs.forEach((childTeam: any) => {
              flattenedTeams.push({
                Id: childTeam.Id.toString(),
                Name: childTeam.Name,
              });
            });
          }
          // Also add parent team
          flattenedTeams.push({
            Id: parentTeam.Id.toString(),
            Name: parentTeam.Name,
          });
        });
      }
      
      return flattenedTeams;
    },
  });

  // Add new page mutation
  const addPageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("facebook_pages")
        .insert({
          page_name: newPageName,
          page_id: newPageId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm page mới");
      setNewPageName("");
      setNewPageId("");
      queryClient.invalidateQueries({ queryKey: ["facebook-pages"] });
    },
    onError: (error: Error) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  // Update CRM Team ID mutation
  const updateCrmTeamMutation = useMutation({
    mutationFn: async ({ pageId, crmTeamId, crmTeamName }: { 
      pageId: string; 
      crmTeamId: string;
      crmTeamName: string;
    }) => {
      const { error } = await supabase
        .from("facebook_pages")
        .update({ 
          crm_team_id: crmTeamId,
          crm_team_name: crmTeamName,
        })
        .eq("id", pageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã lưu CRM Team ID");
      queryClient.invalidateQueries({ queryKey: ["facebook-pages"] });
      setSelectedPageId("");
      setManualCrmTeamId("");
      setManualCrmTeamName("");
    },
    onError: (error: Error) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  const selectedPage = facebookPages?.find((p) => p.id === selectedPageId);

  return (
    <div className="space-y-6">
      {/* Add New Page */}
      <Card>
        <CardHeader>
          <CardTitle>Thêm Facebook Page</CardTitle>
          <CardDescription>Thêm page Facebook mới vào hệ thống</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="page-name">Tên Page</Label>
              <Input
                id="page-name"
                placeholder="NhiJudy Store"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-id">Page ID</Label>
              <Input
                id="page-id"
                placeholder="193642490509664"
                value={newPageId}
                onChange={(e) => setNewPageId(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={() => addPageMutation.mutate()}
            disabled={!newPageName || !newPageId || addPageMutation.isPending}
          >
            {addPageMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Thêm Page
          </Button>
        </CardContent>
      </Card>

      {/* Pages List with CRM Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách Facebook Pages</CardTitle>
          <CardDescription>
            Quản lý và cấu hình CRM Team ID cho các Facebook pages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {facebookPages && facebookPages.length > 0 ? (
            <div className="space-y-3">
              {facebookPages.map((page) => (
                <Card key={page.id} className="border">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold text-base">{page.page_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Page ID: {page.page_id}
                        </div>
                        {page.crm_team_id ? (
                          <div className="text-sm">
                            <span className="text-muted-foreground">CRM Team:</span>{" "}
                            <span className="font-medium text-green-600">
                              {page.crm_team_name} ({page.crm_team_id})
                            </span>
                          </div>
                        ) : (
                          <div className="text-sm text-orange-600">
                            Chưa cấu hình CRM Team
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPageId(page.id);
                          if (page.crm_team_id) {
                            setManualCrmTeamId(page.crm_team_id);
                            setManualCrmTeamName(page.crm_team_name || "");
                          } else {
                            setManualCrmTeamId("");
                            setManualCrmTeamName("");
                          }
                        }}
                      >
                        Sửa CRM
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Chưa có Facebook pages nào. Thêm page mới ở trên.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configure CRM Team Dialog */}
      {selectedPageId && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Cấu hình CRM Team ID</CardTitle>
            <CardDescription>
              Đang cấu hình cho:{" "}
              <span className="font-semibold text-foreground">
                {selectedPage?.page_name}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => refetchTeams()}
                disabled={isLoadingTeams}
              >
                {isLoadingTeams ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {crmTeams ? "Tải lại CRM Teams" : "Tải CRM Teams từ TPOS"}
              </Button>
              {crmTeams && (
                <span className="text-sm text-muted-foreground">
                  {crmTeams.length} teams
                </span>
              )}
            </div>

            {isLoadingTeams && (
              <div className="text-sm text-muted-foreground">
                Đang tải danh sách CRM teams...
              </div>
            )}

            {crmTeams && crmTeams.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="crm-team-select">Chọn CRM Team</Label>
                <Select
                  value={manualCrmTeamId}
                  onValueChange={(value) => {
                    setManualCrmTeamId(value);
                    const team = crmTeams.find((t) => t.Id === value);
                    if (team) setManualCrmTeamName(team.Name);
                  }}
                >
                  <SelectTrigger id="crm-team-select" className="bg-background">
                    <SelectValue placeholder="Chọn CRM Team" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {crmTeams.map((team) => (
                      <SelectItem key={team.Id} value={team.Id}>
                        {team.Name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Hoặc nhập thủ công</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="CRM Team ID"
                  value={manualCrmTeamId}
                  onChange={(e) => setManualCrmTeamId(e.target.value)}
                />
                <Input
                  placeholder="Team Name"
                  value={manualCrmTeamName}
                  onChange={(e) => setManualCrmTeamName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() =>
                  updateCrmTeamMutation.mutate({
                    pageId: selectedPageId,
                    crmTeamId: manualCrmTeamId,
                    crmTeamName: manualCrmTeamName,
                  })
                }
                disabled={
                  !manualCrmTeamId ||
                  !manualCrmTeamName ||
                  updateCrmTeamMutation.isPending
                }
              >
                {updateCrmTeamMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Lưu CRM Team ID
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedPageId("");
                  setManualCrmTeamId("");
                  setManualCrmTeamName("");
                }}
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
