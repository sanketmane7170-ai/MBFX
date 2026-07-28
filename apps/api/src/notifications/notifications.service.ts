import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  meta?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, limit = 30) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /** Create one notification per user (deduped). Best-effort, never throws to caller. */
  async createForUsers(userIds: string[], input: NotifyInput): Promise<void> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    try {
      await this.prisma.notification.createMany({
        data: ids.map((userId) => ({
          userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          meta: input.meta ?? Prisma.JsonNull,
        })),
      });
    } catch {
      /* notifications are non-critical */
    }
  }

  /** Notify every active super-admin, plus an optional entity owner. */
  async notifyAdmins(input: NotifyInput, ownerUserId?: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    const ids = admins.map((a) => a.id);
    if (ownerUserId) ids.push(ownerUserId);
    await this.createForUsers(ids, input);
  }
}
