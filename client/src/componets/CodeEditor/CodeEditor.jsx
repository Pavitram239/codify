import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../../utils/axiosInstance";
import ScoreAndLanguageSelector from "./ScoreAndLanguageSelector";
import CodeEditorArea from "./CodeEditorArea";
import TestCaseResults from "./TestCaseResults";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { fetchHistory, setCurrentPage } from "../../redux/slices/historySlice";
import { fetchSubmissions } from "../../redux/slices/submissionSlice";

const CodeEditor = ({ language, setLanguage, problem, onSubmission }) => {
  const user = useSelector((state) => state.app.user);
  const [assignLoading, setAssignLoading] = useState(false); // For button-specific loading
  const userId = user._id;
  const dispatch = useDispatch();
  const testcases = problem.testCases;

  // console.log(testcases[0]);

  const [codeByLanguage, setCodeByLanguage] = useState({
    java: `import java.util.*;
import java.lang.*;
import java.io.*;

class Main {
    public static void main(String[] args){
        // Your code goes here
        System.out.println("Hello, World!");
    }
}`,
    python: `print("Hello, World!")`,
    cpp: `#include <iostream>
using namespace std;

int main() {
    // Your code goes here
    cout << "Hello, World!" << endl;
    return 0;
}`,
  });

  const [results, setResults] = useState(null);
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const previousLanguageRef = useRef(language);
  const [theme, setTheme] = useState("vs-dark"); // Default theme

  useEffect(() => {
    const fetchSavedCode = async () => {
      try {
        const response = await axiosInstance.get("/compile/getCode", {
          params: { problemId: problem._id },
        });
        if (response.data.success && response.data.code && Object.keys(response.data.code).length > 0) {
          setCodeByLanguage((prev) => ({
            ...prev,
            ...response.data.code,
          }));
        }
      } catch (error) {
        console.error("Error fetching saved code:", error);
      }
    };

    fetchSavedCode();
  }, [userId, problem._id]);

  useEffect(() => {
    previousLanguageRef.current = language;
  }, [language]);

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
  };

  const handleEditorChange = (value) => {
    setCodeByLanguage((prev) => ({
      ...prev,
      [language]: value,
    }));
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme); // Update theme state
  };

  const handleRun = async () => {
    setIsLoading(true);
    setRunLoading(true);
    setResults(null);
    setError(null);
    setAssignLoading(true); // Start loading

    try {
      const response = await axiosInstance.post("/compiler/run-code", {
        code: codeByLanguage[language],
        language,
        allTestCases: false,
        problemId: problem._id,
      });

      const testResults = response.data.testResults;
      // console.log(testResults)

      // Check if any test case contains an error
      const errorTestCase = testResults.find((test) => test.error);
      if (errorTestCase) {
        setError(errorTestCase.error); // Set the first error encountered
        setResults(null); // Optionally clear results if you don't want partial results
      } else {
        setResults(testResults);
      }
    } catch (error) {
      setError(
        error.response?.data?.details || "Failed to run code. Please try again."
      );
    } finally {
      setAssignLoading(false); // Start loading
      setIsLoading(false);
      setRunLoading(false);
    }
  };

  // const handleSubmit = async () => {
  //   setIsLoading(true);
  //   setSubmitLoading(true);
  //   setResults(null);
  //   setError(null);
  //   setAssignLoading(true); // Start loading

  //   try {
  //     // Prepare data for compilation request
  //     const compilePayload = {
  //       code: codeByLanguage[language],
  //       language,
  //       allTestCases: true, // Ensures backend processes all test cases
  //       problemId: problem._id,
  //     };

  //     // Send code and test cases to the backend for compilation
  //     const compileResponse = await axiosInstance.post(
  //       "/compiler/run-code",
  //       compilePayload
  //     );

  //     let {
  //       testResults,
  //       overallTime,
  //       averageMemory,
  //       allPassed,
  //     } = compileResponse.data;

  //     console.log("Compilation Results:", testResults);
  //     setResults(testResults);

  //     // Check for errors in test results
  //     const errorTestCase = testResults.find((test) => test.error);
  //     if (errorTestCase) {
  //       setError(errorTestCase.error); // Display the first error encountered
  //       console.error("Compilation Error:", errorTestCase.error);
  //       return;
  //     }

  //     overallTime = (overallTime * 1000).toFixed(2); // Now in ms
  //     averageMemory = (averageMemory / 1024).toFixed(2); // Now in MB

  //     console.log(`Overall Time: ${overallTime} ms`);
  //     console.log(`Average Memory: ${averageMemory} MB`);

  //     // Calculate metrics and prepare test case results
  //     const numberOfTestCase = testResults.length;
  //     const numberOfTestCasePass = testResults.filter((test) => test.passed)
  //       .length;
  //     const testCaseResults = testResults.map((test, index) => {
  //       const marks =
  //         test.passed && testcases[index]?.marks ? testcases[index].marks : 0;
  //       return { ...test, marks };
  //     });

  //     const totalMarks = testCaseResults.reduce(
  //       (sum, test) => sum + test.marks,
  //       0
  //     );
  //     const submissionStatus = allPassed ? "completed" : "rejected";

  //     console.log("Number of Test Cases:", numberOfTestCase);
  //     console.log("Number of Test Cases Passed:", numberOfTestCasePass);
  //     console.log("Total Marks Obtained:", totalMarks);
  //     console.log("Submission Status:", submissionStatus);

  //     // Prepare submission payload with time in ms and memory in MB
  //     const submissionPayload = {
  //       user_id: userId,
  //       problem_id: problem._id,
  //       code: codeByLanguage[language],
  //       language,
  //       execution_time: overallTime, // Now in ms
  //       memory_usage: averageMemory, // Now in MB
  //       status: submissionStatus,
  //       numberOfTestCase,
  //       numberOfTestCasePass,
  //       totalMarks,
  //       testCaseResults,
  //     };

  //     // Send the submission to the backend
  //     const submissionResponse = await axiosInstance.post(
  //       "/submissions",
  //       submissionPayload
  //     );
  //     const savedSubmission = submissionResponse.data.submission;

  //     console.log("Submission Saved Successfully:", savedSubmission);

  //     // Trigger callback if provided
  //     if (onSubmission) {
  //       onSubmission(savedSubmission);
  //     }
  //   } catch (error) {
  //     // Handle errors gracefully
  //     const errorMessage =
  //       error.response?.data?.details || "An error occurred. Please try again.";
  //     console.error("Submission Error:", error);
  //     setError(errorMessage);
  //   } finally {
  //     // Reset loading states
  //     setIsLoading(false);
  //     setSubmitLoading(false);
  //     setAssignLoading(false);
  //   }
  // };

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmitLoading(true);
    setResults(null);
    setError(null);
    setAssignLoading(true);

    try {
      const compilePayload = {
        code: codeByLanguage[language],
        language,
        allTestCases: true, // Ensure all test cases are run
        problemId: problem._id,
      };

      const compileResponse = await axiosInstance.post(
        "/compiler/run-code",
        compilePayload
      );
      const { testResults, savedSubmission } = compileResponse.data;

      // console.log("Compilation Results:", testResults);
      // console.log("Compilation Results:", savedSubmission);

      setResults(testResults);

      if (savedSubmission) {
        // console.log("Submission Saved Successfully:", savedSubmission);
        if (onSubmission) {
          onSubmission(savedSubmission);
          dispatch(fetchHistory({ page: 1, limit: 9 }));
          dispatch(setCurrentPage(1));
          dispatch(fetchSubmissions({ page: 1, limit: 7 }));
        }
      }
    } catch (error) {
      setError(
        error.response?.data?.message || "An error occurred. Please try again."
      );
      console.error("Submission Error:", error);
    } finally {
      setIsLoading(false);
      setSubmitLoading(false);
      setAssignLoading(false);
    }
  };

  const handleSaveCode = async () => {
    try {
      await axiosInstance.post("/compile/saveCode", {
        problemId: problem._id,
        codeByLanguage,
      });
      toast.success("Code saved successfully!");
    } catch (error) {
      console.error("Error saving code:", error);
      toast.error("Failed to save code. Please try again.");
    }
  };

  return (
    <div className="code-editor bg-gray-900 p-6 shadow-lg">
      <ScoreAndLanguageSelector
        language={language}
        handleLanguageChange={handleLanguageChange}
        score={problem.totalMarks}
      />
      <CodeEditorArea
        language={language}
        code={codeByLanguage[language] || ""}
        handleEditorChange={handleEditorChange}
        theme={theme} // Pass the theme to CodeEditorArea
        handleThemeChange={handleThemeChange} // Pass the theme change handler
      />

      <TestCaseResults
        results={results}
        activeTestCaseIndex={activeTestCaseIndex}
        setActiveTestCaseIndex={setActiveTestCaseIndex}
        isLoading={isLoading}
        runLoading={runLoading}
        submitLoading={submitLoading}
        handleRun={handleRun}
        handleSubmit={handleSubmit}
        handleSaveCode={handleSaveCode}
        error={error}
      />

      {assignLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <svg
              className="animate-spin h-12 w-12 text-blue-500 mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            <p className="text-white text-lg font-semibold">Submitting...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
