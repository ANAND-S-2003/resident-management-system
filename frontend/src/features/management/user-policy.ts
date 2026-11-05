import { ROLES, type Role } from '@/lib/constants';

export type UserOperation = 'view' | 'edit' | 'activate' | 'deactivate';

export function mayManageUser(actorRole: Role, targetRole: Role, operation: UserOperation, actorId?: number, targetId?: number): boolean {
  if (targetRole === ROLES[2]) return false;
  if (actorRole !== ROLES[2] && !(actorRole === ROLES[1] && targetRole === ROLES[0])) return false;
  if (operation === 'deactivate' && actorId !== undefined && actorId === targetId) return false;
  return true;
}
