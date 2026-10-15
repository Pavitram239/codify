import { useEffect, useState, useCallback } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import InitialPasswordButton from "../InitialPasswordButton";

const FacultyRegister = () => {
  const user = useSelector((store) => store.app.user);
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const studentsPerPage = 10;
  const [totalPages, setTotalPages] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userId, setuserId] = useState(null);

  const fetchStudents = useCallback(async (page) => {
    try {
      setLoading(true);
      const response = await axiosInstance.post(
        "/faculty/get-students-by-faculty",
        {
          facultyId: user._id,
          page,
          limit: studentsPerPage,
        }
      );

      if (response.data.success) {
        setStudents(response.data.students);
        setTotalStudents(response.data.totalStudents);
        setTotalPages(response.data.totalPages);
      } else {
        setError(response.data.message || "Failed to fetch students.");
      }
    } catch {
      setError("An error occurred while fetching students.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStudents(currentPage);
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

  const openDeleteModal = (studentId) => {
    setuserId(studentId);
    setShowDeleteModal(true);
  };

  const cancelDelete = () => {
    setuserId(null);
    setShowDeleteModal(false);
  };

  const handleDelete = async () => {
    try {
      // console.log(userId)
      const response = await axiosInstance.delete(
        `/faculty/remove-user/${userId}`
      );

      // console.log(response.data);
      if (response.data.success) {
        toast.success(response.data.message);
        fetchStudents(currentPage);
      } else {
        toast.error(response.data.message || "Failed to remove the user.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error in removing user.");
    } finally {
      cancelDelete();
    }
  };

  return (
    <div className="relative ui-page-height ui-page text-slate-900">

      <div className="flex justify-center ui-page-top">
        <h1 className="text-2xl font-bold mb-4">Student Register</h1>
      </div>

      <button
        className="py-2 px-6 ml-6 ui-gradient mb-4   text-slate-900 font-semibold rounded-lg shadow-md   active:scale-95 transition transform duration-200"
        onClick={() => navigate(-1)}
      >
        Back
      </button>

      <div className="flex items-center ml-4 text-slate-900 py-2 px-4 rounded-full ui-card-shadow text-lg font-semibold">
        <span>Total Number of Students Register:</span>
        <span className="ml-2 text-xl font-bold">{totalStudents}</span>
      </div>

      <div>
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
          <p className="text-red-500">{error}</p>
        ) : (
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
                {students.map((student, index) => (
                  <tr
                    key={student._id}
                    className={`${
                      index % 2 === 0 ? "ui-page" : "ui-surface"
                    }`}
                  >
                    <td className="py-3 px-6">
                      {(currentPage - 1) * studentsPerPage + index + 1}
                    </td>
                    <td className="py-3 px-6">{student?.id?.toUpperCase()}</td>
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

                    <td className="py-3">{formatDate(student?.createdAt)} </td>
                    <td className="py-3 px-6">
                      {student.firstTimeLogin && <InitialPasswordButton userId={student._id} namespace="faculty" />}
                      <button
                        onClick={() => openDeleteModal(student._id)}
                        className="bg-red-600 text-slate-900 py-1 px-3 rounded-lg hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
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
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="ui-surface p-6 sm:p-8 rounded-lg w-11/12 max-w-md sm:max-w-lg mx-auto">
            <h3 className="text-slate-900 text-lg sm:text-xl font-bold mb-4 text-center">
              Confirm Deletion
            </h3>
            <p className="text-slate-600 mb-4 text-sm sm:text-base text-center">
              Are you sure you want to delete this student? This action cannot
              be undone.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={cancelDelete}
                className="ui-subtle text-slate-900 py-2 px-4 sm:py-2.5 sm:px-6 rounded-lg hover:ui-subtle transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-500 text-slate-900 py-2 px-4 sm:py-2.5 sm:px-6 rounded-lg hover:bg-red-600 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyRegister;
