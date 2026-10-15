import { can, canResource } from "../../utils/permissions";
import { useState, useEffect, useMemo } from "react";
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
  Sparkles,
} from "lucide-react";

const MakeProblem = () => {
  const user = useSelector((store) => store.app.user);
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [, setLoading] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [problemToDelete, setProblemToDelete] = useState(null);
  const staffActions = can(user, "problems.edit_own", "problems.edit_all", "problems.delete_own", "problems.delete_all", "problems.assign_shared", "problems.assign_all", "submissions.review_own", "submissions.review_all");
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  useEffect(() => {
    fetchProblems();
  }, [user]);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/problems/`);
      const allProblems = Array.isArray(response.data?.problems) ? response.data.problems : [];
      console.log(allProblems);
      
      setProblems(allProblems);
    } catch (error) {
      toast.error("Error fetching problems!");
      console.error("Error fetching problems:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProblem = () => {
    navigate("/problem-form");
  };

  const handleEditProblem = (problemId) => {
    navigate(`/problem-form/${problemId}`);
  };

  const handleDeleteProblem = async () => {
    try {
      await axiosInstance.delete(`/problems/${problemToDelete}`);
      toast.success("Problem deleted successfully!");
      setShowDeleteModal(false);
      setProblemToDelete(null);
      fetchProblems();
    } catch (error) {
      toast.error("Error deleting problem!");
      console.error("Error deleting problem:", error);
    }
  };

  const handleDeleteConfirmation = (problemId) => {
    setProblemToDelete(problemId);
    setShowDeleteModal(true);
  };

  const handleDashboardConfirmation = (problemId, title, difficulty, createdAt) => {
    navigate(`/dashboard/${problemId}`, {
      state: {
        problemTitle: title,
        difficulty: difficulty,
        createdAt: createdAt,
      },
    });
  };

  const assignProblem = (problemId) => {
    navigate(`/assignProblem/${problemId}`);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProblemToDelete(null);
  };

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

  const sortedProblems = useMemo(() => {
    let sortableProblems = [...problems];
    if (sortConfig !== null) {
      sortableProblems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableProblems;
  }, [problems, sortConfig]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredProblems = sortedProblems
    .filter((problem) =>
      difficultyFilter === "All"
        ? true
        : (problem?.difficulty || "").toLowerCase() === difficultyFilter.toLowerCase()
    )
    .filter((problem) =>
      (problem?.title || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  const truncateTitle = (title, maxLength) => {
    return title && title.length > maxLength
      ? `${title.slice(0, maxLength)}...`
      : title || "Untitled";
  };

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  return (
    <div className="ui-page-height ui-gradient   text-slate-900">
      <div className="py-6 px-8 ui-page-top flex justify-center items-center">
        <h1 className="text-3xl font-bold text-slate-900">
          {!can(user, "problems.view_shared", "problems.view_all") ? "Assigned Problems" : "Problem Bank"}
        </h1>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          {can(user, "problems.create") && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleCreateProblem}
                className="flex items-center gap-2 ui-gradient   text-slate-900 font-semibold py-3 px-6 rounded-lg   transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>Add Problem</span>
              </button>
              <button
                onClick={() => navigate("/problem-form?openAI=true")}
                className="flex items-center gap-2 ui-gradient    text-slate-900 font-semibold py-3 px-5 rounded-lg   transition-all shadow-md shadow-indigo-600/25 cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-yellow-700 animate-pulse" />
                <span>✨ Create with AI</span>
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-slate-600" />
              </div>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="ui-surface text-slate-900 py-3 pl-10 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-48"
              >
                <option value="All">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
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
                placeholder="Search problems..."
                className="ui-surface text-slate-900 py-3 pl-10 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>
        </div>

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
                      onClick={() => handleSort("title")}
                      className="flex items-center font-semibold"
                    >
                      Title {getSortIcon("title")}
                    </button>
                  </th>
                  <th className="py-4 px-6 text-center">
                    <button
                      onClick={() => handleSort("difficulty")}
                      className="flex items-center justify-center font-semibold"
                    >
                      Difficulty {getSortIcon("difficulty")}
                    </button>
                  </th>
                  <th className="py-4 px-6 text-center">
                    <button
                      onClick={() => handleSort("createdAt")}
                      className="flex items-center justify-center font-semibold"
                    >
                      Created Date {getSortIcon("createdAt")}
                    </button>
                  </th>
                  {staffActions && (
                    <th className="py-4 px-6 text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredProblems.length > 0 ? (
                  filteredProblems.map((problem, index) => (
                    <tr
                      key={problem._id}
                      className="border-t border-slate-200 hover:ui-surface transition-colors"
                    >
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        {index + 1}
                      </td>
                      <td
                        className="py-4 px-6"
                        onClick={() => navigate(`/problems/${problem._id}`)}
                      >
                        <div className="font-semibold capitalize text-blue-700 hover:text-blue-700 cursor-pointer transition-colors">
                          {truncateTitle(
                            problem?.title,
                            window.innerWidth < 900 ? 25 : 50
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium ${
                            problem.difficulty === "easy"
                              ? "bg-green-50 text-green-700 border border-green-500/30"
                              : problem.difficulty === "medium"
                              ? "bg-yellow-50 text-yellow-700 border border-yellow-500/30"
                              : "bg-red-50 text-red-700 border border-red-500/30"
                          }`}
                        >
                          {(problem?.difficulty || "easy").charAt(0).toUpperCase() +
                            (problem?.difficulty || "easy").slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center text-slate-600 text-sm">
                        {formatDate(problem.createdAt)}
                      </td>
                      {staffActions && (
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-2 rounded-lg bg-blue-600/20 text-blue-700 hover:bg-blue-600/40 transition-colors"
                              title="Edit"
                              disabled={!(canResource(user, "problems", "edit", problem))}
                              onClick={() => handleEditProblem(problem._id)}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 rounded-lg bg-red-600/20 text-red-700 hover:bg-red-600/40 transition-colors"
                              title="Delete"
                              disabled={!(canResource(user, "problems", "delete", problem))}
                              onClick={() =>
                                handleDeleteConfirmation(problem._id)
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 rounded-lg bg-green-600/20 text-green-700 hover:bg-green-600/40 transition-colors"
                              title="Dashboard"
                              disabled={!(can(user, "submissions.review_all") || (can(user, "submissions.review_own") && String(problem.created_by?.id) === String(user?._id)))}
                              onClick={() =>
                                handleDashboardConfirmation(
                                  problem._id,
                                  problem.title,
                                  problem.difficulty,
                                  problem.createdAt
                                )
                              }
                            >
                              <BarChart2 className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 rounded-lg bg-purple-600/20 text-blue-700 hover:bg-purple-600/40 transition-colors"
                              title="Assign"
                              disabled={!(canResource(user, "problems", "assign", problem))}
                              onClick={() => assignProblem(problem._id)}
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
                      colSpan={staffActions ? 5 : 4}
                      className="py-8 px-6 text-center text-slate-600"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-12 h-12 text-slate-700 mb-3" />
                        <p className="text-lg font-medium">No problems found</p>
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
                Are you sure you want to delete this problem? This action cannot
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
                  onClick={handleDeleteProblem}
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

export default MakeProblem;