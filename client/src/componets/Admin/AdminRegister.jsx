import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { BeatLoader } from "react-spinners";

const AdminRegister = () => {
  const user = useSelector((store) => store.app.user);
  const [facultys, setFacultys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState(null);
  const [error, setError] = useState("");
  const [facultyPage, setFacultyPage] = useState(1);
  const [totalFacultyPages, setTotalFacultyPages] = useState(0);
  const [totalFaculty, setTotalFaculty] = useState(0);

  const itemsPerPage = 8;
  const navigate = useNavigate();

  const fetchFacultys = async (page) => {
    try {
      setLoading(true);
      const response = await axiosInstance.post("/admin/get-faculty-by-admin", {
        page,
        limit: itemsPerPage,
      });

      if (response.data.success) {
        // console.log(response.data);
        setFacultys(response.data.facultys);
        setTotalFacultyPages(response.data.totalPages);
        setTotalFaculty(response.data.totalStudents);
      } else {
        setError(response.data.message || "Failed to fetch faculty.");
      }
    } catch (err) {
      setError("An error occurred while fetching faculty.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultys(facultyPage);
  }, [facultyPage]);

  const handleFacultyClick = (facultyId) => {
    navigate(`/students/${facultyId}`);
  };

  const handleTerminateSession = async (e, facultyId, facultyName) => {
    e.stopPropagation();
    setTerminatingId(facultyId);
    try {
      const res = await axiosInstance.post("/admin/terminate-session", {
        userId: facultyId,
      });
      if (res.data.success) {
        toast.success(
          res.data.message || `Session terminated for ${facultyName}`
        );
        setFacultys((prev) =>
          prev.map((f) => (f._id === facultyId ? { ...f, sessionId: null } : f))
        );
      } else {
        toast.error(res.data.message || "Failed to terminate session");
      }
    } catch (err) {
      console.error("Error terminating session:", err);
      toast.error(
        err?.response?.data?.message || "Failed to terminate session"
      );
    } finally {
      setTerminatingId(null);
    }
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

  return (
    <div className="relative min-h-screen bg-gray-900 text-white">
      <div className="flex justify-center pt-[6%]">
        <h1 className="text-2xl font-bold mb-4">Faculty Register</h1>
      </div>

      <button
        className="py-2 px-6 ml-6 bg-gradient-to-r mb-4 from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition transform duration-200"
        onClick={() => navigate(-1)}
      >
        Back
      </button>

      <div className="flex items-center ml-4 text-white py-2 px-4 rounded-full  text-lg font-semibold">
        <span>Total Number of Faculty Register:</span>
        <span className="ml-2 text-xl font-bold">{totalFaculty}</span>
      </div>

      <div>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-opacity-75"></div>
              <p className="mt-4 text-blue-500 text-lg font-medium">
                Loading, please wait...
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 overflow-x-auto">
            <table className="min-w-full text-lg text-left text-gray-500">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="py-3 px-6">#</th>
                  <th className="py-3 px-6">Username</th>
                  <th className="py-3 px-6">Email</th>
                  <th className="py-3 px-6">Branch</th>
                  <th className="py-3 px-6">Subject</th>
                  <th className="py-3 px-6">Session</th>
                  <th className="py-3 px-6">Create Date</th>
                  <th className="py-3 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {facultys.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="py-3 px-6 text-center text-gray-400"
                    >
                      Data not available
                    </td>
                  </tr>
                ) : (
                  facultys.map((faculty, index) => (
                    <tr
                      key={faculty._id}
                      onClick={() => handleFacultyClick(faculty._id)}
                      className={`cursor-pointer ${
                        index % 2 === 0 ? "bg-gray-900" : "bg-gray-800"
                      } hover:bg-gray-700/50 transition`}
                    >
                      <td className="py-3 px-6">{index + 1}</td>
                      <td className="py-3 px-6 text-white font-medium">
                        {faculty.username}
                      </td>
                      <td className="py-3 px-6">{faculty.email}</td>
                      <td className="py-3 px-6">
                        {faculty?.branch?.toUpperCase()}
                      </td>
                      <td className="py-3 px-6">{faculty.subject}</td>
                      <td className="py-3 px-6">
                        {faculty.sessionId ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-sm">
                        {formatDate(faculty.createdAt)}
                      </td>
                      <td className="py-3 px-6 text-center">
                        <button
                          onClick={(e) =>
                            handleTerminateSession(
                              e,
                              faculty._id,
                              faculty.username
                            )
                          }
                          disabled={
                            !faculty.sessionId ||
                            terminatingId === faculty._id
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            faculty.sessionId
                              ? "bg-red-600 hover:bg-red-700 text-white shadow"
                              : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/40"
                          }`}
                        >
                          {terminatingId === faculty._id ? (
                            <BeatLoader size={6} color="#fff" />
                          ) : (
                            "Terminate Session"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRegister;
