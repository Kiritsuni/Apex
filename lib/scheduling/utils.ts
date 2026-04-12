import { format, startOfISOWeek, endOfISOWeek } from 'date-fns';

export const TIMEZONE = 'Europe/Madrid';

export function toMadrid(date: Date): Date {
  // Convert a UTC date to Madrid local time representation
  const offset = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE })).getTime() - date.getTime();
  return new Date(date.getTime() + offset);
}

export function fromMadrid(date: Date): Date {
  // Convert a Madrid local time to UTC
  const offset = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE })).getTime() - date.getTime();
  return new Date(date.getTime() - offset);
}

export function getWeekRange(date: Date) {
  const weekStart = startOfISOWeek(date);
  const weekEnd = endOfISOWeek(date);
  return { weekStart, weekEnd };
}

export function formatDateForDB(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getAvailableStartTime(dayOfWeek: number): string {
  if (dayOfWeek === 0 || dayOfWeek === 6) return '10:00';
  if (dayOfWeek === 1 || dayOfWeek === 2) return '15:00';
  return '14:30';
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
