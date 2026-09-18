import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const Dashboard = () => {
  const { problemId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [TotalSubmission, setTotalSubmission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const [filters, setFilters] = useState({
    branch: "ALL",
    semester: "ALL",
    language: "ALL",
    status: "ALL",
    batch: "ALL",
  });

  const { problemTitle, difficulty, createdAt } = location.state || {};

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const response = await axiosInstance.get("/submissions/problem", {
          params: { problem_id: problemId },
        });
        setSubmissions(response.data.submissions);
        setTotalSubmission(response.data.submissions.length);
        setFilteredSubmissions(response.data.submissions);
        // console.log(response.data);
      } catch (err) {
        setError(
          err.response ? err.response.data.message : "Error fetching data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [problemId]);

  useEffect(() => {
    applyFilters();
  }, [filters]);

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(order);

    const sortedData = [...filteredSubmissions].sort((a, b) => {
      const valA =
        field === "branch" || field === "batch"
          ? a.user_id[field]?.toUpperCase()
          : a.user_id[field];
      const valB =
        field === "branch" || field === "batch"
          ? b.user_id[field]?.toUpperCase()
          : b.user_id[field];

      if (order === "asc") {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      } else {
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      }
    });

    setFilteredSubmissions(sortedData);
  };

  const applyFilters = () => {
    let filtered = submissions;

    if (filters.branch !== "ALL") {
      filtered = filtered.filter(
        (submission) =>
          submission.user_id.branch?.toUpperCase() === filters.branch
      );
    }

    if (filters.semester !== "ALL") {
      filtered = filtered.filter((submission) => {
        const semester = submission.user_id.semester; // Extract semester
        return semester && String(semester) === String(filters.semester);
      });
    }

    if (filters.language !== "ALL") {
      filtered = filtered.filter(
        (submission) => submission.language?.toUpperCase() === filters.language
      );
    }

    if (filters.status !== "ALL") {
      filtered = filtered.filter(
        (submission) => submission.status?.toUpperCase() === filters.status
      );
    }
    if (filters.batch !== "ALL") {
      // console.log(filters.batch);
      filtered = filtered.filter((submission) => {
        return submission.user_id.batch?.toUpperCase() === filters.batch;
      });
    }

    setFilteredSubmissions(filtered);
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  const downloadExcel = () => {
    const totalSubmissions = filteredSubmissions.length;

    // Add a header row for the total number of submissions
    const headerRow = [
      { ID: `Total Submissions: ${totalSubmissions}` },
      {}, // Blank cells to adjust layout
    ];

    const dataToExport = filteredSubmissions.map((submission) => ({
      ID: submission.user_id.id,
      Username: submission.user_id.username,
      Branch: submission.user_id.branch?.toUpperCase() || "N/A",
      Batch: submission.user_id.batch?.toUpperCase() || "N/A",
      Semester: submission.user_id.semester || "N/A",
      "Test Cases Passed": `${submission.numberOfTestCasePass || 0}/${
        submission.numberOfTestCase || 0
      }`,
      "Submission Date": formatDate(submission.createdAt),
      Marks: submission.totalMarks ?? "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(worksheet, [
      [`Total Submissions: ${totalSubmissions}`],
    ]);
    XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: "A3" });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");

    XLSX.writeFile(workbook, "Submissions.xlsx");
  };

  const downloadPDF = () => {
    const totalSubmissions = filteredSubmissions.length;

    const doc = new jsPDF();
    const tableColumnHeaders = [
      "ID",
      "Username",
      "Branch",
      "Batch",
      "Semester",
      "Test Cases Passed",
      "Submission Date",
      "Marks",
    ];
    const tableRows = filteredSubmissions.map((submission) => [
      submission.user_id.id,
      submission.user_id.username,
      submission.user_id.branch?.toUpperCase() || "N/A",
      submission.user_id.batch?.toUpperCase() || "N/A",
      submission.user_id.semester || "N/A",
      `${submission.numberOfTestCasePass || 0}/${
        submission.numberOfTestCase || 0
      }`,
      formatDate(submission.createdAt),
      submission.totalMarks ?? "N/A",
    ]);

    // Add a title and the total submissions
    doc.text("Submissions Report", 14, 15);
    doc.text(`Total Submissions: ${totalSubmissions}`, 14, 25);

    // Generate the table
    doc.autoTable({
      head: [tableColumnHeaders],
      body: tableRows,
      startY: 30,
    });

    doc.save("Submissions.pdf");
  };

  return (
    <>
      <div className="relative min-h-screen bg-gray-900 text-white">
        <div className="mx-auto px-5 pt-20 pb-5">
          {problemTitle && (
            <div className="mb-6 bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
              <h3 className="text-2xl sm:text-3xl font-bold text-blue-400 mb-4">
                {problemTitle}
              </h3>
              <div className="flex flex-col sm:flex-row sm:justify-between text-base sm:text-lg">
                <p className="font-semibold text-gray-300 mb-2 sm:mb-0">
                  Difficulty:{" "}
                  <span className="text-blue-300">{difficulty}</span>
                </p>
                <p className="font-semibold text-gray-300">
                  Created on:{" "}
                  <span className="text-gray-400">{formatDate(createdAt)}</span>
                </p>
              </div>
            </div>
          )}

          <div className="mb-4 font-medium text-xl  text-gray-300">
            Total Number of Submissions :{" "}
            {TotalSubmission ? TotalSubmission : "0"}
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:justify-between items-center">
            {/* Filters Section */}
            <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
              <select
                value={filters.branch}
                onChange={(e) => updateFilter("branch", e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Branches</option>
                <option value="CSPIT-IT">CSPIT-IT</option>
                <option value="CSPIT-CSE">CSPIT-CSE</option>
                <option value="CSPIT-CE">CSPIT-CE</option>
              </select>
              <select
                value={filters.semester}
                onChange={(e) => updateFilter("semester", e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Semesters</option>
                {[...Array(8)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Semester {i + 1}
                  </option>
                ))}
              </select>
              {/* <select
                value={filters.language}
                onChange={(e) => updateFilter("language", e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Languages</option>
                <option value="CPP">C++</option>
                <option value="PYTHON">Python</option>
                <option value="JAVA">Java</option>
              </select> */}
              {/* <select
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
              </select> */}

              <select
                value={filters.batch}
                onChange={(e) => updateFilter("batch", e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Batches</option>
                {["A", "B", "C", "D"].map((letter) =>
                  [1, 2].map((num) => (
                    <option key={`${letter}${num}`} value={`${letter}${num}`}>
                      {`${letter}${num}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Back Button Section */}
            <div>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all duration-200 ease-in-out"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  focusable="false"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="white"
                >
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path>
                </svg>
                Back
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-4 mb-4">
            <button
              onClick={downloadExcel}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded shadow transition-all duration-200"
            >
              Download Excel
            </button>
            <button
              onClick={downloadPDF}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow transition-all duration-200"
            >
              Download PDF
            </button>
          </div>

          {/* Submissions Table */}
          <div className="overflow-x-auto">
            <div className="mb-4 font-medium text-xl text-gray-300">
              Total After Filter of Submissions:{" "}
              {filteredSubmissions.length > 0
                ? filteredSubmissions.length
                : "0"}
            </div>

            <table className="w-full min-w-max text-sm text-left text-gray-400 border-collapse border border-gray-600">
              <thead className="bg-gray-800 text-gray-300">
                <tr>
                  <th
                    className="py-3 px-6 border border-gray-600 text-sm md:text-base cursor-pointer"
                    onClick={() => handleSort("id")}
                  >
                    ID
                  </th>
                  <th
                    className="py-3 px-6 border border-gray-600 text-sm md:text-base cursor-pointer"
                    onClick={() => handleSort("username")}
                  >
                    User Name
                  </th>
                  <th className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                    Branch
                  </th>
                  <th
                    className="py-3 px-6 border border-gray-600 text-sm md:text-base cursor-pointer"
                    onClick={() => handleSort("batch")}
                  >
                    Batch
                  </th>
                  <th
                    className="py-3 px-6 border border-gray-600 text-sm md:text-base cursor-pointer"
                    onClick={() => handleSort("semester")}
                  >
                    Semester
                  </th>
                  {/* <th className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                    Language
                  </th> */}
                  {/* <th className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                    Status
                  </th> */}
                  <th className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                    TestCase Pass
                  </th>
                  <th className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                    Submission Date
                  </th>
                  <th className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                    Marks
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="py-6 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
                        <p className="mt-4 text-blue-500 text-lg font-medium">
                          Loading, please wait...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredSubmissions.length > 0 ? (
                  filteredSubmissions.map((submission, index) => (
                    <tr
                      key={submission._id}
                      className={`${
                        index % 2 === 0 ? "bg-gray-900" : "bg-gray-800"
                      } hover:bg-gray-700 text-gray-300 cursor-pointer transition-all duration-200`}
                      onClick={() => navigate("/submissions/" + submission._id)}
                    >
                      <td className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                        {submission.user_id.id}
                      </td>
                      <td className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                        {submission.user_id.username}
                      </td>
                      <td className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                        {submission.user_id.branch?.toUpperCase() || "N/A"}
                      </td>
                      <td className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                        {submission.user_id.batch?.toUpperCase() || "N/A"}
                      </td>
                      <td className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                        {submission.user_id.semester || "N/A"}
                      </td>
                      {/* <td className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                        {submission.language || "N/A"}
                      </td> */}
                      {/* <td
                        className={`py-3 px-6 border border-gray-600 capitalize text-sm md:text-base ${
                          submission.status === "completed"
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {submission.status}
                      </td> */}
                      <td className="py-3 px-6 border border-gray-600 capitalize text-sm md:text-base">
                        {submission.numberOfTestCasePass != null &&
                        submission.numberOfTestCase != null
                          ? `${submission.numberOfTestCasePass}/${submission.numberOfTestCase}`
                          : "N/A"}
                      </td>
                      <td className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                        {formatDate(submission?.createdAt)}
                      </td>
                      <td className="py-3 px-6 border border-gray-600 text-sm md:text-base">
                        {submission?.totalMarks ?? "N/A"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="10"
                      className="py-3 px-6 text-center text-gray-400 border border-gray-600"
                    >
                      No submissions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
