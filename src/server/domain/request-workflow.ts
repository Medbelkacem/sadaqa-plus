import type { RequestStatus } from '@prisma/client';

import { errors } from '@/lib/api/errors';

/**
 * Help-request state machine.
 *
 * Transitions are enumerated explicitly rather than validated ad hoc at each
 * call site. Anything not listed here is impossible, which is what stops a
 * request from, say, jumping from DRAFT straight to ACTIVE and skipping human
 * verification.
 *
 *   DRAFT → PENDING_REVIEW → UNDER_REVIEW → VERIFIED → ACTIVE
 *           → PARTIALLY_HELPED → COMPLETED
 *   plus REJECTED / EXPIRED / ARCHIVED as terminal-ish branches.
 */

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['UNDER_REVIEW', 'REJECTED', 'DRAFT', 'ARCHIVED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED', 'PENDING_REVIEW', 'ARCHIVED'],
  // VERIFIED is the moderator's decision; ACTIVE is the published state.
  // Publication is a separate step so a verified request can be held back.
  VERIFIED: ['ACTIVE', 'REJECTED', 'ARCHIVED'],
  ACTIVE: ['PARTIALLY_HELPED', 'COMPLETED', 'EXPIRED', 'ARCHIVED', 'REJECTED'],
  PARTIALLY_HELPED: ['COMPLETED', 'ACTIVE', 'EXPIRED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  REJECTED: ['PENDING_REVIEW', 'ARCHIVED'],
  EXPIRED: ['PENDING_REVIEW', 'ARCHIVED'],
  ARCHIVED: [],
};

/** Statuses whose rows are visible to anyone, signed in or not. */
export const PUBLIC_REQUEST_STATUSES: RequestStatus[] = [
  'ACTIVE',
  'PARTIALLY_HELPED',
  'COMPLETED',
];

/** Statuses the author may still edit. */
export const EDITABLE_BY_AUTHOR: RequestStatus[] = ['DRAFT', 'PENDING_REVIEW', 'REJECTED'];

/** Statuses sitting in the moderation queue. */
export const MODERATION_QUEUE_STATUSES: RequestStatus[] = ['PENDING_REVIEW', 'UNDER_REVIEW'];

export function canTransition(from: RequestStatus, to: RequestStatus) {
  return REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws a typed 409 rather than silently ignoring an illegal transition. */
export function assertTransition(from: RequestStatus, to: RequestStatus) {
  if (!canTransition(from, to)) throw errors.invalidTransition(from, to);
}

/**
 * Which transitions a moderator may drive, versus the author.
 * Authors can submit and archive their own; only moderators can verify,
 * reject or publish.
 */
export const MODERATOR_ONLY_TRANSITIONS: RequestStatus[] = [
  'UNDER_REVIEW',
  'VERIFIED',
  'ACTIVE',
  'REJECTED',
];

export function requiresModerator(to: RequestStatus) {
  return MODERATOR_ONLY_TRANSITIONS.includes(to);
}

/** Statuses that display a verification badge. */
export function verificationBadge(status: RequestStatus) {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'pending' as const;
    case 'UNDER_REVIEW':
      return 'under_review' as const;
    case 'VERIFIED':
    case 'ACTIVE':
    case 'PARTIALLY_HELPED':
    case 'COMPLETED':
      return 'verified' as const;
    case 'REJECTED':
      return 'rejected' as const;
    default:
      return null;
  }
}
