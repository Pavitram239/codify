import PropTypes from "prop-types";

import { useNavigate } from "react-router-dom";

const SubmissionList = ({ submissions, loading }) => {
  const navigate = useNavigate();
  return (
    <div>
      <h3 className="font-bold text-xl text-slate-900 mb-2">Submissions</h3>
      <p className="text-slate-600 mb-4">
        Here, you can view your previous submissions for this problem.
      </p>
      {/* {error && <p className="text-red-500 text-center mb-4">{error}</p>} */}
      {loading ? (
        <div className="flex justify-center items-center my-4">
          <div className="spinner-border animate-spin border-t-4 border-blue-600 border-solid rounded-full w-12 h-12"></div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          {submissions.length > 0 ? (
            <table
              className="min-w-full text-slate-900 border-separate"
              style={{ borderSpacing: "0 15px" }}
            >
              <thead>
                <tr className="ui-surface text-slate-600 uppercase text-sm">
                  <th className="px-4 py-3 rounded-l-lg">Status</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3 items-center justify-center">
                     Runtime
                  </th>
                  <th className="px-4 py-3">
                     Memory
                  </th>
                  <th className="px-4 py-3 rounded-r-lg">Date</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr
                    key={submission._id}
                    onClick={() => navigate("/submissions/" + submission._id)}
                    className="transition duration-200 ease-in-out hover:ui-page rounded-lg hover:cursor-pointer"
                  >
                    <td className="px-4 py-2 font-semibold text-center capitalize">
                      <span
                        className={`px-2 py-1 rounded ${
                          submission.status === "completed"
                            ? "bg-green-600 text-green-700"
                            : "bg-red-600 text-red-700"
                        }`}
                      >
                        {submission.status === "completed"
                          ? "Accepted"
                          : "Rejected"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center capitalize">
                      {submission.language}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {submission.execution_time
                        ? `${submission.execution_time.toFixed(2)} ms`
                        : "N/A"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {submission.memory_usage
                        ? `${submission.memory_usage.toFixed(2)} MB`
                        : "N/A"}
                    </td>
                    <td className="px-4 py-2 text-slate-600 text-center">
                      {submission.createdAt
                        ? new Date(submission.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )
                        : "Invalid Date"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-600 text-center mt-4">
              No submissions found.
            </p>
          )}
        </div>
      )}
    </div>
  );
};


SubmissionList.propTypes = {
  submissions: PropTypes.array,
  onSelect: PropTypes.func,
  loading: PropTypes.bool,
  error: PropTypes.string,
};

export default SubmissionList;
