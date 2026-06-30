export function displayUrlForEvent(
  eventId: string,
  options?: { kiosk?: boolean },
): string {
  const params = new URLSearchParams({ eventId });
  if (options?.kiosk) params.set('kiosk', '1');
  return `/display?${params.toString()}`;
}

export function adminUrlForEvent(eventId: string): string {
  return `/admin?eventId=${encodeURIComponent(eventId)}`;
}
