import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowClient, commandFor, initialWorkflowState, workflowReducer, parseWorkflowImport, parseAcceptedItemIds, effectiveResourceId, formPayload } from './workflow_client.js';

test('uncertain retries preserve command ID and exact original revision', () => {
  const first = commandFor(null, 'savePerson', { name: 'Mira', email: '' }, 4, () => 'command-1');
  const retry = commandFor(first, 'savePerson', { name: 'Mira', email: '' }, 9, () => 'command-2');
  assert.deepEqual(retry, first);
  assert.notEqual(commandFor(first, 'savePerson', { name: 'New name', email: '' }, 9, () => 'command-2').commandId, first.commandId);
});

test('conflict refresh preserves unsaved draft while replacing revision', () => {
  let state = workflowReducer(initialWorkflowState, { type: 'scope', scope: 'event-a' });
  state = workflowReducer(state, { type: 'loaded', scope: 'event-a', data: { revision: 1 } });
  state = workflowReducer(state, { type: 'draft', scope: 'event-a', key: 'person', value: { name: 'Unsaved' } });
  state = workflowReducer(state, { type: 'failed', scope: 'event-a', error: { code: 'revision_conflict' } });
  state = workflowReducer(state, { type: 'loaded', scope: 'event-a', data: { revision: 2 } });
  assert.equal(state.drafts.person.name, 'Unsaved');
  assert.equal(state.data.revision, 2);
});

test('late loads from another event cannot replace current event or leak drafts', () => {
  let state = workflowReducer(initialWorkflowState, { type: 'scope', scope: 'event-a' });
  state = workflowReducer(state, { type: 'draft', scope: 'event-a', key: 'person', value: { name: 'Private' } });
  state = workflowReducer(state, { type: 'scope', scope: 'event-b' });
  const before = state;
  state = workflowReducer(state, { type: 'loaded', scope: 'event-a', data: { people: [{ name: 'Private' }] } });
  assert.deepEqual(state, before);
  assert.deepEqual(state.drafts, {});
});

test('transport respects base path, status, credentials and abort', async () => {
  let observed;
  const client = createWorkflowClient(async (url, options) => { observed = { url, options }; return new Response(JSON.stringify({ error: { code: 'forbidden', message: 'Denied' } }), { status: 403 }); }, '/suite');
  const result = await client.load('event a');
  assert.equal(observed.url, '/suite/api/events/event%20a/operations/workflow');
  assert.equal(observed.options.credentials, 'same-origin');
  assert.equal(result.error.code, 'forbidden');
  assert.equal(result.error.status, 403);
  const aborted = createWorkflowClient(async () => { throw new DOMException('Canceled', 'AbortError'); });
  await assert.rejects(aborted.load('a'), { name: 'AbortError' });
});

test('network and invalid mutation response are uncertain, never successful', async () => {
  const network = createWorkflowClient(async () => { throw new Error('offline'); });
  assert.equal((await network.mutate('a', {})).error.uncertain, true);
  const malformed = createWorkflowClient(async () => new Response('not JSON', { status: 200 }));
  assert.equal((await malformed.mutate('a', {})).error.uncertain, true);
});

test('bulk import parses quoted CSV, roles and numeric capacity without silent extra columns', () => {
  assert.deepEqual(parseWorkflowImport('name,email,roles\n"Mira, Rao",mira@example.test,presenter|staff', 'csv', 'people'), [{ name: 'Mira, Rao', email: 'mira@example.test', roles: ['presenter', 'staff'] }]);
  assert.deepEqual(parseWorkflowImport('title,kind,timezone,capacity\nSession,workshop,UTC,12', 'csv', 'activities'), [{ title: 'Session', kind: 'workshop', timezone: 'UTC', capacity: 12 }]);
  assert.throws(() => parseWorkflowImport('name,email\nMira,mira@example.test,extra', 'csv', 'people'), /columns/);
  assert.throws(() => parseWorkflowImport(JSON.stringify(Array.from({ length: 101 }, () => ({ name: 'Person' }))), 'json', 'people'), /100/);
});

