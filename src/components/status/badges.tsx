import type { RequestStatus, UrgencyLevel, VerificationStatus } from '@prisma/client';
import { AlertTriangle, CircleDashed, Eye, ShieldCheck, ShieldX } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Dictionary } from '@/i18n';

/**
 * Verification badge.
 *
 * There is deliberately no "default to verified" path: an item whose
 * verification state is unknown renders nothing rather than a green tick.
 */
export function VerificationBadge({
  status,
  t,
}: {
  status: VerificationStatus | null | undefined;
  t: Dictionary;
}) {
  if (!status) return null;

  switch (status) {
    case 'PENDING':
      return (
        <Badge tone="warning">
          <CircleDashed aria-hidden="true" />
          {t.verification.pending}
        </Badge>
      );
    case 'UNDER_REVIEW':
      return (
        <Badge tone="info">
          <Eye aria-hidden="true" />
          {t.verification.underReview}
        </Badge>
      );
    case 'VERIFIED':
      return (
        <Badge tone="success">
          <ShieldCheck aria-hidden="true" />
          {t.verification.verified}
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge tone="danger">
          <ShieldX aria-hidden="true" />
          {t.verification.rejected}
        </Badge>
      );
    case 'SUSPENDED':
      return <Badge tone="neutral">{t.verification.suspended}</Badge>;
    default:
      return null;
  }
}

const URGENCY_TONE = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
} as const;

export function UrgencyBadge({ level, t }: { level: UrgencyLevel; t: Dictionary }) {
  return (
    <Badge tone={URGENCY_TONE[level]}>
      {(level === 'HIGH' || level === 'CRITICAL') && <AlertTriangle aria-hidden="true" />}
      {t.requests.urgencyLevels[level]}
    </Badge>
  );
}

const REQUEST_STATUS_TONE: Record<RequestStatus, Parameters<typeof Badge>[0]['tone']> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  UNDER_REVIEW: 'info',
  VERIFIED: 'success',
  ACTIVE: 'primary',
  PARTIALLY_HELPED: 'accent',
  COMPLETED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
  ARCHIVED: 'neutral',
};

export function RequestStatusBadge({ status, t }: { status: RequestStatus; t: Dictionary }) {
  return <Badge tone={REQUEST_STATUS_TONE[status]}>{t.requests.status[status]}</Badge>;
}
