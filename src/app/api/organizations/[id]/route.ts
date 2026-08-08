import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireOrgMember, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { prisma } from '@/server/db/prisma';
import { getOrganizationForActor } from '@/server/services/organization.service';
import { recordAudit } from '@/server/services/audit.service';
import { updateOrganizationSchema } from '@/validations/organization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handler(async (_request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const auth = await requireAuth();
  return ok(await getOrganizationForActor(id, auth));
});

/** Editing an organization profile requires ADMIN rank inside that organization. */
export const PATCH = handler(async (request: NextRequest, context: RouteContext) => {
  await requireSameOrigin();
  const { id } = await context.params;
  const auth = await requireOrgMember(id, 'ADMIN', PERMISSIONS.ORGANIZATION_VERIFY);
  const input = await readJson(request, updateOrganizationSchema);

  const organization = await prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({
      where: { id },
      data: {
        publicName: input.publicName,
        description: input.description,
        email: input.email,
        phone: input.phone ?? null,
        website: input.website ?? null,
        facebook: input.facebook ?? null,
        instagram: input.instagram ?? null,
        linkedin: input.linkedin ?? null,
        wilayaId: input.wilayaId ?? null,
        communeId: input.communeId ?? null,
        address: input.address ?? null,
        areasOfWork: input.areasOfWork,
        logoId: input.logoId ?? null,
      },
      select: { id: true, slug: true, publicName: true },
    });

    // Replace coverage wholesale — a partial diff would leave stale wilayas.
    await tx.organizationCoverage.deleteMany({ where: { organizationId: id } });
    if (input.coverageWilayaIds.length > 0) {
      await tx.organizationCoverage.createMany({
        data: input.coverageWilayaIds.map((wilayaId) => ({ organizationId: id, wilayaId })),
        skipDuplicates: true,
      });
    }

    return updated;
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'ORGANIZATION_UPDATED',
    targetType: 'ORGANIZATION',
    targetId: id,
  });

  return ok(organization);
});
