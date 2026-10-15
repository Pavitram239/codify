import { useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { can } from "../../utils/permissions";
import StudentInfo from "../Admin/StudentInfo";
import StudentList from "../Admin/StudentList";
import { PageHeading } from "./WorkspaceUI";

export default function StudentsPage() {
  const user = useSelector((state) => state.app.user);
  const { facultyId } = useParams();
  const canView = can(user, "users.view_assigned", "users.view_all");
  const canCreate = can(user, "users.create_assigned", "users.create_all");
  return <section>
    <PageHeading context="Codify classroom / People" title="Students" description="View your students and manage registration." />
    {canCreate && <div className="workspace-students-actions">
      <Link className="workspace-button" to="/add-student-using-file?add=1">Add student</Link>
      <Link className="workspace-button workspace-button--secondary" to="/add-student-using-file">Import students</Link>
    </div>}
    {canView ? can(user, "users.view_all") && !facultyId ? <StudentInfo embedded /> : <StudentList embedded facultyId={facultyId || user._id} /> : <p className="workspace-message">Use the actions above to register students.</p>}
  </section>;
}
