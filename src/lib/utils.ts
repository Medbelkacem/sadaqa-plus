import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL-safe slug that keeps Arabic letters intact. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Progress as an integer percentage. Returns null when there is no target to
 * measure against, so the UI can say "no target" instead of inventing 0%.
 */
export function percentage(current: number, target: number | null | undefined) {
  if (!target || target <= 0) return null;
  return clamp(Math.round((current / target) * 100), 0, 100);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Masks a phone number for public display: 0555 12 34 56 -> 0555 •• •• 56 */
export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '••••';
  return `${digits.slice(0, 4)} •• •• ${digits.slice(-2)}`;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return '••••';
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}
