import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Clock, Code, ChevronRight, AlertCircle, History, FileText } from 'lucide-react';
import { fetchSubmissions } from "../redux/slices/submissionSlice";

const SubmissionPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { submissions, loading, error } = useSelector((state) => state.submissions);
  const user = useSelector((state) => state.app.user);
  
  const userId = user?._id || user?.id;
  // This component owns fetching; the thunk deduplicates requests and caches empty results.
  useEffect(() => {
    if (userId) dispatch(fetchSubmissions({ page: 1, limit: 7 }));
  }, [dispatch, userId]);

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

  return (
    <div className="flex flex-col space-y-4">
      <div className="ui-gradient   rounded-lg ui-card-shadow p-8 border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold  text-slate-900 ui-gradient  ">
              Submission History
            </h2>
            <p className="text-slate-600 mt-2">Your recent code submissions</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-full">
            <History size={24} className="text-blue-700" />
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20">
                <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-500/30 rounded-full"></div>
                <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
              </div>
              <p className="mt-6 text-blue-700 text-lg font-medium">
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
              <p className="text-slate-600">{error}</p>
              <button type="button" className="workspace-link mt-3" disabled={loading} onClick={() => dispatch(fetchSubmissions({ page: 1, limit: 7, force: true }))}>Retry</button>
            </div>
          </div>
        )}

        {!loading && !error && submissions.length === 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-8 text-center">
            <FileText size={48} className="text-blue-700 mx-auto mb-4" />
            <p className="text-xl font-medium text-slate-900 mb-2">No submissions found</p>
            <p className="text-slate-600 mb-6">You haven&apos;t submitted any solutions yet.</p>
            <button 
              onClick={() => navigate('/problems')}
              className="px-6 py-3 bg-blue-600 text-slate-900 rounded-lg hover:bg-blue-700 transition-all duration-300 ui-card-shadow"
            >
              Browse Problems
            </button>
          </div>
        )}

        {!loading && !error && submissions.length > 0 && (
          <ul className="space-y-3">
            {submissions.map((submission) => {
              const status = submission.status || "Unknown";
              const statusColor = getStatusColor(status);
              return (
                <li
                  key={submission._id}
                  onClick={() => navigate("/submissions/" + submission._id)}
                  className="ui-surface border border-slate-200 hover:border-blue-500/50 p-4 rounded-lg flex items-center cursor-pointer transition-all duration-300 hover:ui-surface group"
                >
                  <div className="flex-shrink-0 mr-4 w-10 h-10 rounded-full ui-surface flex items-center justify-center">
                    <Code size={20} className="text-blue-700" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-medium text-slate-900 group-hover:text-blue-700 transition-colors">
                        {truncateTitle(submission.problem_id?.title, 40)}
                      </h3>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium bg-${statusColor}-500/20 text-${statusColor}-400 border border-${statusColor}-500/30`}>
                        {status}
                      </div>
                    </div>
                    <div className="flex items-center mt-1 text-sm text-slate-600">
                      <Clock size={14} className="mr-1" />
                      <span>{formatDate(submission.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <ChevronRight size={20} className="text-slate-600 group-hover:text-blue-700 transition-colors" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && submissions.length > 0 && (
          <div className="flex justify-end mt-8">
            <button
              className="px-6 py-3 ui-gradient     text-slate-900 rounded-lg transition-all duration-300 transform hover:scale-105 ui-card-shadow flex items-center space-x-2"
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
