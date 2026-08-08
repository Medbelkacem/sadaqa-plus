import { describe, expect, it } from 'vitest';

import { algerianPhoneSchema, passwordSchema, registerSchema } from '@/validations/auth';
import { optionalUrlSchema, sanitizedText } from '@/validations/common';
import { createRequestSchema } from '@/validations/request';

describe('password policy', () => {
  it('requires length over composition tricks', () => {
    expect(passwordSchema.safeParse('Abc1!').success).toBe(false);
    expect(passwordSchema.safeParse('une-phrase-de-passe-solide').success).toBe(true);
  });

  it('rejects well-known passwords', () => {
    for (const banned of ['password123', 'motdepasse', 'azertyuiop', 'sadaqa123']) {
      expect(passwordSchema.safeParse(banned).success).toBe(false);
    }
  });

  it('rejects repetitive passwords that pass on length alone', () => {
    expect(passwordSchema.safeParse('aaaaaaaaaaaaaaaa').success).toBe(false);
  });
});

describe('Algerian phone numbers', () => {
  it('accepts national and international forms', () => {
    for (const value of ['0555123456', '05 55 12 34 56', '+213555123456', '00213555123456']) {
      expect(algerianPhoneSchema.safeParse(value).success).toBe(true);
    }
  });

  it('rejects foreign or malformed numbers', () => {
    for (const value of ['+33612345678', '123', '05551234', 'not-a-number']) {
      expect(algerianPhoneSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('sanitizedText', () => {
  const schema = sanitizedText(5, 100, 'Le champ');

  it('strips zero-width and bidi characters used to hide content', () => {
    const result = schema.parse('Besoin\u200B urgent\u202E d\u2060eau');
    expect(result).not.toMatch(/[\u200B\u202E\u2060]/);
    expect(result).toContain('Besoin');
  });

  it('strips control characters but keeps newlines', () => {
    // \u0007 (BEL) is a control character that must be removed;
    // the newline between the two lines must survive.
    const result = schema.parse('Ligne un\nLigne\u0007 deux');
    expect(result).toContain('\n');
    expect(result).not.toContain('\u0007');
    expect(result).toBe('Ligne un\nLigne deux');
  });

  it('enforces the length bounds after sanitising', () => {
    // Six zero-width characters sanitise away to nothing.
    expect(schema.safeParse('\u200B'.repeat(6)).success).toBe(false);
    expect(schema.safeParse('Assez long').success).toBe(true);
  });
});

describe('optionalUrlSchema', () => {
  it('accepts http(s) and empty', () => {
    expect(optionalUrlSchema.safeParse('https://example.dz').success).toBe(true);
    expect(optionalUrlSchema.safeParse('').success).toBe(true);
    expect(optionalUrlSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects javascript: and data: URLs', () => {
    // Rendering either of these as an anchor href is an XSS vector.
    expect(optionalUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(optionalUrlSchema.safeParse('data:text/html,<script>alert(1)</script>').success).toBe(
      false,
    );
  });
});

describe('request creation contract', () => {
  const base = {
    title: 'Eau potable pour un service hospitalier',
    description:
      'Le service de pédiatrie manque d’eau potable depuis plusieurs jours. Nous avons besoin de bouteilles pour les patients.',
    categoryId: '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607',
    wilayaId: 5,
  };

  it('accepts a minimal valid request', () => {
    expect(createRequestSchema.safeParse(base).success).toBe(true);
  });

  it('requires a phone number when PHONE is the chosen contact method', () => {
    const result = createRequestSchema.safeParse({ ...base, contactMethod: 'PHONE' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('contactPhone'))).toBe(true);
    }
  });

  it('refuses EXACT location precision without coordinates', () => {
    // Publishing an exact pin with no point is meaningless, and exact
    // precision is exactly what the privacy rules gate.
    const result = createRequestSchema.safeParse({ ...base, locationPrecision: 'EXACT' });
    expect(result.success).toBe(false);
  });

  it('defaults contact details to private', () => {
    const result = createRequestSchema.parse(base);
    expect(result.contactPublic).toBe(false);
    expect(result.contactMethod).toBe('PLATFORM');
    expect(result.locationPrecision).toBe('COMMUNE_ONLY');
  });

  it('rejects an out-of-range wilaya', () => {
    expect(createRequestSchema.safeParse({ ...base, wilayaId: 99 }).success).toBe(false);
    expect(createRequestSchema.safeParse({ ...base, wilayaId: 0 }).success).toBe(false);
  });
});

describe('registration contract', () => {
  const valid = {
    firstName: 'Amina',
    lastName: 'Belkacem',
    email: 'Amina.Test@Example.DZ',
    password: 'une-phrase-de-passe-solide',
    confirmPassword: 'une-phrase-de-passe-solide',
    acceptTerms: true as const,
  };

  it('normalises the email to lowercase', () => {
    const result = registerSchema.parse(valid);
    expect(result.email).toBe('amina.test@example.dz');
  });

  it('rejects mismatched confirmation', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'autre-chose-encore' });
    expect(result.success).toBe(false);
  });

  it('requires the terms checkbox', () => {
    const result = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  it('rejects names containing markup', () => {
    expect(registerSchema.safeParse({ ...valid, firstName: '<script>' }).success).toBe(false);
  });
});
