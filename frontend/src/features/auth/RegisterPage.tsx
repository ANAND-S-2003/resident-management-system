import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Alert, Button, Card, FormField, Input } from '@/components/ui';
import { branding } from '@/config/branding';
import { ApiError } from '@/lib/api/client';
import type { RegisterRequest } from '@/lib/api/types';
import { registerSchema } from '@/lib/validation/schemas';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useAuth } from './AuthProvider';

type FormValues = RegisterRequest & { confirmPassword: string };
export function RegisterPage() {
  useDocumentTitle('Register');
  const { register: createAccount, login } = useAuth(); const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false); const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(registerSchema) });
  const submit = handleSubmit(async (formValues) => {
    setFormError(null);
    const values: RegisterRequest = { fullName: formValues.fullName, email: formValues.email, flatNumber: formValues.flatNumber, password: formValues.password };
    try { await createAccount(values); await login({ email: values.email, password: values.password }); navigate('/resident', { replace: true }); }
    catch (cause) {
      if (cause instanceof ApiError && cause.code === 'DUPLICATE_RESOURCE') setError('email', { message: 'An account with this email already exists.' });
      else if (cause instanceof ApiError && cause.code === 'VALIDATION_ERROR' && cause.details.length) {
        let mapped = false;
        for (const detail of cause.details) if (['fullName','email','flatNumber','password'].includes(detail.field)) { setError(detail.field as keyof FormValues, { message: detail.message }); mapped = true; }
        if (!mapped) setFormError(cause.message);
      } else if (cause instanceof ApiError && cause.code === 'TOO_MANY_REQUESTS') setFormError(`Too many attempts. Try again in ${cause.retryAfterSeconds ?? 0} seconds.`);
      else setFormError(cause instanceof ApiError ? cause.message : 'Registration failed. Please try again.');
    }
  });
  return <main className="auth-page"><div className="auth-brand">{branding.logoSrc ? <img src={branding.logoSrc} alt={branding.appName} /> : <span className="wordmark"><strong>{branding.shortName}</strong><span>{branding.appName}</span></span>}<p>{branding.tagline}</p></div><Card className="auth-card"><h1>Create your resident account</h1>{formError && <Alert tone="error">{formError}</Alert>}<form onSubmit={submit} noValidate>
    <FormField id="fullName" label="Full name" required error={errors.fullName?.message}><Input id="fullName" autoComplete="name" {...register('fullName')} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? 'fullName-error' : undefined} /></FormField>
    <FormField id="email" label="Email" required error={errors.email?.message}><Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" {...register('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} /></FormField>
    <FormField id="flatNumber" label="Flat number" required error={errors.flatNumber?.message}><Input id="flatNumber" autoComplete="address-line2" {...register('flatNumber')} aria-invalid={!!errors.flatNumber} aria-describedby={errors.flatNumber ? 'flatNumber-error' : undefined} /></FormField>
    <FormField id="password" label="Password" required error={errors.password?.message}><div className="password-control"><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password')} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? 'Hide' : 'Show'}</button></div></FormField>
    <FormField id="confirmPassword" label="Confirm password" required error={errors.confirmPassword?.message}><Input id="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('confirmPassword')} aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined} /></FormField>
    <Button type="submit" loading={isSubmitting} className="auth-submit">Create account</Button>
  </form><p className="auth-footer">Already registered? <Link to="/login">Sign in</Link></p></Card></main>;
}
