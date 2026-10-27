export function leaveBackTarget({ confirmation, details, calendar, busy }: {
  confirmation: boolean; details: boolean; calendar: boolean; busy: boolean;
}) {
  if (details) return 'details';
  if (busy) return 'blocked';
  if (confirmation) return 'confirmation';
  if (calendar) return 'home';
  return 'parent';
}
