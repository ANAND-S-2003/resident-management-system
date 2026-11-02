import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { AppShell } from './layout';
import { PublicOnly, RequireAuth, RequireRole } from './guards';
import { homeForRole } from './guards';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLES } from '@/lib/constants';
import { ComingSoon, ForbiddenPage, NotFoundPage } from './pages';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';

function Placeholder({ title }: { title: string }) { return <ComingSoon title={title} />; }
const lazyPage = (title: string) => lazy(async () => ({ default: (() => <Placeholder title={title} />) as ComponentType }));
const ResidentHome = lazyPage('Resident dashboard'); const ResidentRequests = lazyPage('My requests'); const NewRequest = lazyPage('New request'); const RequestDetails = lazyPage('Request details'); const ResidentNotifications = lazyPage('Notifications');
const AdminHome = lazyPage('Admin dashboard'); const AdminRequests = lazyPage('Requests'); const AdminRequestDetails = lazyPage('Request details'); const Residents = lazyPage('Residents'); const Services = lazyPage('Services'); const Messages = lazyPage('Messages'); const Admins = lazyPage('Admins'); const Account = lazyPage('Account'); const Contact = lazyPage('Contact');
const fallback = <div className="route-loading" role="status"><Spinner />Loading page...</div>;

export const router = createBrowserRouter([
  { element: <PublicOnly />, children: [
    { path: '/login', element: <LoginPage /> }, { path: '/register', element: <RegisterPage /> },
  ] },
  { path: '/contact', element: <Suspense fallback={fallback}><Contact /></Suspense> },
  { element: <RequireAuth />, children: [{ element: <AppShell />, children: [
    { index: true, element: <RoleHomeRedirect /> },
    { element: <RequireRole roles={[ROLES[0]]} />, children: [
      { path: '/resident', element: <Suspense fallback={fallback}><ResidentHome /></Suspense> },
      { path: '/resident/requests', element: <Suspense fallback={fallback}><ResidentRequests /></Suspense> },
      { path: '/resident/requests/new', element: <Suspense fallback={fallback}><NewRequest /></Suspense> },
      { path: '/resident/requests/:id', element: <Suspense fallback={fallback}><RequestDetails /></Suspense> },
      { path: '/resident/notifications', element: <Suspense fallback={fallback}><ResidentNotifications /></Suspense> },
    ] },
    { element: <RequireRole roles={[ROLES[1], ROLES[2]]} />, children: [
      { path: '/admin', element: <Suspense fallback={fallback}><AdminHome /></Suspense> },
      { path: '/admin/requests', element: <Suspense fallback={fallback}><AdminRequests /></Suspense> },
      { path: '/admin/requests/:id', element: <Suspense fallback={fallback}><AdminRequestDetails /></Suspense> },
      { path: '/admin/residents', element: <Suspense fallback={fallback}><Residents /></Suspense> },
      { path: '/admin/services', element: <Suspense fallback={fallback}><Services /></Suspense> },
      { path: '/admin/messages', element: <Suspense fallback={fallback}><Messages /></Suspense> },
    ] },
    { element: <RequireRole roles={[ROLES[2]]} />, children: [{ path: '/admin/admins', element: <Suspense fallback={fallback}><Admins /></Suspense> }] },
    { element: <RequireRole roles={[...ROLES]} />, children: [{ path: '/account', element: <Suspense fallback={fallback}><Account /></Suspense> }] },
  ] }] },
  { path: '/forbidden', element: <ForbiddenPage /> }, { path: '*', element: <NotFoundPage /> },
]);

function RoleHomeRedirect() { const { user } = useAuth(); return <Navigate to={user ? homeForRole(user.role) : '/login'} replace />; }
