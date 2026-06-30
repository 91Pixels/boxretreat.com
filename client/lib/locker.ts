export function daysBetween(startDate: string, endDate: string): number {
  const s = new Date(startDate + 'T12:00:00');
  const e = new Date(endDate + 'T12:00:00');
  return Math.round((e.getTime() - s.getTime()) / 86_400_000);
}
