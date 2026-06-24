// Portuguese Utilities for Jesuino's Barber Shop

export const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const WEEKDAYS_PT = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
];

export const WEEKDAYS_SHORT_PT = [
  "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"
];

// Formats "2026-06-06" -> "06 de Junho"
export function formatDateLong(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} de ${MONTHS_PT[month - 1]}`;
}

// Formats "2026-06-06" -> "06/06 (Sábado)"
export function formatDateWithDayName(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = WEEKDAYS_PT[d.getDay()];
  
  const paddedDay = day.toString().padStart(2, '0');
  const paddedMonth = month.toString().padStart(2, '0');
  
  return `${paddedDay}/${paddedMonth} (${dayName})`;
}

// Formats ISO string or Date to WhatsApp-friendly local string e.g. "06/06/2026"
export function formatPortugueseDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const paddedDay = day.toString().padStart(2, '0');
  const paddedMonth = month.toString().padStart(2, '0');
  return `${paddedDay}/${paddedMonth}/${year}`;
}

// Check if a slot is in the past
export function isSlotAndDateInPast(dateStr: string, hourMinStr: string): boolean {
  const now = new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, min] = hourMinStr.split(':').map(Number);
  
  const bookingDateTime = new Date(year, month - 1, day, hour, min, 0);
  return bookingDateTime.getTime() < now.getTime();
}
