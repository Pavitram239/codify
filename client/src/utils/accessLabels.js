export const moduleNames = { problems: "Problems", contests: "Contests", submissions: "Submissions", execution: "Code execution", drafts: "Code drafts", users: "Users", sessions: "Sessions", access: "Access management" };
const nouns = { problems: "problems", contests: "contests", submissions: "submissions", execution: "code", drafts: "code drafts", users: "users", sessions: "sessions", access: "access" };
export const moduleName = (module) => moduleNames[module] || module;
export const actionName = (code) => {
  const action = code.split(".")[1].split("_")[0];
  return ({ edit: "Update", review: "Review", assign: "Assign", approve: "Approve", issue: "Issue password", revoke: "Revoke", manage: "Manage" })[action] || action.charAt(0).toUpperCase() + action.slice(1);
};
export const permissionName = (permission) => {
  if (permission.code === "users.issue_password_assigned") return "Issue passwords to assigned students";
  if (permission.code === "users.issue_password_all") return "Issue passwords to all users";
  if (permission.module === "execution") return "Run code";
  if (permission.module === "access") return "Manage roles and permissions";
  const action = actionName(permission.code);
  const scope = permission.code.split("_").slice(1).join(" ");
  const scopeLabel = ({ own: "own", shared: "own and shared", assigned: "assigned", all: "all" })[scope] || "";
  return `${action} ${scopeLabel} ${nouns[permission.module] || permission.module}`.replace(/\s+/g, " ").trim();
};
export const permissionDescription = (permission) => {
  const scope = permission.code.split("_").at(-1);
  if (scope === "own") return permission.module === "submissions" && permission.code.includes("review") ? "Review submissions for problems and contests you created." : "Applies only to resources you created or submissions you made.";
  if (scope === "assigned") return permission.module === "users" || permission.module === "sessions" ? "Applies only to students linked to your account." : "Applies only to resources assigned to your account. Contest time windows still apply.";
  if (scope === "shared") return "Applies to resources you created and the shared administrator resource bank.";
  if (scope === "all") return `Applies across the ${moduleName(permission.module).toLowerCase()} module, regardless of ownership.`;
  if (permission.module === "access") return "Create roles, assign roles, and grant additional user permissions.";
  if (permission.module === "execution") return "Run code for problems you already have permission to access.";
  if (permission.module === "drafts") return "Access your own code drafts for problems available to you.";
  return `Allows this action in the ${moduleName(permission.module).toLowerCase()} module.`;
};
export const toggle = (values, value) => values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

