import type { GuardApp } from './native';

export function sortAllowedApps(apps: GuardApp[]): GuardApp[] {
  return [...apps].sort((a, b) => a.label.localeCompare(b.label, 'ko') || a.packageName.localeCompare(b.packageName));
}

export function allowedAppSections(apps: GuardApp[], allowed: string[], search: string) {
  const selected = new Set(allowed);
  const query = search.trim().toLowerCase();
  const filtered = sortAllowedApps(apps.filter(app => `${app.label} ${app.packageName}`.toLowerCase().includes(query)));
  return [
    { key: 'allowed', title: '허용한 앱', data: filtered.filter(app => selected.has(app.packageName)) },
    { key: 'other', title: '다른 앱', data: filtered.filter(app => !selected.has(app.packageName)) },
  ];
}
