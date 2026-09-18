import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import SubmissionDetails from "./SubmissionDetails"; // Adjust the import path as necessary.

const Details = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubmissionDetails = async () => {
      try {
        const response = await axiosInstance.get(
          `/submissions/${submissionId}`
        );
        setSubmission(response.data);
        // console.log(response.data);
      } catch (err) {
        setError(
          err.response?.data?.error || "Failed to fetch submission details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissionDetails();
  }, [submissionId]);

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* Back button */}
      <div className="pt-20"></div>

      {/* Show loading spinner or message */}
      {loading && (
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="loader border-t-4 border-blue-500 rounded-full w-12 h-12 animate-spin"></div>
          <span className="ml-4 text-lg">Loading...</span>
        </div>
      )}

      {/* Show error message */}
      {error && (
        <div className="text-red-500 text-center mt-4 pt-20">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2  bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Back
          </button>
          {error}
        </div>
      )}

      {/* Render SubmissionDetails Component */}
      {!loading && !error && submission && (
        <SubmissionDetails
          submission={submission}
          onBack={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default Details;
