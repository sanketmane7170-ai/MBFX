import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';

const ADMIN_VIEW = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type AdminView = Prisma.UserGetPayload<{ select: typeof ADMIN_VIEW }>;

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: { email: string; password: string },
    creatorId: string,
  ): Promise<AdminView> {
    const passwordHash = await argon2.hash(dto.password);
    try {
      const admin = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          role: Role.ADMIN,
          createdById: creatorId,
        },
        select: ADMIN_VIEW,
      });
      await this.audit.log({
        userId: creatorId,
        action: 'ADMIN_CREATED',
        entityType: 'User',
        entityId: admin.id,
        meta: { email: admin.email },
      });
      return admin;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
  }

  findAll(): Promise<AdminView[]> {
    return this.prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: ADMIN_VIEW,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<AdminView> {
    const admin = await this.prisma.user.findFirst({
      where: { id, role: Role.ADMIN },
      select: ADMIN_VIEW,
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async setStatus(
    id: string,
    status: UserStatus,
    actorId: string,
  ): Promise<AdminView> {
    await this.findOne(id); // guards role + existence
    const admin = await this.prisma.user.update({
      where: { id },
      data: {
        status,
        // Disabling revokes the active session immediately.
        ...(status === UserStatus.DISABLED
          ? { hashedRefreshToken: null }
          : {}),
      },
      select: ADMIN_VIEW,
    });
    await this.audit.log({
      userId: actorId,
      action: status === UserStatus.DISABLED ? 'ADMIN_DISABLED' : 'ADMIN_ENABLED',
      entityType: 'User',
      entityId: id,
    });
    return admin;
  }

  async resetPassword(
    id: string,
    password: string,
    actorId: string,
  ): Promise<void> {
    await this.findOne(id);
    const passwordHash = await argon2.hash(password);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, hashedRefreshToken: null },
    });
    await this.audit.log({
      userId: actorId,
      action: 'ADMIN_PASSWORD_RESET',
      entityType: 'User',
      entityId: id,
    });
  }
}
