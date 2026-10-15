import { useEffect } from "react";
import { useDispatch } from "react-redux";
import AuthService from "../Auth/auth";
import { setUser } from "../redux/userSlice";
import { can, routePermissions } from "../utils/permissions";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import WorkspaceShell from "./workspace/WorkspaceShell";
import "../CSS/Application.css";

export default function Layout() {
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const result = await AuthService.getCurrentUser();
      if (active && result.authStatus) dispatch(setUser(result.data.user));
    };
    if (pathname !== "/") refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [pathname, dispatch]);
  const user = useSelector((state) => state.app.user);
  if (!user && pathname !== "/") return <Navigate to="/" replace />;
  const required = routePermissions(pathname);
  const denied = user && required.length > 0 && !can(user, ...required);
  const referenceScreen =
    /^\/(browse|make-contest|assessments|create-contest|submissions|access-management|approvals|students)(\/|$)/.test(
      pathname,
    );
  return (
    <WorkspaceShell authentication={pathname === "/"}>
      <div className={referenceScreen ? "" : "application-page"}>
        {denied ? <section className="p-6" role="alert"><h1 className="text-2xl font-semibold">Access denied</h1><p className="mt-3">Your account does not have access to this page.</p></section> : <Outlet />}
      </div>
    </WorkspaceShell>
  );
}
