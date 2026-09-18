import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import toast from "react-hot-toast";
import StudentTable from "./StudentTable";

const AssignProblem = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignLoading, setAssignLoading] = useState(false); // For button-specific loading
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [filters, setFilters] = useState({
    branch: "cspit-it",
    semester: "6",
    batch: "a1",
  });
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 12;

  useEffect(() => {
    const fetchUnassignedStudents = async () => {
      setLoading(true);
      try {
        const response = await axiosInstance.get(
          `/problems/${problemId}/unassignStudent`,
          {
            params: {
              branch: filters.branch,
              semester: filters.semester,
              batch: filters.batch,
            },
          }
        );
        setUnassignedStudents(response.data.unassignedStudents);
      } catch (err) {
        toast.error("Failed to fetch unassigned students. Please try again.");
        setError("Failed to fetch unassigned students");
      } finally {
        setLoading(false);
      }
    };

    fetchUnassignedStudents();
  }, [problemId, filters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === unassignedStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(unassignedStudents.map((student) => student._id));
    }
  };

  const handleSelectStudent = (id) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(
        selectedStudents.filter((studentId) => studentId !== id)
      );
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const handleAssign = async () => {
    setAssignLoading(true);
    try {
      const res = await axiosInstance.post(`/problems/${problemId}/assign`, {
        studentIds: selectedStudents,
      });
      setUnassignedStudents(
        unassignedStudents.filter(
          (student) => !selectedStudents.includes(student._id)
        )
      );
      toast.success(res.data.message);
      setSelectedStudents([]);
      setError(null);
    } catch (error) {
      toast.error("Failed to assign students. Please try again.");
      setError("Failed to assign students. Please try again.");
    } finally {
      setAssignLoading(false);
    }
  };

  const totalPages = Math.ceil(unassignedStudents.length / studentsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="relative min-h-screen bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-4 pt-20 justify-center flex items-center">
        List of Students unAssigned to the Problem
      </h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

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
            <p className="text-white text-lg font-semibold">Assigning...</p>
          </div>
        </div>
      )}

      <button
        className="py-2 px-6 ml-6 bg-gradient-to-r mb-4 from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition transform duration-200"
        onClick={() => navigate(`/assignedStudents/${problemId}`)}
      >
        View Assigned Students
      </button>

      <div className="px-4 mb-4">
        <p className="text-xl font-medium">
          Unassigned Students: {unassignedStudents.length}
        </p>
      </div>

      <StudentTable
        users={unassignedStudents}
        selectedStudents={selectedStudents}
        handleSelectStudent={handleSelectStudent}
        handleSelectAll={handleSelectAll}
        filters={filters}
        updateFilter={updateFilter}
        loading={loading}
        currentPage={currentPage}
        itemsPerPage={studentsPerPage}
        handlePageChange={handlePageChange}
        totalPages={totalPages}
      />

      <div className="flex justify-start ml-4 p-4">
        <button
          onClick={handleAssign}
          disabled={selectedStudents.length === 0}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-600"
        >
          Assign Problem
        </button>
      </div>
    </div>
  );
};

export default AssignProblem;