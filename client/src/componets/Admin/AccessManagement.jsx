import { PageHeading } from "../workspace/WorkspaceUI";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Users, ShieldCheck, KeyRound, Plus, Search, Filter, Pencil, Trash2, Check, Copy, Layers, Info, History, ChevronRight, LockKeyhole } from "lucide-react";
import toast from "react-hot-toast";
import axios from "../../utils/axiosInstance";
import AuthService from "../../Auth/auth";
import { setUser as setCurrentUser } from "../../redux/userSlice";
import { can } from "../../utils/permissions";
import { errorMessage } from "../../utils/errorMessage";
import { Modal } from "../access/AccessUI";
import { moduleName, actionName, permissionName, permissionDescription } from "../../utils/accessLabels";
import { RoleEditor, UserAccessEditor, UserDetailsEditor } from "../access/AccessEditors";
import "../../CSS/AccessManagement.css";

const sections = {
  users: { title: "User Management", description: "Manage accounts, their status, roles, and individual permissions.", icon: Users },
  roles: { title: "Role Management", description: "Define reusable roles and manage their module permissions.", icon: ShieldCheck },
  permissions: { title: "Permission Management", description: "Explore the access rights available across all Codify modules.", icon: KeyRound },
  audit: { title: "Access Change History", description: "Review who changed roles, accounts, and access assignments.", icon: History },
};
const initials = (name) => name.split(/[\s._-]+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

function PermissionCatalog({ catalog }) {
  const [module, setModule] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const modules = [...new Set(catalog.map((p) => p.module))];
  const scoped = catalog.filter((p) => !module || p.module === module);
  const actions = [...new Set(scoped.map((p) => actionName(p.code)))];
  const visible = scoped.filter((p) => (!action || actionName(p.code) === action) && `${permissionName(p)} ${p.code} ${permissionDescription(p)}`.toLowerCase().includes(search.toLowerCase()));
  const copy = async (code) => { try { await navigator.clipboard.writeText(code); toast.success("Permission code copied."); } catch { toast.error("Unable to copy. Select the permission code to copy it."); } };
  return <div className="rbac-catalog-layout">
    <aside className="rbac-module-panel"><h2><Layers size={18} />Modules <span className="rbac-badge">{modules.length}</span></h2><label className="rbac-search"><Search size={16} /><input aria-label="Search modules" placeholder="Search modules…" value={moduleSearch} onChange={(e) => setModuleSearch(e.target.value)} /></label>
      <button className={!module ? "is-active" : ""} onClick={() => { setModule(""); setAction(""); }}><Layers size={18} />All modules<span>{catalog.length}</span></button>
      {modules.filter((m) => moduleName(m).toLowerCase().includes(moduleSearch.toLowerCase())).map((m) => <button key={m} className={module === m ? "is-active" : ""} onClick={() => { setModule(m); setAction(""); }}><KeyRound size={17} />{moduleName(m)}<span>{catalog.filter((p) => p.module === m).length}</span></button>)}
    </aside>
    <section className="rbac-catalog-panel"><div className="rbac-catalog-heading"><span className="rbac-icon"><ShieldCheck size={23} /></span><div><h2>{module ? `${moduleName(module)} permissions` : "All system permissions"}</h2><p>Showing {visible.length} of {scoped.length} permissions</p></div></div>
      <div className="rbac-action-tabs"><button className={!action ? "is-active" : ""} onClick={() => setAction("")}>All ({scoped.length})</button>{actions.map((a) => <button key={a} className={action === a ? "is-active" : ""} onClick={() => setAction(a)}>{a} ({scoped.filter((p) => actionName(p.code) === a).length})</button>)}</div>
      <label className="rbac-search"><Search size={18} /><input aria-label="Search catalog permissions" placeholder="Search permissions by name, code, or description…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <div className="rbac-permission-grid rbac-catalog-cards">{visible.map((permission) => <article className="rbac-permission-card" key={permission.code}><div className="rbac-group-heading"><h3>{permissionName(permission)}</h3><span className={`rbac-badge rbac-action-${actionName(permission.code).toLowerCase().replace(/\s/g, "-")}`}>{actionName(permission.code)}</span></div><button className="rbac-code" onClick={() => copy(permission.code)} aria-label={`Copy ${permission.code}`}><code>{permission.code}</code><Copy size={13} /></button><p>{permissionDescription(permission)}</p><footer><span><Layers size={14} />{moduleName(permission.module)}</span><small>#{permission.id}</small></footer></article>)}</div>
      {!visible.length && <div className="rbac-empty">No permissions match these filters.</div>}
    </section>
  </div>;
}

PermissionCatalog.propTypes = { catalog: PropTypes.array.isRequired };

export default function AccessManagement() {
  const actor = useSelector((state) => state.app.user);
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const section = pathname.split("/")[2];
  const [catalog, setCatalog] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [audit, setAudit] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const limit = 10;
  useEffect(() => {
    let active = true;
    Promise.all([axios.get("access/permissions"), axios.get("access/roles")])
      .then(([permissions, savedRoles]) => { if (active) { setCatalog(permissions.data); setRoles(savedRoles.data); } })
      .catch((err) => { if (active) setError(errorMessage(err.response?.data)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => { setSearch(""); setStatus(""); setRoleFilter(""); setPage(1); setDialog(null); setError(""); }, [section]);
  useEffect(() => {
    let active = true;
    if (["users", "audit"].includes(section)) setListLoading(true);
    const timer = setTimeout(async () => {
      if (!["users", "audit"].includes(section)) return;
      setListLoading(true);
      try {
        const result = section === "users" ? await axios.get("access/users", { params: { search, status, role: roleFilter, page, limit } }) : await axios.get("access/audit");
        if (active) { if (section === "users") { setUsers(result.data.results); setCount(result.data.count); } else setAudit(result.data); setError(""); }
      } catch (err) { if (active) setError(errorMessage(err.response?.data)); }
      finally { if (active) setListLoading(false); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [section, search, status, roleFilter, page, reload]);
  useEffect(() => {
    if (dialog?.type !== "details") return;
    let active = true;
    axios.get("access/users", { params: { accountType: "faculty", limit: 1000 } })
      .then((res) => { if (active) setMentors(res.data.results); })
      .catch(() => { if (active) setMentors([]); });
    return () => { active = false; };
  }, [dialog?.type]);
  const open = (next) => { setDialogError(""); setDialog(next); };
  const close = () => { if (!busy) { setDialog(null); setDialogError(""); } };
  const mutate = async (method, path, data, success) => {
    setBusy(true); setDialogError("");
    try {
      const result = await axios({ method, url: path, data });
      setDialog(null);
      if (result.data?.temporaryPasswords) setCredentials(result.data.temporaryPasswords);
      toast.success(success);
      const current = await AuthService.getCurrentUser();
      if (current.authStatus) {
        dispatch(setCurrentUser(current.data.user));
        if (can(current.data.user, "access.manage")) setReload((v) => v + 1);
      }
    } catch (err) { setDialogError(errorMessage(err.response?.data, "Unable to save changes. Please try again.")); }
    finally { setBusy(false); }
  };
  if (!section) return <Navigate to="/access-management/users" replace />;
  if (!sections[section]) return <Navigate to="/access-management/users" replace />;
  const { title, description } = sections[section];
  const filteredRoles = roles.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(search.toLowerCase()));
  const roleName = (id) => roles.find((r) => r.id === id)?.name || "Role";
  const maxPage = Math.max(1, Math.ceil(count / limit));
  return <section className="rbac-page">
    <header className="rbac-page-heading"><PageHeading context={`${actor?.institution || "Codify classroom"} / Access management`} title={title} description={description} /><div className="rbac-heading-actions"><button className="rbac-button rbac-button--soft" onClick={() => open({ type: "help" })}><Info size={16} />How access works</button>{section === "users" && can(actor, "users.create_all") && <button className="rbac-button rbac-button--primary" disabled={loading} onClick={() => open({ type: "details" })}><Plus size={18} />Add user</button>}{section === "roles" && <button className="rbac-button rbac-button--primary" disabled={loading} onClick={() => open({ type: "role" })}><Plus size={18} />Add role</button>}</div></header>
    <nav className="rbac-section-nav" aria-label="Access management pages">{Object.entries(sections).map(([key, item]) => <Link key={key} to={`/access-management/${key}`} aria-current={section === key ? "page" : undefined}><item.icon size={16} />{key === "audit" ? "Change history" : item.title}</Link>)}</nav>
    {error && <div className="rbac-error" role="alert">{error}<button onClick={() => setReload((v) => v + 1)}>Retry</button></div>}
    {loading ? <div className="rbac-empty" role="status">Loading access management…</div> : <>
      {section === "users" && <div className="rbac-panel"><div className="rbac-toolbar"><label className="rbac-search"><Search size={18} /><input placeholder="Search by name, email, or student ID…" aria-label="Search users" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label><label className="rbac-select"><Filter size={16} /><select aria-label="Filter users by role" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}><option value="">All roles</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label className="rbac-select"><select aria-label="Filter users by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
        <div className="rbac-table-scroll" aria-busy={listLoading}><table className="rbac-user-table"><thead><tr><th>User</th><th>Institutional ID</th><th>Roles</th><th>Mobile</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="rbac-person"><span className="rbac-avatar">{initials(user.fullName || user.username)}</span><div><strong>{user.fullName || user.username}</strong><small title={user.email || user.username}>{user.email || user.username}</small></div></div></td><td data-label="Institutional ID">{user.studentId || "—"}</td><td data-label="Roles"><div className="rbac-role-badges">{user.roles.map((id) => <span className="rbac-badge rbac-badge--purple" key={id}>{roleName(id)}</span>)}{!user.roles.length && <span className="rbac-muted">No roles</span>}{user.permissions.length > 0 && <small>+{user.permissions.length} direct</small>}</div></td><td data-label="Mobile">{user.mobileNo || "—"}</td><td data-label="Status"><span className={`rbac-badge ${user.isActive ? "rbac-badge--green" : "rbac-badge--neutral"}`}><span className="rbac-status-dot" />{user.isActive ? "Active" : "Inactive"}</span>{!user.isApproved && <small className="rbac-pending">Awaiting approval</small>}</td><td data-label="Actions"><div className="rbac-row-actions">{can(actor, "users.edit_all") && <button className="rbac-button rbac-button--small" onClick={() => open({ type: "details", user })}><Pencil size={14} />Edit user</button>}<button className="rbac-button rbac-button--small rbac-button--soft" onClick={() => open({ type: "userAccess", user })}><ShieldCheck size={14} />Manage access</button>{can(actor, "users.delete_all") && <button className="rbac-button rbac-button--small rbac-button--danger" disabled={user.id === actor?._id} onClick={() => open({ type: "deleteUser", user })}><Trash2 size={14} />Delete</button>}</div></td></tr>)}</tbody></table>{!users.length && <div className="rbac-empty">{listLoading ? "Loading users…" : "No users match your filters."}</div>}</div>
        <footer className="rbac-pagination"><span>{listLoading ? "Updating…" : `Showing ${count ? (page - 1) * limit + 1 : 0}–${Math.min(page * limit, count)} of ${count} users`}</span><button className="rbac-button" disabled={page === 1 || listLoading} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {maxPage}</span><button className="rbac-button" disabled={page >= maxPage || listLoading} onClick={() => setPage(page + 1)}>Next</button></footer>
      </div>}
      {section === "roles" && <><div className="rbac-toolbar"><label className="rbac-search"><Search size={18} /><input placeholder="Search roles…" aria-label="Search roles" value={search} onChange={(e) => setSearch(e.target.value)} /></label><span className="rbac-muted">{filteredRoles.length} roles · explicit permission grants</span></div><div className="rbac-role-grid">{filteredRoles.map((role) => <article className="workspace-card rbac-role-card" key={role.id}><div className="rbac-role-card-top"><span className="rbac-icon"><ShieldCheck size={26} /></span><div><span className="rbac-badge rbac-badge--blue">{role.userCount} users</span><span className="rbac-badge rbac-badge--purple">{role.permissions.length} permissions</span>{role.defaultAccountType && <span className="rbac-badge rbac-badge--green">Default</span>}</div></div><h2>{role.name}</h2><p>{role.description || `Configure the module permissions granted by the ${role.name} role.`}</p><footer><button className="rbac-text-button" onClick={() => open({ type: "role", role, permissionsOnly: true })}><KeyRound size={16} />Manage permissions</button><button className="rbac-text-button rbac-muted" onClick={() => open({ type: "role", role })}><Pencil size={14} />Edit</button>{!role.defaultAccountType && <button className="rbac-icon-button rbac-danger" aria-label={`Delete ${role.name} role`} onClick={() => open({ type: "deleteRole", role })}><Trash2 size={16} /></button>}</footer></article>)}</div>{!filteredRoles.length && <div className="rbac-empty">No roles match your search.</div>}</>}
      {section === "permissions" && <><div className="rbac-catalog-counts"><span className="rbac-badge rbac-badge--purple">{catalog.length} rights</span><span className="rbac-badge rbac-badge--neutral">{new Set(catalog.map((p) => p.module)).size} modules</span><p>Use role or user management to assign these permissions.</p></div><PermissionCatalog catalog={catalog} /></>}
      {section === "audit" && <div className="rbac-panel rbac-audit"><p className="rbac-muted">Most recent 100 changes</p>{audit.map((entry) => <details key={entry.id}><summary><span className="rbac-icon"><History size={18} /></span><div><strong>{entry.action.replace(/\./g, " ")}</strong><small>{entry.actor__username || "Deleted user"} · {new Date(entry.created_at).toLocaleString()}</small></div><ChevronRight size={17} /></summary><p>Target: {entry.target}</p><div className="rbac-audit-diff"><div><h3>Before</h3><pre>{JSON.stringify(entry.before, null, 2)}</pre></div><div><h3>After</h3><pre>{JSON.stringify(entry.after, null, 2)}</pre></div></div></details>)}{!audit.length && <div className="rbac-empty">{listLoading ? "Loading history…" : "No access changes recorded yet."}</div>}</div>}
    </>}
    {dialog?.type === "role" && <RoleEditor key={dialog.role?.id || "new"} role={dialog.role} permissionsOnly={dialog.permissionsOnly} catalog={catalog} onClose={close} busy={busy} error={dialogError} onSave={(data) => mutate(dialog.role ? "put" : "post", dialog.role ? `access/roles/${dialog.role.id}` : "access/roles", data, "Role saved.")} />}
    {dialog?.type === "userAccess" && <UserAccessEditor user={dialog.user} roles={roles} catalog={catalog} onClose={close} busy={busy} error={dialogError} onSave={(data) => mutate("put", `access/users/${dialog.user.id}`, data, "User access saved.")} />}
    {dialog?.type === "details" && <UserDetailsEditor user={dialog.user} roles={roles} catalog={catalog} mentors={mentors} onClose={close} busy={busy} error={dialogError} onSave={(data) => mutate(dialog.user ? "patch" : "post", dialog.user ? `access/users/${dialog.user.id}` : "access/users", data, dialog.user ? "User updated." : "User created.")} />}
    {["deleteUser", "deleteRole"].includes(dialog?.type) && <Modal title={dialog.type === "deleteUser" ? "Delete user?" : "Delete role?"} onClose={close} busy={busy} footer={<><button className="rbac-button" disabled={busy} onClick={close}>Cancel</button><button className="rbac-button rbac-button--danger-solid" disabled={busy} onClick={() => mutate("delete", dialog.type === "deleteUser" ? `access/users/${dialog.user.id}` : `access/roles/${dialog.role.id}`, undefined, dialog.type === "deleteUser" ? "User deleted." : "Role deleted.")}>{busy ? "Deleting…" : "Confirm deletion"}</button></>}>
      {dialogError && <p className="rbac-error" role="alert">{dialogError}</p>}<p>{dialog.type === "deleteUser" ? `Deleting ${dialog.user.fullName || dialog.user.username} also removes their submissions, drafts, and the problems and contests they created. This cannot be undone.` : `Users assigned to ${dialog.role.name} will lose permissions supplied by this role. Other roles and direct grants remain in effect.`}</p>
    </Modal>}
    {dialog?.type === "help" && <Modal title="How access works" onClose={close} footer={<button className="rbac-button rbac-button--primary" onClick={close}>Got it</button>}><div className="rbac-help"><p><ShieldCheck size={21} /><span><strong>Roles group permissions.</strong> Create a role, choose its permissions by module, and assign it to one or more users.</span></p><p><Users size={21} /><span><strong>Users can have several roles.</strong> Their permissions combine. Roles do not inherit from other roles.</span></p><p><KeyRound size={21} /><span><strong>Direct grants add individual access.</strong> Extra permissions are added to the permissions received through roles.</span></p><p><LockKeyhole size={21} /><span><strong>Inherited permissions are locked in the user editor.</strong> Change the role or remove the user’s role assignment to remove that source of access.</span></p><p><Check size={21} /><span><strong>Scope matters.</strong> Own, assigned, shared, and all permissions control which records an action can affect. Changes apply on subsequent requests.</span></p></div></Modal>}
    {credentials.length > 0 && <Modal title="User created" subtitle="Save this temporary password before closing this dialog." onClose={() => setCredentials([])} footer={<button className="rbac-button rbac-button--primary" onClick={() => setCredentials([])}>Done</button>}><p>Share this password privately with the account holder. They must change it at first login. It is shown only for this operation.</p>{credentials.map((row) => <div className="rbac-credential" key={row.id}><strong>{row.username}</strong><code>{row.temporaryPassword}</code><button className="rbac-button" onClick={async () => { try { await navigator.clipboard.writeText(row.temporaryPassword); toast.success("Password copied."); } catch { toast.error("Select the password to copy it."); } }}><Copy size={15} />Copy password</button></div>)}</Modal>}
  </section>;
}
