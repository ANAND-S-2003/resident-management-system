import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Badge, Button } from '@/components/ui';
import { branding } from '@/config/branding';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Role } from '@/lib/api/types';
import { ROLES } from '@/lib/constants';
import { useUnreadCount } from '@/features/requests/hooks';
import { NotificationsLinkContent } from '@/features/notifications/NotificationsLinkContent';

interface NavItem { label: string; to: string; roles: Role[] }
const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/resident', roles: [ROLES[0]] },
  { label: 'My requests', to: '/resident/requests', roles: [ROLES[0]] },
  { label: 'New request', to: '/resident/requests/new', roles: [ROLES[0]] },
  { label: 'Notifications', to: '/resident/notifications', roles: [ROLES[0]] },
  { label: 'Dashboard', to: '/admin', roles: [ROLES[1], ROLES[2]] },
  { label: 'Requests', to: '/admin/requests', roles: [ROLES[1], ROLES[2]] },
  { label: 'Residents', to: '/admin/residents', roles: [ROLES[1], ROLES[2]] },
  { label: 'Services', to: '/admin/services', roles: [ROLES[1], ROLES[2]] },
  { label: 'Messages', to: '/admin/messages', roles: [ROLES[1], ROLES[2]] },
  { label: 'Admins', to: '/admin/admins', roles: [ROLES[2]] },
  { label: 'Account', to: '/account', roles: [...ROLES] },
];

function Wordmark() { return <span className="wordmark">{branding.logoSrc ? <img src={branding.logoSrc} alt={branding.appName} /> : <><strong>{branding.shortName}</strong><span>{branding.appName}</span></>}</span>; }
function NavigationLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const unread = useUnreadCount(item.to === '/resident/notifications');
  const className = ({ isActive }: { isActive: boolean }) => isActive ? 'nav-link active' : 'nav-link';
  if (item.to === '/resident/notifications') {
    const count = unread.data?.count ?? 0;
    return <NavLink to={item.to} end className={className} onClick={onNavigate}><NotificationsLinkContent count={count}>{count > 0 && <span aria-hidden="true"> <Badge tone="info">{count}</Badge></span>}</NotificationsLinkContent></NavLink>;
  }
  return <NavLink to={item.to} end={item.to === '/admin' || item.to === '/resident'} className={className} onClick={onNavigate}>{item.label}</NavLink>;
}
export function AppShell() {
  const { user, logout } = useAuth(); const [drawerOpen, setDrawerOpen] = useState(false); const location = useLocation();
  const openerRef = useRef<HTMLElement | null>(null);
  const previousPathRef = useRef(location.pathname);
  const items = navItems.filter((item) => user && item.roles.includes(user.role));
  const setBackgroundState = useCallback((hidden: boolean) => {
    document.querySelectorAll<HTMLElement>('.skip-link, .topbar, .sidebar, .main-content').forEach((element) => {
      if (hidden) { element.setAttribute('inert', ''); element.setAttribute('aria-hidden', 'true'); }
      else { element.removeAttribute('inert'); element.removeAttribute('aria-hidden'); }
    });
  }, []);
  const closeDrawer = useCallback((navigated = false) => {
    setBackgroundState(false);
    setDrawerOpen(false);
    requestAnimationFrame(() => {
      const target = navigated
        ? document.querySelector<HTMLElement>('.main-content h1, .main-content [role="heading"]')
        : openerRef.current;
      if (target?.isConnected) {
        if (navigated) target.setAttribute('tabindex', '-1');
        target.focus();
      }
    });
  }, [setBackgroundState]);
  useLayoutEffect(() => {
    if (drawerOpen) {
      setBackgroundState(true);
      document.querySelector<HTMLElement>('.mobile-drawer button[aria-label="Close navigation menu"]')?.focus();
    } else setBackgroundState(false);
  }, [drawerOpen, setBackgroundState]);
  useLayoutEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname;
      if (drawerOpen) closeDrawer(true);
    }
  }, [location.pathname, drawerOpen, closeDrawer]);
  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = document.querySelector<HTMLElement>('.mobile-drawer');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
      if (event.key === 'Tab' && drawer) {
        const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a,button')).filter((element) => !element.hasAttribute('disabled'));
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <button type="button" className="menu-button" aria-label="Open navigation menu" aria-expanded={drawerOpen} aria-controls="mobile-navigation" onClick={(event) => { openerRef.current = event.currentTarget; setDrawerOpen(true); }}><span aria-hidden="true">☰</span></button>
      <Link to={user?.role === ROLES[0] ? '/resident' : '/admin'}><Wordmark /></Link>
      <div className="topbar-user"><span>{user?.fullName}<small>{user?.role}</small></span><Button variant="ghost" size="sm" onClick={() => logout()}>Sign out</Button></div>
    </header>
    <aside className="sidebar"><nav aria-label="Main navigation">{items.map((item) => <NavigationLink key={item.to} item={item} />)}</nav></aside>
    <div className="drawer-backdrop" role="presentation" hidden={!drawerOpen} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
      <aside id="mobile-navigation" className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile navigation">
        <div className="drawer-heading"><Wordmark /><button type="button" aria-label="Close navigation menu" onClick={() => closeDrawer()}><span aria-hidden="true">×</span></button></div>
        <nav aria-label="Mobile navigation menu">{items.map((item) => <NavigationLink key={item.to} item={item} onNavigate={() => closeDrawer(true)} />)}</nav>
      </aside>
    </div>
    <main id="main-content" className="main-content"><Outlet /></main>
  </div>;
}
