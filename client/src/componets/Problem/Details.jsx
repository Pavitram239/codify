import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import SubmissionReview from "../workspace/SubmissionReview";
import { RequestState } from "../workspace/WorkspaceUI";

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
    <div>
      {/* Back button */}

      {/* Show loading spinner or message */}
      {loading && (
        <RequestState loading />
      )}

      {/* Show error message */}
      {error && (
        <div className="workspace-error" role="alert">
          <button
            onClick={() => navigate(-1)}
            className="workspace-button workspace-button--secondary"
          >
            Back
          </button>
          {error}
        </div>
      )}

      {/* Render SubmissionDetails Component */}
      {!loading && !error && submission && (
        <SubmissionReview
          submission={submission}
          onBack={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default Details;
