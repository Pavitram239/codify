export const can = (user, ...codes) => codes.some((code) => user?.permissions?.includes(code));
export const canResource = (user, module, action, resource) => {
  if (can(user, `${module}.${action}_all`)) return true;
  const owner = resource?.created_by;
  const own = String(owner?._id || owner?.id || owner) === String(user?._id);
  if (action === "assign") return can(user, `${module}.assign_shared`) && (own || owner?.role === "admin");
  return own && can(user, `${module}.${action}_own`);
};
export function routePermissions(path) {
  if (/^\/access-management(\/|$)/.test(path)) return ["access.manage"];
  if (/^\/session-management/.test(path)) return ["sessions.view_all"];
  if (path === "/approvals/faculty") return ["users.approve_all"];
  if (/^\/approvals(\/|$)/.test(path)) return ["users.approve_assigned", "users.approve_all"];
  if (/^\/pending-requests/.test(path)) return ["users.approve_all"];
  if (/^\/faculty-section/.test(path)) return ["users.approve_assigned", "users.approve_all"];
  if (path === "/registerFaculty") return ["users.view_all"];
  if (/^\/add-student-using-file/.test(path)) return ["users.create_assigned", "users.create_all"];
  if (path === "/students") return ["users.view_assigned", "users.view_all", "users.create_assigned", "users.create_all"];
  if (path === "/registerStudent") return ["users.view_assigned", "users.view_all"];
  if (/^\/(students|studentinformation)/.test(path)) return ["users.view_assigned", "users.view_all"];
  if (/^\/(dashboard|contests\/[^/]+\/dashboard)/.test(path)) return ["submissions.review_own", "submissions.review_all"];
  if (/^\/(assignProblem|assignedStudents)/.test(path)) return ["problems.assign_shared", "problems.assign_all"];
  if (/^\/(assignContestToStudents|unassignContestToStudents)/.test(path)) return ["contests.assign_shared", "contests.assign_all"];
  if (/^\/problem-form\//.test(path)) return ["problems.edit_own", "problems.edit_all"];
  if (path === "/problem-form") return ["problems.create"];
  if (/^\/create-contest\//.test(path)) return ["contests.edit_own", "contests.edit_all"];
  if (path === "/create-contest") return ["contests.create"];
  if (/^\/(problems|make-problem)/.test(path)) return ["problems.view_assigned", "problems.view_shared", "problems.view_all"];
  if (/^\/(make-contest|assessments|contests)/.test(path)) return ["contests.view_assigned", "contests.view_shared", "contests.view_all"];
  if (/^\/history(\/|$)/.test(path)) return ["submissions.view_own"];
  if (/^\/submissions(\/|$)/.test(path)) return ["submissions.view_own", "submissions.review_own", "submissions.review_all"];
  return [];
}
