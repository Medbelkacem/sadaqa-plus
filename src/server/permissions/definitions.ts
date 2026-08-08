/**
 * Single source of truth for the RBAC matrix.
 *
 * Imported by both the reference seed (to populate `roles` / `permissions` /
 * `role_permissions`) and the runtime authorization guards. Nothing here is
 * ever read from the client — a role or permission arriving from the browser
 * is always ignored.
 *
 * This module is intentionally free of `server-only` and of any Prisma import
 * so the seed script and unit tests can load it directly.
 */

export const ROLE_NAMES = [
  'USER',
  'DONOR',
  'VOLUNTEER',
  'ORGANIZATION',
  'MODERATOR',
  'ADMIN',
  'SUPER_ADMIN',
] as const;

export type RoleNameValue = (typeof ROLE_NAMES)[number];

export const PERMISSIONS = {
  // Requests
  REQUEST_CREATE: 'request:create',
  REQUEST_UPDATE_OWN: 'request:update.own',
  REQUEST_DELETE_OWN: 'request:delete.own',
  REQUEST_MODERATE: 'request:moderate',
  REQUEST_VERIFY: 'request:verify',

  // Campaigns
  CAMPAIGN_CREATE: 'campaign:create',
  CAMPAIGN_UPDATE_OWN: 'campaign:update.own',
  CAMPAIGN_MODERATE: 'campaign:moderate',

  // Events
  EVENT_CREATE: 'event:create',
  EVENT_UPDATE_OWN: 'event:update.own',
  EVENT_MODERATE: 'event:moderate',
  EVENT_ATTENDANCE_RECORD: 'event:attendance.record',

  // Volunteer missions
  MISSION_CREATE: 'mission:create',
  MISSION_UPDATE_OWN: 'mission:update.own',
  MISSION_APPLICATION_REVIEW: 'mission:application.review',

  // Volunteering
  VOLUNTEER_PROFILE_MANAGE: 'volunteer:profile.manage',
  VOLUNTEER_APPLY: 'volunteer:apply',

  // Organizations
  ORGANIZATION_UPDATE_OWN: 'organization:update.own',
  ORGANIZATION_VERIFY: 'organization:verify',
  ORGANIZATION_SUSPEND: 'organization:suspend',
  PARTNER_APPLICATION_SUBMIT: 'partner_application:submit',
  PARTNER_APPLICATION_REVIEW: 'partner_application:review',

  // Donations
  DONATION_CREATE: 'donation:create',
  DONATION_READ_OWN: 'donation:read.own',
  DONATION_MANAGE: 'donation:manage',

  // Messaging & notifications
  MESSAGE_SEND: 'message:send',
  MESSAGE_MODERATE: 'message:moderate',
  NOTIFICATION_READ_OWN: 'notification:read.own',
  NOTIFICATION_BROADCAST: 'notification:send.broadcast',

  // Moderation
  REPORT_CREATE: 'report:create',
  REPORT_MODERATE: 'report:moderate',

  // Users
  USER_READ_ANY: 'user:read.any',
  USER_SUSPEND: 'user:suspend',
  USER_ROLE_MANAGE: 'user:role.manage',
  USER_DELETE: 'user:delete',

  // Platform
  CATEGORY_MANAGE: 'category:manage',
  SETTING_MANAGE: 'setting:manage',
  AUDIT_READ: 'audit:read',
  ANALYTICS_READ: 'analytics:read',
  FILE_READ_PRIVATE_ANY: 'file:read.private.any',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  [PERMISSIONS.REQUEST_CREATE]: 'Submit a help request',
  [PERMISSIONS.REQUEST_UPDATE_OWN]: 'Edit a help request you authored',
  [PERMISSIONS.REQUEST_DELETE_OWN]: 'Delete a help request you authored',
  [PERMISSIONS.REQUEST_MODERATE]: 'Move a help request through the moderation workflow',
  [PERMISSIONS.REQUEST_VERIFY]: 'Record a verification decision on a help request',
  [PERMISSIONS.CAMPAIGN_CREATE]: 'Create a campaign',
  [PERMISSIONS.CAMPAIGN_UPDATE_OWN]: 'Edit a campaign owned by your organization',
  [PERMISSIONS.CAMPAIGN_MODERATE]: 'Approve, pause or reject campaigns',
  [PERMISSIONS.EVENT_CREATE]: 'Create an event',
  [PERMISSIONS.EVENT_UPDATE_OWN]: 'Edit an event owned by your organization',
  [PERMISSIONS.EVENT_MODERATE]: 'Approve, cancel or reject events',
  [PERMISSIONS.EVENT_ATTENDANCE_RECORD]: 'Scan tickets and record event attendance',
  [PERMISSIONS.MISSION_CREATE]: 'Publish a volunteer mission',
  [PERMISSIONS.MISSION_UPDATE_OWN]: 'Edit a volunteer mission owned by your organization',
  [PERMISSIONS.MISSION_APPLICATION_REVIEW]: 'Accept or reject volunteer applications',
  [PERMISSIONS.VOLUNTEER_PROFILE_MANAGE]: 'Create and manage a volunteer profile',
  [PERMISSIONS.VOLUNTEER_APPLY]: 'Apply to volunteer missions',
  [PERMISSIONS.ORGANIZATION_UPDATE_OWN]: 'Edit your organization profile',
  [PERMISSIONS.ORGANIZATION_VERIFY]: 'Verify or reject an organization',
  [PERMISSIONS.ORGANIZATION_SUSPEND]: 'Suspend an organization',
  [PERMISSIONS.PARTNER_APPLICATION_SUBMIT]: 'Submit a partnership application',
  [PERMISSIONS.PARTNER_APPLICATION_REVIEW]: 'Review partnership applications',
  [PERMISSIONS.DONATION_CREATE]: 'Start a donation or declare a donation intent',
  [PERMISSIONS.DONATION_READ_OWN]: 'View your own donation history',
  [PERMISSIONS.DONATION_MANAGE]: 'Administer donations and their lifecycle',
  [PERMISSIONS.MESSAGE_SEND]: 'Send platform messages',
  [PERMISSIONS.MESSAGE_MODERATE]: 'Hide messages and lock conversations',
  [PERMISSIONS.NOTIFICATION_READ_OWN]: 'Read your notifications',
  [PERMISSIONS.NOTIFICATION_BROADCAST]: 'Send platform-wide announcements',
  [PERMISSIONS.REPORT_CREATE]: 'Report content',
  [PERMISSIONS.REPORT_MODERATE]: 'Resolve content reports',
  [PERMISSIONS.USER_READ_ANY]: 'View any user account',
  [PERMISSIONS.USER_SUSPEND]: 'Suspend or reactivate a user account',
  [PERMISSIONS.USER_ROLE_MANAGE]: 'Grant or revoke roles',
  [PERMISSIONS.USER_DELETE]: 'Delete a user account',
  [PERMISSIONS.CATEGORY_MANAGE]: 'Manage categories',
  [PERMISSIONS.SETTING_MANAGE]: 'Manage system settings',
  [PERMISSIONS.AUDIT_READ]: 'Read the audit log',
  [PERMISSIONS.ANALYTICS_READ]: 'Read platform analytics',
  [PERMISSIONS.FILE_READ_PRIVATE_ANY]: 'Read any private file for moderation purposes',
};

