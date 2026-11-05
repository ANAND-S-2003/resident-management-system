import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { AppShell } from './layout';
import { PublicOnly, RequireAuth, RequireRole } from './guards';
import { homeForRole } from './guards';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLES } from '@/lib/constants';
import { ComingSoon, ForbiddenPage, NotFoundPage, RootErrorFallback } from './pages';
import { RootLayout } from './RootLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';

function Placeholder({ title }: { title: string }) { return <ComingSoon title={title} />; }
const lazyPage = (title: string) => lazy(async () => ({ default: (() => <Placeholder title={title} />) as ComponentType }));
const ResidentHome = lazy(() => import('@/features/dashboard/ResidentDashboard').then((module) => ({ default: module.ResidentDashboard })));
const ResidentRequests = lazy(() => import('@/features/requests/RequestListPage').then((module) => ({ default: module.RequestListPage })));
const NewRequest = lazy(() => import('@/features/requests/RequestFormPage').then((module) => ({ default: module.RequestFormPage })));
const RequestDetails = lazy(() => import('@/features/requests/RequestDetailPage').then((module) => ({ default: module.RequestDetailPage })));
const ResidentNotifications = lazy(() => import('@/features/notifications/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const Account = lazy(() => import('@/features/account/AccountPage').then((module) => ({ default: module.AccountPage })));
const AdminHome = lazy(() => import('@/features/dashboard/StaffDashboard').then((module) => ({ default: module.StaffDashboard })));
const AdminRequests = lazy(() => import('@/features/requests/StaffRequestListPage').then((module) => ({ default: module.StaffRequestListPage })));
const AdminRequestDetails = lazy(() => import('@/features/requests/StaffRequestDetailPage').then((module) => ({ default: module.StaffRequestDetailPage })));
const Residents = lazyPage('Residents'); const Services = lazyPage('Services'); const Messages = lazyPage('Messages'); const Admins = lazyPage('Admins'); const Contact = lazyPage('Contact');
const fallback = <div className="route-loading" role="status"><Spinner />Loading page...</div>;

export const appRoutes: RouteObject[] = [{
  element: <RootLayout />,
  errorElement: <RootErrorFallback />,
  children: [
    { index: true, element: <LandingRedirect /> },
    { element: <PublicOnly />, children: [
      { path: '/login', element: <LoginPage /> }, { path: '/register', element: <RegisterPage /> },
    ] },
    { path: '/contact', element: <Suspense fallback={fallback}><Contact /></Suspense> },
    { element: <RequireAuth />, children: [{ element: <AppShell />, children: [
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
  ],
}];

export const createAppRouter = () => createBrowserRouter(appRoutes);

function LandingRedirect() { const { user } = useAuth(); return <Navigate to={user ? homeForRole(user.role) : '/login'} replace />; }
