import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import toast from "react-hot-toast";
import InitialPasswordButton from "../InitialPasswordButton";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { can } from "../../utils/permissions";
import { Modal } from "../access/AccessUI";
import { errorMessage } from "../../utils/errorMessage";
import "../../CSS/AccessManagement.css";

const StudentList = ({ embedded = false, facultyId: selectedFacultyId }) => {
  const params = useParams();
  const facultyId = selectedFacultyId || params.facultyId;
  const user = useSelector((state) => state.app.user);
  const canManage = (action) => can(user, `${action}_all`) || (String(facultyId) === String(user?._id) && can(user, `${action}_assigned`));
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1); // Total pages from backend
  const studentsPerPage = 10;
  const [totalStudents, setTotalStudents] = useState(0);

  const fetchStudents = useCallback(async (page) => {
    try {
      setLoading(true);
      setError("");
      const response = await axiosInstance.post(
        "/faculty/get-students-by-faculty",
        {
          facultyId,
          page,
          limit: studentsPerPage,
        }
      );
      if (response.data.success) {
        // console.log(response.data);
        setStudents(response.data.students);
        setTotalPages(response.data.totalPages); // Ensure backend sends the total pages
        setTotalStudents(response.data.totalStudents);
      } else {
        setError(response.data.message || "Failed to fetch students.");
      }
    } catch {
      setError("An error occurred while fetching students.");
    } finally {
      setLoading(false);
    }
  }, [facultyId]);

  useEffect(() => {
    fetchStudents(currentPage); // Fetch students when currentPage changes
  }, [fetchStudents, currentPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  const handleExpireSession = async (userId) => {
    try {
      // console.log("Expiring session for user:", userId);
      const response = await axiosInstance.post("/faculty/expire-session", {
        userId,
      });

      if (response.data.success) {
        toast.success("Session expired successfully. The user has been logged out.");
      } else {
        toast.error(response.data.message || "Failed to expire session.");
      }
    } catch (error) {
      console.error("Error expiring session:", error);
      toast.error("An error occurred while expiring the session.");
    }
  };
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axiosInstance.delete(`/faculty/remove-user/${deleteTarget._id}`);
      setDeleteTarget(null);
      toast.success("Student deleted.");
      if (students.length === 1 && currentPage > 1) setCurrentPage(currentPage - 1);
      else await fetchStudents(currentPage);
    } catch (err) {
      toast.error(errorMessage(err.response?.data, "Unable to delete the student."));
    } finally { setDeleting(false); }
  };

  return (
    <div className="relative ui-page-height ui-page text-slate-900">

      {!embedded && <div className="flex justify-center ui-page-top">
        <h1 className="text-2xl font-bold mb-4">Student List</h1>
      </div>}

      {!embedded && <button
        className="py-2 px-6 ml-6 ui-gradient   text-slate-900 font-semibold rounded-lg shadow-md   active:scale-95 transition transform duration-200"
        onClick={() => navigate(-1)}
      >
        Back
      </button>}

      <div className="flex items-center ml-4 text-slate-900 py-2 px-4 rounded-full ui-card-shadow text-lg font-semibold">
        <span>Total Number of Students Register:</span>
        <span className="ml-2 text-xl font-bold">{totalStudents}</span>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-opacity-75"></div>
            <p className="mt-4 text-blue-700 text-lg font-medium">
              Loading, please wait...
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center text-red-500">{error}</div>
      ) : (
        <>
          <div className="overflow-x-auto ui-page shadow-md rounded-lg p-4">
            <table className="min-w-full text-lg text-left text-slate-600">
              <thead className="ui-page text-slate-600">
                <tr>
                  <th className="py-3 px-6">#</th>
                  <th className="py-3 px-6">ID</th>
                  <th className="py-3 px-6">Username</th>
                  <th className="py-3 px-6">Semester</th>
                  <th className="py-3 px-6">Branch</th>
                  <th className="py-3 px-6">Batch</th>
                  <th className="py-3 px-6">Create Date</th>
                  <th className="py-3 px-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="py-3 px-6 text-center text-slate-600"
                    >
                      Data not available
                    </td>
                  </tr>
                ) : (
                  students.map((student, index) => (
                    <tr
                      key={student._id}
                      className={`${
                        index % 2 === 0 ? "ui-page" : "ui-surface"
                      }`}
                    >
                      <td className="py-3 px-6">
                        {(currentPage - 1) * studentsPerPage + index + 1}
                      </td>
                      <td className="py-3 px-6">
                        {student?.id?.toUpperCase()}
                      </td>
                      <td className="capitalize py-3 px-6">
                        {student?.username}
                      </td>
                      <td className="py-3 px-6">{student?.semester}</td>
                      <td className="py-3 px-6">
                        {student?.branch?.toUpperCase()}
                      </td>
                      <td className="py-3 px-6">
                        {student?.batch?.toUpperCase()}
                      </td>

                      <td className="py-3 px-6">
                        {formatDate(student?.createdAt)}{" "}
                      </td>
                      <td className="py-3 px-6">
                      <div className="flex flex-wrap items-center gap-2">
                      {student.firstTimeLogin && canManage("users.issue_password") && <InitialPasswordButton userId={student._id} namespace={can(user, "users.issue_password_all") ? "admin" : "faculty"} />}
                        {canManage("sessions.revoke") && <button
                          onClick={() => handleExpireSession(student._id)}
                          className="bg-blue-500 text-slate-900 py-2 px-4 rounded-lg hover:bg-blue-600 shadow-md transition duration-200 ease-in-out transform hover:scale-105"
                        >
                          Expire Session
                        </button>}
                        {canManage("users.delete") && <button type="button" onClick={() => setDeleteTarget(student)} className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600">Delete</button>}
                      </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="mt-4 flex items-center justify-center">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="ui-surface text-slate-900 py-2 px-4 rounded-lg hover:ui-subtle transition disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-slate-600 pr-2 pl-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="ui-surface text-slate-900 py-2 px-4 rounded-lg hover:ui-subtle transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      {deleteTarget && <Modal title="Delete student?" subtitle={deleteTarget.username} busy={deleting} onClose={() => { if (!deleting) setDeleteTarget(null); }} footer={<>
        <button type="button" className="rbac-button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button>
        <button type="button" className="rbac-button rbac-button--danger-solid" disabled={deleting} onClick={handleDelete}>{deleting ? "Deleting…" : "Delete student"}</button>
      </>}><p>Deleting this student also removes their submissions and code drafts. This cannot be undone.</p></Modal>}
    </div>
  );
};

StudentList.propTypes = { embedded: PropTypes.bool, facultyId: PropTypes.string };
export default StudentList;
