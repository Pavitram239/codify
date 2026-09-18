import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useParams } from "react-router-dom";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ContestDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    sortBy: 'totalMarks',
    sortOrder: 'asc',
    branch: 'cspit-it',
    semester: '6',
    batch: 'a1'
  });

  const { id } = useParams();
  const pageSizeOptions = [10, 20, 50, 100, 500, 1000];

  const branchOptions = [
    { value: 'ALL', label: 'All Branches' },
    { value: 'cspit-it', label: 'CSPIT-IT' },
    { value: 'cspit-ce', label: 'CSPIT-CE' },
    { value: 'cspit-cse', label: 'CSPIT-CSE' }
  ];

  const semesterOptions = [
    { value: 'ALL', label: 'All Semesters' },
    ...Array.from({ length: 8 }, (_, i) => ({
      value: String(i + 1),
      label: `Semester ${i + 1}`
    }))
  ];

  const batchOptions = [
    { value: 'ALL', label: 'All Batches' },
    ...['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2'].map(batch => ({
      value: batch,
      label: `Batch ${batch}`
    }))
  ];

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams(filters);
      const response = await axiosInstance.get(`/contests/${id}/dashboard?${queryParams}`);
      console.log(response.data)
      setDashboardData(response.data);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [id, filters]);

  const downloadExcel = () => {
    if (!dashboardData?.rankings) return;

    const data = dashboardData.rankings.map(student => ({
      Rank: student.rank,
      'Student ID': student.studentId,
      Name: student.username,
      Branch: student.branch,
      Semester: student.semester,
      Batch: student.batch,
      ...student.problemMarks.reduce((acc, mark, index) => {
        acc[`Problem ${index + 1} Marks`] = mark;
        return acc;
      }, {}),
      'Total Marks': student.totalMarks,
      'Last Submission Date': student.lastSubmissionDate,
      'Last Submission Time': student.lastSubmissionTime
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Rankings");
    XLSX.writeFile(wb, `${dashboardData.contestName}-rankings.xlsx`);
  };

  const downloadPDF = () => {
    if (!dashboardData?.rankings) return;

    const doc = new jsPDF();
    doc.text(dashboardData.contestName, 14, 15);

    const head = [
      ['Rank', 'Student ID', 'Name', 'Branch', 'Semester', 'Batch', ...dashboardData.problemNames.map((_, index) => `Problem ${index + 1} Marks`), 'Total Marks', 'Last Submission Date', 'Last Submission Time']
    ];
    const body = dashboardData.rankings.map(student => [
      student.rank,
      student.studentId,
      student.username,
      student.branch,
      student.semester,
      student.batch,
      ...student.problemMarks,
      student.totalMarks,
      student.lastSubmissionDate,
      student.lastSubmissionTime
    ]);

    doc.autoTable({
      startY: 25,
      head,
      body
    });
    doc.save(`${dashboardData.contestName}-rankings.pdf`);
  };

  const handleSort = (sortBy) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy ? (prev.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc',
      page: 1
    }));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 pt-20">
      <div className="max-w-7xl mx-auto">
        {/* Header - Always visible */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {dashboardData?.contestName || "Contest Dashboard"}
            </h1>
            <div className="text-gray-400 mt-2">
              Total Submissions: {dashboardData?.pagination?.totalStudents || 0}
              {dashboardData?.sortBy && (
                <span className="ml-2">
                  | Filtered: {dashboardData.pagination.totalStudents} students
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            {/* Controls - Always visible but disabled during loading */}
            <select 
              value={filters.limit}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                limit: Number(e.target.value),
                page: 1 
              }))}
              className="bg-gray-700 rounded px-2 py-1"
              disabled={loading}
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>

            <select 
              value={filters.branch}
              onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value, page: 1 }))}
              className="bg-gray-700 rounded px-2 py-1"
              disabled={loading}
            >
              {branchOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select 
              value={filters.semester}
              onChange={(e) => setFilters(prev => ({ ...prev, semester: e.target.value, page: 1 }))}
              className="bg-gray-700 rounded px-2 py-1"
              disabled={loading}
            >
              {semesterOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select 
              value={filters.batch}
              onChange={(e) => setFilters(prev => ({ ...prev, batch: e.target.value, page: 1 }))}
              className="bg-gray-700 rounded px-2 py-1"
              disabled={loading}
            >
              {batchOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <button 
              onClick={downloadExcel} 
              className="bg-green-600 px-3 py-1 rounded"
              disabled={loading || !dashboardData?.rankings?.length}
            >
              Excel
            </button>
            <button 
              onClick={downloadPDF} 
              className="bg-red-600 px-3 py-1 rounded"
              disabled={loading || !dashboardData?.rankings?.length}
            >
              PDF
            </button>
          </div>
        </div>

        {/* Table - Always visible with conditional content */}
        <div className="overflow-x-auto bg-gray-800 rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-700">
                <th className="p-3 text-left">Rank</th>
                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('studentId')}>ID</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Branch</th>
                <th className="p-3 text-left">Semester</th>
                <th className="p-3 text-left">Batch</th>
                {dashboardData?.problemNames?.map((problem, index) => (
                  <th key={index} className="p-3 text-right">
                    {problem.name}<br/>
                    <span className="text-sm text-gray-400">({problem.maxMarks})</span>
                  </th>
                ))}
                <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('totalMarks')}>Total Marks</th>
                <th className="p-3 text-right">Last Submission</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>Loading submissions...</span>
                    </div>
                  </td>
                </tr>
              ) : dashboardData?.rankings?.length ? (
                dashboardData.rankings.map((student) => (
                  <tr key={student.studentId} className="border-t border-gray-700 hover:bg-gray-700">
                    <td className="p-3">{student.rank}</td>
                    <td className="p-3">{student.studentId}</td>
                    <td className="p-3">{student.username}</td>
                    <td className="p-3">{student.branch}</td>
                    <td className="p-3">{student.semester}</td>
                    <td className="p-3">{student.batch}</td>
                    {student.problemMarks.map((marks, index) => (
                      <td key={index} className="p-3 text-right">
                        {marks || '-'}
                      </td>
                    ))}
                    <td className="p-3 text-right">{student.totalMarks}</td>
                    <td className="p-3 text-right">
                      <div>{student.lastSubmissionDate}</div>
                      <div className="text-sm text-gray-400">{student.lastSubmissionTime}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-8 text-center">
                    No submissions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Show only when we have data */}
        {dashboardData?.rankings?.length > 0 && (
          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm">
              Showing {((filters.page - 1) * filters.limit) + 1} to{' '}
              {Math.min(filters.page * filters.limit, dashboardData.pagination.totalStudents)} of{' '}
              {dashboardData.pagination.totalStudents} submissions
              {filters.sortBy !== 'totalMarks' && (
                <span className="ml-2 text-gray-400">
                  (Filtered from {dashboardData.pagination.totalStudents} total)
                </span>
              )}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: dashboardData.pagination.totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setFilters(prev => ({ ...prev, page: i + 1 }))}
                  className={`px-3 py-1 rounded ${
                    filters.page === i + 1 ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                  disabled={loading}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Statistics Panel */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Total Submissions</h3>
            <p className="text-2xl">{dashboardData?.pagination?.totalStudents || 0}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Filtered Count</h3>
            <p className="text-2xl">{dashboardData?.pagination?.totalStudents || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContestDashboard;