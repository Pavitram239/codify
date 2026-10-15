import { can, canResource } from "../../utils/permissions";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { Field, PageHeading, RequestState } from "./WorkspaceUI";
import { formatDate, formatTime, statusLabels } from "../../utils/assessment";

export default function AssessmentList() {
  const user = useSelector((state) => state.app.user);
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const dialog = useRef(null);
  useEffect(() => {
    if (!deleting) return;
    const previous = document.activeElement;
    const controls = dialog.current?.querySelectorAll("button");
    controls?.[0]?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) setDeleting(null);
      if (event.key === "Tab" && controls?.length) {
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls[controls.length - 1].focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === controls[controls.length - 1]
        ) {
          event.preventDefault();
          controls[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [deleting, busy]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    axiosInstance
      .get("/contests")
      .then(({ data }) => {
        if (active) setContests(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active)
          setError(
            err.response?.data?.message || "Unable to load assessments.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const filtered = useMemo(
    () =>
      contests.filter(
        (contest) =>
          contest.name.toLowerCase().includes(query.toLowerCase()) &&
          (!status || contest.status === status),
      ),
    [contests, query, status],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * 10, current * 10);
  const canReview = (contest) => can(user, "submissions.review_all") || (can(user, "submissions.review_own") && String(contest.created_by?._id || contest.created_by?.id || contest.created_by) === String(user?._id));
  const canManage = (contest) => ["edit", "delete", "assign"].some((action) => canResource(user, "contests", action, contest)) || canReview(contest);
  const remove = async () => {
    setBusy(true);
    try {
      await axiosInstance.delete(`/contests/${deleting._id || deleting.id}`);
      setDeleting(null);
      setReload(reload + 1);
      toast.success("Assessment deleted.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Unable to delete assessment.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        context={`${user?.institution || "Codify classroom"} / ${user?.subject || "Assessments"}`}
        title="Assessments"
      />
      <div className="workspace-toolbar">
        <Field label="Search" id="assessment-search">
          <input
            id="assessment-search"
            type="search"
            placeholder="Search assessments"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </Field>
        {can(user, "contests.create") && (
          <Link className="workspace-button" to="/create-contest">
            Create assessment
          </Link>
        )}
      </div>
      <div className="workspace-filter">
        <Field label="Status" id="assessment-status">
          <select
            id="assessment-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="upcoming">Scheduled</option>
            <option value="ongoing">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </Field>
      </div>
      <RequestState
        loading={loading}
        error={error}
        onRetry={() => setReload(reload + 1)}
      />
      {!loading && !error && (
        <section
          className="workspace-card workspace-table-card"
          aria-label="Assessment records"
        >
          <table className="workspace-table">
            <thead>
              <tr>
                <th scope="col">Assessment</th>
                <th scope="col">Scope</th>
                <th scope="col">Status</th>
                <th scope="col">Window</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((contest) => {
                const id = contest._id || contest.id;
                const marks =
                  contest.problems?.reduce(
                    (sum, problem) => sum + (Number(problem.maxMarks) || 0),
                    0,
                  ) || 0;
                return (
                  <tr key={id}>
                    <td>
                      <Link to={`/contests/${id}`} className="workspace-link">
                        {contest.name}
                      </Link>
                      {canManage(contest) && (
                        <div className="workspace-assessment-actions">
                          {canResource(user, "contests", "edit", contest) && (<Link
                            className="workspace-link"
                            to={`/create-contest/${id}`}
                          >
                            Edit
                          </Link>)}
                          {canResource(user, "contests", "assign", contest) && (<Link
                            className="workspace-link"
                            to={`/assignContestToStudents/${id}`}
                          >
                            Participants
                          </Link>)}
                          {canReview(contest) && (<Link
                            className="workspace-link"
                            to={`/contests/${id}/dashboard`}
                          >
                            Results
                          </Link>)}
                          <button
                            disabled={!canResource(user, "contests", "delete", contest)}
                            className="workspace-link"
                            onClick={() => setDeleting(contest)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="workspace-mobile-label">Scope</span>
                      {contest.problems?.length || 0} problems · {marks} marks
                    </td>
                    <td>
                      <span className="workspace-mobile-label">Status</span>
                      <span className="workspace-link">
                        {statusLabels[contest.status] || contest.status}
                      </span>
                    </td>
                    <td>
                      <span className="workspace-mobile-label">Window</span>
                      {contest.start_time
                        ? `${formatDate(contest.start_time)} · ${formatTime(contest.start_time)}–${formatTime(contest.end_time)} IST`
                        : "Not scheduled"}
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={4}>
                    {contests.length
                      ? "No assessments match your search."
                      : "No assessments yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="workspace-pagination">
            <span>
              {filtered.length
                ? `${(current - 1) * 10 + 1}–${Math.min(current * 10, filtered.length)}`
                : "0"}{" "}
              of {filtered.length} assessments
            </span>
            <div>
              {pages > 1 && (
                <button
                  className="workspace-link"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </button>
              )}
              <span>
                Page {current} of {pages}
              </span>
              {pages > 1 && (
                <button
                  className="workspace-link"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </section>
      )}
      {deleting && (
        <div className="workspace-dialog-backdrop">
          <section
            ref={dialog}
            className="workspace-card workspace-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-assessment-title"
          >
            <h2 id="delete-assessment-title">Delete {deleting.name}?</h2>
            <p>This removes the assessment and its student assignments.</p>
            <div className="workspace-step-nav">
              <button
                className="workspace-button workspace-button--secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button
                className="workspace-button"
                disabled={busy}
                onClick={remove}
              >
                {busy ? "Deleting…" : "Delete assessment"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
