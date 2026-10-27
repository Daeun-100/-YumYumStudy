# Supabase Discord log monitor

## Live status

Activated on 2026-10-27 after the user registered the dedicated management token.
The deployed authenticated dry run successfully queried 08:48–08:58 UTC
(17:48–17:58 KST): API Gateway 121 requests, Edge Functions 6 requests,
no server errors or threshold findings, and no Discord message sent.
`cron.job` was then verified with `active = true` and the requested UTC schedule.
The first scheduled run after activation is 2026-10-27 19:10 KST.

## Requested behavior

- Asia/Seoul: daily at 15:10, 16:10, 17:10, 19:10, 20:10, 21:10, 22:10.
- Each run inspects exactly the preceding ten minutes (e.g. 15:00–15:10).
- Cron timezone on this project is GMT: `10 6,7,8,10,11,12,13 * * *`.
- No notification for normal results, no recovery or periodic success messages.
- A log query failure sends a distinct monitoring-failure notification.
- Empty windows are recorded as `no_observations`, not evidence of health; they send no notification.
- Seven samples/day cover 70 minutes, not the entire day. Late-arriving logs and events outside the sampled windows may be missed. No automatic block or continuous monitoring.

## Initial detection policy

Evaluate API Gateway (`edge_logs`) and Edge Functions (`function_edge_logs`) separately, without adding overlapping event counts together. Exclude OPTIONS and the monitor endpoint itself.

Send one combined Discord message per execution when any source meets either traffic condition or the error condition:

| Condition | Threshold |
| --- | --- |
| Peak recorded requests in one calendar second | >= 1,000 |
| Peak recorded requests in one calendar minute | >= 3,000 |
| HTTP 5xx during the sampled ten minutes | >= 20 AND >= 5% of valid HTTP responses |

Thresholds are operational starting values, not Supabase quota limits. This monitor does not measure egress, billing, individual users/IPs, Postgres errors, or Realtime message volume. Adjust thresholds in `supabase/functions/log-monitor/policy.ts` and redeploy.

## Deployment and secrets

The function performs its own random bearer-secret authentication before querying logs. `verify_jwt = false` is intentional; public clients cannot invoke it without the scheduler secret. No new public tables or RPCs are introduced.

Edge Function secrets:

- `DISCORD_WEBHOOK_URL`: Discord channel webhook.
- `MONITOR_CRON_SECRET`: random 256-bit scheduler secret; matching Vault secret is `log_monitor_cron_secret`.
- `MONITOR_MANAGEMENT_TOKEN`: a dedicated PAT scoped to this project with only `analytics_logs_read`. Create at https://supabase.com/dashboard/account/tokens and store directly in Edge Functions Secrets. Never put an account-wide CLI token here. Token expiry/revocation stops log access and should cause a monitoring-failure alert while the function itself remains available.

The Discord URL and scheduler secret are also in the git-ignored local `.env`; neither is prefixed `EXPO_PUBLIC_`. Never expose them in app code, artifacts, logs, or commits.

Deployment order: secrets, function, then apply `20261027075804_scheduled_discord_log_monitor.sql` to register the paused schedule. Set the dedicated token and verify an authenticated deployed dry run before enabling the job with `cron.alter_job`. The migration references this project's URL; change it when reusing elsewhere.

For a dry run, POST `{ "dry_run": true }` to `/functions/v1/log-monitor` with `Authorization: Bearer <MONITOR_CRON_SECRET>`. Optional `end` selects a recent UTC window end, within the last 24 hours. Dry runs never send Discord messages, including on errors. Normal invocations accept only the seven scheduled slots, with up to five minutes of dispatch delay.

Check execution summaries in Edge Function logs. Check cron in `cron.job` / `cron.job_run_details`, and HTTP delivery in `net._http_response`. Cron success means the HTTP request was queued, not that the function succeeded. There is no automatic retry; repeated manually authorized invocations can repeat an alert. If Supabase/the scheduler or Discord is unavailable, delivery cannot be guaranteed.

Pause: `select cron.alter_job(jobid, active := false) from cron.job where jobname = 'discord-log-monitor';`

## Budget

30-day month: 210 scheduled function invocations, 0.042% of the organization's 500,000 Free invocation allowance. 31 days: 217. Tests and manual dry runs add invocations. Each run makes one bounded aggregate logs API query; scan bytes vary with log traffic and are not guaranteed by the invocation count. Database cron run history and function logs also consume resources.

## Validation

`node --experimental-strip-types --test tests/log-monitor.test.mjs` checks all daily minute slots, UTC/KST windows, detection boundaries, authentication, quiet normal/empty/dry-run behavior, source separation, and monitoring-failure alerts with mocked HTTP. Also run the app lint and typecheck.

## Source-control PR verification (2026-10-27)

Read-only checks during PR preparation confirmed log-monitor version 3 is ACTIVE
and discord-log-monitor is active with schedule `10 6,7,8,10,11,12,13 * * *`.
The PR records already-running server code and configuration; no function deploy,
schedule change, migration replay, live webhook call or mobile publication was
performed while preparing it. Do not replay the scheduling migration on the
active project: its initial-deployment behavior deliberately pauses the job.
