export const initialWorkflowState = { scope: null, data: null, loading: true, error: null, drafts: {} };

export function workflowReducer(state, action) {
  if (action.type === 'scope') return state.scope === action.scope ? state : { ...initialWorkflowState, scope: action.scope };
  if (action.scope !== state.scope) return state;
  switch (action.type) {
    case 'loading': return { ...state, loading: true };
    case 'loaded': return { ...state, loading: false, error: null, data: action.data };
    case 'failed': return { ...state, loading: false, error: action.error };
    case 'draft': return { ...state, drafts: { ...state.drafts, [action.key]: action.value } };
    default: return state;
  }
}

export function commandFor(previous, action, payload, revision, uuid = () => crypto.randomUUID()) {
  const signature = JSON.stringify({ action, ...payload });
  if (previous?.signature === signature) return previous;
  const commandId = uuid();
  return { signature, commandId, body: { action, expectedRevision: revision, commandId, ...payload } };
}

export function createWorkflowClient(fetcher = fetch, basePath = process.env.NEXT_PUBLIC_BASE_PATH || '') {
  const root = (eventId, portal) => portal
    ? `${basePath}/api/portal/operations/${encodeURIComponent(eventId)}`
    : `${basePath}/api/events/${encodeURIComponent(eventId)}/operations/workflow`;
  async function request(url, body, signal, validateMutation = true) {
    const mutation = body !== undefined;
    try {
      const response = await fetcher(url, { method: mutation ? 'POST' : 'GET',
        credentials: 'same-origin', cache: 'no-store', signal,
        ...(mutation ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const supplied = data?.error;
        return { error: { ...(typeof supplied === 'object' ? supplied : {}), status: response.status,
          code: supplied?.code || (response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : response.status === 409 ? 'revision_conflict' : 'request_failed'),
          message: supplied?.message || (typeof supplied === 'string' ? supplied : `Request failed (${response.status}).`),
          uncertain: mutation && response.status >= 500 } };
      }
      if (!data || (mutation && validateMutation && (!Number.isInteger(data.revision) || !Object.hasOwn(data, 'result')))) {
        return { error: { code: 'invalid_response', message: 'The server returned an unreadable response. Reload to check the outcome.', uncertain: mutation } };
      }
      return { data };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return { error: { code: 'network_error', message: mutation ? 'The connection failed. The command may have been saved; retry the same command to check.' : 'Could not connect. Try loading again.', uncertain: mutation } };
    }
  }
  return { load: (eventId, portal = false, signal) => request(root(eventId, portal), undefined, signal),
    acceptedItems: (eventId, signal) => request(`${root(eventId, false)}?source=accepted`, undefined, signal),
    history: (eventId, signal) => request(`${root(eventId, false)}?source=history`, undefined, signal),
    mutate: (eventId, body, portal = false, signal) => request(root(eventId, portal), body, signal),
    accept: (body, signal) => request(`${basePath}/api/portal/operations/invitations/accept`, body, signal),
    auth: (path, body, signal) => request(`${basePath}/api/portal/${path}`, body, signal, false) };
}

export function dateLabel(value, timezone = 'UTC') {
  if (!value) return 'Unscheduled';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value)); }
  catch { return value; }
}

export function effectiveResourceId(activity, activities) {
  const byId = new Map(activities.map((item) => [item.id, item]));
  const seen = new Set();
  let current = activity;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.resourceId) return current.resourceId;
    current = byId.get(current.parentId);
  }
  return null;
}

export function formValue(value, type) {
  if (type === 'date') return value ? new Date(value).toISOString().slice(0, 16) : '';
  return value ?? '';
}

export function draftFromForm(fields, draft, controls) {
  if (!controls) return draft;
  return { ...draft, ...Object.fromEntries(fields.flatMap((field) => {
    if (field.type === 'roles') return [[field.key, controls.getAll(field.key)]];
    return controls.has(field.key) ? [[field.key, controls.get(field.key)]] : [];
  })) };
}

export function formPayload(fields, draft, controls) {
  const entered = draftFromForm(fields, draft, controls);
  const payload = {};
  for (const field of fields) {
    const value = entered[field.key] ?? field.default ?? '';
    if (value === '' && field.optional) { if (field.nullable) payload[field.key] = null; continue; }
    payload[field.key] = field.type === 'number' ? Number(value) : field.type === 'date' ? new Date(`${value}Z`).toISOString() : value;
  }
  return payload;
}

export function parseWorkflowImport(text, format, kind) {
  let items;
  if (format === 'json') {
    items = JSON.parse(text);
  } else {
    const rows = [];
    let row = [], field = '', quoted = false;
    const source = text.replace(/^\uFEFF/, '');
    for (let index = 0; index < source.length; index++) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') { field += '"'; index++; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) { row.push(field); field = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && source[index + 1] === '\n') index++;
        row.push(field); if (row.some((value) => value.trim())) rows.push(row); row = []; field = '';
      } else field += char;
    }
    if (quoted) throw new Error('A quoted CSV value is not closed.');
    row.push(field); if (row.some((value) => value.trim())) rows.push(row);
    const headers = (rows.shift() || []).map((value) => value.trim());
    if (!headers.length || new Set(headers).size !== headers.length) throw new Error('CSV needs unique column headers.');
    const allowed = kind === 'people' ? ['id', 'name', 'email', 'contactId', 'roles'] : ['id', 'title', 'kind', 'resourceId', 'parentId', 'startsAt', 'endsAt', 'timezone', 'capacity'];
    if (headers.some((header) => !allowed.includes(header))) throw new Error(`Allowed columns: ${allowed.join(', ')}.`);
    items = rows.map((values) => {
      if (values.length !== headers.length) throw new Error('Every CSV row must have the same number of columns as its header.');
      return Object.fromEntries(headers.flatMap((header, index) => {
        const value = values[index].trim();
        if (!value && header !== 'email') return [];
        return [[header, header === 'roles' ? value.split('|').filter(Boolean) : header === 'capacity' ? Number(value) : value]];
      }));
    });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 100 || items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('Supply an array of 1–100 entries per import.');
  return items;
}

export function parseAcceptedItemIds(text) {
  const ids = text.trim().split(/[\s,]+/).filter(Boolean);
  if (ids.length < 1 || ids.length > 100) throw new Error('Select 1–100 accepted items per import.');
  if (ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new Error('Every accepted item ID must be a UUID.');
  if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length) throw new Error('Remove duplicate accepted item IDs.');
  return ids;
}
