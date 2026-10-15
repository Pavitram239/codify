import { useEffect, useRef, useState, useId } from "react";
import PropTypes from "prop-types";
import { Search, Filter, Check, LockKeyhole, X, ShieldCheck, KeyRound } from "lucide-react";

import { moduleName, permissionName, permissionDescription, toggle } from "../../utils/accessLabels";

export function Modal({ title, subtitle, children, footer, onClose, busy = false, wide = false, icon = "shield" }) {
  const dialog = useRef(null);
  const headingId = useId();
  const previousFocus = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    previousFocus.current = document.activeElement;
    element.showModal();
    return () => { element.close(); previousFocus.current?.focus(); };
  }, []);
  const Icon = icon === "key" ? KeyRound : ShieldCheck;
  return <dialog ref={dialog} className={`rbac-dialog ${wide ? "rbac-dialog--wide" : ""}`} aria-labelledby={headingId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="rbac-dialog-frame">
      <header className="rbac-dialog-heading"><span className="rbac-icon"><Icon size={26} /></span><div><h2 id={headingId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="rbac-icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={22} /></button></header>
      <div className="rbac-dialog-body">{children}</div>
      {footer && <footer className="rbac-dialog-footer">{footer}</footer>}
    </div>
  </dialog>;
}
Modal.propTypes = { title: PropTypes.string.isRequired, subtitle: PropTypes.string, children: PropTypes.node, footer: PropTypes.node, onClose: PropTypes.func.isRequired, busy: PropTypes.bool, wide: PropTypes.bool, icon: PropTypes.string };

export function PermissionPicker({ catalog, selected, onChange, inherited = [], sources = {}, busy = false }) {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("");
  const inheritedSet = new Set(inherited);
  const modules = [...new Set(catalog.map((p) => p.module))];
  const filtered = catalog.filter((p) => (!module || p.module === module) && `${permissionName(p)} ${p.code} ${permissionDescription(p)}`.toLowerCase().includes(search.toLowerCase()));
  const available = filtered.filter((p) => !inheritedSet.has(p.code)).map((p) => p.code);
  const allSelected = available.length > 0 && available.every((code) => selected.includes(code));
  const selectGroup = (codes) => {
    const all = codes.every((code) => selected.includes(code));
    onChange(all ? selected.filter((code) => !codes.includes(code)) : [...new Set([...selected, ...codes])]);
  };
  return <div className="rbac-picker">
    <div className="rbac-picker-filters"><label className="rbac-search"><Search size={18} /><input aria-label="Search permissions" placeholder="Search permissions by name or code…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="rbac-select"><Filter size={17} /><select aria-label="Filter permissions by module" value={module} onChange={(event) => setModule(event.target.value)}><option value="">All modules ({catalog.length})</option>{modules.map((m) => <option key={m} value={m}>{moduleName(m)} ({catalog.filter((p) => p.module === m).length})</option>)}</select></label></div>
    <div className="rbac-picker-summary"><p>Showing <strong>{filtered.length}</strong> permissions · <strong>{available.length}</strong> available to select</p><button type="button" className="rbac-button rbac-button--soft" disabled={busy || !available.length} onClick={() => selectGroup(available)}><Check size={16} />{allSelected ? "Clear" : "Select all"} visible</button></div>
    {!filtered.length && <div className="rbac-empty">No permissions match your search.</div>}
    {modules.filter((m) => filtered.some((p) => p.module === m)).map((m) => {
      const group = filtered.filter((p) => p.module === m);
      const codes = group.filter((p) => !inheritedSet.has(p.code)).map((p) => p.code);
      const groupSelected = codes.length > 0 && codes.every((code) => selected.includes(code));
      return <section className="rbac-picker-group" key={m}><div className="rbac-group-heading"><h3>{moduleName(m)} <span>({group.length} permissions)</span></h3><button type="button" className="rbac-text-button" disabled={busy || !codes.length} onClick={() => selectGroup(codes)}>{groupSelected ? "Clear available" : "Select all available"}</button></div>
        <div className="rbac-permission-grid">{group.map((permission) => {
          const locked = inheritedSet.has(permission.code);
          const direct = selected.includes(permission.code);
          return <label className={`rbac-permission-option ${locked ? "is-inherited" : ""} ${direct ? "is-selected" : ""}`} key={permission.code}>
            <input type="checkbox" checked={direct || locked} disabled={busy || locked} onChange={() => onChange(toggle(selected, permission.code))} />
            <span className="rbac-permission-content"><strong>{permissionName(permission)}</strong><code>{permission.code}</code><small>{locked ? `Inherited from ${(sources[permission.code] || []).join(", ") || "assigned roles"}` : permissionDescription(permission)}</small></span>
            <span className={`rbac-badge ${locked ? "rbac-badge--neutral" : "rbac-badge--purple"}`}>{locked ? <><LockKeyhole size={12} />Role inherited{direct ? " + direct" : ""}</> : direct ? "Custom added" : "Available"}</span>
          </label>;
        })}</div>
      </section>;
    })}
    {selected.some((code) => inheritedSet.has(code)) && <p className="rbac-hint">Some permissions have both a role grant and a direct grant. Role-inherited permissions stay locked here; both grants remain until their source is removed.</p>}
  </div>;
}
PermissionPicker.propTypes = { catalog: PropTypes.array.isRequired, selected: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, inherited: PropTypes.array, sources: PropTypes.object, busy: PropTypes.bool };
