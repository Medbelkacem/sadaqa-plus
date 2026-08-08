import 'server-only';

import { unstable_cache } from 'next/cache';

import type { CategoryKind } from '@prisma/client';

import { prisma } from '@/server/db/prisma';

/**
 * Reference data (wilayas, communes, categories).
 *
 * This is the one part of the database that ships populated, and it changes
 * only when an administrator edits a category or the state redraws a boundary.
 * Cached aggressively and revalidated by tag when an admin makes a change.
 */

export const getWilayas = unstable_cache(
  async () =>
    prisma.wilaya.findMany({
      select: {
        id: true,
        code: true,
        nameFr: true,
        nameAr: true,
        nameEn: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { id: 'asc' },
    }),
  ['wilayas'],
  { revalidate: 86_400, tags: ['geography'] },
);

export const getCommunes = unstable_cache(
  async (wilayaId: number) =>
    prisma.commune.findMany({
      where: { wilayaId },
      select: { id: true, wilayaId: true, nameFr: true, nameAr: true, nameEn: true, dairaFr: true },
      orderBy: { nameFr: 'asc' },
    }),
  ['communes'],
  { revalidate: 86_400, tags: ['geography'] },
);

export const getAllCommunes = unstable_cache(
  async () =>
    prisma.commune.findMany({
      select: { id: true, wilayaId: true, nameFr: true, nameAr: true, nameEn: true },
      orderBy: [{ wilayaId: 'asc' }, { nameFr: 'asc' }],
    }),
  ['communes-all'],
  { revalidate: 86_400, tags: ['geography'] },
);

export const getCategories = unstable_cache(
  async (kind: CategoryKind) =>
    prisma.category.findMany({
      where: { kind, isActive: true },
      select: {
        id: true,
        slug: true,
        nameFr: true,
        nameAr: true,
        nameEn: true,
        icon: true,
        color: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }],
    }),
  ['categories'],
  { revalidate: 3_600, tags: ['categories'] },
);

export type WilayaOption = Awaited<ReturnType<typeof getWilayas>>[number];
export type CommuneOption = Awaited<ReturnType<typeof getAllCommunes>>[number];
export type CategoryOption = Awaited<ReturnType<typeof getCategories>>[number];

/** Reads a system setting with a typed fallback. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
  if (!row || row.value === null) return fallback;
  return row.value as T;
}
