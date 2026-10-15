import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { Card, Field, PageHeading, RequestState } from "./WorkspaceUI";
import { scheduleTimestamp, splitTimestamp } from "../../utils/assessment";

const emptyDraft = {
  name: "",
  description: "",
  problems: [],
  openDate: "",
  openTime: "09:00",
  closeDate: "",
  closeTime: "17:00",
  timezone: "Asia/Kolkata",
};

export default function AssessmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.app.user);
  const draftKey = `codify:assessment-draft:${user?._id || "anonymous"}:${id || "new"}`;
  const [draft, setDraft] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey));
      return saved?.draft && Array.isArray(saved.draft.problems)
        ? { ...emptyDraft, ...saved.draft }
        : { ...emptyDraft };
    } catch {
      return { ...emptyDraft };
    }
  });
  const [step, setStep] = useState(1);
  const [problems, setProblems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await axiosInstance.get("/problems");
        if (!active) return;
        setProblems(response.data.problems || []);
        if (id && !localStorage.getItem(draftKey)) {
          const { data } = await axiosInstance.get(`/contests/${id}`);
          if (!active) return;
          const open = splitTimestamp(data.start_time);
          const close = splitTimestamp(data.end_time);
          setDraft({
            ...emptyDraft,
            name: data.name,
            description: data.description,
            problems: data.problems.map((problem) => problem._id || problem.id),
            openDate: open.date,
            openTime: open.time,
            closeDate: close.date,
            closeTime: close.time,
          });
        }
      } catch (err) {
        if (active)
          setError(
            err.response?.data?.message || "Unable to load assessment details.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, draftKey]);
  const update = (field, value) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setError("");
  };
  const saveDraft = () => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ draft, savedAt: new Date().toISOString() }),
      );
      setStorageError(false);
      toast.success("Draft saved on this device.");
    } catch {
      setStorageError(true);
    }
  };
  const open = scheduleTimestamp(
    draft.openDate,
    draft.openTime,
    draft.timezone,
  );
  const close = scheduleTimestamp(
    draft.closeDate,
    draft.closeTime,
    draft.timezone,
  );
  const validWindow = open && close && new Date(close) > new Date(open);
  const hours = validWindow ? (new Date(close) - new Date(open)) / 3600000 : 0;
  const selected = problems.filter((problem) =>
    draft.problems.includes(problem._id || problem.id),
  );
  const continueStep = () => {
    if (step === 1 && (!draft.name.trim() || !draft.description.trim())) {
      setError("Enter an assessment name and description.");
      return;
    }
    if (step === 2 && !draft.problems.length) {
      setError("Select at least one problem.");
      return;
    }
    setError("");
    setStep(step + 1);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (step < 3) {
      continueStep();
      return;
    }
    if (!validWindow) {
      setError(
        "Enter opening and closing dates. The closing time must be after the opening time.",
      );
      return;
    }
    if (
      !draft.name.trim() ||
      !draft.description.trim() ||
      !draft.problems.length
    ) {
      setError(
        "Complete the assessment details and select at least one problem.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        problems: draft.problems,
        start_time: open,
        end_time: close,
      };
      const response = id
        ? await axiosInstance.put(`/contests/${id}`, payload)
        : await axiosInstance.post("/contests/create", payload);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* Assessment is saved even if local storage is unavailable. */
      }
      toast.success(id ? "Assessment updated." : "Assessment created.");
      navigate(
        `/assignContestToStudents/${response.data._id || response.data.id || id}`,
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save assessment. Your entries are preserved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const back = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ draft }));
    } catch {
      setStorageError(true);
    }
    if (step > 1) setStep(step - 1);
    else navigate("/make-contest");
  };
  const changeTimezone = (timezone) => {
    const previousOpen = open ? splitTimestamp(open, timezone) : null;
    const previousClose = close ? splitTimestamp(close, timezone) : null;
    setDraft((previous) => ({
      ...previous,
      timezone,
      ...(previousOpen
        ? { openDate: previousOpen.date, openTime: previousOpen.time }
        : {}),
      ...(previousClose
        ? { closeDate: previousClose.date, closeTime: previousClose.time }
        : {}),
    }));
  };
  return (
    <>
      <PageHeading
        context={`${user?.institution || "Codify classroom"} / Assessment authoring`}
        title={
          step === 1
            ? id
              ? "Edit assessment details"
              : "Create an assessment"
            : step === 2
              ? "Choose the problems"
              : "Set the availability window"
        }
        description={`Step ${step} of 3${draft.name ? ` · ${draft.name}` : ""}${user?.username ? ` · ${user.profile?.name || user.username}` : ""}`}
      />
      <RequestState loading={loading} />
      {!loading && (
        <form onSubmit={submit} className="workspace-stack" aria-busy={busy}>
          {step === 1 && (
            <Card title="Assessment details">
              <div className="workspace-stack">
                <Field label="Assessment name" id="assessment-name">
                  <input
                    id="assessment-name"
                    value={draft.name}
                    onChange={(event) => update("name", event.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Description" id="assessment-description">
                  <textarea
                    id="assessment-description"
                    rows={4}
                    value={draft.description}
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                  />
                </Field>
              </div>
            </Card>
          )}
          {step === 2 && (
            <Card title="Problems">
              <Field label="Search problems" id="problem-search">
                <input
                  id="problem-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
              <div className="workspace-problem-picker">
                {problems
                  .filter((problem) =>
                    problem.title.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((problem) => {
                    const problemId = problem._id || problem.id;
                    return (
                      <label key={problemId}>
                        <input
                          type="checkbox"
                          checked={draft.problems.includes(problemId)}
                          onChange={(event) =>
                            update(
                              "problems",
                              event.target.checked
                                ? [...draft.problems, problemId]
                                : draft.problems.filter(
                                    (selectedId) => selectedId !== problemId,
                                  ),
                            )
                          }
                        />
                        <span>{problem.title}</span>
                      </label>
                    );
                  })}
                {!problems.length && (
                  <p>
                    No problems available. Create a problem before scheduling an
                    assessment.
                  </p>
                )}
              </div>
              <p className="workspace-note">
                {draft.problems.length} problems selected
              </p>
            </Card>
          )}
          {step === 3 && (
            <>
              <Card title="Timezone">
                <Field label="Assessment timezone" id="assessment-timezone">
                  <select
                    id="assessment-timezone"
                    value={draft.timezone}
                    onChange={(event) => changeTimezone(event.target.value)}
                  >
                    <option value="Asia/Kolkata">
                      Asia/Kolkata · IST (UTC+05:30)
                    </option>
                    <option value="UTC">UTC (UTC+00:00)</option>
                  </select>
                </Field>
              </Card>
              <div className="workspace-schedule-groups">
                {[
                  ["Opens", "open"],
                  ["Closes", "close"],
                ].map(([label, prefix]) => (
                  <Card title={label} key={prefix}>
                    <Field label="Date" id={`${prefix}-date`}>
                      <div className="workspace-input-wrap">
                        <input
                          id={`${prefix}-date`}
                          type="date"
                          required
                          value={draft[`${prefix}Date`]}
                          onChange={(event) =>
                            update(`${prefix}Date`, event.target.value)
                          }
                        />
                        <img
                          className="workspace-input-icon"
                          src="/design/calendar.svg"
                          alt=""
                        />
                      </div>
                    </Field>
                    <Field label="Time" id={`${prefix}-time`}>
                      <div className="workspace-input-wrap">
                        <input
                          id={`${prefix}-time`}
                          type="time"
                          required
                          value={draft[`${prefix}Time`]}
                          onChange={(event) =>
                            update(`${prefix}Time`, event.target.value)
                          }
                        />
                        <img
                          className="workspace-input-icon"
                          src="/design/clock.svg"
                          alt=""
                        />
                      </div>
                    </Field>
                  </Card>
                ))}
              </div>
              <Card title="Validation summary">
                <p aria-live="polite">
                  {validWindow
                    ? `${Number(hours.toFixed(2))}-hour window · ${selected.length} problems. End is after start. `
                    : "Choose opening and closing dates and times to validate the assessment window. "}
                  Students see timestamps in IST.
                </p>
              </Card>
            </>
          )}
          {error && (
            <p className="workspace-error" role="alert">
              {error}
            </p>
          )}
          {storageError && (
            <p className="workspace-error" role="alert">
              Your browser could not save the draft. Keep this page open to
              retain your entries.
            </p>
          )}
          <button
            className="workspace-button"
            type="submit"
            disabled={busy || loading}
          >
            {busy
              ? "Saving…"
              : step === 3
                ? "Continue to participants"
                : "Continue"}
          </button>
          <button
            className="workspace-button workspace-button--secondary"
            type="button"
            onClick={saveDraft}
            disabled={busy}
          >
            Save draft
          </button>
          <button
            className="workspace-link"
            type="button"
            onClick={back}
            disabled={busy}
          >
            {step > 1 ? "← Previous step" : "← Back to assessments"}
          </button>
        </form>
      )}
    </>
  );
}
