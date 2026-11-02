import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui';
import { branding } from '@/config/branding';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Role } from '@/lib/api/types';
import { ROLES } from '@/lib/constants';

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
export function AppShell() {
  const { user, logout } = useAuth(); const [drawerOpen, setDrawerOpen] = useState(false); const location = useLocation();
  const items = navItems.filter((item) => user && item.roles.includes(user.role));
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.skip-link, .topbar, .sidebar, .main-content').forEach((element) => {
      if (drawerOpen) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
  }, [drawerOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const drawer = document.querySelector<HTMLElement>('.mobile-drawer');
    drawer?.querySelector<HTMLElement>('a,button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
      if (event.key === 'Tab' && drawer) {
        const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a,button')).filter((element) => !element.hasAttribute('disabled'));
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey); return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [drawerOpen]);
  return <div className="app-shell"><a className="skip-link" href="#main-content" aria-hidden={drawerOpen}>Skip to main content</a><header className="topbar" aria-hidden={drawerOpen}><button type="button" className="menu-button" aria-label="☰ Open navigation menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>☰</button><Link to={user?.role === ROLES[0] ? '/resident' : '/admin'}><Wordmark /></Link><div className="topbar-user"><span>{user?.fullName}<small>{user?.role}</small></span><Button variant="ghost" size="sm" onClick={() => logout()}>Sign out</Button></div></header><aside className="sidebar" aria-hidden={drawerOpen}><nav aria-label="Main navigation">{items.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/admin' || item.to === '/resident'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>{item.label}</NavLink>)}</nav></aside>{drawerOpen && <div className="drawer-backdrop"><aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile navigation"><div className="drawer-heading"><Wordmark /><button type="button" aria-label="× Close navigation menu" onClick={() => setDrawerOpen(false)}>×</button></div><nav aria-label="Mobile navigation menu">{items.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/admin' || item.to === '/resident'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>{item.label}</NavLink>)}</nav></aside></div>}<main id="main-content" className="main-content" aria-hidden={drawerOpen}><Outlet /></main></div>;
}
