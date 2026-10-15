import PropTypes from "prop-types";
import { useState } from "react";

const StudentTable = ({
  users,
  selectedStudents,
  handleSelectAll,
  handleSelectStudent,
  filters,
  updateFilter,
  loading,
  currentPage,
  itemsPerPage,
  handlePageChange,
  totalPages,
}) => {
  const [sortConfig, setSortConfig] = useState({
    key: "id",
    direction: "asc",
  });

  console.log(users);

  // Apply filters
  const filteredUsers = users.filter((user) => {
    const branchMatch =
      filters.branch === "ALL" || user.branch === filters.branch;
    const semesterMatch =
      filters.semester === "ALL" ||
      user.semester.toString().toUpperCase() === filters.semester.toUpperCase();
    const batchMatch =
      filters.batch === "ALL" ||
      user.batch.toUpperCase() === filters.batch.toUpperCase();

    return branchMatch && semesterMatch && batchMatch;
  });

  // Sorting logic
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const keyA = a[sortConfig.key]?.toString().toLowerCase() || "";
    const keyB = b[sortConfig.key]?.toString().toLowerCase() || "";

    // Custom sorting for semester types like A1, B1, etc.
    if (sortConfig.key === "semester") {
      const parseSemester = (val) => {
        const match = val.match(/^([A-D])(\d)$/);
        if (match) {
          const [, letter, num] = match;
          return [letter.charCodeAt(0), parseInt(num, 10)];
        }
        return [0, parseInt(val, 10)];
      };
      const [charA, numA] = parseSemester(keyA);
      const [charB, numB] = parseSemester(keyB);

      if (charA !== charB)
        return sortConfig.direction === "asc" ? charA - charB : charB - charA;
      return sortConfig.direction === "asc" ? numA - numB : numB - numA;
    }

    // Default string sorting
    if (keyA < keyB) return sortConfig.direction === "asc" ? -1 : 1;
    if (keyA > keyB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key) => {
    setSortConfig((prev) => {
      const isSameKey = prev.key === key;
      const newDirection = isSameKey
        ? prev.direction === "asc"
          ? "desc"
          : "asc"
        : "asc"; // Corrected this line
      return { key, direction: newDirection };
    });
  };

  return (
    <div className="overflow-x-auto p-4">
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:justify-between items-center pl-4">
        <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
          <select
            value={filters.branch}
            onChange={(e) => updateFilter("branch", e.target.value)}
            className="ui-surface text-slate-900 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Branches</option>
            <option value="cspit-it">CSPIT-IT</option>
            <option value="cspit-cse">CSPIT-CSE</option>
            <option value="cspit-ce">CSPIT-CE</option>
          </select>
          <select
            value={filters.semester}
            onChange={(e) => updateFilter("semester", e.target.value)}
            className="ui-surface text-slate-900 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Semesters</option>
            {[...Array(8)].map((_, i) => (
              <option key={`semester-${i + 1}`} value={i + 1}>
                Semester {i + 1}
              </option>
            ))}
          </select>
          <select
            value={filters.batch}
            onChange={(e) => updateFilter("batch", e.target.value)}
            className="ui-surface text-slate-900 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Batches</option>
            {["a", "b", "c", "d"].map((letter) =>
              [1, 2].map((num) => (
                <option key={`${letter}${num}`} value={`${letter}${num}`}>
                  {`${letter}${num}`}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="mb-4 text-slate-600 pl-4">
        <span className="font-bold">{filteredUsers.length}</span>{" "}
        {filteredUsers.length === 1 ? "student" : "students"} found.
      </div>

      {/* Students Table */}
      <div className="p-4">
        <div className="overflow-hidden rounded-lg border border-slate-200 ui-page ui-card-shadow">
          <table className="w-full border-collapse text-left text-slate-600">
            <thead>
              <tr className="border-b border-slate-200 ui-page">
                <th className="py-4 px-4 text-center">
                  <button
                    onClick={handleSelectAll}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-slate-900 transition-all hover:bg-blue-700 hover:ui-card-shadow hover:shadow-blue-500/20 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                  >
                    {selectedStudents.length === filteredUsers.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </th>
                <th
                  className="group cursor-pointer py-4 px-4 text-center text-sm font-medium uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900"
                  onClick={() => handleSort("id")}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>ID</span>
                    {sortConfig.key === "id" && (
                      <span className="text-blue-700">
                        {sortConfig.direction === "asc" ? " ↑" : " ↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="group cursor-pointer py-4 px-4 text-center text-sm font-medium uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900"
                  onClick={() => handleSort("username")}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Username</span>
                    {sortConfig.key === "username" && (
                      <span className="text-blue-700">
                        {sortConfig.direction === "asc" ? " ↑" : " ↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-4 px-4 text-center text-sm font-medium uppercase tracking-wider text-slate-600">
                  Branch
                </th>
                <th
                  className="group cursor-pointer py-4 px-4 text-center text-sm font-medium uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900"
                  onClick={() => handleSort("semester")}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Semester</span>
                    {sortConfig.key === "semester" && (
                      <span className="text-blue-700">
                        {sortConfig.direction === "asc" ? " ↑" : " ↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-4 px-4 text-center text-sm font-medium uppercase tracking-wider text-slate-600">
                  Batch
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500"></div>
                      <p className="mt-4 text-lg font-medium text-blue-700">
                        Loading, please wait...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length > 0 ? (
                paginatedUsers.map((student, index) => (
                  <tr
                    key={student._id}
                    className={`transition-colors ${
                      index % 2 === 0 ? "ui-page" : "ui-page"
                    } hover:ui-page`}
                  >
                    <td className="py-4 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student._id)}
                        onChange={() => handleSelectStudent(student._id)}
                        className="h-4 w-4 rounded border-slate-200 ui-surface text-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                      />
                    </td>
                    <td className="whitespace-nowrap py-4 px-4 text-center font-medium text-slate-900">
                      {student.id?.toUpperCase()}
                    </td>
                    <td className="py-4 px-4 text-center text-slate-900">
                      {student.username}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex rounded-full ui-surface px-3 py-1 text-sm font-medium text-slate-900">
                        {student.branch?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-medium text-slate-900">
                      {student.semester}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-700">
                        {student.batch?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="py-8 text-center text-lg text-slate-600"
                  >
                    No students found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mb-4 flex items-center justify-center space-x-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center space-x-2 rounded-lg ui-surface px-4 py-2 text-sm font-medium text-slate-900 transition-all hover:ui-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:ui-surface"
        >
          <span>Previous</span>
        </button>
        <div className="rounded-lg ui-surface px-4 py-2 text-sm font-medium text-slate-600">
          Page {currentPage} of {totalPages}
        </div>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center space-x-2 rounded-lg ui-surface px-4 py-2 text-sm font-medium text-slate-900 transition-all hover:ui-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:ui-surface"
        >
          <span>Next</span>
        </button>
      </div>
    </div>
  );
};


StudentTable.propTypes = {
  users: PropTypes.any,
  selectedStudents: PropTypes.object,
  handleSelectAll: PropTypes.func,
  handleSelectStudent: PropTypes.func,
  filters: PropTypes.object,
  updateFilter: PropTypes.any,
  loading: PropTypes.bool,
  currentPage: PropTypes.number,
  itemsPerPage: PropTypes.any,
  handlePageChange: PropTypes.func,
  totalPages: PropTypes.number,
};

export default StudentTable;