test('datetime form submission reads actual controls even if change state is stale', () => {
  const fields = [{ key: 'startsAt', type: 'date', optional: true, nullable: true }, { key: 'endsAt', type: 'date', optional: true, nullable: true }];
  const controls = new FormData();
  controls.set('startsAt', '2026-10-02T09:00'); controls.set('endsAt', '2026-10-02T10:00');
  assert.deepEqual(formPayload(fields, {}, controls), { startsAt: '2026-10-02T09:00:00.000Z', endsAt: '2026-10-02T10:00:00.000Z' });
  controls.set('startsAt', ''); controls.set('endsAt', '');
  assert.deepEqual(formPayload(fields, { startsAt: '2026-10-02T09:00', endsAt: '2026-10-02T10:00' }, controls), { startsAt: null, endsAt: null });
});

test('named form submission keeps multi-role controls and numeric values typed', () => {
  const controls = new FormData();
  controls.append('roles', 'presenter'); controls.append('roles', 'staff'); controls.set('capacity', '12');
  assert.deepEqual(formPayload([{ key: 'roles', type: 'roles', default: [] }, { key: 'capacity', type: 'number' }], {}, controls), { roles: ['presenter', 'staff'], capacity: 12 });
});

test('accepted conference import accepts only bounded unique IDs from pasted selections', () => {
  const first = '11111111-1111-4111-8111-111111111111';
  const second = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual(parseAcceptedItemIds(` ${first},\n${second} `), [first, second]);
  assert.throws(() => parseAcceptedItemIds(`${first}\n${first}`), /duplicate/i);
  assert.throws(() => parseAcceptedItemIds(''), /1–100/);
  assert.throws(() => parseAcceptedItemIds('Conference title,not-a-uuid'), /UUID/);
  assert.throws(() => parseAcceptedItemIds(Array.from({ length: 101 }, (_, i) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`).join('\n')), /1–100/);
});

test('accepted source picker uses staff workflow source endpoint with scoped credentials and abort', async () => {
  const controller = new AbortController();
  let observed;
  const client = createWorkflowClient(async (url, options) => { observed = { url, options }; return new Response(JSON.stringify({ items: [], truncated: false })); }, '/suite');
  assert.deepEqual((await client.acceptedItems('event a', controller.signal)).data, { items: [], truncated: false });
  assert.equal(observed.url, '/suite/api/events/event%20a/operations/workflow?source=accepted');
  assert.equal(observed.options.method, 'GET');
  assert.equal(observed.options.credentials, 'same-origin');
  assert.equal(observed.options.signal, controller.signal);
});

test('working schedule resolves inherited rooms and stops missing or cyclic parent chains', () => {
  const parent = { id: 'parent', resourceId: 'hall' };
  const child = { id: 'child', parentId: 'parent', resourceId: null };
  const grandchild = { id: 'grandchild', parentId: 'child' };
  assert.equal(effectiveResourceId(grandchild, [parent, child, grandchild]), 'hall');
  assert.equal(effectiveResourceId({ ...child, resourceId: 'equipment' }, [parent, child]), 'equipment');
  assert.equal(effectiveResourceId(child, [child]), null);
  assert.equal(effectiveResourceId(child, [child, { ...parent, parentId: 'child', resourceId: null }]), null);
});

test('history viewer reads the separate staff source and propagates archive permission denial', async () => {
  let url;
  const client = createWorkflowClient(async (requested) => { url = requested; return new Response(JSON.stringify({ error: { code: 'forbidden', message: 'History permission is required.' } }), { status: 403 }); }, '/suite');
  const response = await client.history('event-id');
  assert.equal(url, '/suite/api/events/event-id/operations/workflow?source=history');
  assert.equal(response.error.status, 403);
  assert.equal(response.error.message, 'History permission is required.');
});
