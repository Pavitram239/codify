import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import toast from "react-hot-toast";
import { BeatLoader } from "react-spinners";

const Faculty = () => {
  const user = useSelector((store) => store.app.user);
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const PAGE_SIZE = 10;

  // Only faculty allowed
  useEffect(() => {
    if (user?.role !== "faculty") navigate("/");
  }, [user, navigate]);

  // Fetch users with pagination
  const fetchUsers = async (page = 1) => {
    let facultyId = user._id;
    // console.log("This is faculty id: ", facultyId);

    if (!facultyId) {
      toast.error("Faculty ID is required.");
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.get(
        `/faculty/get-pending-users?page=${page}&facultyId=${facultyId}`
      );
      // console.log(response.data);

      if (response?.data?.success) {
        setPendingUsers(Array.isArray(response.data.data) ? response.data.data : []);
        setTotalPages(response.data.totalPages || 0);
      } else {
        setPendingUsers([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("An error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage]);

  // Accept a single user
  const handleAcceptUser = async (userId) => {
    let facultyId = user._id;

    if (!facultyId) {
      toast.error("Faculty ID is required.");
      return;
    }

    setActionLoading(userId);
    try {
      const response = await axiosInstance.post(`/faculty/accept-request`, {
        userId,
        facultyId,
      });

      if (response.data.success) {
        toast.success("User accepted successfully.");
        setPendingUsers((prev) => prev.filter((user) => user._id !== userId));
      } else {
        toast.error(response.data.message || "Failed to accept user.");
      }
    } catch (error) {
      console.error("Error accepting user:", error);
      toast.error("An error occurred while accepting the user.");
    } finally {
      setActionLoading(false);
    }
  };

  // Decline a single user
  const handleDeclineUser = async (userId) => {
    let facultyId = user._id;

    if (!facultyId) {
      toast.error("Faculty ID is required.");
      return;
    }

    setActionLoading(userId);
    try {
      const response = await axiosInstance.post(`/faculty/decline-request`, {
        userId,
        facultyId,
      });

      if (response.data.success) {
        toast.success(response.data.message || "User declined successfully.");
        setPendingUsers((prev) => prev.filter((user) => user._id !== userId));
      } else {
        toast.error(response.data.message || "Failed to decline user.");
      }
    } catch (error) {
      console.error("Error declining user request:", error);
      toast.error("An error occurred while declining the user.");
    } finally {
      setActionLoading(false);
    }
  };

  // Accept all pending users
  const handleAcceptAll = async () => {
    let facultyId = user._id;

    if (!facultyId) {
      toast.error("Faculty ID is required.");
      return;
    }

    setActionLoading(true);
    try {
      const response = await axiosInstance.post(
        `/faculty/accept-all-requests`,
        {
          facultyId,
        }
      );

      if (response.data.success) {
        toast.success(
          response.data.message || "All pending users have been approved."
        );
        setPendingUsers([]);
        fetchUsers(currentPage);
      } else {
        toast.error(response.data.message || "Failed to accept all users.");
      }
    } catch (error) {
      console.error("Error accepting all users:", error);
      toast.error("An error occurred while accepting all users.");
    } finally {
      setActionLoading(false);
    }
  };

  // Decline all pending users
  const handleDeclineAll = async () => {
    setActionLoading(true);
    try {
      const response = await axiosInstance.post(
        `/faculty/decline-all-requests`,
        {
          facultyId: user._id,
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setPendingUsers([]);
        fetchUsers(currentPage);
      } else {
        toast.error(response.data.message || "Failed to decline all users.");
      }
    } catch (error) {
      toast.error("An error occurred while declining all users.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="bg-gray-900 text-gray-100 min-h-screen overflow-hidden">
        <div className="flex justify-between items-center mb-4 p-6 pt-[100px]">
          <h1 className="text-2xl font-bold">
            Pending User Requests For Subject {user?.subject}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptAll}
              disabled={pendingUsers.length === 0}
              className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {actionLoading ? (
                <BeatLoader size={10} color="#fff" />
              ) : (
                "Accept All"
              )}
            </button>
            <button
              onClick={handleDeclineAll}
              disabled={pendingUsers.length === 0}
              className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              {actionLoading ? (
                <BeatLoader size={10} color="#fff" />
              ) : (
                "Decline All"
              )}
            </button>
          </div>
        </div>

        <div className="p-4">
          <button className="bg-blue-500 hover:bg-blue-600 text-white mr-2 font-bold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
          onClick={() => navigate("/add-student-using-file")}>
            Add Student Using File
          </button>
          <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
          onClick={() => navigate("/registerStudent")}>
            Register Student 
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <BeatLoader size={15} color="#4A90E2" />
          </div>
        ) : (
          <div className="p-4">
            <table className="min-w-full  text-lg text-left text-gray-500">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="py-3 px-6">#</th>
                  <th className="py-3 px-6">Id</th>
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">Mobile No</th>
                  <th className="py-3 px-6">Branch</th>
                  <th className="py-3 px-6">Semester</th>
                  <th className="py-3 px-6">Batch</th>
                  <th className="py-3 px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.length > 0 ? (
                  pendingUsers.map((user, index) => (
                    <tr
                      key={user._id}
                      className={`${
                        index % 2 === 0 ? "bg-gray-900" : "bg-gray-800"
                      }`}
                    >
                      <td className="py-3 px-6">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="py-3 px-6 text-gray-300">{user.id}</td>
                      <td className="capitalize py-3 px-6">{user.username}</td>
                      <td className="py-3 px-6 text-gray-300">
                        {user.mobileNo}
                      </td>
                      <td className="py-3 px-6">{user.branch}</td>
                      <td className="py-3 px-6 text-gray-300">
                        {user.semester}
                      </td>
                      <td className="py-3 px-6">{user.batch}</td>
                      <td className="py-3 px-6 flex gap-2">
                        <button
                          onClick={() => handleAcceptUser(user._id)}
                          disabled={actionLoading === user._id}
                          className="bg-green-600 text-white py-1 px-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {actionLoading === user._id ? (
                            <BeatLoader size={10} color="#fff" />
                          ) : (
                            "Accept"
                          )}
                        </button>
                        <button
                          onClick={() => handleDeclineUser(user._id)}
                          disabled={actionLoading === user._id}
                          className="bg-red-600 text-white py-1 px-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                        >
                          {actionLoading === user._id ? (
                            <BeatLoader size={10} color="#fff" />
                          ) : (
                            "Decline"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="py-3 px-6 text-center text-gray-300"
                    >
                      No pending users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-center mt-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="cursor-pointer bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            Previous
          </button>
          <span className="mx-4 mt-1 text-white">{`Page ${currentPage} of ${totalPages}`}</span>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="cursor-pointer bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
};

export default Faculty;
