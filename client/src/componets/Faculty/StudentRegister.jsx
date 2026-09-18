import React, { useState } from "react";
import * as XLSX from "xlsx";
import axiosInstance from "../../utils/axiosInstance";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const StudentRegister = () => {
  const [students, setStudents] = useState([]); // Holds parsed Excel data
  const [selectedStudents, setSelectedStudents] = useState({}); // Tracks selected students for registration
  const [errorMessages, setErrorMessages] = useState([]); // Holds error messages from the backend
  const user = useSelector((store) => store.app.user);
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal visibility state
  const [newStudent, setNewStudent] = useState({
    id: "",
    username: "",
    batch: "",
    semester: "",
  });
  const navigate = useNavigate();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    // console.log(file);

    if (!file) return;

    // Create a FileReader to read the file
    const reader = new FileReader();

    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result); // Read the file as ArrayBuffer
      const workbook = XLSX.read(data, { type: "array" }); // Parse the Excel data into a workbook
      const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Get the first sheet
      const parsedData = XLSX.utils.sheet_to_json(sheet); // Parse the sheet into JSON data
      // console.log("Parsed Data:", parsedData); // Log parsed data to debug

      // Transform parsed data to expected format
      setStudents(
        parsedData.map((row, index) => ({
          id: row.ID?.toLowerCase() || "", // Match the key 'ID' in the parsed data
          username: row.Username || "", // Match the key 'Username'
          batch: row.Batch?.toLowerCase() || "", // Match the key 'Batch'
          semester: row.Semester || "", // Match the key 'Semester'
          index,
        }))
      );

      // Reset selected students and error messages
      setSelectedStudents({});
      setErrorMessages([]);
    };

    reader.readAsArrayBuffer(file); // Start reading the file
  };

  // Toggle select all students
  const toggleSelectAll = () => {
    if (Object.keys(selectedStudents).length === students.length) {
      setSelectedStudents({});
    } else {
      const allSelected = {};
      students.forEach((student) => (allSelected[student.index] = true));
      setSelectedStudents(allSelected);
    }
  };

  // Handle individual student selection toggle
  const toggleSelectStudent = (index) => {
    setSelectedStudents((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Submit selected students or registration

  const facultyId = user._id;

  const handleRegisterSelected = async () => {
    const selectedData = students.filter(
      (student) => selectedStudents[student.index]
    );

    if (selectedData.length === 0) {
      toast.error("No students selected for registration.");
      return;
    }

    try {
      const response = await axiosInstance.post("/faculty/bulk-register", {
        students: selectedData,
        facultyId,
      });

      // Display success and error messages from the response
      const { results } = response.data;
      setErrorMessages([
        ...results.errors.map((err) => `${err.id}: ${err.message}`),
      ]);

      // Optionally, you can display success messages as well
      if (results.success.length > 0) {
        toast.success("Registration completed successfully.");
      }

      // Remove successfully registered students from the list
      setStudents((prev) =>
        prev.filter((student) => !selectedStudents[student.index])
      );
      setSelectedStudents({});
    } catch (error) {
      console.error(error);
      toast.error(
        "Error registering students. Please check console for details."
      );
    }
  };

  const handleModalSubmit = () => {
    if (!newStudent.id || !newStudent.username || !newStudent.batch || !newStudent.semester) {
      toast.error("Please fill in all fields.");
      return;
    }
  
    // Add the new student to the list
    setStudents((prev) => [
      ...prev,
      {
        id: newStudent.id.toLowerCase(),
        username: newStudent.username,
        batch: newStudent.batch.toLowerCase(),
        semester: newStudent.semester,
        index: students.length,
      },
    ]);
  
    // Reset the form and close the modal
    setNewStudent({ id: "", username: "", batch: "", semester: "" });
    setIsModalOpen(false);
    toast.success("Student added successfully!");
  };

  // Handle declining a single student
  const handleDecline = (index) => {
    setStudents((prev) => prev.filter((student) => student.index !== index));
    setSelectedStudents((prev) => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Calculate the total pages
  const totalPages = Math.ceil(students.length / PAGE_SIZE);

  // Slice the students to display only the current page data
  const paginatedStudents = students.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Handlers for pagination
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="relative min-h-screen bg-gray-900 text-white">

      <div className="pl-10 pt-[6%]">
        <button
          className="py-2 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition transform duration-200"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>

      
      <div className="pl-10 pr-10 mt-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-4">Bulk Student Registration</h1>
          {/* File Upload Input */}
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="mb-4"
            style={{hover:"cursor:pointer"}}
          />
        </div>
        <div>
        <button
          className="py-2 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition transform duration-200"
          onClick={() => setIsModalOpen(true)}
        >
          Add Single Student
        </button>
        </div>
      </div>

      {/* Render Student Data Table */}
      {students.length > 0 ? (
        <div className="overflow-x-auto bg-gray-900 shadow-md rounded-lg p-8">
          <table className="min-w-full text-lg text-left text-gray-500">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="py-3 px-6">
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={
                      Object.keys(selectedStudents).length === students.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-3 px-6">#</th>
                <th className="py-3 px-6">ID</th>
                <th className="py-3 px-6">Username</th>
                <th className="py-3 px-6">Batch</th>
                <th className="py-3 px-6">Semester</th>
                <th className="py-3 px-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student, index) => (
                <tr
                  key={index}
                  className={`${
                    index % 2 === 0 ? "bg-gray-900" : "bg-gray-800"
                  }`}
                >
                  <td className="py-3 px-6">
                    <input
                      type="checkbox"
                      className="accent-blue-500"
                      checked={!!selectedStudents[student.index]}
                      onChange={() => toggleSelectStudent(student.index)}
                    />
                  </td>
                  <td className="py-3 px-6">
                    {(index + 1 + (currentPage - 1) * PAGE_SIZE)
                      .toString()
                      .padStart(2, "0")}
                  </td>
                  <td className="py-3 px-6">{student.id}</td>
                  <td className="capitalize py-3 px-6">{student.username}</td>
                  <td className="py-3 px-6">{student.batch}</td>
                  <td className="py-3 px-6">{student.semester}</td>
                  <td className="py-3 px-6 flex gap-2">
                    <button
                      className="bg-red-600 text-white py-1 px-3 rounded-lg hover:bg-red-700 transition"
                      onClick={() => handleDecline(student.index)}
                    >
                      Decline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-gray-300 pr-2 pl-2 ">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>

          <button
            onClick={handleRegisterSelected}
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg shadow transition"
          >
            Register Selected
          </button>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <p>No data available</p>
        </div>
      )}

      {/* Display error messages */}
      <div className="p-4">
        {errorMessages.length > 0 && (
          <div className="mt-4 bg-red-100 text-red-800 p-4 rounded">
            <h3 className="font-bold">Errors:</h3>
            <ul>
              {errorMessages.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>



      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-900 rounded-lg shadow-lg p-8" style={{width:"40%"}}>
            <h2 className="text-2xl font-bold text-white mb-4">Add Student</h2>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Student ID"
                value={newStudent.id}
                onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
                className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"
              />
              <input
                type="text"
                placeholder="Username"
                value={newStudent.username}
                onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"
              />
              <input
                type="text"
                placeholder="Batch"
                value={newStudent.batch}
                onChange={(e) => setNewStudent({ ...newStudent, batch: e.target.value })}
                className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"
              />
              <input
                type="text"
                placeholder="Semester"
                value={newStudent.semester}
                onChange={(e) => setNewStudent({ ...newStudent, semester: e.target.value })}
                className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"
              />
              <div className="flex justify-end gap-4">
                <button
                  className="py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition"
                  onClick={handleModalSubmit}
                >
                  Add Student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentRegister;
