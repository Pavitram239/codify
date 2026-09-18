import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useSelector } from "react-redux";
import SubmissionList from "./SubmissionList.jsx";

const Submission = ({ problemId, latestSubmission }) => {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(
    latestSubmission || null
  );
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = useSelector((state) => state.app.user);
  const userId = user._id;

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null); 

      const response = await axiosInstance.get("/submissions", {
        params: { problem_id: problemId },
      });

      if (response.data.data?.length === 0) {
        setSubmissions([]);
        setError("No submissions found for this problem.");
      } else {
        const sortedSubmissions = response.data.data.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setSubmissions(sortedSubmissions);
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
      setError(
        error.response?.data?.message ||
          "Failed to load submissions. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [userId, problemId]);

  useEffect(() => {
    if (latestSubmission) {
      setSelectedSubmission(latestSubmission);
    }
  }, [latestSubmission]);

  return (
    <div className="bg-gray-900 p-2 rounded-lg shadow-lg">
      <SubmissionList
        submissions={submissions}
        onSelect={setSelectedSubmission}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default Submission;
