import React from "react";
import { useNavigate } from "react-router-dom";

const SubmissionList = ({ submissions, onSelect, loading, error }) => {
  const navigate = useNavigate();
  return (
    <div>
      <h3 className="font-bold text-xl text-white mb-2">Submissions</h3>
      <p className="text-gray-400 mb-4">
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
              className="min-w-full text-gray-200 border-separate"
              style={{ borderSpacing: "0 15px" }}
            >
              <thead>
                <tr className="bg-gray-700 text-gray-300 uppercase text-sm">
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
                    className="transition duration-200 ease-in-out hover:bg-gray-900 rounded-lg hover:cursor-pointer"
                  >
                    <td className="px-4 py-2 font-semibold text-center capitalize">
                      <span
                        className={`px-2 py-1 rounded ${
                          submission.status === "completed"
                            ? "bg-green-600 text-green-200"
                            : "bg-red-600 text-red-200"
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
                    <td className="px-4 py-2 text-gray-400 text-center">
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
            <p className="text-gray-400 text-center mt-4">
              No submissions found.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmissionList;
