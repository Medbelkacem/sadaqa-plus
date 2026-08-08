/**
 * Reference data seed.
 *
 * This script seeds ONLY system reference data:
 *   roles, permissions, categories, wilayas, communes, system settings.
 *
 * It deliberately creates NO users, organizations, requests, campaigns,
 * events, volunteers, donations, notifications or statistics. A freshly
 * seeded Sadaqa+ database reports zero activity, because there is none yet.
 *
 * The script is idempotent: running it again updates reference rows in place
 * and never touches activity tables.
 */

import { Prisma, PrismaClient, type CategoryKind, type RoleName } from '@prisma/client';

import { CATEGORIES } from './data/categories';
import { WILAYAS } from './data/wilayas';
import communesJson from './data/communes.json';
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_DESCRIPTIONS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
} from '../src/server/permissions/definitions';

const prisma = new PrismaClient();

type CommuneSeed = {
  id: number;
  wilayaId: number;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  dairaFr: string | null;
  dairaAr: string | null;
};

const COMMUNES = communesJson as CommuneSeed[];

/** Platform defaults. Every one of these is editable from /admin/settings. */
const SYSTEM_SETTINGS: { key: string; value: unknown; description: string }[] = [
  {
    key: 'platform.request.auto_expire_days',
    value: 90,
    description: 'Days after publication before an unresolved request is marked EXPIRED.',
  },
  {
    key: 'platform.request.require_verification',
    value: true,
    description: 'Requests must pass human verification before appearing publicly.',
  },
  {
    key: 'platform.campaign.require_moderation',
    value: true,
    description: 'Campaigns must be approved by a moderator before publication.',
  },
  {
    key: 'platform.upload.max_file_size_mb',
    value: 8,
    description: 'Maximum accepted upload size in megabytes.',
  },
  {
    key: 'platform.upload.max_files_per_request',
    value: 6,
    description: 'Maximum number of attachments per help request.',
  },
  {
    key: 'platform.announcement',
    value: null,
    description: 'Optional site-wide announcement banner. Null hides the banner.',
  },
  {
    key: 'platform.legal.entity_status',
    value: 'unregistered',
    description:
      'Legal standing of the operating entity. Anything other than a documented registration keeps all charity/tax claims hidden from the UI.',
  },
  {
    key: 'platform.legal.tax_deductible',
    value: false,
    description:
      'Whether donations are legally tax deductible. Must only be enabled with documented legal confirmation.',
  },
  {
    key: 'platform.featured.campaign_ids',
    value: [],
    description: 'Campaign IDs pinned to the homepage. Empty by default.',
  },
];

async function seedRolesAndPermissions() {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: PERMISSION_DESCRIPTIONS[key] },
      update: { description: PERMISSION_DESCRIPTIONS[key] },
    });
  }

  const permissionRows = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissionRows.map((p) => [p.key, p.id]));

  for (const name of ROLE_NAMES) {
    const role = await prisma.role.upsert({
      where: { name: name as RoleName },
      create: { name: name as RoleName, description: ROLE_DESCRIPTIONS[name] },
      update: { description: ROLE_DESCRIPTIONS[name] },
    });

    const wanted = ROLE_PERMISSIONS[name];
    const wantedIds = wanted
      .map((k) => permissionIdByKey.get(k))
      .filter((id): id is string => Boolean(id));

    // Replace the role's grants so the matrix in code is authoritative.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: wantedIds } },
    });
    await prisma.rolePermission.createMany({
      data: wantedIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  console.log(
    `  roles: ${ROLE_NAMES.length}, permissions: ${ALL_PERMISSIONS.length}`,
  );
}

async function seedGeography() {
  for (const w of WILAYAS) {
    await prisma.wilaya.upsert({
      where: { id: w.id },
      create: w,
      update: {
        code: w.code,
        nameFr: w.nameFr,
        nameAr: w.nameAr,
        nameEn: w.nameEn,
        latitude: w.latitude,
        longitude: w.longitude,
      },
    });
  }

  // Communes are inserted in bulk; `skipDuplicates` keeps the run idempotent
  // without issuing 1,541 individual upserts.
  const existing = await prisma.commune.count();
  if (existing !== COMMUNES.length) {
    const CHUNK = 500;
    for (let i = 0; i < COMMUNES.length; i += CHUNK) {
      await prisma.commune.createMany({
        data: COMMUNES.slice(i, i + CHUNK),
        skipDuplicates: true,
      });
    }
  }

  console.log(
    `  wilayas: ${await prisma.wilaya.count()}, communes: ${await prisma.commune.count()}`,
  );
}

async function seedCategories() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { kind_slug: { kind: c.kind as CategoryKind, slug: c.slug } },
      create: { ...c, kind: c.kind as CategoryKind },
      update: {
        nameFr: c.nameFr,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
      },
    });
  }
  console.log(`  categories: ${await prisma.category.count()}`);
}

async function seedSettings() {
  for (const s of SYSTEM_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        value: (s.value === null
          ? Prisma.JsonNull
          : s.value) as Prisma.InputJsonValue,
        description: s.description,
      },
      // Never clobber an operator's chosen value; only refresh documentation.
      update: { description: s.description },
    });
  }
  console.log(`  settings: ${await prisma.systemSetting.count()}`);
}

async function reportActivityCounts() {
  const [users, organizations, requests, campaigns, events, donations] =
    await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.request.count(),
      prisma.campaign.count(),
      prisma.event.count(),
      prisma.donation.count(),
    ]);

  console.log('\nActivity tables (must be zero on a fresh install):');
  console.log(
    `  users=${users} organizations=${organizations} requests=${requests} ` +
      `campaigns=${campaigns} events=${events} donations=${donations}`,
  );
}

async function main() {
  console.log('Seeding Sadaqa+ reference data (no demo activity)…\n');
  await seedRolesAndPermissions();
  await seedGeography();
  await seedCategories();
  await seedSettings();
  await reportActivityCounts();
  console.log('\nDone.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
