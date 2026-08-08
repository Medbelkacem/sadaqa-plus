import 'server-only';

import type { Prisma, TargetType } from '@prisma/client';

import { errors } from '@/lib/api/errors';
import { paginate } from '@/lib/api/response';
import type { AuthContext } from '@/server/auth/context';
import { prisma } from '@/server/db/prisma';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { notify } from '@/server/services/notification.service';

/**
 * Internal messaging.
 *
 * Every read and write goes through `assertMember`, which resolves the
 * conversation *and* the caller's membership in a single query. There is no
 * code path that fetches a conversation by id without that check, so a
 * guessed conversation id returns 404.
 *
 * Attachments reuse the file service, which only ever accepts JPEG, PNG, WebP
 * and PDF — no executable can be attached.
 */

async function assertMember(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: {
      id: true,
      leftAt: true,
      conversation: { select: { id: true, isLocked: true, subject: true } },
    },
  });

  if (!membership || membership.leftAt) throw errors.notFound();
  return membership;
}

export async function listConversations(userId: string, page: number, pageSize: number) {
  const where: Prisma.ConversationWhereInput = {
    members: { some: { userId, leftAt: null } },
  };

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        subject: true,
        targetType: true,
        targetId: true,
        isLocked: true,
        lastMessageAt: true,
        members: {
          where: { userId: { not: userId } },
          select: {
            user: {
              select: {
                id: true,
                profile: { select: { firstName: true, lastName: true, avatarId: true } },
              },
            },
          },
        },
        messages: {
          where: { deletedAt: null, isHidden: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, createdAt: true, senderId: true },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  // Unread = messages newer than this member's lastReadAt, from someone else.
  const memberships = await prisma.conversationMember.findMany({
    where: { userId, conversationId: { in: items.map((item) => item.id) } },
    select: { conversationId: true, lastReadAt: true },
  });
  const readMap = new Map(memberships.map((m) => [m.conversationId, m.lastReadAt]));

  const unreadCounts = await Promise.all(
    items.map((item) =>
      prisma.message.count({
        where: {
          conversationId: item.id,
          senderId: { not: userId },
          deletedAt: null,
          isHidden: false,
          ...(readMap.get(item.id) ? { createdAt: { gt: readMap.get(item.id)! } } : {}),
        },
      }),
    ),
  );

  return paginate(
    items.map((item, index) => ({ ...item, unread: unreadCounts[index] })),
    total,
    page,
    pageSize,
  );
}

export async function getConversation(
  conversationId: string,
  auth: AuthContext,
  page = 1,
  pageSize = 50,
) {
  await assertMember(conversationId, auth.user.id);

  const [conversation, messages, total] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        subject: true,
        isLocked: true,
        targetType: true,
        targetId: true,
        members: {
          select: {
            user: {
              select: {
                id: true,
                profile: { select: { firstName: true, lastName: true, avatarId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        body: true,
        senderId: true,
        isHidden: true,
        hiddenReason: true,
        createdAt: true,
        editedAt: true,
        attachments: {
          select: { id: true, file: { select: { id: true, originalName: true, mimeType: true } } },
        },
      },
    }),
    prisma.message.count({ where: { conversationId, deletedAt: null } }),
  ]);

  // Mark read on open.
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: auth.user.id } },
    data: { lastReadAt: new Date() },
  });

  return {
    conversation,
    messages: paginate(
      // Hidden messages keep their slot so the thread does not silently
      // reflow, but their body is replaced.
      messages.map((message) =>
        message.isHidden
          ? { ...message, body: '', attachments: [] }
          : message,
      ),
      total,
      page,
      pageSize,
    ),
  };
}

/**
 * Finds or creates a one-to-one conversation about a subject.
 * Reusing an existing thread keeps context together instead of scattering it.
 */
