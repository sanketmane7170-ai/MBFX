import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { TokenService } from './token.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: User['role'];
  status: UserStatus;
}

export interface LoginResult extends AuthTokens {
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Uniform failure to avoid leaking which part was wrong.
    const invalid = new UnauthorizedException('Invalid credentials');
    if (!user || user.status === UserStatus.DISABLED) {
      await this.audit.log({
        userId: user?.id,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        meta: { email: email.toLowerCase(), reason: user ? 'disabled' : 'unknown_user' },
      });
      throw invalid;
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      await this.audit.log({
        userId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        meta: { email: email.toLowerCase(), reason: 'bad_password' },
      });
      throw invalid;
    }

    const tokens = await this.issueTokens(user);
    await this.audit.log({
      userId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    return { ...tokens, user: AuthService.toPublicUser(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const invalid = new UnauthorizedException('Invalid refresh token');

    let payload: { sub: string };
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw invalid;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user ||
      user.status === UserStatus.DISABLED ||
      !user.hashedRefreshToken
    ) {
      throw invalid;
    }

    const matches = await argon2.verify(user.hashedRefreshToken, refreshToken);
    if (!matches) throw invalid;

    const tokens = await this.issueTokens(user);
    await this.audit.log({
      userId: user.id,
      action: 'AUTH_TOKEN_REFRESH',
      entityType: 'User',
      entityId: user.id,
    });
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
    await this.audit.log({
      userId,
      action: 'AUTH_LOGOUT',
      entityType: 'User',
      entityId: userId,
    });
  }

  /** Self-service password change. Verifies the current password, then rotates. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('Current password is incorrect.');
    if (await argon2.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException('New password must be different from the current one.');
    }

    const passwordHash = await argon2.hash(newPassword);
    // Invalidate other sessions on password change.
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, hashedRefreshToken: null },
    });
    await this.audit.log({
      userId,
      action: 'AUTH_PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return AuthService.toPublicUser(user);
  }

  /** Issues an access + refresh pair and persists the hashed refresh token (rotation). */
  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessToken = await this.tokens.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.tokens.signRefresh({ sub: user.id });

    const hashedRefreshToken = await argon2.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  private static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
