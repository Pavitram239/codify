import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import "../../CSS/ProblemShow.css";
import Submission from "./Submission";
import Solution from "./Solution";
import Statement from "./Statement";
import CodeEditor from "../CodeEditor/CodeEditor";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";

const ProblemShow = () => {
  const { id } = useParams();
  const location = useLocation();
  const { state } = location;
  const { startTime, endTime } = state || {};
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [language, setLanguage] = useState("java");
  const [code, setCode] = useState("");
  const [activeTab, setActiveTab] = useState("statement");
  const [latestSubmission, setLatestSubmission] = useState(null); // Store latest submission

  

  const handleSubmission = (submission) => {
    setLatestSubmission(submission); // Update with the new submission
    setActiveTab("submissions");
  };

  const codeTemplates = {
    java:
      "public class Main {\n  public static void main(String[] args) {\n    // Your code here\n  }\n}",
    python: 'if __name__ == "__main__":\n    # Your code here\n    pass',
    cpp:
      "#include <iostream>\nint main() {\n  // Your code here\n  return 0;\n}",
  };

  const resizableRef = useRef(null);

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const response = await axiosInstance.get(`/problems/${id}`);
        setProblem(response.data);
        // console.log(response.data)
      } catch (error) {
        toast.error("Failed to load problem data");
        // console.error("Failed to load problem data", error);
      }
    };

    fetchProblem();
  }, [id]);

  useEffect(() => {
    setCode(codeTemplates[language]);
  }, [language]);

  const handleResize = (event) => {
    const resizable = resizableRef.current;
    const containerWidth = resizable.parentElement.getBoundingClientRect()
      .width;
    const newWidth = ((event.clientX / containerWidth) * 100).toFixed(2);
    if (newWidth >= 35 && newWidth <= 75) {
      resizable.style.flexBasis = `${newWidth}%`;
    }
  };

  if (!problem) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="loader border-t-4 border-blue-500 rounded-full w-12 h-12 animate-spin"></div>
        <span className="ml-4 text-white text-lg">
          Loading problem details...
        </span>
      </div>
    );
  }

  return (
    <div className="problem-container">
      <div
        ref={resizableRef}
        className="resizable bg-gray-900 p-4 flex flex-col"
      >
        <div className="sticky top-0 z-10 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="mb-3 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full flex items-center shadow-md hover:shadow-lg transition-all duration-200 ease-in-out"
          >
            <svg
              className="MuiSvgIcon-root _icon_1pe2i_343"
              style={{ width: "15px" }}
              focusable="false"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="white"
            >
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path>
            </svg>
          </button>

          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {problem.title}
            </h1>
          </div>

          <div className="border-b border-gray-700 mb-4">
            <button
              onClick={() => setActiveTab("statement")}
              className={`py-2 px-4 ${
                activeTab === "statement"
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-400 hover:text-white"
              } transition-all duration-200`}
            >
              Statement
            </button>
            <button
              onClick={() => setActiveTab("submissions")}
              className={`py-2 px-4 ${
                activeTab === "submissions"
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-400 hover:text-white"
              } transition-all duration-200`}
            >
              Submissions
            </button>
            <button
              onClick={() => setActiveTab("solution")}
              className={`py-2 px-4 ${
                activeTab === "solution"
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-400 hover:text-white"
              } transition-all duration-200`}
            >
              Solution
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === "statement" && <Statement problem={problem} />}
          {activeTab === "submissions" && (
            <Submission
              problemId={problem._id}
              latestSubmission={latestSubmission} // Pass latest submission
            />
          )}
          {activeTab === "solution" && <Solution />}
        </div>
      </div>

      {/* Divider */}
      <div
        className="divider"
        onMouseDown={() => {
          window.addEventListener("mousemove", handleResize);
          window.addEventListener("mouseup", () => {
            window.removeEventListener("mousemove", handleResize);
          });
        }}
      ></div>

      {/* Right Column: Code Editor */}
      <CodeEditor
        language={language}
        setLanguage={setLanguage}
        code={code}
        setCode={setCode}
        problem={problem}
        onSubmission={handleSubmission}
      />
    </div>
  );
};

export default ProblemShow;
