import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiRequest, setUnauthorizedHandler } from '@/lib/api/client';
import { setTokenProvider } from '@/lib/api/session-token';
import { queryKeys } from '@/lib/query-keys';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, Role, UserSummary } from '@/lib/api/types';
import { clearStoredSession, readSession, writeSession, type AuthSession } from './session';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';
interface AuthContextValue {
  user: UserSummary | null; status: AuthStatus;
  login: (credentials: LoginRequest) => Promise<UserSummary>;
  register: (data: RegisterRequest) => Promise<RegisterResponse>;
  logout: (expired?: boolean) => void;
  isRole: (...roles: Role[]) => boolean;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const initialRestoreHandled = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [storedSession] = useState(readSession);
  const storedSessionValid = !!storedSession && Date.parse(storedSession.expiresAt) > Date.now();
  const loggingOut = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const restoredUser = useQuery({
    queryKey: queryKeys.currentUser,
    // Do not consume the query signal here: React.StrictMode's development
    // remount would abort and restart this one-time startup validation.
    queryFn: () => apiRequest<UserSummary>('/auth/me', { token: storedSession?.token ?? null }),
    // Validation runs only while the live provider state is loading. Once it
    // rejects, anonymous state disables this query even if the startup snapshot
    // still contains the old token.
    enabled: status === 'loading' && storedSessionValid,
    retry: false,
  });

  const logout = useCallback((expired = false) => {
    if (loggingOut.current || (!session && !readSession())) return;
    loggingOut.current = true;
    initialRestoreHandled.current = true;
    clearStoredSession();
    setTokenProvider(() => null);
    setSession(null);
    setStatus('anonymous');
    void queryClient.cancelQueries();
    queryClient.clear();
    if (expired) setNotice('Your session has expired. Please sign in again.');
    if (location.pathname !== '/login') navigate('/login', { replace: true, state: { message: expired ? 'Your session has expired. Please sign in again.' : undefined } });
  }, [location.pathname, navigate, queryClient, session]);

  useEffect(() => {
    setUnauthorizedHandler(() => logout(true));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    // Restore only the session captured at mount. A successful login later in
    // this provider's lifetime must not be cleared because that snapshot was empty.
    if (initialRestoreHandled.current) return;
    if (!storedSessionValid) {
      if (storedSession) clearStoredSession();
      setSession(null); setStatus('anonymous');
      initialRestoreHandled.current = true;
    } else if (restoredUser.data && storedSession) {
      const next = { ...storedSession, user: restoredUser.data };
      // Publish the validated token before enabling authenticated child queries.
      setTokenProvider(() => next.token);
      writeSession(next); setSession(next); setStatus('authenticated');
      initialRestoreHandled.current = true;
    } else if (restoredUser.isError) {
      const invalidSession = restoredUser.error instanceof Error && 'status' in restoredUser.error && restoredUser.error.status === 401;
      if (invalidSession) { initialRestoreHandled.current = true; logout(true); }
      else setStatus('error');
    }
  }, [restoredUser.data, restoredUser.error, restoredUser.isError, storedSession, storedSessionValid, logout]);

  useEffect(() => {
    if (!session) return;
    let timer: number;
    const checkExpiry = () => {
      const remaining = Date.parse(session.expiresAt) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) logout(true);
      else timer = window.setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647));
    };
    const initialRemaining = Date.parse(session.expiresAt) - Date.now();
    timer = window.setTimeout(checkExpiry, Number.isFinite(initialRemaining) ? Math.min(Math.max(0, initialRemaining), 2_147_483_647) : 0);
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'rms.session.v1' && event.newValue === null) {
        setSession(null); setStatus('anonymous'); void queryClient.cancelQueries(); queryClient.clear();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient]);

  useEffect(() => {
    const token = session?.token ?? null;
    setTokenProvider(() => token);
  }, [session]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: credentials, token: null });
    const next: AuthSession = { token: result.accessToken, expiresAt: result.expiresAt, user: { ...result.user, active: true } };
    // Publish the token before protected route queries mount after navigation.
    setTokenProvider(() => next.token);
    loggingOut.current = false;
    writeSession(next); setSession(next); setStatus('authenticated'); setNotice(null);
    queryClient.setQueryData(queryKeys.currentUser, next.user);
    return next.user;
  }, [queryClient]);

  const register = useCallback((data: RegisterRequest) => apiRequest<RegisterResponse>('/auth/register', { method: 'POST', body: data, token: null }), []);
  const user = session?.user ?? null;
  const value = useMemo<AuthContextValue>(() => ({ user, status, login, register, logout, isRole: (...roles) => !!user && roles.includes(user.role) }), [user, status, login, register, logout]);

  if (status === 'loading') return <div className="full-page-loading" role="status">Loading your session...</div>;
  if (status === 'error') return <main className="standalone-page"><h1>Unable to validate your session</h1><p>Check your connection and try again. Your saved session has been kept.</p><button type="button" className="button button-primary" onClick={() => void restoredUser.refetch()}>Retry</button><button type="button" className="button button-secondary" onClick={() => logout(false)}>Continue signed out</button></main>;
  return <AuthContext.Provider value={value}><>{notice && <div className="session-notice" role="status">{notice}</div>}{children}</></AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** Live auth state for enabling queries that require an authenticated session. */
export function useIsAuthenticated(): boolean {
  return useAuth().status === 'authenticated';
}
