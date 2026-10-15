import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import toast from "react-hot-toast";
import "../../CSS/Quiz.css";
import { useSelector } from "react-redux";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  BarChart2,
  UserPlus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const MakeContest = () => {
  const user = useSelector((store) => store.app.user);
  const navigate = useNavigate();
  const [contests, setContests] = useState([]);
  const [, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contestToDelete, setContestToDelete] = useState(null);
  const [userRole, setUserRole] = useState(null); // State to store the user role
  const [statusFilter, setStatusFilter] = useState(""); // State for status filter

  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  const getSortIcon = (columnName) => {
    if (sortConfig.key !== columnName) {
      return null;
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="inline w-4 h-4" />
    ) : (
      <ChevronDown className="inline w-4 h-4" />
    );
  };

  const handleAddContest = () => {
    navigate("/create-contest");
  };

  const handleEditContest = (contestId) => {
    navigate(`/create-contest/${contestId}`);
  };

  const handleDeleteContest = async () => {
    try {
      await axiosInstance.delete(`/contests/${contestToDelete}`);
      toast.success("Contest deleted successfully!");
      setShowDeleteModal(false);
      setContestToDelete(null);
      fetchContests();
    } catch (error) {
      toast.error("Error deleting contest!");
      console.error("Error deleting contest:", error);
    }
  };

  const handleDeleteConfirmation = (contestId) => {
    setContestToDelete(contestId);
    setShowDeleteModal(true);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setContestToDelete(null);
  };

  const fetchContests = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/contests");
      console.log("Fetched contests response:", response.data); // Debug statement
      // Assuming the contests are directly in response.data
      setContests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error("Error fetching contests!");
      console.error("Error fetching contests:", error);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchContests();

  }, []);

  useEffect(() => { setUserRole(user.role); }, [user.role]);

  const sortedContests = React.useMemo(() => {
    let sortableContests = Array.isArray(contests) ? [...contests] : [];
    if (sortConfig !== null) {
      sortableContests.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableContests;
  }, [contests, sortConfig]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredContests = sortedContests
    .filter((contest) =>
      contest.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((contest) => {
      if (statusFilter === "") return true;
      return contest?.status === statusFilter;
    });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  const assignContestToStudents = (contestId) => {
    navigate(`/assignContestToStudents/${contestId}`);
  };

  const truncateTitle = (title, maxLength) => {
    return title && title.length > maxLength
      ? `${title.slice(0, maxLength)}...`
      : title || "Untitled";
  };

  return (
    <div className="ui-page-height ui-gradient   text-slate-900">
      {/* Header with gradient */}
      <div className="py-6 px-8 ui-page-top flex items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-900">Contest Bank</h1>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          {/* Add Contest Button (for non-students) */}
          {userRole !== "student" && (
            <button
              onClick={handleAddContest}
              className="flex items-center gap-2 ui-gradient   text-slate-900 font-semibold py-3 px-6 rounded-lg   transition-all shadow-md"
            >
              <Plus className="w-5 h-5" />
              <span>Add Contest</span>
            </button>
          )}

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-slate-600" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="ui-surface text-slate-900 py-3 pl-10 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-48"
              >
                <option value="">All Statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-600" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contests..."
                className="ui-surface text-slate-900 py-3 pl-10 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>
        </div>

        {/* Contests Table */}
        <div className="ui-page rounded-lg ui-card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="ui-surface text-slate-900 text-sm uppercase">
                  <th className="py-4 px-6 text-left">
                    <button
                      onClick={() => handleSort("_id")}
                      className="flex items-center font-semibold"
                    >
                      # {getSortIcon("_id")}
                    </button>
                  </th>
                  <th className="py-4 px-6 text-left">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center font-semibold"
                    >
                      Name {getSortIcon("name")}
                    </button>
                  </th>
                  <th className="py-4 px-6 text-center">
                    <button
                      onClick={() => handleSort("start_time")}
                      className="flex items-center justify-center font-semibold"
                    >
                      Start Date {getSortIcon("start_time")}
                    </button>
                  </th>
                  <th className="py-4 px-6 text-center">
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center justify-center font-semibold"
                    >
                      Status {getSortIcon("status")}
                    </button>
                  </th>
                  {userRole !== "student" && (
                    <th className="py-4 px-6 text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredContests.length > 0 ? (
                  filteredContests.map((contest, index) => (
                    <tr
                      key={contest._id}
                      className="border-t border-slate-200 hover:ui-surface transition-colors"
                    >
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        {index + 1}
                      </td>
                      <td className="py-4 px-6">
                        <div
                          className="capitalize font-semibold text-blue-700 hover:text-blue-700 cursor-pointer transition-colors"
                          onClick={() => navigate(`/contests/${contest._id}`)}
                        >
                          {/* {contest.name} */}
                          {truncateTitle(
                            contest?.name,
                            window.innerWidth < 900 ? 25 : 50
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center text-slate-600 text-sm">
                        {formatDate(contest.start_time)}
                      </td>
                      <td
                        className={`py-4 px-6 text-center ${
                          contest.status === "upcoming"
                            ? "text-yellow-500"
                            : contest.status === "ongoing"
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {contest.status}
                      </td>
                      {userRole !== "student" && (
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditContest(contest._id)}
                              className="p-2 rounded-lg bg-blue-600/20 text-blue-700 hover:bg-blue-600/40 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteConfirmation(contest._id)
                              }
                              className="p-2 rounded-lg bg-red-600/20 text-red-700 hover:bg-red-600/40 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                navigate(`/contests/${contest._id}/dashboard`)
                              }
                              className="p-2 rounded-lg bg-green-600/20 text-green-700 hover:bg-green-600/40 transition-colors"
                              title="Dashboard"
                            >
                              <BarChart2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                assignContestToStudents(contest._id)
                              }
                              className="p-2 rounded-lg bg-purple-600/20 text-blue-700 hover:bg-purple-600/40 transition-colors"
                              title="Assign"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={userRole !== "student" ? 5 : 4}
                      className="py-8 px-6 text-center text-slate-600"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-12 h-12 text-slate-700 mb-3" />
                        <p className="text-lg font-medium">No contests found</p>
                        <p className="text-sm text-slate-600">
                          Try adjusting your search or filter
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
          <div className="ui-surface p-8 rounded-lg w-11/12 max-w-md mx-auto border border-slate-200 ui-card-shadow transform transition-all">
            <div className="flex flex-col items-center">
              <div className="bg-red-500/20 p-3 rounded-full mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-900">
                Confirm Deletion
              </h3>
              <p className="text-slate-600 mb-6 text-center">
                Are you sure you want to delete this contest? This action cannot
                be undone.
              </p>
              <div className="flex gap-4 w-full">
                <button
                  onClick={cancelDelete}
                  className="flex-1 py-3 px-4 ui-surface hover:ui-subtle text-slate-900 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteContest}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-50 text-slate-900 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MakeContest;
