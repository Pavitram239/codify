import { useState } from "react";
import PropTypes from "prop-types";
import { Plus, ShieldCheck, KeyRound, Check, LockKeyhole, ChevronRight } from "lucide-react";
import { Modal, PermissionPicker } from "./AccessUI";
import { toggle, permissionName } from "../../utils/accessLabels";

function RoleChoices({ roles, selected, onChange, busy }) {
  return <div className="rbac-role-choices">{roles.map((role) => <label key={role.id} className={selected.includes(role.id) ? "is-selected" : ""}><input type="checkbox" checked={selected.includes(role.id)} disabled={busy} onChange={() => onChange(toggle(selected, role.id))} /><ShieldCheck size={18} /><span><strong>{role.name}</strong><small>{role.permissions.length} permissions</small></span></label>)}{!roles.length && <p>No roles available. Create a role first or grant permissions directly.</p>}</div>;
}
RoleChoices.propTypes = { roles: PropTypes.array.isRequired, selected: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, busy: PropTypes.bool };

function ExtraPermissions({ catalog, roles, draft, setDraft, busy }) {
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState([]);
  const selectedRoles = roles.filter((role) => draft.roles.includes(role.id));
  const inherited = [...new Set(selectedRoles.flatMap((role) => role.permissions))];
  const sources = Object.fromEntries(inherited.map((code) => [code, selectedRoles.filter((role) => role.permissions.includes(code)).map((role) => role.name)]));
  const effective = new Set([...inherited, ...draft.permissions]);
  return <section className="rbac-extra-section"><div className="rbac-group-heading"><div><h3><KeyRound size={20} />Additional custom permissions</h3><p>Grant permissions directly to this user on top of their roles.</p></div><button type="button" className="rbac-button" disabled={busy} onClick={() => { setSelection([...draft.permissions]); setEditing(true); }}><Plus size={17} />Manage extra permissions</button></div>
    <div className="rbac-access-counts"><span className="rbac-badge rbac-badge--purple">{draft.permissions.length} direct grants</span><span className="rbac-badge rbac-badge--neutral"><LockKeyhole size={12} />{inherited.length} role inherited</span><span className="rbac-badge rbac-badge--blue">{effective.size} effective permissions</span></div>
    {draft.permissions.length > 0 && <div className="rbac-direct-chips">{draft.permissions.map((code) => <span key={code}>{permissionName(catalog.find((p) => p.code === code) || { code, module: code.split(".")[0] })}<button type="button" disabled={busy} aria-label={`Remove direct grant ${code}`} onClick={() => setDraft({ ...draft, permissions: draft.permissions.filter((p) => p !== code) })}>×</button></span>)}</div>}
    {editing && <Modal title="Custom user permissions" subtitle="Add individual permissions. Permissions inherited from selected roles are locked." icon="key" onClose={() => setEditing(false)} wide footer={<><span className="rbac-footer-count">{selection.length} custom added · {inherited.length} role inherited</span><button type="button" className="rbac-button" onClick={() => setEditing(false)}>Cancel</button><button type="button" className="rbac-button rbac-button--primary" onClick={() => { setDraft({ ...draft, permissions: selection }); setEditing(false); }}><Check size={16} />Save selection</button></>}>
      <PermissionPicker catalog={catalog} selected={selection} onChange={setSelection} inherited={inherited} sources={sources} />
    </Modal>}
  </section>;
}
ExtraPermissions.propTypes = { catalog: PropTypes.array.isRequired, roles: PropTypes.array.isRequired, draft: PropTypes.object.isRequired, setDraft: PropTypes.func.isRequired, busy: PropTypes.bool };

