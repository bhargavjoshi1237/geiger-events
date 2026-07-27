-- ===========================================================================
-- Geiger Events — organiser broadcast (targeted messaging to buyers)
--
-- One SECURITY DEFINER helper so an organiser can start a support thread with,
-- and post a first message to, many buyers at once from the dashboard inbox. The
-- audience is resolved to a list of emails client-side (lib/audience/resolve.js);
-- this function looks each buyer up in the service-role-only portal_members,
-- creates a thread, and inserts the organiser's message — the same cross-identity
-- posture as z_chat.sql's create_qa_thread.
--
-- Runs AFTER portal_support.sql (portal_threads / portal_thread_messages) and
-- zz_project_access.sql (can_access_project) — hence the zzz_ prefix. Idempotent.
-- ===========================================================================

create schema if not exists events;

-- Start a thread + first organiser message for each matched buyer. Returns how
-- many messages were delivered. Guarded by can_access_project against the caller.
create or replace function events.broadcast_message(
  p_project_id uuid,
  p_emails     text[],
  p_subject    text,
  p_body       text,
  p_event_id   uuid default null
)
returns integer
language plpgsql
security definer
set search_path = events, public
as $$
declare
  v_email  text;
  v_member uuid;
  v_name   text;
  v_thread uuid;
  v_count  integer := 0;
begin
  if p_project_id is null or not events.can_access_project(p_project_id) then
    return 0;                                   -- caller isn't an org member
  end if;
  if coalesce(trim(p_body), '') = '' then
    return 0;
  end if;

  foreach v_email in array coalesce(p_emails, '{}'::text[]) loop
    if coalesce(trim(v_email), '') = '' then
      continue;
    end if;
    select id, name into v_member, v_name
      from events.portal_members
      where lower(email) = lower(v_email)
      limit 1;
    if v_member is null then
      continue;                                 -- no portal account for this email
    end if;

    insert into events.portal_threads
      (member_id, project_id, event_id, subject, status,
       member_email, member_name, last_message_at, member_unread, organiser_unread)
    values
      (v_member, p_project_id, p_event_id,
       coalesce(nullif(trim(p_subject), ''), 'Message from the organiser'),
       'open', lower(v_email), coalesce(v_name, ''), now(), true, false)
    returning id into v_thread;

    insert into events.portal_thread_messages (thread_id, sender, body)
    values (v_thread, 'organiser', left(p_body, 4000));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function events.broadcast_message(uuid, text[], text, text, uuid)
  to authenticated, service_role;
