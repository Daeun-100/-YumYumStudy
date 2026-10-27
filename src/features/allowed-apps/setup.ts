type Permissions = { usageAccess: boolean; notificationAccess: boolean; restrictedSettingsReviewed: boolean };

export function allowedAppsSetup(status: Permissions | null) {
  const usage = status?.usageAccess === true;
  const notifications = status?.notificationAccess === true;
  // Acknowledging the sideload guide never substitutes for actual permission checks.
  const reviewed = usage || status?.restrictedSettingsReviewed === true;
  return { reviewed, usage, notifications, ready: usage && notifications,
    step: !usage ? 'usage' : !notifications ? 'notifications' : 'ready' } as const;
}
