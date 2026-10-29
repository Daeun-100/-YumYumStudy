// Shared synchronous gate: an update must not race a new timer/mutation.
const blockers = new Set<symbol>();
let reloading = false;
export function blockUpdateReload() {
  const token = Symbol();
  blockers.add(token);
  return () => { blockers.delete(token); };
}
export function updateReloadBlocked() { return reloading || blockers.size > 0; }
export function isUpdateReloading() { return reloading; }
export function beginUpdateReload() {
  if (updateReloadBlocked()) return false;
  reloading = true;
  return true;
}
export function cancelUpdateReload() { reloading = false; }
