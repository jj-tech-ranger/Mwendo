import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPlateNumber(plate: string): string {
  if (!plate) return '';
  const cleaned = plate.replace(/\s+/g, '').toUpperCase();
  if (cleaned.length === 7) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  return cleaned;
}

export function formatSpeed(speed: number): string {
  return `${Math.round(speed)} KM/H`;
}

export function toStandardDate(input?: string | Date | { toDate?: () => Date; seconds?: number } | number | null): Date {
  if (!input) return new Date();
  if (typeof input === 'object' && input !== null && 'toDate' in input && typeof input.toDate === 'function') {
    return input.toDate();
  }
  if (typeof input === 'object' && input !== null && 'seconds' in input && typeof input.seconds === 'number') {
    return new Date(input.seconds * 1000);
  }
  if (input instanceof Date) {
    return input;
  }
  const d = new Date(input as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatTimestamp(input?: string | Date | { toDate?: () => Date; seconds?: number } | number | null): string {
  if (!input) return '';
  const date = toStandardDate(input);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(input?: string | Date | { toDate?: () => Date; seconds?: number } | number | null): string {
  if (!input) return '';
  const date = toStandardDate(input);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
