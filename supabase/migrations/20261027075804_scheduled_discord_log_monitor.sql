-- Prerequisite: provision log_monitor_cron_secret in Vault and the matching
-- MONITOR_CRON_SECRET / MONITOR_MANAGEMENT_TOKEN / DISCORD_WEBHOOK_URL Edge secrets.
-- The job starts paused. Deploy and dry-run verify before explicitly activating.
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'log_monitor_cron_secret') then
    raise exception 'Provision log_monitor_cron_secret in Vault before scheduling log-monitor';
  end if;
end;
$$;

-- pg_cron uses GMT in this project. KST 15/16/17/19/20/21/22:10
-- corresponds to UTC 06/07/08/10/11/12/13:10. One run per selected hour.
select cron.schedule(
  'discord-log-monitor',
  '10 6,7,8,10,11,12,13 * * *',
  $job$
  select net.http_post(
    url := 'https://hxwwhgxxvyzqqnxlgqde.supabase.co/functions/v1/log-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'log_monitor_cron_secret'
      )
    ),
    body := jsonb_build_object('end', date_trunc('minute', now())),
    timeout_milliseconds := 60000
  );
  $job$
);

select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'discord-log-monitor';
