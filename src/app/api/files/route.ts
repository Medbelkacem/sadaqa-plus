import type { NextRequest } from 'next/server';

import { created, handler } from '@/lib/api/response';
import { errors } from '@/lib/api/errors';
import { ipOf } from '@/lib/api/request';
import { requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { uploadFile } from '@/server/services/file.service';
import { MAX_UPLOAD_BYTES } from '@/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Multipart upload endpoint.
 *
 * Files land as PRIVATE by default. Making an asset public is always a
 * separate, explicit decision taken by the feature that owns it.
 */
export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  await enforce(RATE_LIMITS.fileUpload, `${auth.user.id}:${ipOf(request)}`);

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw errors.unsupportedMedia('Envoi de fichier attendu.');
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 4096) {
    throw errors.payloadTooLarge('Ce fichier dépasse la taille maximale autorisée.');
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) throw errors.validation('Aucun fichier reçu.');

  const asset = await uploadFile(file, auth, 'PRIVATE');
  return created(asset);
});
