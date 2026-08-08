import { describe, expect, it } from 'vitest';

import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  SELF_ASSIGNABLE_ROLES,
  STAFF_ROLES,
} from '@/server/permissions/definitions';

describe('RBAC matrix', () => {
  it('defines permissions for every role', () => {
    for (const role of ROLE_NAMES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it('gives SUPER_ADMIN every permission', () => {
    expect(new Set(ROLE_PERMISSIONS.SUPER_ADMIN)).toEqual(new Set(ALL_PERMISSIONS));
  });

  it('keeps ordinary users away from moderation', () => {
    const forbidden = [
      PERMISSIONS.REQUEST_MODERATE,
      PERMISSIONS.REQUEST_VERIFY,
      PERMISSIONS.CAMPAIGN_MODERATE,
      PERMISSIONS.REPORT_MODERATE,
      PERMISSIONS.USER_READ_ANY,
      PERMISSIONS.FILE_READ_PRIVATE_ANY,
      PERMISSIONS.AUDIT_READ,
    ];

    for (const role of ['USER', 'DONOR', 'VOLUNTEER'] as const) {
      for (const permission of forbidden) {
        expect(ROLE_PERMISSIONS[role]).not.toContain(permission);
      }
    }
  });

  it('keeps organizations away from moderation and administration', () => {
    // An organization can create; it must never approve its own content.
    expect(ROLE_PERMISSIONS.ORGANIZATION).toContain(PERMISSIONS.CAMPAIGN_CREATE);
    expect(ROLE_PERMISSIONS.ORGANIZATION).not.toContain(PERMISSIONS.CAMPAIGN_MODERATE);
    expect(ROLE_PERMISSIONS.ORGANIZATION).not.toContain(PERMISSIONS.REQUEST_VERIFY);
    expect(ROLE_PERMISSIONS.ORGANIZATION).not.toContain(PERMISSIONS.ORGANIZATION_VERIFY);
    expect(ROLE_PERMISSIONS.ORGANIZATION).not.toContain(PERMISSIONS.USER_ROLE_MANAGE);
  });

  it('stops moderators short of administration', () => {
    expect(ROLE_PERMISSIONS.MODERATOR).toContain(PERMISSIONS.REQUEST_MODERATE);

    for (const permission of [
      PERMISSIONS.USER_ROLE_MANAGE,
      PERMISSIONS.USER_SUSPEND,
      PERMISSIONS.SETTING_MANAGE,
      PERMISSIONS.ORGANIZATION_VERIFY,
      PERMISSIONS.DONATION_MANAGE,
    ]) {
      expect(ROLE_PERMISSIONS.MODERATOR).not.toContain(permission);
    }
  });

  it('never lets an admin delete accounts — that stays with SUPER_ADMIN', () => {
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain(PERMISSIONS.USER_DELETE);
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain(PERMISSIONS.USER_DELETE);
  });

  it('only allows DONOR and VOLUNTEER to be self-assigned', () => {
    expect(SELF_ASSIGNABLE_ROLES).toEqual(['DONOR', 'VOLUNTEER']);
    for (const role of ['MODERATOR', 'ADMIN', 'SUPER_ADMIN', 'ORGANIZATION'] as const) {
      expect(SELF_ASSIGNABLE_ROLES).not.toContain(role);
    }
  });

  it('scopes the admin area to staff roles', () => {
    expect(STAFF_ROLES).toEqual(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']);
  });

  it('has no duplicate permission keys', () => {
    const keys = Object.values(PERMISSIONS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
