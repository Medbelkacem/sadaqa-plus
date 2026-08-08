'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/api/client';
import type { PermissionKey } from '@/server/permissions/definitions';

export type SessionUser = {
  id: string;
  email: string;
  status: string;
  locale: 'FR' | 'AR' | 'EN';
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarId: string | null;
  wilayaId: number | null;
  communeId: number | null;
  onboarded: boolean;
};

export type SessionOrganization = {
  organizationId: string;
  slug: string;
  publicName: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';
  verificationStatus: string;
};

export type SessionPayload =
  | { authenticated: false }
  | {
      authenticated: true;
      user: SessionUser;
      roles: string[];
      permissions: PermissionKey[];
      organizations: SessionOrganization[];
      isStaff: boolean;
      unreadNotifications: number;
    };

export const SESSION_QUERY_KEY = ['session'] as const;

/**
 * Reads the session from the server.
 *
 * The returned permissions drive what the UI *shows*. They are never the basis
 * of what the server *allows* — every protected action re-checks server-side,
 * so tampering with this response only changes which buttons are visible.
 */
export function useSession() {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => api.get<SessionPayload>('/api/auth/me'),
    staleTime: 60_000,
  });

  const session = query.data;
  const authenticated = session?.authenticated ?? false;

  return {
    ...query,
    session,
    authenticated,
    user: session?.authenticated ? session.user : null,
    roles: session?.authenticated ? session.roles : [],
    organizations: session?.authenticated ? session.organizations : [],
    isStaff: session?.authenticated ? session.isStaff : false,
    unreadNotifications: session?.authenticated ? session.unreadNotifications : 0,
    can: (permission: PermissionKey) =>
      Boolean(session?.authenticated && session.permissions.includes(permission)),
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      // Drop every cached query: some of it is scoped to the signed-in user.
      queryClient.clear();
      router.refresh();
    },
  });
}
