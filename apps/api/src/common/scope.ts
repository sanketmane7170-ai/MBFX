import { Role } from '@prisma/client';
import { AuthPayload } from './decorators/current-user.decorator';

/** The authenticated caller. */
export type Actor = AuthPayload;

export function isSuper(actor: Actor): boolean {
  return actor.role === Role.SUPER_ADMIN;
}

/**
 * Tenant ownership filter for Prisma `where` clauses.
 * SUPER_ADMIN sees everything ({}); an ADMIN is scoped to records they created.
 */
export function ownedBy(actor: Actor, field = 'createdById'): Record<string, unknown> {
  return isSuper(actor) ? {} : { [field]: actor.sub };
}
