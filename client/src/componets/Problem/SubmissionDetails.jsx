import React, { useState } from "react";
import PropTypes from "prop-types";

const SubmissionDetails = ({ submission, onBack }) => {
  const [expandedCase, setExpandedCase] = useState(null); // Default: No case expanded
  // console.log(submission);

  const safeAccess = (obj, path, defaultValue = "N/A") => {
    try {
      return path.reduce(
        (acc, key) => (acc && acc[key] !== undefined ? acc[key] : defaultValue),
        obj
      );
    } catch {
      return defaultValue;
    }
  };

  const toggleExpand = (index) => {
    setExpandedCase(expandedCase === index ? null : index);
  };

  const isLoaded = submission && Object.keys(submission).length > 0;

  return (
    <div className="bg-gray-900 min-h-screen p-4">
      {/* Back Button */}
      <button
        className="mb-4 bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-500"
        onClick={onBack}
      >
        Back to Submissions
      </button>

      <h3 className="font-bold text-xl text-white mb-4">
        Submission Details :{" "}
        <span className="text-blue-400">
          {safeAccess(submission, ["problem_id", "title"], "Problem Title Unavailable")}
        </span>
      </h3>

      {isLoaded ? (
        <>
          {/* Test Case Overview */}
          <div className="mb-6 bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <span className="text-lg font-semibold text-white">
              Test Cases: {safeAccess(submission, ["numberOfTestCasePass"], 0)}/
              {safeAccess(submission, ["numberOfTestCase"], 0)} Passed
            </span>
            <span
              className={`px-3 py-1 rounded ${
                safeAccess(submission, ["numberOfTestCase"]) ===
                safeAccess(submission, ["numberOfTestCasePass"])
                  ? "bg-green-600"
                  : "bg-red-600"
              } text-white`}
            >
              {safeAccess(submission, ["numberOfTestCase"]) ===
              safeAccess(submission, ["numberOfTestCasePass"])
                ? "All Passed"
                : "Some Failed"}
            </span>
          </div>

          {/* Marks and Details */}
          <div className="mb-6 bg-gray-800 p-4 rounded-lg">
            <span className="text-lg font-semibold text-white">
              Total Marks: {safeAccess(submission, ["totalMarks"], "Not Available")}
            </span>
          </div>

          {/* Runtime and Memory */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-900 rounded-lg text-center shadow">
              <p className="text-gray-300">Runtime</p>
              <p className="text-xl text-white font-bold">
                {safeAccess(submission, ["execution_time"], 0).toFixed(2)} ms
              </p>
            </div>
            <div className="p-4 bg-gray-900 rounded-lg text-center shadow">
              <p className="text-gray-300">Memory</p>
              <p className="text-xl text-white font-bold">
                {safeAccess(submission, ["memory_usage"], 0).toFixed(2)} MB
              </p>
            </div>
          </div>

          {/* Code Block */}
          <div className="mb-6 bg-gray-800 p-4 rounded-lg">
            <p className="text-white mb-2 font-bold">Code:</p>
            <pre className="bg-gray-900 p-4 rounded text-gray-100 overflow-auto text-sm">
              {safeAccess(submission, ["code"], "No code available")}
            </pre>
          </div>

          {/* Test Cases */}
          <h4 className="text-lg text-white mb-4">Test Cases</h4>
          {submission.testCaseResults?.length > 0 ? (
            submission.testCaseResults.map((testCase, index) => (
              <div key={index} className="bg-gray-800 p-4 mb-4 rounded-lg">
                {/* Summary */}
                <div
                  className="flex justify-between cursor-pointer"
                  onClick={() => toggleExpand(index)}
                >
                  <p className="text-white font-bold">
                    Case {index + 1} -{" "}
                    <span
                      className={testCase?.passed ? "text-green-500" : "text-red-500"}
                    >
                      {testCase?.passed ? "✓ Passed" : "✗ Failed"}
                    </span>
                  </p>
                  <button className="text-blue-400 hover:underline">
                    {expandedCase === index ? "Hide Details" : "Show Details"}
                  </button>
                </div>

                {/* Details */}
                {expandedCase === index && (
                  <div className="mt-3 space-y-2 text-gray-300">
                    <div>
                      <p>Input:</p>
                      <pre className="bg-gray-900 p-3 rounded">{testCase.input}</pre>
                    </div>
                    <div>
                      <p>Output:</p>
                      <pre className="bg-gray-900 p-3 rounded">
                        {testCase.output}
                      </pre>
                    </div>
                    <div>
                      <p>Expected Output:</p>
                      <pre className="bg-gray-900 p-3 rounded">
                        {testCase.expectedOutput}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-400">No test cases available.</p>
          )}
        </>
      ) : (
        <p className="text-gray-400">Submission details not loaded.</p>
      )}
    </div>
  );
};

SubmissionDetails.propTypes = {
  submission: PropTypes.shape({
    problem_id: PropTypes.shape({
      title: PropTypes.string,
    }),
    numberOfTestCasePass: PropTypes.number,
    numberOfTestCase: PropTypes.number,
    totalMarks: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    execution_time: PropTypes.number,
    memory_usage: PropTypes.number,
    language: PropTypes.string,
    code: PropTypes.string,
    testCaseResults: PropTypes.arrayOf(
      PropTypes.shape({
        input: PropTypes.string,
        output: PropTypes.string,
        expectedOutput: PropTypes.string,
        passed: PropTypes.bool,
      })
    ),
  }).isRequired,
  onBack: PropTypes.func.isRequired,
};

export default SubmissionDetails;
