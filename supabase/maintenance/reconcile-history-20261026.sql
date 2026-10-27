-- One-time history reconciliation for hxwwhgxxvyzqqnxlgqde, verified 2026-10-26.
-- Does not rerun application migrations or modify study records.
-- Original migration SQL remains in supabase/migrations; statements are intentionally NULL.
begin;
DO $verify$ DECLARE verified boolean; BEGIN
WITH expected(name,hash) AS (VALUES ('study_date','381f07db2b1a4cb2f99a7692783a83af'),
('_session_json','effda3d286e30e144a692cc7f847c8f3'),
('_day_record','7f9fa698032b2d2e6f413ceee11de6ad'),
('ensure_profile','cade0ee4358ac3652df97ae2c70d003f'),
('start_study','9c7e5618a54db7c662f47f793cf7abdc'),
('stop_study','94bd29012a449361ba1cf9c4bf05d089'),
('get_today','3352621b7b064dc4748fb6b898ae60eb'),
('get_room','2effedac00720e7c5b716a0ef1df9b3a'),
('get_goals','f4f0c2e38f69ddc5659e76a5651358c7'),
('get_history','844f634cebc2e1451093768ddd047356'),
('save_goals','1963c7d048b4dec9bf721c9cd3edcc6e'),
('get_goal_settings','1aef9bc556c01dd20852a6af5d08411d'),
('_goal_completed_at','e6a83930fab0600ecbf760060417de7b'),
('_leave_earned_at','cb59b533ce1d6ddab8f8328f113182f6'),
('_leave_state','3fc9961ac3faa58bd61eff93fa073cd1'),
('schedule_leave','566a53f94d9512ef9e94984d57504a6d'),
('cancel_leave','7716cdd5a0131551623791ecf17693ea'),
('_reconcile_leave_status','8734d3144a765afe166f89a61ed371b7'),
('get_leave_status','0e9355b4485e4e532ac5582fd4597543'),
('mutate_leave','890ba241f6ac8968e47ccd4ff4e1eb8b')) SELECT count(*)=20 AND bool_and(p.oid IS NOT NULL AND md5(lower(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s', '', 'g')))=e.hash) INTO verified FROM expected e LEFT JOIN pg_proc p ON p.proname=e.name AND p.pronamespace='public'::regnamespace;
IF verified IS DISTINCT FROM true THEN RAISE EXCEPTION 'Function definitions differ: abort history repair'; END IF;
END $verify$;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
 version text primary key,
 statements text[],
 name text
);
revoke all on supabase_migrations.schema_migrations from public, anon, authenticated;
insert into supabase_migrations.schema_migrations(version,name) values
('010','app_releases'),
('100','study_core'),
('110','goals_attendance'),
('111','empty_day_running_time'),
('200','leave_foundation'),
('210','leave_states'),
('220','leave_attendance_policy'),
('230','leave_requests')
on conflict(version) do nothing;
commit;
select version,name from supabase_migrations.schema_migrations order by version;
