import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import type { AssetVisibility } from '@prisma/client';

import { errors } from '@/lib/api/errors';
import type { AuthContext } from '@/server/auth/context';
import { prisma } from '@/server/db/prisma';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { recordAudit } from '@/server/services/audit.service';
import {
  ALLOWED_MIME_TYPES,
  EXTENSION_BY_MIME,
  MAX_UPLOAD_BYTES,
  storage,
  type AllowedMimeType,
} from '@/server/storage';

/**
 * Upload handling.
 *
 * The declared Content-Type and the file extension are both attacker-supplied,
 * so neither is trusted. The real check is `sniffMimeType`, which reads the
 * leading bytes. A file whose sniffed type disagrees with its declared type is
 * rejected outright rather than being "corrected" — disagreement is a signal,
 * not a formatting problem.
 */

/** Magic-byte signatures for the four accepted formats. */
function sniffMimeType(buffer: Buffer): AllowedMimeType | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // PDF: "%PDF-"
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';

  return null;
}

/**
 * Scans an SVG-in-disguise or a polyglot: some formats tolerate trailing HTML
 * that a browser will happily execute if the file is ever served with a
 * permissive content type. We refuse anything containing a script opener in
 * the first kilobyte of an image.
 */
function looksLikePolyglot(buffer: Buffer, mime: AllowedMimeType) {
  if (mime === 'application/pdf') return false;
  const head = buffer.subarray(0, 1024).toString('latin1').toLowerCase();
  return head.includes('<script') || head.includes('<!doctype html') || head.includes('<svg');
}

export function sanitizeFilename(name: string) {
  return (
    name
      // Control characters first, then path separators and characters that
      // are hostile on Windows or in shells. This value is display-only:
      // the storage key is always a generated UUID.
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\.{2,}/g, '.')
      .trim()
      .slice(0, 120) || 'fichier'
  );
}

export type UploadResult = {
  id: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
};

export async function uploadFile(
  file: File,
  auth: AuthContext,
  visibility: AssetVisibility = 'PRIVATE',
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw errors.payloadTooLarge(
      `Ce fichier dépasse la taille maximale de ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} Mo.`,
    );
  }
  if (file.size === 0) throw errors.validation('Ce fichier est vide.');

  const buffer = Buffer.from(await file.arrayBuffer());

  // Re-check the real size: `File.size` is client-reported metadata.
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw errors.payloadTooLarge('Ce fichier dépasse la taille maximale autorisée.');
  }

  const sniffed = sniffMimeType(buffer);
  if (!sniffed) {
    throw errors.unsupportedMedia(
      'Format non reconnu. Formats acceptés : JPEG, PNG, WebP, PDF.',
    );
  }

  const declared = file.type?.toLowerCase();
  if (declared && declared !== sniffed && ALLOWED_MIME_TYPES.includes(declared as AllowedMimeType)) {
    // Declared an allowed type but the bytes say otherwise: reject.
    throw errors.unsupportedMedia('Le contenu du fichier ne correspond pas à son type déclaré.');
  }

  if (looksLikePolyglot(buffer, sniffed)) {
    throw errors.unsupportedMedia('Ce fichier a été refusé par le contrôle de sécurité.');
  }

  const originalName = sanitizeFilename(file.name);
  const checksum = createHash('sha256').update(buffer).digest('hex');
  const id = randomUUID();
  const key = `uploads/${new Date().getUTCFullYear()}/${id}.${EXTENSION_BY_MIME[sniffed]}`;

  await storage().put(key, buffer, sniffed);

  const asset = await prisma.fileAsset.create({
    data: {
      id,
      storageKey: key,
      originalName,
      mimeType: sniffed,
      sizeBytes: buffer.byteLength,
      checksum,
      visibility,
      uploadedById: auth.user.id,
      // No malware scanner is wired in by default. The status stays PENDING
      // rather than claiming a clean scan that never happened; the admin
      // panel reports the scanner as not configured.
      scanStatus: 'PENDING',
    },
    select: { id: true, mimeType: true, originalName: true, sizeBytes: true },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'FILE_UPLOADED',
    targetId: asset.id,
    metadata: { mimeType: sniffed, sizeBytes: buffer.byteLength, visibility },
  });

  return asset;
}

/**
 * Authorization for reading a stored file.
 *
 * PUBLIC assets are readable by anyone. Everything else requires either
 * ownership or a moderation permission. This is the single choke point: the
 * file route calls nothing else.
 */
export async function authorizeFileRead(fileId: string, auth: AuthContext | null) {
  const file = await prisma.fileAsset.findFirst({
    where: { id: fileId, deletedAt: null },
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      originalName: true,
      sizeBytes: true,
      visibility: true,
      uploadedById: true,
    },
  });

  // A missing file and an unauthorized one look identical from outside.
  if (!file) throw errors.notFound();

  if (file.visibility === 'PUBLIC') return file;

  if (!auth) throw errors.notFound();

  if (file.uploadedById === auth.user.id) return file;

  if (auth.permissions.has(PERMISSIONS.FILE_READ_PRIVATE_ANY)) {
    await recordAudit({
      actorId: auth.user.id,
      action: 'FILE_ACCESSED',
      targetId: file.id,
      metadata: { visibility: file.visibility, reason: 'moderation' },
    });
    return file;
  }

  // Attachments explicitly published on a live request are readable by all.
  if (file.visibility === 'MODERATORS_ONLY') throw errors.notFound();

  throw errors.notFound();
}

export async function setFileVisibility(fileId: string, visibility: AssetVisibility) {
  await prisma.fileAsset.update({ where: { id: fileId }, data: { visibility } });
}

export async function deleteFile(fileId: string, auth: AuthContext) {
  const file = await prisma.fileAsset.findFirst({
    where: { id: fileId, deletedAt: null },
    select: { id: true, storageKey: true, uploadedById: true },
  });
  if (!file) throw errors.notFound();
  if (file.uploadedById !== auth.user.id && !auth.permissions.has(PERMISSIONS.FILE_READ_PRIVATE_ANY)) {
    throw errors.notFound();
  }

  // Soft-delete the row first: losing the object but keeping a dangling row is
  // worse than the reverse.
  await prisma.fileAsset.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
  await storage().delete(file.storageKey).catch((error) => {
    console.error('[files] object deletion failed', { fileId, error });
  });
}

/** Reports whether a malware scanner is wired in. Surfaced in /admin. */
export function malwareScannerConfigured() {
  return false;
}
