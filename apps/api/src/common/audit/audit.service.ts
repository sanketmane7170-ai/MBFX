import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records a state-changing action. Never throws into the caller path. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          meta: entry.meta,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log for ${entry.action}`, err as Error);
    }
  }

  /** Paginated, filterable audit trail (super-admin view). */
  async list(q: {
    action?: string;
    entityType?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: unknown[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.action ? { action: q.action } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.from || q.to
        ? { ts: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } }
        : {}),
    };
    const take = Math.min(q.limit ?? 50, 200);
    const skip = q.offset ?? 0;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { ts: 'desc' },
        take,
        skip,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          meta: true,
          ts: true,
          user: { select: { email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
