// Run with --env-file=.env. Public Supabase config only; never handles service keys.
import { spawnSync } from 'node:child_process';
import { validateSupabaseConfig } from '../src/lib/config.ts';
validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const cli=process.env.EAS_CLI_BIN || 'eas';
for (const environment of ['preview','production']) {
  for (const name of ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    const result=spawnSync(cli,['env:create',environment,'--name',name,'--value',process.env[name],'--visibility','plaintext','--type','string','--scope','project','--force','--non-interactive'],{encoding:'utf8',timeout:60000});
    if(result.status!==0) throw new Error(`EAS ${environment} ${name} setup failed (output hidden to avoid logging config).`);
    console.log(`Configured ${environment}: ${name}`);
  }
}
