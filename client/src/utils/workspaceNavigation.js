import { can, routePermissions } from "./permissions";

export function allowedDestination(user, to) {
  const required = routePermissions(to);
  return !required.length || can(user, ...required);
}

export function workspaceNavigation(user) {
  const visible = (items) => items.filter((item) => allowedDestination(user, item.to));
  return {
    main: visible([
      { label: user?.role === "student" ? "Home" : "Overview", to: "/browse" },
      { label: "Assessments", to: "/make-contest" },
      { label: "Problems", to: "/make-problem" },
      { label: "History", to: "/history" },
    ]),
    groups: [
      { id: "people", label: "People", items: visible([
        { label: "Students", to: "/students" },
        { label: "Faculty", to: "/registerFaculty" },
        { label: "Approvals", to: "/approvals" },
      ]) },
      { id: "administration", label: "Administration", items: visible([
        { label: "Access management", to: "/access-management" },
        { label: "Sessions", to: "/session-management" },
      ]) },
    ].filter((group) => group.items.length),
    footer: [{ label: "Account", to: "/profile" }, { label: "Support", to: "/support" }],
    mobile: visible([
      { label: "Home", to: "/browse", icon: "home" },
      { label: "Assessments", to: "/make-contest", icon: "assessments" },
      { label: "Progress", to: "/history", icon: "progress" },
      { label: "Account", to: "/profile", icon: "account" },
    ]),
  };
}

export function destinationActive(to, path) {
  if (to === "/make-contest") return /^\/(make-contest|create-contest|assessments|contests|assignContestToStudents|unassignContestToStudents)(\/|$)/.test(path);
  if (to === "/make-problem") return /^\/(make-problem|problem-form|problems|assignProblem|assignedStudents|dashboard)(\/|$)/.test(path);
  if (to === "/history") return /^\/(history|submissions)(\/|$)/.test(path);
  if (to === "/students") return /^\/(students|studentinformation|registerStudent|add-student-using-file)(\/|$)/.test(path);
  return path === to || path.startsWith(`${to}/`);
}
