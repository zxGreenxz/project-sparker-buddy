import { AppRole, PERMISSION_TEMPLATES } from './permissions-config';

export type UserPermissions = Record<string, Record<string, boolean>>;

export function checkPermission(
  userPermissions: UserPermissions | null | undefined,
  pageId: string,
  permissionType: string
): boolean {
  if (!userPermissions) return false;
  return userPermissions[pageId]?.[permissionType] === true;
}

export function applyPermissionTemplate(role: AppRole): UserPermissions {
  return PERMISSION_TEMPLATES[role].permissions;
}

export function mergePermissions(
  rolePermissions: UserPermissions,
  customPermissions: UserPermissions
): UserPermissions {
  const merged: UserPermissions = { ...rolePermissions };
  
  Object.keys(customPermissions).forEach((pageId) => {
    merged[pageId] = {
      ...(merged[pageId] || {}),
      ...customPermissions[pageId],
    };
  });
  
  return merged;
}

export function hasAnyPermission(
  userPermissions: UserPermissions | null | undefined,
  pageId: string
): boolean {
  if (!userPermissions || !userPermissions[pageId]) return false;
  return Object.values(userPermissions[pageId]).some((v) => v === true);
}
