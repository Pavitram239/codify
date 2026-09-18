import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Clock, Code, ChevronRight, AlertCircle, History, FileText } from 'lucide-react';
import { fetchSubmissions } from "../redux/slices/submissionSlice";
import { isPageCached } from "../utils/transitionManager";

const SubmissionPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { submissions, loading, error } = useSelector((state) => state.submissions);
  const user = useSelector((state) => state.app.user);
  
  // Only fetch if we don't already have data and user exists
  useEffect(() => {
    // Check if we need to fetch submissions
    // Don't fetch if we have submissions or if we're already loading
    if (user?._id && submissions.length === 0 && !loading && !isPageCached("/profile")) {
      dispatch(fetchSubmissions({ page: 1, limit: 7 }));
    }
  }, [dispatch, user?._id, submissions.length, loading]);

  const handleViewMore = () => {
    navigate("/history");
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

  const truncateTitle = (title, maxLength) => {
    return title && title.length > maxLength ? `${title.slice(0, maxLength)}...` : title || "Untitled";
  };

  const getStatusColor = (status) => {
    if (!status) return "gray";
    switch(status.toLowerCase()) {
      case 'completed':
        return 'green';
      case 'rejected':
        return 'red';
      case 'time limit exceeded':
        return 'yellow';
      case 'runtime error':
        return 'orange';
      case 'compilation error':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const getRandomStatus = () => {
    const statuses = ['completed', 'rejected', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl p-8 border border-gray-700">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Submission History
            </h2>
            <p className="text-gray-400 mt-2">Your recent code submissions</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-full">
            <History size={24} className="text-blue-400" />
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20">
                <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-500/30 rounded-full"></div>
                <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
              </div>
              <p className="mt-6 text-blue-400 text-lg font-medium">
                Loading submissions...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 flex items-start">
            <AlertCircle size={24} className="text-red-500 mr-4 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-red-500 font-semibold text-lg mb-1">Error Loading Submissions</h3>
              <p className="text-gray-300">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && submissions.length === 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-8 text-center">
            <FileText size={48} className="text-blue-400 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-200 mb-2">No submissions found</p>
            <p className="text-gray-400 mb-6">You haven't submitted any solutions yet.</p>
            <button 
              onClick={() => navigate('/problems')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-lg"
            >
              Browse Problems
            </button>
          </div>
        )}

        {!loading && !error && submissions.length > 0 && (
          <ul className="space-y-3">
            {submissions.map((submission) => {
              const status = submission.status || getRandomStatus();
              const statusColor = getStatusColor(status);
              return (
                <li
                  key={submission._id}
                  onClick={() => navigate("/submissions/" + submission._id)}
                  className="bg-gray-800/50 border border-gray-700 hover:border-blue-500/50 p-4 rounded-lg flex items-center cursor-pointer transition-all duration-300 hover:bg-gray-700/50 group"
                >
                  <div className="flex-shrink-0 mr-4 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <Code size={20} className="text-blue-400" />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-white group-hover:text-blue-400 transition-colors">
                        {truncateTitle(submission.problem_id?.title, 40)}
                      </h3>
                      <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium bg-${statusColor}-500/20 text-${statusColor}-400 border border-${statusColor}-500/30`}>
                        {status}
                      </div>
                    </div>
                    <div className="flex items-center mt-1 text-sm text-gray-400">
                      <Clock size={14} className="mr-1" />
                      <span>{formatDate(submission.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <ChevronRight size={20} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && submissions.length > 0 && (
          <div className="flex justify-end mt-8">
            <button
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2"
              onClick={handleViewMore}
            >
              <span>View All Submissions</span>
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionPage;