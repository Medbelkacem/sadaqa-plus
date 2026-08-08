import { NextResponse, type NextRequest } from 'next/server';

import { toApiFailure } from '@/lib/api/response';
import { getAuthContext } from '@/server/auth/context';
import { authorizeFileRead } from '@/server/services/file.service';
import { storage } from '@/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Authorized file read.
 *
 * Every private object goes through this route so the permission check runs on
 * each request. With an S3 driver the response is a redirect to a short-lived
 * signed URL; with the local driver the bytes are streamed directly.
 *
 * IDOR protection: `authorizeFileRead` resolves the asset and the caller
 * together and throws a 404 for anything the caller may not read, so guessing
 * an id reveals nothing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await getAuthContext();
    const file = await authorizeFileRead(id, auth);

    const driver = storage();
    const signed = await driver.signedUrl(file.storageKey, 300);
    if (signed) return NextResponse.redirect(signed, { status: 307 });

    const body = await driver.get(file.storageKey);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.sizeBytes),
        // `attachment` for PDFs: rendering an untrusted PDF inline on the app
        // origin gives it a same-origin script context in some browsers.
        'Content-Disposition':
          file.mimeType === 'application/pdf'
            ? `attachment; filename="${encodeURIComponent(file.originalName)}"`
            : `inline; filename="${encodeURIComponent(file.originalName)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control':
          file.visibility === 'PUBLIC'
            ? 'public, max-age=31536000, immutable'
            : 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return toApiFailure(error);
  }
}
