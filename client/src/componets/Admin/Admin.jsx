import { can } from "../../utils/permissions";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import toast from "react-hot-toast";
import TemporaryPasswords from "../TemporaryPasswords";
import { BeatLoader } from "react-spinners";
import PropTypes from "prop-types";
import { useApprovalCounts } from "../workspace/approvalCounts";

const Admin = ({ embedded = false }) => {
  const approvalCounts = useApprovalCounts();
  const setCount = approvalCounts?.setCount;
  const user = useSelector((store) => store?.app?.user);
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [credentials, setCredentials] = useState([]);
  const PAGE_SIZE = 10;

  // Only admin allowed
  useEffect(() => {
    if (!can(user, "users.approve_all")) navigate("/");
  }, [user, navigate]);

  // Fetch users with pagination
  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(
        `/admin/get-pending-users?page=${page}`
      );
      if (response?.data?.success) {
        setCount?.("faculty", response.data.total ?? response.data.totalUsers ?? 0);
        setPendingUsers(Array.isArray(response?.data?.data) ? response.data.data : []);
        setTotalPages(response?.data?.totalPages || 0);
      } else {
        setPendingUsers([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("An error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  }, [setCount]);

  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage, fetchUsers]);

  // Accept a single user
  const handleAcceptUser = async (userId) => {
    setActionLoading(userId);
    try {
      const response = await axiosInstance.post(`/admin/accept-request`, {
        userId,
      });
      if (response?.data?.success) {
        setCredentials(response.data.temporaryPasswords || []);
        toast.success("User accepted successfully.");
        setPendingUsers((prev) => prev?.filter((user) => user?._id !== userId));
        approvalCounts?.adjustCount("faculty", -1);
      } else {
        toast.error("Failed to accept user.");
      }
    } catch {
      toast.error("An error occurred while accepting user.");
    } finally {
      setActionLoading(false);
    }
  };

  // Decline a single user
  const handleDeclineUser = async (userId) => {
    setActionLoading(userId);
    try {
      const response = await axiosInstance.post(`/admin/decline-request`, {
        userId,
      });
      if (response?.data?.success) {
        toast.success("User declined successfully.");
        setPendingUsers((prev) => prev?.filter((user) => user?._id !== userId));
        approvalCounts?.adjustCount("faculty", -1);
      } else {
        toast.error("Failed to decline user.");
      }
    } catch {
      toast.error("An error occurred while declining user.");
    } finally {
      setActionLoading(false);
    }
  };

  // Accept all pending users
  const handleAcceptAll = async () => {
    setActionLoading(true);
    try {
      const response = await axiosInstance.post(`/admin/accept-all-requests`);
      if (response?.data?.success) {
        setCredentials(response.data.temporaryPasswords || []);
        toast.success(response?.data?.message);
        setPendingUsers([]);
        fetchUsers(currentPage);
      } else {
        toast.error("Failed to accept all users.");
      }
    } catch {
      toast.error("An error occurred while accepting all users.");
    } finally {
      setActionLoading(false);
    }
  };

  // Decline all pending users
  const handleDeclineAll = async () => {
    setActionLoading(true);
    try {
      const response = await axiosInstance.post(`/admin/decline-all-requests`);
      if (response?.data?.success) {
        toast.success(response?.data?.message);
        setPendingUsers([]);
        fetchUsers(currentPage);
      } else {
        toast.error("Failed to decline all users.");
      }
    } catch {
      toast.error("An error occurred while declining all users.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="ui-page text-slate-900 ui-page-height overflow-hidden">
      <TemporaryPasswords credentials={credentials} onDismiss={() => setCredentials([])} />
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0 mb-4 p-6 ui-page-top">
          {!embedded && <h1 className="text-2xl font-bold">Pending User Requests</h1>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleAcceptAll}
              disabled={pendingUsers?.length === 0}
              className="bg-green-600 text-slate-900 py-2 px-4 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {actionLoading ? (
                <BeatLoader size={10} color="#fff" />
              ) : (
                "Accept All"
              )}
            </button>
            <button
              onClick={handleDeclineAll}
              disabled={pendingUsers?.length === 0}
              className="bg-red-600 text-slate-900 py-2 px-4 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
            >
              {actionLoading ? (
                <BeatLoader size={10} color="#fff" />
              ) : (
                "Decline All"
              )}
            </button>
          </div>
        </div>

        {!embedded && <div className="p-4 flex flex-wrap gap-3">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-slate-900 font-bold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
            onClick={() => navigate("/registerFaculty")}
          >
            Register Faculty
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-slate-900 font-bold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
            onClick={() => navigate("/studentinformation")}
          >
            Student Information
          </button>
          <button
            className="bg-purple-600 hover:bg-purple-700 text-slate-900 font-bold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-purple-300 transition flex items-center gap-2"
            onClick={() => navigate("/session-management")}
          >
            Session Management
          </button>
        </div>}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <BeatLoader size={15} color="#4A90E2" />
          </div>
        ) : (
          <div className="p-4 overflow-x-auto">
            <table className="min-w-full text-sm sm:text-lg text-left text-slate-600">
              <thead className="ui-page text-slate-600">
                <tr>
                  <th className="py-3 px-6">#</th>
                  <th className="py-3 px-6">Email</th>
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">Subject</th>
                  <th className="py-3 px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers?.length > 0 ? (
                  pendingUsers?.map((user, index) => (
                    <tr
                      key={user?._id}
                      className={`${
                        index % 2 === 0 ? "ui-page" : "ui-surface"
                      }`}
                    >
                      <td className="py-3 px-6">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="py-3 px-6 text-slate-600">{user?.email}</td>
                      <td className="capitalize py-3 px-6">{user?.username}</td>
                     
                      <td className="py-3 px-6">{user?.subject}</td>
                      <td className="py-3 px-6 flex gap-2">
                        <button
                          onClick={() => handleAcceptUser(user?._id)}
                          disabled={actionLoading === user?._id}
                          className="bg-green-600 text-slate-900 py-1 px-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {actionLoading === user?._id ? (
                            <BeatLoader size={10} color="#fff" />
                          ) : (
                            "Accept"
                          )}
                        </button>
                        <button
                          onClick={() => handleDeclineUser(user?._id)}
                          disabled={actionLoading === user?._id}
                          className="bg-red-600 text-slate-900 py-1 px-3 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                        >
                          {actionLoading === user?._id ? (
                            <BeatLoader size={10} color="#fff" />
                          ) : (
                            "Decline"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="9"
                      className="py-3 px-6 text-center text-slate-600"
                    >
                      No pending users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-center mt-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="cursor-pointer ui-surface text-slate-900 py-2 px-4 rounded-lg hover:ui-surface transition disabled:opacity-50"
          >
            Previous
          </button>
          <span className="mx-4 mt-1 text-slate-900">{`Page ${currentPage} of ${totalPages}`}</span>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math?.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="cursor-pointer ui-surface text-slate-900 py-2 px-4 rounded-lg hover:ui-surface transition disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
};

Admin.propTypes = { embedded: PropTypes.bool };
export default Admin;
