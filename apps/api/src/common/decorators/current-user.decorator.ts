import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

/** Shape of the JWT access-token payload attached to the request. */
export interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthPayload }>();
    if (!req.user) return undefined;
    return data ? req.user[data] : req.user;
  },
);
