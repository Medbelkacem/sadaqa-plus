'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

const ASSIGNABLE = ['MODERATOR', 'ORGANIZATION', 'VOLUNTEER', 'DONOR'] as const;
const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'] as const;

/**
 * Per-user role and status actions.
 *
 * The menu only offers what the caller may actually do. The server re-checks
 * every rule anyway — including that nobody edits their own account and that
 * only a SUPER_ADMIN grants ADMIN or SUPER_ADMIN.
 */
export function UserActions({
  userId,
  status,
  roles,
  canManageRoles,
  canSuspend,
  isSuperAdmin,
}: {
  userId: string;
  status: string;
  roles: string[];
  canManageRoles: boolean;
  canSuspend: boolean;
  isSuperAdmin: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const mutate = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post(`/api/admin/users/${userId}`, body),
    onSuccess: () => {
      toast.success(t.admin.decisionRecorded);
      router.refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : t.errors.genericBody),
  });

  const grantable = [...ASSIGNABLE, ...(isSuperAdmin ? PRIVILEGED : [])];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t.common.edit}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {canManageRoles ? (
          <>
            <DropdownMenuLabel>{t.admin.grantRole}</DropdownMenuLabel>
            {grantable.map((role) => {
              const held = roles.includes(role);
              return (
                <DropdownMenuItem
                  key={role}
                  onSelect={() =>
                    mutate.mutate({ op: held ? 'revoke_role' : 'grant_role', role })
                  }
                >
                  <span className="flex-1">{role}</span>
                  <span className="text-xs text-muted-fg">
                    {held ? t.admin.revokeRole : t.admin.grantRole}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </>
        ) : null}

        {canSuspend ? (
          <>
            {canManageRoles ? <DropdownMenuSeparator /> : null}
            {status === 'SUSPENDED' ? (
              <DropdownMenuItem
                onSelect={() => mutate.mutate({ op: 'set_status', status: 'ACTIVE' })}
              >
                {t.admin.reactivateUser}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                destructive
                onSelect={() => mutate.mutate({ op: 'set_status', status: 'SUSPENDED' })}
              >
                {t.admin.suspendUser}
              </DropdownMenuItem>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
