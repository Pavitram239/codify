import React, { useState, useEffect } from "react";
import axiosInstance from "../../utils/axiosInstance";
import ConfirmationModal from "../ConfirmationModal";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";

const CreateContest = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useSelector((store) => store.app.user);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false); // For button-specific loading
  const [contest, setContest] = useState({
    name: "",
    description: "",
    problems: [],
    created_by: user._id,
    start_time: "",
    end_time: "",
  });

  const [problems, setProblems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isInvalid, setIsInvalid] = useState({
    name: false,
    description: false,
    problems: false,
    start_time: false,
    end_time: false,
  });

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const response = await axiosInstance.get("/problems");
        let { problems: allProblems } = response.data;
        allProblems = allProblems.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setProblems(allProblems);
      } catch (error) {
        toast.error("Error fetching problems.");
        console.error("Error fetching problems:", error);
      }
    };
    fetchProblems();
  }, []);

  const formatDateTimeLocal = (isoString) => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      const fetchContest = async () => {
        try {
          setAssignLoading(true); // Start loading
          const response = await axiosInstance.get(`/contests/${id}`);
          const contestData = response.data;
          setContest({
            name: contestData.name,
            description: contestData.description,
            problems: contestData.problems.map((problem) => problem._id),
            created_by: contestData.created_by,
            start_time: formatDateTimeLocal(contestData.start_time),
            end_time: formatDateTimeLocal(contestData.end_time),
          });
        } catch (error) {
          console.error("Error fetching contest data:", error);
        } finally {
          setAssignLoading(false); // Stop loading
        }
      };
      fetchContest();
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setContest((prevContest) => ({
      ...prevContest,
      [name]: value,
    }));
    setIsInvalid((prevInvalid) => ({ ...prevInvalid, [name]: false }));
  };

  const handleProblemSelect = (problemId) => {
    setContest((prevContest) => {
      const isSelected = prevContest.problems.includes(problemId);
      if (isSelected) {
        return {
          ...prevContest,
          problems: prevContest.problems.filter((id) => id !== problemId),
        };
      } else {
        return {
          ...prevContest,
          problems: [...prevContest.problems, problemId],
        };
      }
    });
    setIsInvalid((prevInvalid) => ({ ...prevInvalid, problems: false }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalidFields = {
      name: contest.name.trim() === "",
      description: contest.description.trim() === "",
      problems: contest.problems.length === 0,
      start_time: contest.start_time.trim() === "",
      end_time: contest.end_time.trim() === "",
    };
    setIsInvalid(invalidFields);
    if (Object.values(invalidFields).some((field) => field)) {
      toast.error("Please fill in all required fields.");
      return;
    }
    try {
      if (isEditMode) {
        await axiosInstance.put(`/contests/${id}`, contest);
        toast.success("Contest updated successfully!");
      } else {
        await axiosInstance.post("/contests/create", contest);
        toast.success("Contest created successfully!");
      }
      navigate("/make-contest");
    } catch (error) {
      toast.error("Error creating/updating contest.");
      console.error("Error creating/updating contest:", error);
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

  const filteredProblems = Array.isArray(problems)
    ? problems.filter((problem) =>
        problem.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];
  const displayedProblems = searchTerm ? filteredProblems : problems;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-900 text-white px-4 py-8 pt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            {isEditMode ? "Edit Contest" : "Create Contest"}
          </h1>
          <p className="mt-3 text-gray-400">
            Design your perfect coding challenge
          </p>
        </div>
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
                ></circle>z
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                ></path>
              </svg>
              <p className="text-white text-lg font-semibold">Loading...</p>
            </div>
          </div>
        )}
        <button
          onClick={handleBackClick}
          className="group flex items-center space-x-2 px-4 py-2 mb-8 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all duration-300"
        >
          <span className="transform group-hover:-translate-x-1 transition-transform duration-300">
            ←
          </span>
          <span>Back</span>
        </button>
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onConfirm={handleConfirmBack}
        />
        <div className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-700">
          <form className="space-y-8" onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-lg font-medium mb-3 text-gray-200"
                htmlFor="name"
              >
                Contest Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="name"
                className={`w-full p-4 bg-gray-900 border rounded-xl transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isInvalid.name ? "border-red-400" : "border-gray-600"
                }`}
                onChange={handleChange}
                name="name"
                value={contest.name}
                placeholder="Enter an engaging title for your contest"
              />
            </div>
            <div>
              <label
                className="block text-g font-medium mb-3 text-gray-200"
                htmlFor="description"
              >
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                id="description"
                rows={5}
                name="description"
                value={contest.description}
                onChange={handleChange}
                className={`w-full p-4 bg-gray-900 border rounded-xl transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isInvalid.description ? "border-red-400" : "border-gray-600"
                }`}
                placeholder="Describe your contest objectives and guidelines"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  className="block text-lg font-medium mb-3 text-gray-200"
                  htmlFor="start_time"
                >
                  Start Time <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="start_time"
                  name="start_time"
                  value={contest.start_time}
                  onChange={handleChange}
                  className={`w-full p-4 bg-gray-900 border rounded-xl transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isInvalid.start_time ? "border-red-400" : "border-gray-600"
                  }`}
                />
              </div>
              <div>
                <label
                  className="block text-lg font-medium mb-3 text-gray-200"
                  htmlFor="end_time"
                >
                  End Time <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="end_time"
                  name="end_time"
                  value={contest.end_time}
                  onChange={handleChange}
                  className={`w-full p-4 bg-gray-900 border rounded-xl transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isInvalid.end_time ? "border-red-400" : "border-gray-600"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-lg font-medium mb-3 text-gray-200">
                Select Problems <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search problems..."
                  className="w-full p-4 bg-gray-900 border border-gray-600 rounded-xl mb-4 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-4 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900">
                {displayedProblems.map((problem) => (
                  <div
                    key={problem._id}
                    className="p-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-800 transition-colors duration-200"
                  >
                    <label className="flex items-center space-x-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contest.problems.includes(problem._id)}
                        onChange={() => handleProblemSelect(problem._id)}
                        className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                      />
                      <span className="text-lg">{problem.title}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg font-semibold rounded-xl shadow-lg hover:from-blue-600 hover:to-purple-600 transform hover:scale-[1.02] transition-all duration-300"
            >
              {isEditMode ? "Update Contest" : "Create Contest"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateContest;
