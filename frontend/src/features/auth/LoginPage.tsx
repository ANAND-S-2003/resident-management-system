import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Alert, Button, Card, FormField, Input } from '@/components/ui';
import { branding } from '@/config/branding';
import { ApiError } from '@/lib/api/client';
import type { LoginRequest } from '@/lib/api/types';
import { loginSchema } from '@/lib/validation/schemas';
import { useAuth } from './AuthProvider';
import { canAccessPath, homeForRole } from '@/app/guards';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

interface LocationState { from?: { pathname?: string }; message?: string }
export function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth(); const location = useLocation(); const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState<string | null>(null);
  const state = location.state as LocationState | null;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginRequest>({ resolver: zodResolver(loginSchema) });
  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const current = await login(values);
      const role = current.role;
      const target = state?.from?.pathname;
      navigate(role && target && canAccessPath(role, target) ? target : homeForRole(role ?? 'USER'), { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'INVALID_CREDENTIALS') setError('Invalid email or password');
      else if (cause instanceof ApiError && cause.code === 'TOO_MANY_REQUESTS') setError(`Too many attempts. Try again in ${cause.retryAfterSeconds ?? 0} seconds.`);
      else setError(cause instanceof ApiError ? cause.message : 'Sign in failed. Please try again.');
    }
  });
  return <main className="auth-page"><div className="auth-brand">{branding.logoSrc ? <img src={branding.logoSrc} alt={branding.appName} /> : <span className="wordmark"><strong>{branding.shortName}</strong><span>{branding.appName}</span></span>}<p>{branding.tagline}</p></div><Card className="auth-card"><h1>Sign in</h1>{(state?.message || error) && <Alert tone="error">{error ?? state?.message}</Alert>}<form onSubmit={submit} noValidate>
    <FormField id="email" label="Email" required error={errors.email?.message}><Input id="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" {...register('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} /></FormField>
    <FormField id="password" label="Password" required error={errors.password?.message}><div className="password-control"><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...register('password')} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} /><button type="button" className="password-toggle" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? 'Hide' : 'Show'}</button></div></FormField>
    <Button type="submit" loading={isSubmitting} className="auth-submit">Sign in</Button>
  </form><p className="auth-footer">New to the community? <Link to="/register">Create an account</Link></p><p className="auth-footer"><Link to="/contact">Contact us</Link></p></Card></main>;
}
