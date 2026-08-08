import { describe, expect, it } from 'vitest';

import { clamp, formatBytes, maskEmail, maskPhone, percentage, slugify } from '@/lib/utils';

describe('percentage', () => {
  it('computes a real ratio', () => {
    expect(percentage(50, 200)).toBe(25);
    expect(percentage(200, 200)).toBe(100);
  });

  it('returns null when there is no target, rather than inventing 0%', () => {
    // A campaign with no numeric target must render "no target", not a bar.
    expect(percentage(10, null)).toBeNull();
    expect(percentage(10, undefined)).toBeNull();
    expect(percentage(10, 0)).toBeNull();
  });

  it('never exceeds 100 or drops below 0', () => {
    expect(percentage(500, 100)).toBe(100);
    expect(percentage(-5, 100)).toBe(0);
  });
});

describe('slugify', () => {
  it('produces URL-safe slugs from French text', () => {
    expect(slugify('Eau potable pour l’hôpital')).toBe('eau-potable-pour-lhopital');
  });

  it('keeps Arabic letters intact', () => {
    const slug = slugify('ماء صالح للشرب');
    expect(slug).toContain('ماء');
    expect(slug).not.toContain(' ');
  });

  it('trims separators and caps length', () => {
    expect(slugify('  ---Besoin---  ')).toBe('besoin');
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(72);
  });
});

describe('masking helpers', () => {
  it('masks a phone number but keeps it recognisable to its owner', () => {
    const masked = maskPhone('0555123456');
    expect(masked).toContain('0555');
    expect(masked).toContain('56');
    expect(masked).not.toContain('1234');
  });

  it('masks an email local part while keeping the domain', () => {
    const masked = maskEmail('amina.belkacem@example.dz');
    expect(masked.endsWith('@example.dz')).toBe(true);
    expect(masked).not.toContain('belkacem');
  });
});

describe('misc', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
