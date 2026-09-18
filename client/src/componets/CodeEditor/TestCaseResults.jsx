import React from "react";

const TestCaseResults = ({
  results,
  activeTestCaseIndex,
  setActiveTestCaseIndex,
  isLoading,
  runLoading,
  submitLoading,
  handleRun,
  handleSubmit,
  handleSaveCode,
  error,
}) => {
  const hasResults = results && results.length > 0;
  const currentTestCase =
    hasResults && activeTestCaseIndex >= 0 && activeTestCaseIndex < results.length
      ? results[activeTestCaseIndex]
      : null;

  return (
    <div className="mt-4">
      <div className="flex space-x-4">
        <button
          onClick={handleRun}
          disabled={isLoading || runLoading || submitLoading}
          className={`px-4 py-2 rounded-lg shadow-md text-white transition-all duration-200 ${
            runLoading ? "bg-gray-500" : "bg-yellow-500 hover:bg-yellow-400"
          }`}
        >
          {runLoading ? "Running..." : "Run Test Case"}
        </button>

        <button
          onClick={handleSubmit}
          disabled={isLoading || submitLoading || runLoading}
          className={`px-4 py-2 rounded-lg shadow-md text-white transition-all duration-200 ${
            submitLoading ? "bg-gray-500" : "bg-green-600 hover:bg-green-500"
          }`}
        >
          {submitLoading ? "Submitting..." : "Submit Code"}
        </button>

        <button onClick={handleSaveCode} className="bg-blue-500 text-white px-4 py-2 rounded">
          Save Codez
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-800 text-red-200 rounded-lg shadow-lg max-w-full overflow-auto">
          <strong>Error:</strong> {error}
        </div>
      )}

      {hasResults && !error ? (
        <div className="mt-6">
          <div className="flex space-x-4">
            {results.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveTestCaseIndex(index)}
                className={`px-3 py-2 rounded-lg shadow-md transition-all duration-200 ${
                  activeTestCaseIndex === index
                    ? "bg-green-500 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                Case {index + 1}
              </button>
            ))}
          </div>

          {currentTestCase && (
            <div className="mt-4 bg-gray-800 p-4 rounded-lg shadow-lg text-gray-300">
              <h3
                className={`text-lg font-semibold ${
                  currentTestCase.passed ? "text-green-400" : "text-red-400"
                }`}
              >
                {currentTestCase.passed ? "Accepted" : "Failed"}
              </h3>

              <div className="mt-2 flex flex-col">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Input</h4>
                  <div className="p-3 bg-gray-900 rounded-lg overflow-auto mb-2">
                    {currentTestCase.input || "No input provided"}
                  </div>
                </div>

                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Output</h4>
                  <div className="p-3 bg-gray-900 rounded-lg overflow-auto">
                    {currentTestCase.output || "No output available"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Expected Output</h4>
                <div className="p-3 bg-gray-900 rounded-lg overflow-auto">
                  {currentTestCase.expectedOutput || "No expected output"}
                </div>
              </div>

              {currentTestCase.error && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-red-400 mb-2">Error / Compiler Details</h4>
                  <pre className="p-3 bg-red-950/40 border border-red-800/50 text-red-300 rounded-lg overflow-auto font-mono text-xs whitespace-pre-wrap">
                    {currentTestCase.error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        !error && (
          <div className="mt-4 text-gray-500">
            {/* No results available */}
          </div>
        )
      )}
    </div>
  );
};

export default TestCaseResults;
