-- ===========================================================================
-- Geiger Events — event config metadata merge
--
-- Self-contained and idempotent. Depends on public.flow_events (events.sql).
-- Each editor section stores its config under a distinct top-level key in
-- flow_events.metadata (tickets, questions, regSettings, team, languages,
-- pageDesign, recurring, seo, …). This RPC shallow-merges a patch so saving one
-- section never clobbers another's keys.
-- ===========================================================================

create or replace function public.flow_event_merge_meta(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb;
begin
  update public.flow_events
    set metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    where id = p_id and deleted_at is null
    returning metadata into v_meta;
  return v_meta;
end;
$$;

grant execute on function public.flow_event_merge_meta(uuid, jsonb)
  to anon, authenticated;