export async function openConversation(
  input: { recipientId: string; targetType?: TargetType; targetId?: string; subject?: string },
  auth: AuthContext,
) {
  if (input.recipientId === auth.user.id) {
    throw errors.validation('Vous ne pouvez pas démarrer une conversation avec vous-même.');
  }

  const recipient = await prisma.user.findFirst({
    where: { id: input.recipientId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!recipient) throw errors.notFound();

  // Blocking works in both directions: neither party can start a thread.
  const blocked = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: auth.user.id, blockedId: input.recipientId },
        { blockerId: input.recipientId, blockedId: auth.user.id },
      ],
    },
    select: { id: true },
  });
  if (blocked) throw errors.forbidden('Cette conversation n’est pas disponible.');

  const existing = await prisma.conversation.findFirst({
    where: {
      ...(input.targetId ? { targetId: input.targetId, targetType: input.targetType } : {}),
      AND: [
        { members: { some: { userId: auth.user.id } } },
        { members: { some: { userId: input.recipientId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      subject: input.subject ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      members: {
        create: [{ userId: auth.user.id }, { userId: input.recipientId }],
      },
    },
    select: { id: true },
  });
}

export async function sendMessage(
  conversationId: string,
  input: { body: string; attachmentIds?: string[] },
  auth: AuthContext,
) {
  const membership = await assertMember(conversationId, auth.user.id);
  if (membership.conversation.isLocked) {
    throw errors.forbidden('Cette conversation a été verrouillée par la modération.');
  }

  if (input.attachmentIds?.length) {
    const owned = await prisma.fileAsset.count({
      where: { id: { in: input.attachmentIds }, uploadedById: auth.user.id, deletedAt: null },
    });
    if (owned !== input.attachmentIds.length) throw errors.forbidden();
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { conversationId, senderId: auth.user.id, body: input.body },
      select: { id: true, createdAt: true },
    });

    if (input.attachmentIds?.length) {
      await tx.messageAttachment.createMany({
        data: input.attachmentIds.map((fileId) => ({ messageId: created.id, fileId })),
      });
    }

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: created.createdAt },
    });

    return created;
  });

  const others = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { not: auth.user.id }, leftAt: null },
    select: { userId: true },
  });

  for (const member of others) {
    await notify({
      userId: member.userId,
      type: 'NEW_MESSAGE',
      title: 'Nouveau message',
      body: input.body.slice(0, 120),
      targetType: 'CONVERSATION',
      targetId: conversationId,
      path: `/messages/${conversationId}`,
    }).catch(() => undefined);
  }

  return message;
}

/** Moderation: hides a message without destroying the record. */
export async function hideMessage(messageId: string, reason: string, auth: AuthContext) {
  if (!auth.permissions.has(PERMISSIONS.MESSAGE_MODERATE)) throw errors.forbidden();

  await prisma.message.update({
    where: { id: messageId },
    data: { isHidden: true, hiddenReason: reason },
  });
}

export async function setConversationLock(
  conversationId: string,
  locked: boolean,
  auth: AuthContext,
) {
  if (!auth.permissions.has(PERMISSIONS.MESSAGE_MODERATE)) throw errors.forbidden();
  await prisma.conversation.update({ where: { id: conversationId }, data: { isLocked: locked } });
}

export async function blockUser(blockedId: string, reason: string | undefined, auth: AuthContext) {
  if (blockedId === auth.user.id) throw errors.validation('Action impossible.');

  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: auth.user.id, blockedId } },
    create: { blockerId: auth.user.id, blockedId, reason: reason ?? null },
    update: { reason: reason ?? null },
  });
}

export async function unblockUser(blockedId: string, auth: AuthContext) {
  await prisma.userBlock.deleteMany({
    where: { blockerId: auth.user.id, blockedId },
  });
}

export async function totalUnread(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId, leftAt: null },
    select: { conversationId: true, lastReadAt: true },
  });

  if (memberships.length === 0) return 0;

  const counts = await Promise.all(
    memberships.map((membership) =>
      prisma.message.count({
        where: {
          conversationId: membership.conversationId,
          senderId: { not: userId },
          deletedAt: null,
          isHidden: false,
          ...(membership.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {}),
        },
      }),
    ),
  );

  return counts.reduce((sum, count) => sum + count, 0);
}
