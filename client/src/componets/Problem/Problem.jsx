import { useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useSelector } from "react-redux";

const ProblemForm = () => {
  const user = useSelector((state) => state.app.user); // Get the logged-in user
  console.log(user)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [sampleIO, setSampleIO] = useState([{ input: "", output: "" }]);
  const [testCases, setTestCases] = useState([
    { inputs: "", outputs: "", marks: 0 },
  ]);
  const [constraints, setConstraints] = useState("");
  const [tags, setTags] = useState([]);
  const [totalMarks, setTotalMarks] = useState(0);

  const handleSampleIOChange = (index, field, value) => {
    const newSampleIO = [...sampleIO];
    newSampleIO[index][field] = value;
    setSampleIO(newSampleIO);
  };

  const handleAddSampleIO = () => {
    setSampleIO([...sampleIO, { input: "", output: "" }]);
  };

  useEffect(() => {z
    if (user?.role !== "admin") navigate("/");
  }, [user, navigate]);

  const handleRemoveSampleIO = (index) => {
    setSampleIO(sampleIO.filter((_, i) => i !== index));
  };

  const handleTestCaseChange = (index, field, value) => {
    const newTestCases = [...testCases];
    if (field === "marks") {
      newTestCases[index].marks = parseInt(value, 10) || 0;
    } else {
      newTestCases[index][field] = value;
    }
    setTestCases(newTestCases);
    updateTotalMarks(newTestCases);
  };

  const handleAddTestCase = () => {
    setTestCases([...testCases, { inputs: "", outputs: "", marks: 0 }]);
  };

  const handleRemoveTestCase = (index) => {
    const newTestCases = testCases.filter((_, i) => i !== index);
    setTestCases(newTestCases);
    updateTotalMarks(newTestCases);
  };

  const updateTotalMarks = (testCases) => {
    const total = testCases.reduce((sum, tc) => sum + tc.marks, 0);
    setTotalMarks(total);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const problemData = {
      title,
      description,
      difficulty: difficulty.toLowerCase(),
      inputFormat,
      outputFormat,
      sampleIO,
      testCases,
      constraints,
      tags,
      totalMarks,
      createdBy: user?._id || "Unknown",
    };

    try {
      // console.log("Problem data --->", problemData);
      const response = await axiosInstance.post("/problems/", problemData);
      console.log("Problem created successfully:", response.data);
    } catch (error) {
      console.error("Error creating problem:", error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded-md">
      <h2 className="text-2xl font-semibold mb-4">Create New Problem</h2>
      <form onSubmit={handleSubmit}>
        {/* Problem Details */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            required
          />
        </div>

        {/* Difficulty, Input/Output Format */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              required
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Input Format
            </label>
            <input
              type="text"
              value={inputFormat}
              onChange={(e) => setInputFormat(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Output Format
            </label>
            <input
              type="text"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Constraints
            </label>
            <input
              type="text"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Sample Input/Output */}
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Sample Input/Output</h3>
          {sampleIO.map((sio, index) => (
            <div key={index} className="mb-4">
              <input
                type="text"
                placeholder="Sample Input"
                value={sio.input}
                onChange={(e) =>
                  handleSampleIOChange(index, "input", e.target.value)
                }
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md mb-2"
              />
              <input
                type="text"
                placeholder="Sample Output"
                value={sio.output}
                onChange={(e) =>
                  handleSampleIOChange(index, "output", e.target.value)
                }
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => handleRemoveSampleIO(index)}
                className="text-red-600 hover:text-red-800 mt-2"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddSampleIO}
            className="px-4 py-2 bg-blue-500 text-white rounded-md"
          >
            Add Sample IO
          </button>
        </div>

        {/* Test Cases */}
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Test Cases</h3>
          {testCases.map((testCase, index) => (
            <div key={index} className="mb-4 p-4 border rounded-md bg-gray-50">
              <textarea
                placeholder="Input"
                value={testCase.inputs}
                onChange={(e) =>
                  handleTestCaseChange(index, "inputs", e.target.value)
                }
                className="block w-full p-2 border border-gray-300 rounded-md mb-2"
                rows="3"
              />
              <textarea
                placeholder="Expected Output"
                value={testCase.outputs}
                onChange={(e) =>
                  handleTestCaseChange(index, "outputs", e.target.value)
                }
                className="block w-full p-2 border border-gray-300 rounded-md mb-2"
                rows="3"
              />
              <input
                type="number"
                placeholder="Marks"
                value={testCase.marks}
                onChange={(e) =>
                  handleTestCaseChange(index, "marks", e.target.value)
                }
                className="block w-full p-2 border border-gray-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => handleRemoveTestCase(index)}
                className="text-red-600 hover:text-red-800 mt-2"
              >
                Remove Test Case
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddTestCase}
            className="px-4 py-2 bg-blue-500 text-white rounded-md"
          >
            Add Test Case
          </button>
        </div>

        <div className="mb-4">
          <h4 className="font-medium">Total Marks: {totalMarks}</h4>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Tags
          </label>
          <input
            type="text"
            placeholder="Comma-separated tags"
            value={tags.join(", ")}
            onChange={(e) =>
              setTags(e.target.value.split(",").map((tag) => tag.trim()))
            }
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="px-6 py-2 bg-green-500 text-white font-semibold rounded-md"
        >
          Submit Problem
        </button>
      </form>
    </div>
  );
};

export default ProblemForm;
