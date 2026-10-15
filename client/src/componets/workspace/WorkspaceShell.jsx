import { destinationActive, workspaceNavigation } from "../../utils/workspaceNavigation";
import { ApprovalCountsContext, usePendingApprovals } from "./approvalCounts";
import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { logout } from "../../redux/userSlice";
import { logoutSubmissions } from "../../redux/slices/submissionSlice";
import { logoutHistory } from "../../redux/slices/historySlice";
import { persistor } from "../../redux/store";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "../../CSS/Workspace.css";

export default function WorkspaceShell({ children, authentication = false }) {
  const user = useSelector((state) => state.app.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const closeButton = useRef(null);
  const menuButton = useRef(null);
  const name = user?.profile?.name || user?.username || "Your account";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const context = user?.subject || user?.branch || "Coding assessments";
  const navigation = workspaceNavigation(user);
  const approvals = usePendingApprovals(user, location.pathname);
  const activeGroupId = navigation.groups.find((group) => group.items.some((item) => destinationActive(item.to, location.pathname)))?.id;
  useEffect(() => {
    if (activeGroupId) setOpenGroups((previous) => previous[activeGroupId] ? previous : { ...previous, [activeGroupId]: true });
  }, [activeGroupId, location.pathname]);
  const navLink = (item) => {
    const active = destinationActive(item.to, location.pathname);
    return <Link key={item.to} to={item.to} className={`workspace-nav-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
      <span>{item.label}</span>
      {item.to === "/approvals" && approvals.total > 0 && <span className="workspace-nav-count" aria-label={`${approvals.total} pending ${approvals.total === 1 ? "request" : "requests"}`}>{approvals.total}</span>}
    </Link>;
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!user && !authentication) navigate("/", { replace: true });
  }, [user, authentication, navigate]);
  useEffect(() => {
    if (!menuOpen) return;
    closeButton.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab" && window.innerWidth < 768) {
        const controls = [...document.querySelectorAll(
          "#workspace-navigation a[href], #workspace-navigation button",
        )].filter((element) => !element.disabled && element.getClientRects().length > 0);
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls[controls.length - 1]?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === controls[controls.length - 1]
        ) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  const signOut = async () => {
    try {
      await axiosInstance.post("auth/logout");
      localStorage.removeItem("UserToken");
      dispatch(logoutSubmissions());
      dispatch(logoutHistory());
      dispatch(logout());
      await persistor.purge();
      navigate("/");
    } catch {
      toast.error("Unable to sign out. Please try again.");
    }
  };

  return (
    <div
      className={`workspace ${authentication ? "workspace--authentication" : ""}`}
    >
      <a className="workspace-skip" href="#workspace-main">
        Skip to content
      </a>
      <div className="workspace-safe-area" />
      <header className="workspace-topbar">
        <Link className="workspace-brand" to={user ? "/browse" : "/"}>
          {"{ }"} <span>Codify</span>
        </Link>
        {!authentication && (
          <button
            ref={menuButton}
            className="workspace-icon-button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <img src="/design/menu.svg" alt="" />
          </button>
        )}
        <Link
          className="workspace-profile"
          to={user ? "/profile" : "/"}
          aria-label={user ? `Account for ${name}` : "Sign in"}
        >
          {user ? initials : "Sign in"}
        </Link>
      </header>
      {menuOpen && (
        <button
          className="workspace-scrim"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="workspace-shell">
        {!authentication && (
          <aside
            id="workspace-navigation"
            className={`workspace-sidebar ${menuOpen ? "is-open" : ""}`}
          >
            <button
              ref={closeButton}
              className="workspace-menu-close"
              onClick={() => {
                setMenuOpen(false);
                menuButton.current?.focus();
              }}
            >
              Close menu ×
            </button>
            <p className="workspace-organisation">
              {user?.institution || "Codify classroom"}
            </p>
            <p className="workspace-class-label">
              {context}
              {user?.batch ? ` · cohort ${user.batch.toUpperCase()}` : ""}
            </p>
            <nav aria-label="Main navigation">
              {navigation.main.map(navLink)}
              {navigation.groups.map((group) => {
                const expanded = openGroups[group.id] ?? activeGroupId === group.id;
                return <div className="workspace-nav-group" key={group.id}>
                  <button type="button" className={`workspace-nav-link workspace-nav-toggle ${activeGroupId === group.id ? "has-active-page" : ""}`} aria-label={group.label} aria-expanded={expanded} aria-controls={`navigation-${group.id}`} onClick={() => setOpenGroups((previous) => ({ ...previous, [group.id]: !expanded }))}>
                    <span>{group.label}</span>
                    {group.id === "people" && approvals.total > 0 && <span className="workspace-nav-count" aria-hidden="true">{approvals.total}</span>}
                    <svg className="workspace-nav-chevron" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </button>
                  <div id={`navigation-${group.id}`} className="workspace-nav-subitems" hidden={!expanded}>{group.items.map(navLink)}</div>
                </div>;
              })}
            </nav>
            <div className="workspace-sidebar-footer">
            <nav aria-label="Account and help">{navigation.footer.map(navLink)}</nav>
            <p className="workspace-signed-in">
              {user
                ? `Signed in as ${name}`
                : "Sign in to access your classroom"}
            </p>
            {user ? (
              <button
                className="workspace-link workspace-signout"
                onClick={signOut}
              >
                Sign out
              </button>
            ) : (
              <Link className="workspace-link" to="/">
                Sign in
              </Link>
            )}
            </div>
          </aside>
        )}
        <main id="workspace-main" className="workspace-main" tabIndex={-1}>
          <ApprovalCountsContext.Provider value={approvals}>{children}</ApprovalCountsContext.Provider>
        </main>
      </div>
      {!authentication && (
        <nav className="workspace-bottomnav" aria-label="Mobile navigation">
          {navigation.mobile.map(({ label, to, icon }) => (
            <Link
              to={to}
              key={label}
              className={destinationActive(to, location.pathname) ? "is-active" : ""}
              aria-current={destinationActive(to, location.pathname) ? "page" : undefined}
            >
              <img src={`/design/${icon}.svg`} alt="" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

WorkspaceShell.propTypes = {
  children: PropTypes.node,
  authentication: PropTypes.bool,
};
