import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import axiosInstance from "../../utils/axiosInstance";
import {
  Card,
  Metric,
  PageHeading,
  Record,
  RequestState,
  Status,
} from "./WorkspaceUI";
import { formatDate, formatTime, statusLabels } from "../../utils/assessment";

export default function StudentHome() {
  const user = useSelector((state) => state.app.user);
  const [data, setData] = useState({ contests: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      axiosInstance.get("/contests"),
      axiosInstance.get("/submissions/user/submissions", {
        params: { page: 1, limit: 10 },
      }),
    ])
      .then(([contests, history]) => {
        if (active)
          setData({
            contests: Array.isArray(contests.data) ? contests.data : [],
            history: history.data.submissions || [],
          });
      })
      .catch((err) => {
        if (active)
          setError(
            err.response?.data?.message || "Unable to load your classroom.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const name = user?.profile?.name || user?.username || "there";
  const context = user?.subject || user?.branch || "Coding assessments";
  const next = [...data.contests]
    .filter((item) => ["upcoming", "ongoing"].includes(item.status))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
  const latest = data.history.find((item) => item.status !== "pending");
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const reviewTo = next ? `/contests/${next._id || next.id}` : "/make-contest";
  const marks = next?.problems?.reduce(
    (sum, problem) => sum + (Number(problem.maxMarks) || 0),
    0,
  );
  return (
    <div className="workspace-home">
      <PageHeading
        context={`${user?.institution || "Codify classroom"} / ${context} / ${user?.role === "student" ? "Student home" : "Overview"}`}
        title={`${greeting}, ${name.split(" ")[0]}`}
        description={
          next
            ? "Your next assessment is ready to review."
            : "Your assessments, learning progress and classroom in one place."
        }
      />
      <RequestState
        loading={loading}
        error={error}
        onRetry={() => setReload(reload + 1)}
      />
      {!loading && !error && (
        <div className="workspace-split">
          <div className="workspace-stack workspace-home-primary">
            <Card title="Coming up">
              {next ? (
                <>
                  <Record
                    title={
                      <Link className="workspace-link" to={reviewTo}>
                        {next.name}
                      </Link>
                    }
                    description={`${formatDate(next.start_time)} · ${formatTime(next.start_time)}–${formatTime(next.end_time)} IST`}
                  >
                    <Status>
                      ○ {statusLabels[next.status] || next.status}
                    </Status>
                  </Record>
                  <Record
                    title={`${next.problems?.length || 0} problems`}
                    description={`${marks || 0} marks · ${context}`}
                  />
                </>
              ) : (
                <Record
                  title="No upcoming assessments"
                  description="Your assigned assessments will appear here when scheduled."
                />
              )}
            </Card>
            <Card title="Your learning">
              <p>
                {latest
                  ? `Latest submission: ${latest.problem_id?.title || "Coding problem"}, ${formatDate(latest.createdAt)}.`
                  : "Complete your first problem to start tracking your learning."}
              </p>
              <div className="workspace-metrics">
                <Metric
                  value={latest ? latest.totalMarks : "—"}
                  label="Latest marks"
                  description={
                    latest ? "Evaluated submission" : "No results yet"
                  }
                />
                <Metric
                  value={user?.subject || user?.branch || "—"}
                  label="Class"
                  description={
                    user?.batch
                      ? `Cohort ${user.batch.toUpperCase()}`
                      : "Your classroom"
                  }
                />
              </div>
            </Card>
            <Link
              className="workspace-button workspace-review-button"
              to={reviewTo}
            >
              {next ? "Review upcoming assessment" : "View assessments"}
            </Link>
          </div>
          <div className="workspace-stack workspace-home-context">
            <Card title="Instructor updates">
              <p>
                Check assessment instructions for preparation guidance and
                announcements from your instructor.
              </p>
              {next && (
                <Record
                  title={next.name}
                  description={
                    next.description || "Review the assessment before it opens."
                  }
                />
              )}
              <Record
                title="Use a desktop to write code"
                description="On your phone, review instructions, assessment status and results."
              />
            </Card>
            <Card
              title="Your class"
              id="your-class"
              className="workspace-class-card"
            >
              <p>
                {context}
                {user?.semester ? ` · Semester ${user.semester}` : ""}
                {user?.batch ? ` · Cohort ${user.batch.toUpperCase()}` : ""}
              </p>
              <Record
                title="Prepare for your next assessment"
                description="Review assigned problems and keep track of your results."
              />
              <Link className="workspace-link" to="/make-problem">
                View assigned problems
              </Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
