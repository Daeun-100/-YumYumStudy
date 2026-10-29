// Isolated DB harness. Cron is a scheduling-table substitute, not a real scheduler.
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export async function createTestDatabase(modulePath) {
 const { PGlite } = await import(pathToFileURL(modulePath).href);
 const db = new PGlite();
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema extensions; create schema realtime; create schema cron;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to service_role;
 create table realtime.messages(extension text);
 alter table realtime.messages enable row level security;
 create function realtime.topic() returns text language sql as $$ select ''::text $$;
 create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ select $$;
 create publication supabase_realtime;
 create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,active boolean default true,username text default 'postgres');
 create table cron.job_run_details(jobid bigint,status text,start_time timestamptz,end_time timestamptz,return_message text);
 create function cron.schedule(text,text,text) returns bigint language plpgsql as $$ declare n bigint; begin insert into cron.job(jobname,schedule,command) values($1,$2,$3) on conflict(jobname) do update set schedule=$2,command=$3 returning jobid into n; return n; end $$;
 create function cron.unschedule(bigint) returns boolean language plpgsql as $$ begin delete from cron.job where jobid=$1; return found; end $$;
 `);
 const files = (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort((a,b)=> {
  const x=BigInt(a.split('_')[0]),y=BigInt(b.split('_')[0]);return x<y?-1:x>y?1:a.localeCompare(b);
 });
 for(const file of files) {
  if(file.includes('scheduled_discord_log_monitor')) continue;
  const sql=(await readFile(`supabase/migrations/${file}`,'utf8')).replace(/create extension if not exists pg_cron;/gi,'');
  try {await db.exec(sql);} catch(e) {await db.close();throw new Error(`Migration ${file}: ${e.message}`);}
 }
 return db;
}
