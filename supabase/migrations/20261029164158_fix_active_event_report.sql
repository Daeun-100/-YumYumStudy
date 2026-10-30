begin;

create or replace function private.event_report(p_job uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from private.events e),'[]'::jsonb),
 'backgrounds',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from private.event_backgrounds b),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(to_jsonb(j)||jsonb_build_object(
   -- Active replacements have no start Cron: the scheduling transaction already applies them.
   'overdue',j.state='scheduled' and j.run_at<now()
    and not (j.kind='set_backgrounds' and j.replaces is not null and j.cron_ids[1] is null)
    and not exists(select 1 from private.event_runs where job_id=j.id and phase in ('grant','start')),
   'cron',coalesce((select jsonb_agg(jsonb_build_object('id',c.jobid,'schedule',c.schedule,'active',c.active,'username',c.username)) from cron.job c where c.jobid=any(j.cron_ids)),'[]'::jsonb),
   'cronHistory',coalesce((select jsonb_agg(to_jsonb(h)) from (select jobid,status,start_time,end_time,return_message from cron.job_run_details where jobid=any(j.cron_ids) order by start_time desc limit 10) h),'[]'::jsonb),
   'runs',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('deliveries',coalesce((select jsonb_agg(to_jsonb(d)) from private.event_deliveries d where d.run_id=r.id),'[]'::jsonb)) order by r.started_at) from private.event_runs r where r.job_id=j.id),'[]'::jsonb)
  ) order by j.created_at desc) from private.event_jobs j where p_job is null or j.id=p_job),'[]'::jsonb))
$$;

commit;
