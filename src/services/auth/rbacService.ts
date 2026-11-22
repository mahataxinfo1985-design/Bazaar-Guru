import { BusinessRole, ActionPermission, ResourceScope, BusinessUser } from '../../types/workspace';

/**
 * Master permission matrix defining access policies per role.
 */
export const ROLE_PERMISSIONS: Record<BusinessRole, Partial<Record<ResourceScope, ActionPermission[]>>> = {
  owner: {
    sales: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    purchases: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    inventory: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    banking: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    accounting: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    parties: ['view', 'create', 'edit', 'delete_draft', 'export'],
    reports: ['view', 'export'],
    settings: ['view', 'manage_settings', 'manage_users'],
    documents: ['view', 'create', 'edit', 'delete_draft', 'export']
  },
  admin: {
    sales: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    purchases: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    inventory: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    banking: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    accounting: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'cancel', 'export'],
    parties: ['view', 'create', 'edit', 'delete_draft', 'export'],
    reports: ['view', 'export'],
    settings: ['view', 'manage_settings'],
    documents: ['view', 'create', 'edit', 'delete_draft', 'export']
  },
  accountant: {
    sales: ['view', 'post', 'export'],
    purchases: ['view', 'post', 'export'],
    inventory: ['view', 'export'],
    banking: ['view', 'create', 'edit', 'post', 'export'],
    accounting: ['view', 'create', 'edit', 'post', 'export'],
    parties: ['view', 'edit', 'export'],
    reports: ['view', 'export'],
    documents: ['view', 'create', 'export']
  },
  sales_manager: {
    sales: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'export'],
    parties: ['view', 'create', 'edit', 'export'],
    inventory: ['view'],
    reports: ['view', 'export']
  },
  sales_staff: {
    sales: ['view', 'create'],
    parties: ['view', 'create'],
    inventory: ['view']
  },
  purchase_manager: {
    purchases: ['view', 'create', 'edit', 'delete_draft', 'approve', 'post', 'export'],
    parties: ['view', 'create', 'edit', 'export'],
    inventory: ['view', 'create', 'edit'],
    reports: ['view', 'export']
  },
  inventory_manager: {
    inventory: ['view', 'create', 'edit', 'post', 'export'],
    purchases: ['view'],
    sales: ['view'],
    reports: ['view', 'export']
  },
  cashier: {
    sales: ['view', 'create'],
    banking: ['view', 'create'],
    parties: ['view']
  },
  viewer: {
    sales: ['view'],
    purchases: ['view'],
    inventory: ['view'],
    banking: ['view'],
    accounting: ['view'],
    parties: ['view'],
    reports: ['view'],
    documents: ['view']
  }
};

/**
 * Checks whether a given role has permission to perform an action on a resource.
 */
export function hasPermission(
  role: BusinessRole,
  action: ActionPermission,
  resource: ResourceScope
): boolean {
  if (role === 'owner') return true;
  const resourcePerms = ROLE_PERMISSIONS[role]?.[resource];
  if (!resourcePerms) return false;
  return resourcePerms.includes(action);
}

/**
 * Asserts that the role has permission, throwing an AuthorizationError if not.
 */
export function assertPermission(
  role: BusinessRole,
  action: ActionPermission,
  resource: ResourceScope
): void {
  if (!hasPermission(role, action, resource)) {
    throw new Error(`Unauthorized: Role '${role}' lacks permission to perform '${action}' on '${resource}'.`);
  }
}
