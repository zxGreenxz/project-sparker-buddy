import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DETAILED_PERMISSIONS } from "@/lib/permissions-config";
import { UserPermissions } from "@/lib/permission-utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PermissionMatrixProps {
  permissions: UserPermissions;
  onChange: (permissions: UserPermissions) => void;
}

export function PermissionMatrix({
  permissions,
  onChange,
}: PermissionMatrixProps) {
  const handleToggle = (pageId: string, permissionId: string, value: boolean) => {
    const newPermissions = { ...permissions };
    if (!newPermissions[pageId]) {
      newPermissions[pageId] = {};
    }
    newPermissions[pageId][permissionId] = value;
    onChange(newPermissions);
  };

  const handleToggleAll = (pageId: string, value: boolean) => {
    const newPermissions = { ...permissions };
    const page = DETAILED_PERMISSIONS.find((p) => p.id === pageId);
    if (page) {
      newPermissions[pageId] = Object.fromEntries(
        page.permissions.map((p) => [p.id, value])
      );
      onChange(newPermissions);
    }
  };

  const isPageFullyEnabled = (pageId: string) => {
    const page = DETAILED_PERMISSIONS.find((p) => p.id === pageId);
    if (!page || !permissions[pageId]) return false;
    return page.permissions.every((p) => permissions[pageId][p.id] === true);
  };

  const groupedPages = DETAILED_PERMISSIONS.reduce((acc, page) => {
    if (!acc[page.category]) {
      acc[page.category] = [];
    }
    acc[page.category].push(page);
    return acc;
  }, {} as Record<string, typeof DETAILED_PERMISSIONS>);

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-6">
        {Object.entries(groupedPages).map(([category, pages]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pages.map((page) => (
                <div key={page.id} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{page.label}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Tất cả</span>
                      <Switch
                        checked={isPageFullyEnabled(page.id)}
                        onCheckedChange={(checked) =>
                          handleToggleAll(page.id, checked)
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 ml-4">
                    {page.permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-center space-x-2"
                      >
                        <Switch
                          id={`${page.id}-${permission.id}`}
                          checked={permissions[page.id]?.[permission.id] === true}
                          onCheckedChange={(checked) =>
                            handleToggle(page.id, permission.id, checked)
                          }
                        />
                        <Label
                          htmlFor={`${page.id}-${permission.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {permission.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
