create table if not exists public.sapa_pic_activity (
 id uuid primary key, session_id uuid not null, pic text not null,
 action text not null, feature text not null,
 units integer not null default 0 check(units between 0 and 50000),
 active_seconds integer not null default 0 check(active_seconds between 0 and 60),
 created_at timestamptz not null default now()
);
alter table public.sapa_pic_activity enable row level security;
revoke all on public.sapa_pic_activity from public, anon, authenticated;
grant select,insert on public.sapa_pic_activity to service_role;
create index if not exists sapa_pic_activity_time on public.sapa_pic_activity(created_at);
create index if not exists sapa_pic_activity_pic_time on public.sapa_pic_activity(pic,created_at);
create or replace function public.sapa_activity_summary(p_from timestamptz,p_to timestamptz,p_pic text default null,p_feature text default null)
returns jsonb language sql stable security invoker set search_path=public as $$
with filtered as materialized (
 select * from public.sapa_pic_activity where created_at>=p_from and created_at<p_to and (p_pic is null or pic=p_pic) and (p_feature is null or feature=p_feature)
), per_pic as (
 select p.name as pic,count(distinct f.session_id) as sessions,count(distinct (f.created_at at time zone 'Asia/Jakarta')::date) as days,
 count(f.id) filter(where f.action not in ('heartbeat','session_start')) as activities,
 count(f.id) filter(where f.action='page_view') as visits,
 count(f.id) filter(where f.action='tarik_upload') as uploads,
 count(f.id) filter(where f.action='tarik_update') as updates,
 count(f.id) filter(where f.action in ('report_copy','report_export')) as reports,
 coalesce(sum(f.active_seconds),0) as active_seconds,max(f.created_at) as last_seen
 from public.sapa_pic_profiles p left join filtered f on f.pic=p.name where p_pic is null or p.name=p_pic group by p.name
), daily as (
 select to_char(created_at at time zone 'Asia/Jakarta','YYYY-MM-DD') as date,count(*) filter(where action not in ('heartbeat','session_start')) as activities,count(distinct pic) as pics from filtered group by 1 order by 1
), features as (
 select feature,count(*) filter(where action not in ('heartbeat','session_start')) as activities from filtered group by feature order by activities desc
), actions as (
 select action,count(*) as count,coalesce(sum(units),0) as units from filtered where action<>'heartbeat' group by action order by count desc
), hours as (
 select extract(hour from created_at at time zone 'Asia/Jakarta')::int as hour,count(*) as count from filtered where action not in ('heartbeat','session_start') group by 1 order by 1
)
select jsonb_build_object(
 'totals',(select jsonb_build_object('activePics',count(distinct pic),'sessions',count(distinct (pic,session_id)),'activities',count(*) filter(where action not in ('heartbeat','session_start')),'activeSeconds',coalesce(sum(active_seconds),0)) from filtered),
 'pics',coalesce((select jsonb_agg(to_jsonb(x) order by x.activities desc,x.pic) from per_pic x),'[]'),
 'daily',coalesce((select jsonb_agg(to_jsonb(x)) from daily x),'[]'),
 'features',coalesce((select jsonb_agg(to_jsonb(x)) from features x),'[]'),
 'actions',coalesce((select jsonb_agg(to_jsonb(x)) from actions x),'[]'),
 'hours',coalesce((select jsonb_agg(to_jsonb(x)) from hours x),'[]'),
 'recent',coalesce((select jsonb_agg(to_jsonb(x)) from (select pic,action,feature,units,created_at from filtered where action<>'heartbeat' order by created_at desc limit 50) x),'[]'),
 'roster',(select coalesce(jsonb_agg(name order by name),'[]') from public.sapa_pic_profiles),
 'trackingSince',(select min(created_at) from public.sapa_pic_activity)
);
$$;
revoke all on function public.sapa_activity_summary(timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.sapa_activity_summary(timestamptz,timestamptz,text,text) to service_role;
