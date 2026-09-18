import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchHistory, setCurrentPage } from "../redux/slices/historySlice";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const History = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { history, loading, error, currentPage, totalPages } = useSelector(
    (state) => state.history
  );
  const user = useSelector((state) => state.app.user);

  useEffect(() => {
    if (history.length === 0) {
      dispatch(fetchHistory({ page: currentPage, limit: 9 }));
    }
  }, [dispatch, currentPage, history.length]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      dispatch(setCurrentPage(newPage));
      dispatch(fetchHistory({ page: newPage, limit: 9 }));
    }
  };

  // Utility functions
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const getStatusInfo = (status) => {
    if (!status) return { icon: AlertCircle, color: "gray" };
    switch (status.toLowerCase()) {
      case "completed":
      case "accepted":
        return { icon: CheckCircle, color: "green" };
      case "rejected":
        return { icon: XCircle, color: "red" };
      case "time limit exceeded":
        return { icon: Clock, color: "yellow" };
      case "runtime error":
      case "compilation error":
        return { icon: AlertCircle, color: "orange" };
      default:
        return { icon: AlertCircle, color: "gray" };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white pt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Submission History
            </h1>
            <p className="text-gray-400 mt-2">
              Complete record of your code submissions
            </p>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-full">
            <Code size={28} className="text-blue-400" />
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin h-16 w-16 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-blue-400 text-xl font-medium">
              Loading history...
            </p>
          </div>
        ) : error ? (
          <div className="mb-8 bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle size={24} className="text-red-500 mr-4" />
              <div>
                <h3 className="text-red-500 font-semibold text-lg">
                  Error Loading History
                </h3>
                <p className="text-gray-300">{error}</p>
              </div>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-8 text-center">
            <FileText size={48} className="mx-auto text-blue-400 mb-4" />
            <p className="text-xl font-medium text-gray-200 mb-2">
              No history found
            </p>
            <p className="text-gray-400 mb-6">
              You haven't submitted any solutions yet.
            </p>
            <button
              onClick={() => navigate("/problems")}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-lg"
            >
              Browse Problems
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/80 border-b border-gray-700">
                  <tr>
                    <th className="py-4 px-6 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      #
                    </th>
                    <th className="py-4 px-6 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Problem
                    </th>
                    <th className="py-4 px-6 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Language
                    </th>
                    <th className="py-4 px-6 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Test Cases
                    </th>
                    <th className="py-4 px-6 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-4 px-6 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {history.map((submission, index) => {
                    const { icon: StatusIcon, color } = getStatusInfo(
                      submission.status
                    );
                    return (
                      <tr
                        key={submission._id}
                        onClick={() =>
                          navigate(`/submissions/${submission._id}`)
                        }
                        className="hover:bg-blue-500/5 cursor-pointer transition-colors duration-200"
                      >
                        <td className="py-4 px-6 text-sm font-medium text-gray-300">
                          {index + 1 + (currentPage - 1) * 9}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
                              <Code size={18} className="text-blue-400" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">
                                {submission.problem_id?.title || "Untitled"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-center">
                          <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full bg-gray-700 text-gray-300 capitalize">
                            {submission.language || "Unknown"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm text-center">
                          {submission.numberOfTestCase != null &&
                          submission.numberOfTestCasePass != null ? (
                            <div className="flex items-center justify-center">
                              <div className="relative w-full max-w-[100px] h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                                  style={{
                                    width: `${
                                      (submission.numberOfTestCasePass /
                                        submission.numberOfTestCase) *
                                      100
                                    }%`,
                                  }}
                                ></div>
                              </div>
                              <span className="ml-2 text-xs font-medium">
                                {submission.numberOfTestCasePass}/
                                {submission.numberOfTestCase}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-sm text-center">
                          <div className="flex items-center justify-center">
                            <StatusIcon
                              size={16}
                              className={`text-${color}-500 mr-1.5`}
                            />
                            <span className={`text-${color}-500 capitalize`}>
                              {submission.status || "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-center text-gray-400">
                          <div className="flex items-center justify-center">
                            <Clock size={14} className="mr-1.5" />
                            <span>{formatDate(submission.createdAt)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-400">
                Showing page {currentPage} of {totalPages}
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === 1
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === totalPages
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-500"
                  }`}
                >
                  Next
                  <ChevronRight size={16} className="ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
