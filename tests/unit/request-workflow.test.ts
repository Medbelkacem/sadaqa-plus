import { describe, expect, it } from 'vitest';

import {
  EDITABLE_BY_AUTHOR,
  MODERATION_QUEUE_STATUSES,
  PUBLIC_REQUEST_STATUSES,
  assertTransition,
  canTransition,
  requiresModerator,
} from '@/server/domain/request-workflow';

describe('help-request state machine', () => {
  it('walks the intended happy path', () => {
    const path = [
      'DRAFT',
      'PENDING_REVIEW',
      'UNDER_REVIEW',
      'VERIFIED',
      'ACTIVE',
      'PARTIALLY_HELPED',
      'COMPLETED',
    ] as const;

    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('refuses to skip human verification', () => {
    // The whole point of the machine: nothing reaches the public feed without
    // passing through a moderator decision.
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(false);
    expect(canTransition('DRAFT', 'VERIFIED')).toBe(false);
    expect(canTransition('PENDING_REVIEW', 'ACTIVE')).toBe(false);
    expect(canTransition('PENDING_REVIEW', 'VERIFIED')).toBe(false);
  });

  it('treats ARCHIVED as terminal', () => {
    expect(canTransition('ARCHIVED', 'ACTIVE')).toBe(false);
    expect(canTransition('ARCHIVED', 'DRAFT')).toBe(false);
    expect(canTransition('COMPLETED', 'ACTIVE')).toBe(false);
  });

  it('lets a rejected request be resubmitted', () => {
    expect(canTransition('REJECTED', 'PENDING_REVIEW')).toBe(true);
    expect(canTransition('EXPIRED', 'PENDING_REVIEW')).toBe(true);
  });

  it('throws a typed error on an illegal transition', () => {
    expect(() => assertTransition('DRAFT', 'ACTIVE')).toThrowError(
      /cannot move from DRAFT to ACTIVE/,
    );
    expect(() => assertTransition('DRAFT', 'PENDING_REVIEW')).not.toThrow();
  });

  it('marks the moderator-only transitions', () => {
    expect(requiresModerator('VERIFIED')).toBe(true);
    expect(requiresModerator('ACTIVE')).toBe(true);
    expect(requiresModerator('REJECTED')).toBe(true);
    expect(requiresModerator('UNDER_REVIEW')).toBe(true);

    // Authors drive these themselves.
    expect(requiresModerator('PENDING_REVIEW')).toBe(false);
    expect(requiresModerator('COMPLETED')).toBe(false);
  });

  it('keeps unpublished statuses out of the public set', () => {
    for (const status of ['DRAFT', 'PENDING_REVIEW', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'] as const) {
      expect(PUBLIC_REQUEST_STATUSES).not.toContain(status);
    }
    expect(PUBLIC_REQUEST_STATUSES).toContain('ACTIVE');
  });

  it('stops an author editing a request that is already under review', () => {
    expect(EDITABLE_BY_AUTHOR).toContain('DRAFT');
    expect(EDITABLE_BY_AUTHOR).toContain('REJECTED');
    expect(EDITABLE_BY_AUTHOR).not.toContain('UNDER_REVIEW');
    expect(EDITABLE_BY_AUTHOR).not.toContain('ACTIVE');
  });

  it('queues exactly the two review states', () => {
    expect(MODERATION_QUEUE_STATUSES).toEqual(['PENDING_REVIEW', 'UNDER_REVIEW']);
  });
});
