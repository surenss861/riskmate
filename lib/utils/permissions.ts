/**
 * Granular Permissions System
 * 
 * Fine-grained permission checking beyond basic Owner/Admin/Member roles.
 */

export type Permission =
  | 'jobs.create'
  | 'jobs.edit'
  | 'jobs.delete'
  | 'jobs.close'
  | 'hazards.edit'
  | 'hazards.delete'
  | 'mitigations.edit'
  | 'mitigations.complete'
  | 'documents.upload'
  | 'documents.delete'
  | 'reports.generate'
  | 'reports.share'
  | 'permit_packs.generate'
  | 'team.invite'
  | 'team.remove'
  | 'billing.view'
  | 'billing.manage'
  | 'analytics.view'
  | 'settings.edit'

export type Role = 'owner' | 'admin' | 'member'

interface PermissionMap {
  [key: string]: Permission[]
}

const ROLE_PERMISSIONS: PermissionMap = {
  owner: [
    'jobs.create',
    'jobs.edit',
    'jobs.delete',
    'jobs.close',
    'hazards.edit',
    'hazards.delete',
    'mitigations.edit',
    'mitigations.complete',
    'documents.upload',
    'documents.delete',
    'reports.generate',
    'reports.share',
    'permit_packs.generate',
    'team.invite',
    'team.remove',
    'billing.view',
    'billing.manage',
    'analytics.view',
    'settings.edit',
  ],
  admin: [
    'jobs.create',
    'jobs.edit',
    'jobs.close',
    'hazards.edit',
    'mitigations.edit',
    'mitigations.complete',
    'documents.upload',
    'documents.delete',
    'reports.generate',
    'reports.share',
    'permit_packs.generate',
    'team.invite',
    'analytics.view',
  ],
  member: [
    'jobs.create',
    'hazards.edit',
    'mitigations.complete',
    'documents.upload',
    'reports.view',
  ],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Check multiple permissions (all must be true)
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm))
}

/**
 * Check multiple permissions (any must be true)
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm))
}

