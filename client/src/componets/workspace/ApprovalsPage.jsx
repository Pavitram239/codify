import { useSelector } from "react-redux";
import { Link, Navigate, useParams } from "react-router-dom";
import { can } from "../../utils/permissions";
import Admin from "../Admin/Admin";
import Faculty from "../Faculty/Faculty";
import { PageHeading } from "./WorkspaceUI";
import { useApprovalCounts } from "./approvalCounts";

export default function ApprovalsPage() {
  const user = useSelector((state) => state.app.user);
  const { kind } = useParams();
  const { counts } = useApprovalCounts();
  const tabs = [
    { kind: "faculty", label: "Faculty requests", allowed: can(user, "users.approve_all") },
    { kind: "students", label: "Student requests", allowed: can(user, "users.approve_assigned", "users.approve_all") },
  ].filter((tab) => tab.allowed);
  if (!tabs.some((tab) => tab.kind === kind)) return <Navigate to={`/approvals/${tabs[0]?.kind || "students"}`} replace />;
  return <section>
    <PageHeading context="Codify classroom / People" title="Approvals" description="Review pending faculty and student requests." />
    <nav className="workspace-tabs" aria-label="Approval categories">
      {tabs.map((tab) => <Link className="workspace-tab" key={tab.kind} to={`/approvals/${tab.kind}`} aria-current={kind === tab.kind ? "page" : undefined}>
        {tab.label}{counts[tab.kind] !== null && <span className="workspace-nav-count" aria-label={`${counts[tab.kind]} pending ${counts[tab.kind] === 1 ? "request" : "requests"}`}>{counts[tab.kind]}</span>}
      </Link>)}
    </nav>
    <section className="workspace-approvals-content" aria-label={kind === "faculty" ? "Faculty requests" : "Student requests"}>
      {kind === "faculty" ? <Admin embedded /> : <Faculty embedded />}
    </section>
  </section>;
}
