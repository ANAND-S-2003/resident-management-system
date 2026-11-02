import { z } from 'zod';

export const PASSWORD_MESSAGE = 'Password must be at least 8 characters, no more than 72 UTF-8 bytes, and include at least one letter and one digit.';
export const codePointLength = (value: string): number => [...value].length;
export const trimmedString = () => z.string().transform((value) => value.trim());
export const emailSchema = trimmedString().refine((value) => codePointLength(value) <= 254, 'Email must be at most 254 characters.').pipe(z.string().email('Enter a valid email address.'));
export const fullNameSchema = trimmedString().refine((value) => codePointLength(value) >= 2 && codePointLength(value) <= 120, 'Name must be between 2 and 120 characters.');
export const flatNumberSchema = trimmedString().refine((value) => codePointLength(value) >= 1 && codePointLength(value) <= 30, 'Flat number must be between 1 and 30 characters.');
export const passwordSchema = z.string().superRefine((value, context) => {
  const hasLetter = /\p{L}/u.test(value);
  const hasDigit = /\p{Nd}/u.test(value);
  if ([...value].length < 8 || new TextEncoder().encode(value).length > 72 || !hasLetter || !hasDigit) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: PASSWORD_MESSAGE });
  }
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Password is required.') });
export const registerSchema = z.object({ fullName: fullNameSchema, email: emailSchema, flatNumber: flatNumberSchema, password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