const BASE_USER: PermissionKey[] = [
  PERMISSIONS.REQUEST_CREATE,
  PERMISSIONS.REQUEST_UPDATE_OWN,
  PERMISSIONS.REQUEST_DELETE_OWN,
  PERMISSIONS.DONATION_CREATE,
  PERMISSIONS.DONATION_READ_OWN,
  PERMISSIONS.MESSAGE_SEND,
  PERMISSIONS.NOTIFICATION_READ_OWN,
  PERMISSIONS.REPORT_CREATE,
  PERMISSIONS.PARTNER_APPLICATION_SUBMIT,
];

const MODERATOR_ONLY: PermissionKey[] = [
  PERMISSIONS.REQUEST_MODERATE,
  PERMISSIONS.REQUEST_VERIFY,
  PERMISSIONS.CAMPAIGN_MODERATE,
  PERMISSIONS.EVENT_MODERATE,
  PERMISSIONS.REPORT_MODERATE,
  PERMISSIONS.MESSAGE_MODERATE,
  PERMISSIONS.USER_READ_ANY,
  PERMISSIONS.FILE_READ_PRIVATE_ANY,
  PERMISSIONS.NOTIFICATION_READ_OWN,
];

const ADMIN_ONLY: PermissionKey[] = [
  PERMISSIONS.ORGANIZATION_VERIFY,
  PERMISSIONS.ORGANIZATION_SUSPEND,
  PERMISSIONS.PARTNER_APPLICATION_REVIEW,
  PERMISSIONS.USER_SUSPEND,
  PERMISSIONS.USER_ROLE_MANAGE,
  PERMISSIONS.CATEGORY_MANAGE,
  PERMISSIONS.SETTING_MANAGE,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.ANALYTICS_READ,
  PERMISSIONS.DONATION_MANAGE,
  PERMISSIONS.NOTIFICATION_BROADCAST,
  PERMISSIONS.EVENT_ATTENDANCE_RECORD,
];

/**
 * Permissions granted by each role. A user holding several roles receives the
 * union. SUPER_ADMIN holds every permission plus destructive account actions.
 */
export const ROLE_PERMISSIONS: Record<RoleNameValue, PermissionKey[]> = {
  USER: [...BASE_USER],

  DONOR: [...BASE_USER],

  VOLUNTEER: [
    ...BASE_USER,
    PERMISSIONS.VOLUNTEER_PROFILE_MANAGE,
    PERMISSIONS.VOLUNTEER_APPLY,
  ],

  ORGANIZATION: [
    ...BASE_USER,
    PERMISSIONS.ORGANIZATION_UPDATE_OWN,
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_UPDATE_OWN,
    PERMISSIONS.EVENT_CREATE,
    PERMISSIONS.EVENT_UPDATE_OWN,
    PERMISSIONS.EVENT_ATTENDANCE_RECORD,
    PERMISSIONS.MISSION_CREATE,
    PERMISSIONS.MISSION_UPDATE_OWN,
    PERMISSIONS.MISSION_APPLICATION_REVIEW,
  ],

  MODERATOR: [...BASE_USER, ...MODERATOR_ONLY],

  ADMIN: [...BASE_USER, ...MODERATOR_ONLY, ...ADMIN_ONLY],

  SUPER_ADMIN: [...ALL_PERMISSIONS],
};

export const ROLE_DESCRIPTIONS: Record<RoleNameValue, string> = {
  USER: 'Browse, search, save, report and submit help requests',
  DONOR: 'Track donations and follow campaigns',
  VOLUNTEER: 'Maintain a volunteer profile and apply to missions',
  ORGANIZATION: 'Act on behalf of a verified organization',
  MODERATOR: 'Review requests, reports and verification submissions',
  ADMIN: 'Administer the platform',
  SUPER_ADMIN: 'Unrestricted system access',
};

/** Roles a user may self-assign from the UI. Everything else is granted by an admin. */
export const SELF_ASSIGNABLE_ROLES: RoleNameValue[] = ['DONOR', 'VOLUNTEER'];

/** Roles that unlock the /admin area. */
export const STAFF_ROLES: RoleNameValue[] = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'];