export function UserAccessEditor({ user, roles, catalog, onClose, onSave, busy, error }) {
  const [draft, setDraft] = useState({ ...user, roles: [...user.roles], permissions: [...user.permissions] });
  const selected = roles.filter((role) => draft.roles.includes(role.id));
  const effective = [...new Set([...selected.flatMap((role) => role.permissions), ...draft.permissions])];
  return <Modal title={`Manage access · ${user.fullName || user.username}`} subtitle="Assign roles and additional permissions to this account." onClose={onClose} busy={busy} wide footer={<><span className="rbac-footer-count">{draft.roles.length} roles · {effective.length} effective permissions</span><button className="rbac-button" disabled={busy} onClick={onClose}>Cancel</button><button className="rbac-button rbac-button--primary" disabled={busy} onClick={() => onSave({ roles: draft.roles, permissions: draft.permissions })}>{busy ? "Saving…" : "Save user access"}</button></>}>
    {error && <p className="rbac-error" role="alert">{error}</p>}
    <section className="rbac-form-section"><h3><ShieldCheck size={20} />Assign roles</h3><p>Permissions from all selected roles are combined.</p><RoleChoices roles={roles} selected={draft.roles} onChange={(ids) => setDraft({ ...draft, roles: ids })} busy={busy} /></section>
    <ExtraPermissions roles={roles} catalog={catalog} draft={draft} setDraft={setDraft} busy={busy} />
    <details className="rbac-effective"><summary><ChevronRight size={16} />Effective access preview ({effective.length})</summary><div className="rbac-effective-grid">{effective.map((code) => <div key={code}><strong>{permissionName(catalog.find((p) => p.code === code) || { code, module: code.split(".")[0] })}</strong><small>{[...selected.filter((role) => role.permissions.includes(code)).map((role) => role.name), ...(draft.permissions.includes(code) ? ["Direct grant"] : [])].join(" · ")}</small></div>)}</div>{!effective.length && <p>This account has no module permissions.</p>}</details>
  </Modal>;
}
UserAccessEditor.propTypes = { user: PropTypes.object.isRequired, roles: PropTypes.array.isRequired, catalog: PropTypes.array.isRequired, onClose: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired, busy: PropTypes.bool, error: PropTypes.string };

export function UserDetailsEditor({ user, roles, catalog, mentors = [], onClose, onSave, busy, error }) {
  const initialType = "faculty";
  const defaultRoles = roles.filter((r) => r.defaultAccountType === initialType).map((r) => r.id);
  const [draft, setDraft] = useState(user ? { ...user } : { username: "", fullName: "", email: "", mobileNo: "", accountType: initialType, studentId: "", branch: "cspit-it", semester: 1, batch: "a1", subject: "", facultyId: "", isActive: true, isApproved: true, roles: defaultRoles, permissions: [] });
  const [rolesTouched, setRolesTouched] = useState(false);
  const change = (field, value) => setDraft({ ...draft, [field]: value });
  const fields = [["fullName", "Full name", "text", "e.g. Aisha Patel"], ["username", "Username", "text", "e.g. aisha.patel"], ["email", "Email address", "email", "aisha@example.edu"], ["mobileNo", "Mobile number", "tel", "Contact number"], ["studentId", "Institutional / student ID", "text", "e.g. 24IT015"], ["subject", "Subject", "text", "e.g. Data Structures"]];
  const submit = (event) => { event.preventDefault(); onSave({ ...draft, facultyId: draft.facultyId || null, semester: Number(draft.semester) }); };
  return <Modal title={user ? "Edit user" : "Add new user"} subtitle={user ? "Update account details and status. Manage access separately." : "Create an account and optionally assign roles and extra permissions."} onClose={onClose} busy={busy} wide footer={<><span className="rbac-footer-count">{!user && "A temporary password is provided after creation."}</span><button className="rbac-button" disabled={busy} onClick={onClose}>Cancel</button><button className="rbac-button rbac-button--primary" form="rbac-user-form" disabled={busy}>{busy ? "Saving…" : user ? "Save changes" : "Create user"}</button></>}>
    <form id="rbac-user-form" onSubmit={submit}>
      {error && <p className="rbac-error" role="alert">{error}</p>}
      <fieldset disabled={busy} className="rbac-fields"><legend className="sr-only">Account details</legend>
        {fields.map(([field, label, type, placeholder]) => <label key={field}>{label}<input type={type} placeholder={placeholder} value={draft[field]} required={field === "username"} maxLength={field === "username" ? 150 : field === "mobileNo" ? 20 : field === "studentId" ? 100 : field === "email" ? 254 : 255} onChange={(event) => change(field, event.target.value)} /></label>)}
        <label>Account type<select value={draft.accountType} onChange={(event) => { const type = event.target.value; setDraft({ ...draft, accountType: type, ...(!user && !rolesTouched ? { roles: roles.filter((r) => r.defaultAccountType === type).map((r) => r.id) } : {}) }); }}><option value="student">Student</option><option value="faculty">Faculty / staff</option><option value="admin">Administrator</option></select></label>
        <label>Branch<select value={draft.branch} onChange={(event) => change("branch", event.target.value)}><option value="cspit-it">CSPIT IT</option><option value="cspit-ce">CSPIT CE</option><option value="cspit-cse">CSPIT CSE</option></select></label>
        <label>Semester<input type="number" min="1" max="12" required value={draft.semester} onChange={(event) => change("semester", event.target.value)} /></label>
        <label>Faculty / mentor<select value={draft.facultyId || ""} onChange={(event) => change("facultyId", event.target.value)}><option value="">No assigned faculty</option>{draft.facultyId && !mentors.some((mentor) => mentor.id === draft.facultyId) && <option value={draft.facultyId}>Current assigned faculty</option>}{mentors.filter((mentor) => mentor.id !== user?.id).map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.fullName || mentor.username}</option>)}</select></label>
        <label>Batch<input maxLength={20} required value={draft.batch} onChange={(event) => change("batch", event.target.value)} /></label>
      </fieldset>
      <p className="rbac-hint">Account type controls student onboarding and session behavior. Module access comes from assigned roles and permissions.</p>
      <div className="rbac-status-controls"><label><input type="checkbox" checked={draft.isActive} disabled={busy} onChange={(event) => change("isActive", event.target.checked)} />Active account</label><label><input type="checkbox" checked={draft.isApproved} disabled={busy} onChange={(event) => change("isApproved", event.target.checked)} />Approved to sign in</label></div>
      {!user && <><section className="rbac-form-section"><h3><ShieldCheck size={20} />Assign roles</h3><RoleChoices roles={roles} selected={draft.roles} onChange={(ids) => { setRolesTouched(true); change("roles", ids); }} busy={busy} /></section><ExtraPermissions roles={roles} catalog={catalog} draft={draft} setDraft={setDraft} busy={busy} /></>}
    </form>
  </Modal>;
}
UserDetailsEditor.propTypes = { mentors: PropTypes.array, user: PropTypes.object, roles: PropTypes.array.isRequired, catalog: PropTypes.array.isRequired, onClose: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired, busy: PropTypes.bool, error: PropTypes.string };

