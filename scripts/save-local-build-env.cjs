// Only the opt-in local cache needs a snapshot of EAS-resolved public values.
// Never persist the full build environment or print credential values.
if (process.env.YUMYUM_FAST_BOOTSTRAP === '1') {
  const fs = require('node:fs');
  const values = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('EXPO_PUBLIC_')));
  fs.writeFileSync('.fast-build-env.json', JSON.stringify(values), { mode: 0o600 });
}
