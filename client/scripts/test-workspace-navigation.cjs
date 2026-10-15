const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const path = require('node:path');
const { build } = require('esbuild');
let nav;
before(async () => {
  const result = await build({ entryPoints: [path.resolve(__dirname, '../src/utils/workspaceNavigation.js')], bundle: true, platform: 'node', format: 'esm', write: false });
  nav = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
});
const user = (...permissions) => ({ _id: 'custom-account', role: 'faculty', permissions });

test('permission-free account has no empty groups or unavailable mobile destinations', () => {
  const result = nav.workspaceNavigation(user());
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.main.map(x => x.label), ['Overview']);
  assert.deepEqual(result.mobile.map(x => x.label), ['Home', 'Account']);
});
test('account type never grants administrative navigation', () => {
  assert.deepEqual(nav.workspaceNavigation({ ...user(), role: 'admin' }).groups, []);
});
test('direct access-management grant reveals only its authorized administration entry', () => {
  const result = nav.workspaceNavigation(user('access.manage'));
  assert.deepEqual(result.groups.map(x => [x.label, x.items.map(y => y.label)]), [['Administration', ['Access management']]]);
});
test('assigned approver gets Approvals but cannot open the faculty approval tab', () => {
  const account = user('users.approve_assigned');
  assert.deepEqual(nav.workspaceNavigation(account).groups[0].items.map(x => x.label), ['Approvals']);
  assert.equal(nav.allowedDestination(account, '/approvals/students'), true);
  assert.equal(nav.allowedDestination(account, '/approvals/faculty'), false);
});
test('create-only student permission exposes registration without granting directory reads', () => {
  const account = user('users.create_assigned');
  assert.equal(nav.allowedDestination(account, '/students'), true);
  assert.equal(nav.allowedDestination(account, '/students/another-faculty'), false);
  assert.equal(nav.allowedDestination(account, '/add-student-using-file'), true);
});
test('student directory permission does not grant import access', () => {
  const account = user('users.view_assigned');
  assert.equal(nav.allowedDestination(account, '/students'), true);
  assert.equal(nav.allowedDestination(account, '/add-student-using-file'), false);
});
test('submission-review permission does not advertise own-history access', () => {
  const account = user('submissions.review_all');
  assert.equal(nav.allowedDestination(account, '/submissions/result'), true);
  assert.equal(nav.allowedDestination(account, '/history'), false);
  assert.equal(nav.workspaceNavigation(account).mobile.some(x => x.label === 'Progress'), false);
});
test('student subpages retain the same navigation highlight', () => {
  for (const route of ['/students', '/students/mentor', '/registerStudent', '/studentinformation', '/add-student-using-file']) assert.equal(nav.destinationActive('/students', route), true);
  assert.equal(nav.destinationActive('/students', '/student'), false);
});
test('nested access-management and approvals routes activate their parent item', () => {
  assert.equal(nav.destinationActive('/access-management', '/access-management/roles'), true);
  assert.equal(nav.destinationActive('/approvals', '/approvals/students'), true);
  assert.equal(nav.destinationActive('/approvals', '/approvals-extra'), false);
});
test('history and resource editors retain the appropriate main navigation highlight', () => {
  assert.equal(nav.destinationActive('/history', '/submissions/result'), true);
  assert.equal(nav.destinationActive('/make-problem', '/problem-form/problem'), true);
  assert.equal(nav.destinationActive('/make-contest', '/create-contest/contest'), true);
  assert.equal(nav.destinationActive('/make-contest', '/submissions/result'), false);
});
