import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axiosInstance from "../../utils/axiosInstance";
import toast from "react-hot-toast";
import { BeatLoader } from "react-spinners";
import { Search, ShieldAlert, UserX, RefreshCw } from "lucide-react";

const SessionManagement = () => {
  const user = useSelector((store) => store.app.user);
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeSessionsCount, setActiveSessionsCount] = useState(0);

  const PAGE_SIZE = 10;

  // Only admin allowed
  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const fetchUsers = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: PAGE_SIZE.toString(),
          search: search.trim(),
          role: roleFilter,
          status: statusFilter,
        });

        const res = await axiosInstance.get(
          `/admin/users-sessions?${queryParams.toString()}`
        );

        if (res.data.success) {
          setUsers(res.data.users || []);
          setTotalPages(res.data.totalPages || 1);
          setTotalUsers(res.data.totalUsers || 0);
          setActiveSessionsCount(res.data.activeSessionsCount || 0);
        } else {
          toast.error(res.data.message || "Failed to fetch user sessions.");
        }
      } catch (error) {
        console.error("Error fetching user sessions:", error);
        toast.error("Failed to load user sessions.");
      } finally {
        setLoading(false);
      }
    },
    [search, roleFilter, statusFilter]
  );

  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage, fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers(1);
  };

  const handleTerminateSession = async (targetUser) => {
    setTerminatingId(targetUser._id);
    try {
      const res = await axiosInstance.post("/admin/terminate-session", {
        userId: targetUser._id,
      });

      if (res.data.success) {
        toast.success(
          res.data.message ||
            `Session terminated for ${targetUser.username || targetUser.id}.`
        );
        // Update local state instantly
        setUsers((prev) =>
          prev.map((u) =>
            u._id === targetUser._id ? { ...u, hasActiveSession: false } : u
          )
        );
        setActiveSessionsCount((prev) => Math.max(0, prev - 1));
      } else {
        toast.error(res.data.message || "Failed to terminate session.");
      }
    } catch (error) {
      console.error("Error terminating session:", error);
      toast.error(
        error?.response?.data?.message || "An error occurred while terminating session."
      );
    } finally {
      setTerminatingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Never";
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pt-24 px-4 sm:px-8 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header and Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="text-blue-400" size={32} />
              Session Management
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Terminate active sessions for locked-out students (e.g., closed incognito tabs). Admin and faculty accounts support multi-device sessions.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => fetchUsers(currentPage)}
              disabled={loading}
              className="flex items-center gap-2 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg border border-gray-700 transition"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => navigate("/pending-requests")}
              className="py-2 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition active:scale-95"
            >
              Back to Admin
            </button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800/80 border border-gray-700/60 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-white mt-1">{totalUsers}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              {totalUsers}
            </div>
          </div>
          <div className="bg-gray-800/80 border border-gray-700/60 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-green-400">Active Sessions</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{activeSessionsCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center font-bold">
              ⚡
            </div>
          </div>
          <div className="bg-gray-800/80 border border-gray-700/60 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-400">Inactive Users</p>
              <p className="text-2xl font-bold text-gray-300 mt-1">
                {Math.max(0, totalUsers - activeSessionsCount)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-700/30 text-gray-400 flex items-center justify-center font-bold">
              💤
            </div>
          </div>
        </div>

        {/* Filter and Search Controls */}
        <div className="bg-gray-800/60 border border-gray-700/60 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 w-full md:max-w-md relative"
          >
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, Email, Username..."
              className="w-full pl-10 pr-24 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium px-3 py-1.5 rounded-md transition"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Role Filter */}
            <div className="flex bg-gray-900 border border-gray-700 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRoleFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  roleFilter === "all"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                All Roles
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoleFilter("student");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  roleFilter === "student"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Students
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoleFilter("faculty");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  roleFilter === "faculty"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Faculty
              </button>
            </div>

            {/* Session Status Filter */}
            <div className="flex bg-gray-900 border border-gray-700 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  statusFilter === "all"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                All Sessions
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("active");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  statusFilter === "active"
                    ? "bg-green-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Active Only
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <BeatLoader size={14} color="#3B82F6" />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-12 text-center text-gray-400">
            <UserX className="mx-auto text-gray-500 mb-3" size={48} />
            <p className="text-lg font-medium">No users found</p>
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-800/80 text-gray-400 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">User ID / Email</th>
                    <th className="py-3.5 px-4">Username</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Branch / Batch</th>
                    <th className="py-3.5 px-4">Last Login</th>
                    <th className="py-3.5 px-4">Session Status</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((u, idx) => (
                    <tr
                      key={u._id}
                      className="hover:bg-gray-800/40 transition duration-150"
                    >
                      <td className="py-3.5 px-4 text-gray-500 font-mono">
                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">
                          {u.id || u.email}
                        </div>
                        {u.id && u.email && (
                          <div className="text-xs text-gray-400">{u.email}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-gray-200">
                        {u.username}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                            u.role === "admin"
                              ? "bg-purple-900/60 text-purple-300 border border-purple-700/50"
                              : u.role === "faculty"
                              ? "bg-blue-900/60 text-blue-300 border border-blue-700/50"
                              : "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-400">
                        {u.branch ? u.branch.toUpperCase() : "—"}{" "}
                        {u.batch ? `(${u.batch.toUpperCase()})` : ""}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {formatDate(u.lastLoginTime)}
                      </td>
                      <td className="py-3.5 px-4">
                        {u.hasActiveSession ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Active Session
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleTerminateSession(u)}
                          disabled={
                            !u.hasActiveSession || terminatingId === u._id
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            u.hasActiveSession
                              ? "bg-red-600 hover:bg-red-700 text-white shadow hover:scale-105 active:scale-95 cursor-pointer"
                              : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/40"
                          }`}
                        >
                          {terminatingId === u._id ? (
                            <BeatLoader size={6} color="#fff" />
                          ) : (
                            "Terminate Session"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-t border-gray-800 text-sm">
                <span className="text-gray-400">
                  Page <strong className="text-white">{currentPage}</strong> of{" "}
                  <strong className="text-white">{totalPages}</strong>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs font-medium"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionManagement;