export function RoleEditor({ role, catalog, onClose, onSave, busy, error, permissionsOnly = false }) {
  const [draft, setDraft] = useState(role ? { ...role, permissions: [...role.permissions] } : { name: "", description: "", permissions: [] });
  const title = permissionsOnly ? `Permissions · ${role.name}` : role ? "Edit role" : "Create new role";
  return <Modal title={title} subtitle="Configure the permissions this role grants across Codify’s modules." onClose={onClose} busy={busy} wide footer={<><span className="rbac-footer-count">Selected: <strong>{draft.permissions.length}</strong> / {catalog.length} permissions</span><button className="rbac-button" disabled={busy} onClick={onClose}>Cancel</button><button className="rbac-button rbac-button--primary" form="rbac-role-form" disabled={busy}>{busy ? "Saving…" : role ? "Save role" : "Create role"}</button></>}>
    <form id="rbac-role-form" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      {error && <p className="rbac-error" role="alert">{error}</p>}
      {!permissionsOnly && <fieldset className="rbac-role-fields" disabled={busy}><label>Role name<input required maxLength={100} placeholder="e.g. Teaching Assistant" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Description<textarea rows={2} placeholder="Describe this role’s responsibilities" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label></fieldset>}
      {role?.defaultAccountType && <p className="rbac-hint">Default role for new {role.defaultAccountType} accounts. Permissions are explicit; no hierarchy inheritance applies.</p>}
      <h3 className="rbac-section-title">Assign permissions</h3><PermissionPicker catalog={catalog} selected={draft.permissions} onChange={(permissions) => setDraft({ ...draft, permissions })} busy={busy} />
    </form>
  </Modal>;
}
RoleEditor.propTypes = { role: PropTypes.object, catalog: PropTypes.array.isRequired, onClose: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired, busy: PropTypes.bool, error: PropTypes.string, permissionsOnly: PropTypes.bool };
