const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const path = require('node:path');
const { build } = require('esbuild');
const { configureStore } = require('@reduxjs/toolkit');

let slice;
let calls;
let respond;
before(async () => {
  const output = await build({
    entryPoints: [path.resolve(__dirname, '../src/redux/slices/submissionSlice.js')],
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'test-api', setup(bundler) {
      bundler.onResolve({ filter: /utils\/axiosInstance$/ }, () => ({ path: 'test-api', namespace: 'test-api' }));
      bundler.onLoad({ filter: /.*/, namespace: 'test-api' }, () => ({ contents: 'export default { get: (...args) => globalThis.__submissionTestAPI(...args) };', loader: 'js' }));
    } }],
  });
  slice = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
});

function storeFor(userId = 'alpha') {
  calls = [];
  respond = async () => ({ data: { submissions: [] } });
  globalThis.__submissionTestAPI = (url, options) => { calls.push({ url, options }); return respond(url, options); };
  return configureStore({ reducer: {
    app: (state = { user: userId ? { _id: userId } : null }, action) => {
      if (action.type === 'user/setUser') return { user: action.payload };
      if (action.type === 'user/logout') return { user: null };
      return state;
    },
    submissions: slice.default,
  } });
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('empty success completes once and remains cached across repeated mounts', async () => {
  const store = storeFor();
  await store.dispatch(slice.fetchSubmissions({ page: 1, limit: 7 }));
  for (let index = 0; index < 20; index++) await store.dispatch(slice.fetchSubmissions({ page: 1, limit: 7 }));
  assert.equal(calls.length, 1);
  assert.equal(store.getState().submissions.status, 'succeeded');
  assert.equal(store.getState().submissions.loading, false);
  assert.deepEqual(store.getState().submissions.submissions, []);
  assert.deepEqual(calls[0].options.params, { page: 1, limit: 7 });
});

test('simultaneous dispatches and explicit refreshes deduplicate in-flight requests', async () => {
  const store = storeFor(); const pending = deferred(); respond = () => pending.promise;
  const first = store.dispatch(slice.fetchSubmissions());
  const duplicate = await store.dispatch(slice.fetchSubmissions());
  const forced = await store.dispatch(slice.fetchSubmissions({ force: true }));
  assert.equal(duplicate.meta.condition, true);
  assert.equal(forced.meta.condition, true);
  assert.equal(calls.length, 1);
  assert.equal(store.getState().submissions.loading, true);
  pending.resolve({ data: { submissions: [] } }); await first;
  assert.equal(store.getState().submissions.status, 'succeeded');
});

test('failed request stops until an explicit retry', async () => {
  const store = storeFor();
  respond = async () => { throw { response: { data: { detail: 'Permission denied.' } } }; };
  await store.dispatch(slice.fetchSubmissions());
  for (let index = 0; index < 10; index++) await store.dispatch(slice.fetchSubmissions());
  assert.equal(calls.length, 1);
  assert.equal(store.getState().submissions.status, 'failed');
  assert.equal(store.getState().submissions.error, 'Permission denied.');
  respond = async () => ({ data: { submissions: [{ _id: 'retried' }] } });
  await store.dispatch(slice.fetchSubmissions({ force: true }));
  assert.equal(calls.length, 2);
  assert.equal(store.getState().submissions.status, 'succeeded');
  assert.equal(store.getState().submissions.error, null);
});

test('same-account profile refresh preserves the completed empty result', async () => {
  const store = storeFor(); await store.dispatch(slice.fetchSubmissions());
  store.dispatch({ type: 'user/setUser', payload: { _id: 'alpha', profile: { name: 'Updated' } } });
  await store.dispatch(slice.fetchSubmissions());
  assert.equal(calls.length, 1);
  assert.equal(store.getState().submissions.status, 'succeeded');
});

test('switching accounts clears the previous history and ignores its late response', async () => {
  const store = storeFor(); const old = deferred(); respond = () => old.promise;
  const oldRequest = store.dispatch(slice.fetchSubmissions());
  store.dispatch({ type: 'user/setUser', payload: { _id: 'beta' } });
  assert.equal(store.getState().submissions.status, 'idle');
  respond = async () => ({ data: { submissions: [{ _id: 'beta-history' }] } });
  await store.dispatch(slice.fetchSubmissions());
  old.resolve({ data: { submissions: [{ _id: 'alpha-history' }] } }); await oldRequest;
  assert.equal(calls.length, 2);
  assert.equal(store.getState().submissions.userId, 'beta');
  assert.deepEqual(store.getState().submissions.submissions, [{ _id: 'beta-history' }]);
});

test('late responses after logout do not repopulate history', async () => {
  const store = storeFor(); const pending = deferred(); respond = () => pending.promise;
  const request = store.dispatch(slice.fetchSubmissions());
  store.dispatch({ type: 'user/logout' });
  pending.resolve({ data: { submissions: [{ _id: 'old' }] } }); await request;
  assert.equal(store.getState().submissions.status, 'idle');
  assert.equal(store.getState().submissions.userId, null);
  assert.deepEqual(store.getState().submissions.submissions, []);
});

test('explicit refresh after a new submission replaces cached history', async () => {
  const store = storeFor(); await store.dispatch(slice.fetchSubmissions());
  respond = async () => ({ data: { submissions: [{ _id: 'new' }] } });
  await store.dispatch(slice.fetchSubmissions({ force: true }));
  assert.equal(calls.length, 2);
  assert.equal(store.getState().submissions.selectedSubmission._id, 'new');
});

test('signed-out users never issue a history request', async () => {
  const store = storeFor(null); const result = await store.dispatch(slice.fetchSubmissions());
  assert.equal(result.meta.condition, true); assert.equal(calls.length, 0);
});
