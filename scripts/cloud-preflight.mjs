import { validateSupabaseConfig } from '../src/lib/config.ts';
validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
if (!process.env.EXPO_TOKEN) throw new Error('Configure GitHub Actions secret EXPO_TOKEN');
if (!['test','production'].includes(process.env.EXPO_PUBLIC_APP_VARIANT)) throw new Error('Explicit app variant required');
console.log('Cloud environment configured.');
