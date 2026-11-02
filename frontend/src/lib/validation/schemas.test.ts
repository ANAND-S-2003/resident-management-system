import { describe, expect, it } from 'vitest';
import { emailSchema, flatNumberSchema, fullNameSchema, PASSWORD_MESSAGE, passwordSchema, registerSchema } from './schemas';

describe('shared validation schemas', () => {
  it('trims strings and counts code points for field limits', () => {
    expect(fullNameSchema.parse('  😀😀  ')).toBe('😀😀');
    expect(flatNumberSchema.parse(' A-1 ')).toBe('A-1');
    expect(fullNameSchema.safeParse('😀'.repeat(121)).success).toBe(false);
  });
  it('enforces password characters, Unicode bytes and byte maximum', () => {
    for (const value of ['Short1', 'Password', '12345678']) expect(passwordSchema.safeParse(value).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(70) + '1A').success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(71) + '1A').success).toBe(false);
    expect(passwordSchema.safeParse('😀'.repeat(18) + 'A1').success).toBe(false);
    expect(passwordSchema.safeParse('Password1').error?.issues[0]?.message).toBe(PASSWORD_MESSAGE);
  });
  it('validates email and password confirmation', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse(`${'a'.repeat(243)}@example.test`).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: 'Resident', email: 'r@example.test', flatNumber: '1', password: 'Password1', confirmPassword: 'Different1' }).success).toBe(false);
  });
});
