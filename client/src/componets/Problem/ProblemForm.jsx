import { useState, useEffect } from "react";

import toast from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance"; // Custom axios instance for API calls
import ConfirmationModal from "../ConfirmationModal"; // Import the modal component
import AIProblemModal from "./AIProblemModal";

const DIFFICULTY = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
};

const ProblemForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  
  const [assignLoading, setAssignLoading] = useState(false); // For button-specific loading

  const [problemData, setProblemData] = useState({
    title: "",
    description: "",
    difficulty: DIFFICULTY.EASY,
    inputFormat: "",
    outputFormat: "",
    sampleIO: [{ input: "", output: "" }],
    constraints: "",
    tags: "",
    totalMarks: 0,
    testCases: [
      {
        inputs: "",
        outputs: "",
        marks: 0,
        cpu_time_limit: 1,
        memory_limit: 128,
        is_hidden: false,
      },
    ],
  });

  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [isModalOpenInternal, setIsModalOpenInternal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, ] = useState("");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Auto-open AI modal if URL contains openAI=true
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("openAI") === "true") {
      setIsAIModalOpen(true);
    }
  }, [location.search]);

  const handleApplyAIProblem = (aiProblem) => {
    const formattedTestCases = (aiProblem.testCases || []).map((tc) => ({
      inputs: tc.inputs || "",
      outputs: tc.outputs || "",
      marks: parseInt(tc.marks, 10) || 10,
      cpu_time_limit: parseFloat(tc.cpu_time_limit) || 1,
      memory_limit: parseInt(tc.memory_limit, 10) || 128,
      is_hidden: Boolean(tc.is_hidden),
    }));

    const total = formattedTestCases.reduce((sum, tc) => sum + tc.marks, 0);

    setProblemData({
      title: aiProblem.title || "",
      description: aiProblem.description || "",
      difficulty: aiProblem.difficulty || DIFFICULTY.EASY,
      inputFormat: aiProblem.inputFormat || "",
      outputFormat: aiProblem.outputFormat || "",
      sampleIO:
        aiProblem.sampleIO && aiProblem.sampleIO.length > 0
          ? aiProblem.sampleIO
          : [{ input: "", output: "" }],
      constraints: aiProblem.constraints || "",
      tags: Array.isArray(aiProblem.tags)
        ? aiProblem.tags.join(", ")
        : aiProblem.tags || "",
      totalMarks: total,
      testCases:
        formattedTestCases.length > 0
          ? formattedTestCases
          : [
              {
                inputs: "",
                outputs: "",
                marks: 0,
                cpu_time_limit: 1,
                memory_limit: 128,
                is_hidden: false,
              },
            ],
    });

    setErrors({});
  };

  // Fetch problem if editing
  useEffect(() => {
    setAssignLoading(true); // Start loading
    if (id) {
      setIsEditing(true);

      const fetchProblem = async () => {
        try {
          const response = await axiosInstance.get(
            `/problems/getProblemByIdForUpdate/${id}`
          );
          // console.log(response.data);
          const fetchedData = response.data;
          // console.log(response.data)

          setProblemData({
            title: fetchedData.title,
            description: fetchedData.description,
            difficulty: fetchedData.difficulty || DIFFICULTY.EASY,
            inputFormat: fetchedData.inputFormat,
            outputFormat: fetchedData.outputFormat,
            sampleIO: fetchedData.sampleIO || [{ input: "", output: "" }],
            constraints: fetchedData.constraints,
            tags: fetchedData.tags,
            totalMarks: fetchedData.totalMarks || 0,
            testCases: fetchedData.testCases.map((testCase) => ({
              inputs: testCase.inputs,
              outputs: testCase.outputs,
              marks: testCase.marks,
              memory_limit: testCase.memory_limit || 1,
              cpu_time_limit: testCase?.cpu_time_limit || 1,
              is_hidden: testCase.is_hidden || false,
            })),
          });
          setAssignLoading(false); // Start loading
        } catch (error) {
          toast.error("Failed to load problem data");
          console.error(error);
          setAssignLoading(false); // Start loading
        }
        
      };
      fetchProblem();
    } else {
      setIsEditing(false);
      setAssignLoading(false); // Start loading
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProblemData({ ...problemData, [name]: value });
    setErrors({ ...errors, [name]: false });
  };

  const handleSampleChange = (index, e) => {
    const { name, value } = e.target;
    const newSampleIO = [...problemData.sampleIO];
    newSampleIO[index][name] = value;
    setProblemData({ ...problemData, sampleIO: newSampleIO });
  };

  const addSampleIO = () => {
    setProblemData({
      ...problemData,
      sampleIO: [...problemData.sampleIO, { input: "", output: "" }],
    });
  };

  const removeSampleIO = (index) => {
    const newSampleIO = problemData.sampleIO.filter((_, i) => i !== index);
    setProblemData({ ...problemData, sampleIO: newSampleIO });
  };

  const handleTestCaseChange = (index, field, value) => {
    const newTestCases = [...problemData.testCases];

    if (
      field === "marks" ||
      field === "cpu_time_limit" ||
      field === "memory_limit"
    ) {
      const numValue = parseInt(value, 10) || 0;
      if (numValue < 0) return;
      newTestCases[index][field] = numValue;
    } else if (field === "is_hidden") {
      newTestCases[index][field] = !newTestCases[index][field]; // Toggle boolean
    } else {
      newTestCases[index][field] = value;
    }

    setProblemData({ ...problemData, testCases: newTestCases });
    updateTotalMarks(newTestCases);
  };

  const addTestCase = () => {
    setProblemData({
      ...problemData,
      testCases: [
        ...problemData.testCases,
        {
          inputs: "",
          outputs: "",
          marks: 0,
          cpu_time_limit: 1,
          memory_limit: 128,
          is_hidden: false,
        },
      ],
    });
  };

  const handleRemoveTestCase = (index) => {
    const newTestCases = problemData.testCases.filter((_, i) => i !== index);
    setProblemData({ ...problemData, testCases: newTestCases });
    updateTotalMarks(newTestCases);
  };

  const updateTotalMarks = (testCases) => {
    const total = testCases.reduce((sum, tc) => sum + tc.marks, 0);
    setProblemData((prevData) => ({ ...prevData, totalMarks: total }));
  };

  const renderTestCases = () => {
    return problemData.testCases.map((testCase, index) => {
      // Determine if there's an error for this test case
      const hasError =
        errors[`testCase_${index}`] ||
        (errors.totalMarks && problemData.totalMarks === 0);

      return (
        <div
          key={index}
          className={`mb-6 p-6 border rounded-lg ui-card-shadow ${
            hasError ? "border-red-600" : "border-slate-200"
          } ui-page`}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-600">
              Test Case {index + 1}
            </h3>

            <button
              type="button"
              onClick={() =>
                handleTestCaseChange(index, "is_hidden", !testCase.is_hidden)
              }
              className={`px-4 py-2 font-medium rounded-md transition flex items-center gap-2 text-slate-900 shadow-md ${
                testCase.is_hidden
                  ? "bg-red-600 hover:bg-red-50"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {testCase.is_hidden ? "🔒 Hidden" : "👁 Show"}
            </button>
          </div>

          {/* Input Field */}
          <label className="block text-slate-600 mb-2">Input</label>
          <textarea
            placeholder="Enter test case input"
            value={testCase.inputs}
            onChange={(e) =>
              handleTestCaseChange(index, "inputs", e.target.value)
            }
            className={`w-full p-3 ui-surface border ${
              hasError ? "border-red-600" : "border-slate-200"
            } rounded-md mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            rows="3"
          />

          {/* Expected Output Field */}
          <label className="block text-slate-600 mb-2">Expected Output</label>
          <textarea
            placeholder="Enter expected output"
            value={testCase.outputs}
            onChange={(e) =>
              handleTestCaseChange(index, "outputs", e.target.value)
            }
            className={`w-full p-3 ui-surface border ${
              hasError ? "border-red-600" : "border-slate-200"
            } rounded-md mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            rows="3"
          />

          {/* Marks Field */}
          <label className="block text-slate-600 mb-2">Marks</label>
          <input
            type="number"
            placeholder="Enter marks for this test case"
            value={testCase.marks}
            onChange={(e) =>
              handleTestCaseChange(index, "marks", e.target.value)
            }
            className="w-full p-3 ui-surface border border-slate-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 mb-4"
          />

          {/* CPU Time Limit */}
          <label className="block text-slate-600 mb-2">
            CPU Time Limit (seconds 1s - 15s)
          </label>
          <input
            type="number"
            min="1"
            max="15"
            placeholder="Enter CPU time limit (sec)"
            value={testCase.cpu_time_limit}
            onChange={(e) => {
              const value = Math.min(15, Math.max(1, Number(e.target.value)));
              handleTestCaseChange(index, "cpu_time_limit", value);
            }}
            onInput={(e) => {
              if (e.target.value < 1) e.target.value = 1;
              if (e.target.value > 15) e.target.value = 15;
            }}
            className="w-full p-3 ui-surface border border-slate-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 mb-4"
          />

          {/* Memory Limit */}
          <label className="block text-slate-600 mb-2">
            Memory Limit (MB 1MB - 256MB)
          </label>
          <input
            type="number"
            min="1"
            max="256"
            placeholder="Enter memory limit (MB)"
            value={testCase.memory_limit}
            onChange={(e) => {
              const value = Math.min(256, Math.max(1, Number(e.target.value)));
              handleTestCaseChange(index, "memory_limit", value);
            }}
            onInput={(e) => {
              if (e.target.value < 1) e.target.value = 1;
              if (e.target.value > 256) e.target.value = 256;
            }}
            className="w-full p-3 ui-surface border border-slate-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 mb-4"
          />

          {/* Hidden/Show Toggle Button */}

          {/* Remove Test Case Button */}
          {problemData.testCases.length > 1 && (
            <button
              type="button"
              onClick={() => handleRemoveTestCase(index)}
              className="mt-4 px-4 py-2 w-full text-red-600 border border-red-600 rounded-md hover:bg-red-600 hover:text-slate-900 transition"
            >
              Remove Test Case
            </button>
          )}
        </div>
      );
    });
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    // Validate problem fields
    if (!problemData.title) newErrors.title = true;
    if (!problemData.description) newErrors.description = true;
    if (!problemData.inputFormat) newErrors.inputFormat = true;
    if (!problemData.outputFormat) newErrors.outputFormat = true;
    if (
      problemData.sampleIO.some((sample) => !sample.input || !sample.output)
    ) {
      newErrors.sampleIO = true;
    }
    if (!problemData.constraints) newErrors.constraints = true;
    if (!problemData.tags) newErrors.tags = true;

    // Validate test cases
    problemData.testCases.forEach((testCase, index) => {
      if (!testCase.inputs || !testCase.outputs || testCase.marks < 0) {
        newErrors[`testCase_${index}`] = true;
        // console.log("Test case error", index);
      }
    });

    if (problemData.totalMarks === 0) {
      newErrors.totalMarks = true;
      // Mark all test cases with an error if total marks is 0
      problemData.testCases.forEach((_, index) => {
        newErrors[`testCase_${index}`] = true;
      });
    }

    setErrors(newErrors); // Store errors for styling
    return newErrors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields!");
      return;
    }
    setIsModalOpenInternal(true);
  };

  const confirmSubmit = async () => {
    
    const apiMethod = isEditing ? axiosInstance.put : axiosInstance.post;
    const apiEndpoint = isEditing ? `/problems/${id}` : "/problems/";

    const tags =
      typeof problemData.tags === "string" && problemData.tags.trim() !== ""
        ? problemData.tags.split(",").map((tag) => tag.trim())
        : problemData.tags;

    try {
      const response = await apiMethod(apiEndpoint, {
        ...problemData,
        tags,
      });

      if (response.status === 200 || response.status === 201) {
        toast.success(
          isEditing
            ? "Problem updated successfully!"
            : "Problem created successfully!"
        );
        setTimeout(() => {
          setIsModalOpenInternal(false);
          navigate("/make-problem");
        }, 100);
      }
    } catch (error) {
      const errorMsg =
        error?.response?.data?.message ||
        (isEditing
          ? "Failed to update problem. Please try again."
          : "Failed to create problem. Please try again.");
      toast.error(errorMsg);
      setTimeout(() => {
        setIsModalOpenInternal(false);
      }, 2000);
      console.error("Submit problem error:", error);
    }
  };

  const handleBackClick = () => {
    setIsModalOpen(true);
  };

  const handleConfirmBack = () => {
    setIsModalOpen(false);
    navigate(-1);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="relative ui-page-height ui-page text-slate-900">
        <div className="mx-auto p-4 ui-surface text-slate-900 rounded-lg ui-card-shadow">
          <h1 className="text-2xl font-bold mt-10 mb-6 text-center">
            {isEditing ? "Edit Problem" : "Create Problem"}
          </h1>

          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <button
              onClick={handleBackClick}
              className="px-4 py-1 sm:px-6 sm:py-2 bg-blue-500 text-slate-900 text-base sm:text-sm rounded-lg hover:bg-blue-600 transition duration-200 ease-in-out cursor-pointer"
            >
              Back
            </button>

            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsAIModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 ui-gradient      text-slate-900 font-medium text-sm rounded-lg ui-card-shadow shadow-indigo-600/30 transition transform hover:-translate-y-0.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-yellow-700 animate-pulse" />
                <span>✨ AI Problem Assistant</span>
              </button>
            )}
          </div>

          <ConfirmationModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onConfirm={handleConfirmBack}
          />

          <AIProblemModal
            isOpen={isAIModalOpen}
            onClose={() => setIsAIModalOpen(false)}
            onApplyProblem={handleApplyAIProblem}
          />

          {assignLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-12 w-12 text-blue-700 mb-4"
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
                <p className="text-slate-900 text-lg font-semibold">Loading...</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-1xl font-medium mb-2">Title</label>
              <input
                type="text"
                name="title"
                value={problemData.title}
                onChange={handleChange}
                className={`w-full p-4  ui-surface border rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500  ${
                  errors.title ? "border-red-500" : "border-slate-200"
                }`}
                placeholder="Enter problem title"
              />
            </div>

            {/* Similar fields for Description, Difficulty, Input/Output Format, Sample IO, Constraints, Tags, and Score */}
            {/* Description */}
            <div>
              <label className="block text-1xl font-medium mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={problemData.description}
                onChange={handleChange}
                className={`w-full p-4  ui-surface border rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500  ${
                  errors.description ? "border-red-500" : "border-slate-200"
                } `}
                placeholder="Describe the problem"
                rows="6"
              />
            </div>

            {/* Difficulty */}

            <div>
              <label className="block text-1xl font-medium mb-2">
                Difficulty
              </label>
              <select
                name="difficulty"
                value={problemData.difficulty}
                onChange={handleChange}
                className="w-full p-4  ui-surface border border-slate-200 rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 "
              >
                <option value={DIFFICULTY.EASY}>Easy</option>
                <option value={DIFFICULTY.MEDIUM}>Medium</option>
                <option value={DIFFICULTY.HARD}>Hard</option>
              </select>
            </div>

            {/* Input Format */}
            <div>
              <label className="block text-1xl font-medium mb-2">
                Input Format
              </label>
              <textarea
                type="text"
                name="inputFormat"
                value={problemData.inputFormat}
                onChange={handleChange}
                className={`w-full p-4  ui-surface border rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500  ${
                  errors.inputFormat ? "border-red-500" : "border-slate-200"
                }`}
                placeholder="Specify the input format"
                rows={4}
              />
            </div>

            {/* Output Format */}
            <div>
              <label className="block text-1xl font-medium mb-2">
                Output Format
              </label>
              <textarea
                type="text"
                name="outputFormat"
                value={problemData.outputFormat}
                onChange={handleChange}
                className={`w-full p-4  ui-surface border rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500  ${
                  errors.outputFormat ? "border-red-500" : "border-slate-200"
                }`}
                placeholder="Specify the output format"
                rows={4}
              />
            </div>

            {/* Sample IO */}
            <div>
              <label className="block text-1xl font-medium mb-2">
                Sample Input/Output
              </label>
              {problemData.sampleIO.map((sample, index) => (
                <div key={index} className="space-y-2 mb-4">
                  <textarea
                    type="text"
                    name="input"
                    value={sample.input}
                    onChange={(e) => handleSampleChange(index, e)}
                    placeholder="Sample Input"
                    className={`w-full p-4  ui-surface border rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500  ${
                      errors.sampleIO ? "border-red-500" : "border-slate-200"
                    }`}
                    rows={3}
                  />
                  <textarea
                    type="text"
                    name="output"
                    value={sample.output}
                    onChange={(e) => handleSampleChange(index, e)}
                    placeholder="Sample Output"
                    className={`w-full p-4  ui-surface border rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500  ${
                      errors.sampleIO ? "border-red-500" : "border-slate-200"
                    }`}
                    rows={3}
                  />

                  {/* Disable Remove button if only one sample exists */}
                  {problemData.sampleIO.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSampleIO(index)}
                      className="bg-red-500 mt-5 text-slate-900 font-semibold py-2 px-4 rounded hover:bg-red-600 transition duration-300 ease-in-out"
                    >
                      Remove Sample
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addSampleIO}
                className="text-blue-700 mt-2"
              >
                + Add More
              </button>
            </div>

            {/* Constraints */}
            <div>
              <label className="block text-1xl font-medium mb-2">
                Constraints
              </label>
              <textarea
                name="constraints"
                value={problemData.constraints}
                onChange={handleChange}
                className={`w-full p-4  ui-surface border rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500  ${
                  errors.constraints ? "border-red-500" : "border-slate-200"
                }`}
                placeholder="Specify the problem constraints"
                rows={4}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-1xl font-medium mb-2">Tags</label>
              <input
                type="text"
                name="tags"
                value={problemData.tags}
                onChange={handleChange}
                className={`w-full p-4  ui-surface border rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500  ${
                  errors.tags ? "border-red-500" : "border-slate-200"
                }
                `}
                placeholder="Comma-separated tags (e.g., arrays, sorting)"
              />
            </div>

            <div>
              <label className="block text-1xl font-medium mb-2">
                Total Marks
              </label>
              <input
                type="number"
                name="totalMarks"
                value={problemData.totalMarks}
                className="w-full p-4 ui-surface border border-slate-200 rounded-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Total Marks for all test cases"
                min={0}
                readOnly
              />
            </div>

            <div>
              {renderTestCases()}
              <button
                type="button"
                onClick={addTestCase}
                className="text-blue-700 mt-2 mb-2"
              >
                + Add More Test Case
              </button>

              <div className="ui-subtle border border-slate-200 rounded-md p-4 my-4">
                <h4 className="text-lg sm:text-base font-semibold text-slate-700 mb-2">
                  Important Note:
                </h4>
                <p className="text-slate-700 sm:text-sm leading-relaxed text-justify">
                  As an admin, when you create a problem, please ensure that the
                  input and output examples are accurate. These examples are
                  crucial for testing the submitted code to determine its
                  correctness.
                </p>
              </div>
            </div>

            <div className="text-center">
              <button
                type="submit"
                className="px-6 py-3 bg-blue-500 text-slate-900 rounded-lg hover:bg-blue-600"
              >
                {isEditing ? "Update Problem" : "Create Problem"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      <div
        className={`${
          isModalOpenInternal ? "block" : "hidden"
        } fixed top-0 left-0 w-full h-full ui-page bg-opacity-50 flex items-center justify-center z-50`}
      >
        <div className="bg-white p-8 rounded-lg ui-card-shadow text-slate-700 text-center">
          <p className="text-2xl font-bold mb-4">Confirmation</p>
          <p>{modalMessage || "Are you sure you want to proceed?"}</p>
          <div className="flex justify-center gap-4 mt-6">
            <button
              className="px-6 py-2 bg-red-500 text-slate-900 rounded-lg hover:bg-red-600"
              onClick={() => setIsModalOpenInternal(false)}
            >
              Cancel
            </button>
            <button
              className="px-6 py-2 bg-green-500 text-slate-900 rounded-lg hover:bg-green-600"
              onClick={confirmSubmit}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProblemForm;
