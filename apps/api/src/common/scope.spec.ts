import { Role } from '@prisma/client';
import { isSuper, ownedBy, type Actor } from './scope';

const admin: Actor = { sub: 'admin-1', email: 'a@x.com', role: Role.ADMIN };
const superAdmin: Actor = { sub: 'super-1', email: 's@x.com', role: Role.SUPER_ADMIN };

describe('scope', () => {
  it('identifies super-admins', () => {
    expect(isSuper(superAdmin)).toBe(true);
    expect(isSuper(admin)).toBe(false);
  });

  it('scopes an ADMIN to records they created', () => {
    expect(ownedBy(admin)).toEqual({ createdById: 'admin-1' });
  });

  it('does not scope a SUPER_ADMIN (sees everything)', () => {
    expect(ownedBy(superAdmin)).toEqual({});
  });

  it('supports a custom owner field', () => {
    expect(ownedBy(admin, 'ownerId')).toEqual({ ownerId: 'admin-1' });
  });
});
