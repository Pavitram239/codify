import { can } from "../../utils/permissions";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { Card, Metric, PageHeading, Record, Status } from "./WorkspaceUI";
import { formatDate, formatTime } from "../../utils/assessment";

export default function SubmissionReview({ submission, onBack }) {
  const user = useSelector((state) => state.app.user);
  const cases = submission.testCaseResults || [];
  const visible = cases.filter((test) => !test.is_hidden);
  const hidden = cases.filter((test) => test.is_hidden);
  const total = submission.numberOfTestCase || cases.length;
  const passed = submission.numberOfTestCasePass || 0;
  const accepted = total > 0 && total === passed;
  const name = submission.user_id?.username || "Student";
  const title = submission.problem_id?.title || "Problem";
  return (
    <>
      <PageHeading
        context={`${user?.institution || "Codify classroom"} / Assessments / ${name}`}
        title={`${name}’s submission`}
        description={`${title} · ${submission.language} · submitted ${formatDate(submission.createdAt)} · ${formatTime(submission.createdAt)} IST`}
      />
      <div className="workspace-split workspace-review-split">
        <div className="workspace-stack">
          <Card title="Automated marks">
            <div className="workspace-metrics">
              <Metric value={submission.totalMarks ?? 0} label="Total marks" />
              <Metric value={`${passed}/${total}`} label="Tests passed" />
              <Metric value="1" label="Problem" />
            </div>
            <Record
              title={title}
              description={`${passed}/${total} tests passed`}
              value={`${submission.totalMarks ?? 0} marks`}
            >
              <Status tone={accepted ? "green" : "amber"}>
                {accepted ? "✓ Accepted" : "! Partial marks"}
              </Status>
            </Record>
          </Card>
          <Card title={`${title} test evidence`} className="workspace-evidence">
            {visible.map((test, index) => (
              <Record
                key={index}
                title={`Visible sample ${index + 1}`}
                description={`Input: ${test.input || "(empty)"} · Expected: ${test.expectedOutput || "(empty)"}`}
              >
                <Status tone={test.passed ? "green" : "amber"}>
                  {test.passed ? "✓ Passed" : "! Failed"}
                </Status>
                <details className="workspace-details">
                  <summary>View output</summary>
                  <pre>{test.output || "(empty output)"}</pre>
                </details>
              </Record>
            ))}
            {hidden.length > 0 && (
              <Record
                title="Hidden tests"
                description={`${hidden.filter((test) => test.passed).length} / ${hidden.length} passed · ${!can(user, "submissions.review_own", "submissions.review_all") ? "Inputs and expected outputs are private" : "Instructor access only"}`}
              />
            )}
            {can(user, "submissions.review_own", "submissions.review_all") &&
              hidden.map((test, index) => (
                <details className="workspace-details" key={index}>
                  <summary>Hidden case {index + 1}</summary>
                  <pre>
                    Input: {test.input}
                    {"\n"}Expected: {test.expectedOutput}
                    {"\n"}Output: {test.output}
                  </pre>
                </details>
              ))}
            {!cases.length && (
              <p>No test evidence is available for this submission.</p>
            )}
          </Card>
          <Card title="Submitted code">
            <details className="workspace-details">
              <summary>View {submission.language} source</summary>
              <pre>{submission.code || "No source code available."}</pre>
            </details>
          </Card>
        </div>
        <div className="workspace-stack">
          <Card title="Execution details">
            <Record
              title={title}
              description={`${Number(submission.execution_time || 0).toFixed(2)} ms · ${Number(submission.memory_usage || 0).toFixed(2)} MB`}
            />
            <Record
              title={name}
              description={submission.user_id?.role || "Student"}
            />
          </Card>
          <button
            className="workspace-button workspace-button--secondary"
            onClick={onBack}
          >
            Back to submissions
          </button>
        </div>
      </div>
    </>
  );
}

SubmissionReview.propTypes = {
  submission: PropTypes.shape({
    testCaseResults: PropTypes.arrayOf(PropTypes.object),
    numberOfTestCase: PropTypes.number,
    numberOfTestCasePass: PropTypes.number,
    user_id: PropTypes.shape({
      username: PropTypes.string,
      role: PropTypes.string,
    }),
    problem_id: PropTypes.shape({ title: PropTypes.string }),
    language: PropTypes.string,
    createdAt: PropTypes.string,
    totalMarks: PropTypes.number,
    execution_time: PropTypes.number,
    memory_usage: PropTypes.number,
    code: PropTypes.string,
  }).isRequired,
  onBack: PropTypes.func.isRequired,
};
