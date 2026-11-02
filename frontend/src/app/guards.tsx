import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/lib/api/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLES } from '@/lib/constants';

export function homeForRole(role: Role): string { return role === ROLES[0] ? '/resident' : '/admin'; }
export function canAccessPath(role: Role, path: string): boolean {
  if (path === '/admin/admins' || path.startsWith('/admin/admins/')) return role === ROLES[2];
  if (path.startsWith('/resident')) return role === ROLES[0];
  if (path.startsWith('/admin')) return role === ROLES[1] || role === ROLES[2];
  if (path === '/account' || path.startsWith('/account/')) return true;
  return false;
}
export function RequireAuth() { const auth = useAuth(); const location = useLocation(); return auth.user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />; }
export function RequireRole({ roles }: { roles: Role[] }) { const auth = useAuth(); return auth.user && roles.includes(auth.user.role) ? <Outlet /> : <ForbiddenContent />; }
export function PublicOnly() { const auth = useAuth(); return auth.user ? <Navigate to={homeForRole(auth.user.role)} replace /> : <Outlet />; }

function ForbiddenContent() { return <div className="forbidden-content"><h1>Access denied</h1><p>You do not have permission to view this page.</p></div>; }
