const assert = require("node:assert/strict"),
  fs = require("fs"),
  path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.WORKSPACE_URL || "http://localhost:5185";
const output = process.env.WORKSPACE_SCREENSHOTS || ".application-check";
fs.mkdirSync(output, { recursive: true });
const problem = {
  _id: "problem-1",
  title: "Pair Sum",
  difficulty: "easy",
  description: "Add two integers.",
  inputFormat: "Two integers",
  outputFormat: "Their sum",
  constraints: "Integers from 0 to 100",
  sampleIO: [{ input: "2 3", output: "5" }],
  testCases: [
    {
      inputs: "2 3",
      outputs: "5",
      marks: 20,
      is_hidden: false,
      cpu_time_limit: 1,
      memory_limit: 128,
    },
  ],
  totalMarks: 20,
  created_by: { _id: "teacher-1" },
  createdAt: "2026-10-13T04:00:00Z",
};
const contest = {
  _id: "contest-1",
  name: "Programming assessment",
  description: "Solve the assigned problems.",
  problems: [problem],
  start_time: "2026-10-01T03:30:00Z",
  end_time: "2026-10-30T11:30:00Z",
  created_by: { _id: "teacher-1" },
};
const submission = {
  _id: "submission-1",
  user_id: { username: "Aanya", role: "student" },
  problem_id: problem,
  status: "completed",
  language: "python",
  createdAt: "2026-10-13T04:00:00Z",
  totalMarks: 20,
  numberOfTestCase: 1,
  numberOfTestCasePass: 1,
  execution_time: 20,
  memory_usage: 10,
  code: "print(5)",
  testCaseResults: [
    {
      input: "2 3",
      output: "5",
      expectedOutput: "5",
      passed: true,
      is_hidden: false,
    },
  ],
};
const routes = [
  "/browse",
  "/make-contest",
  "/assessments",
  "/create-contest",
  "/create-contest/contest-1",
  "/support",
  "/student",
  "/make-problem",
  "/problems",
  "/pending-requests",
  "/faculty-section",
  "/problem-form",
  "/problem-form/problem-1",
  "/problems/problem-1",
  "/profile",
  "/dashboard/problem-1",
  "/history",
  "/add-student-using-file",
  "/registerStudent",
  "/registerFaculty",
  "/students/teacher-1",
  "/assignProblem/problem-1",
  "/assignedStudents/problem-1",
  "/studentinformation",
  "/submissions/submission-1",
  "/assignContestToStudents/contest-1",
  "/unassignContestToStudents/contest-1",
  "/duplicate",
  "/contests/contest-1",
  "/contests/contest-1/dashboard",
  "/session-management",
  "/missing-page",
];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  });
  const failures = [];
  try {
    for (const width of [320, 768, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
      });
      const page = await context.newPage();
      let role = "admin",
        signedIn = true,
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/v1/**", async (r) => {
        const u = new URL(r.request().url()),
          p = u.pathname.replace(/\/$/, "");
        let json = {
          success: true,
          data: [],
          subjects: [],
          facultys: [],
          students: [],
          assignedStudents: [],
          unassignedStudents: [],
          problems: [],
          submissions: [],
          users: [],
          totalUsers: 0,
          totalStudents: 0,
          totalFaculty: 0,
          totalPages: 1,
          branchWiseCount: [],
          semesterBranchBatchWiseCount: {},
        };
        if (p.endsWith("/auth/get-current-user"))
          json = signedIn
            ? {
                success: true,
                user: {
                  _id: "teacher-1",
                  username: "Meera Rao",
                  role,
                  profile: { name: "Meera Rao" },
                  branch: "cspit-it",
                  batch: "a1",
                  semester: 6,
                  subject: "Programming",
                  is_approved: true,
                },
              }
            : { success: false };
        else if (p.endsWith("/auth/csrf"))
          json = { csrfToken: "fixture-token" };
        else if (p.endsWith("/problems/getStudents")) {
        } else if (p.endsWith("/problems")) json = { problems: [problem] };
        else if (p.endsWith("/problems/problem-1")) json = problem;
        else if (p.endsWith("/contests")) json = [contest];
        else if (p.endsWith("/contests/contest-1")) json = contest;
        else if (p.includes("/dashboard"))
          json = {
            contestName: contest.name,
            problemNames: ["Pair Sum"],
            rankings: [],
            pagination: { totalStudents: 0, totalPages: 1, currentPage: 1 },
          };
        else if (p.endsWith("/submissions/submission-1")) json = submission;
        else if (p.endsWith("/submissions/user/submissions"))
          json = { submissions: [], totalPages: 1 };
        await r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(json),
        });
      });
      for (const route of routes) {
        role = /^\/(faculty-section|add-student-using-file|registerStudent)(\/|$)/.test(route) ? "faculty" : "admin";
        console.log(width, route);
        errors = [];
        await page.goto(base + route);
        await page
          .locator(".workspace")
          .waitFor({ timeout: 5000 })
          .catch((e) => {
            console.log("PAGE ERRORS", errors);
            throw e;
          });
        await page.waitForTimeout(180);
        await page.evaluate(() => document.fonts.ready);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          font: document.querySelector(".workspace")
            ? getComputedStyle(document.querySelector(".workspace")).fontFamily
            : "missing",
          overflow: [...document.querySelectorAll("*")]
            .filter(
              (e) =>
                e.getBoundingClientRect().right > innerWidth + 2 &&
                getComputedStyle(e).position !== "fixed",
            )
            .slice(0, 4)
            .map((e) => e.className),
        }));
        if (errors.length || geometry.scroll > width) {
          failures.push({ width, route, errors, geometry });
        }
        if (
          [
            "/problem-form",
            "/problems/problem-1",
            "/session-management",
            "/support",
            "/registerStudent",
            "/contests/contest-1/dashboard",
          ].includes(route)
        )
          await page.screenshot({
            path: path.join(
              output,
              route.replaceAll("/", "_") + "-" + width + ".png",
            ),
            fullPage: false,
            animations: "disabled",
            timeout: 10000,
          });
      }
      // Check the actual non-mutating profile and authoring interactions.
      await page.goto(base + "/profile");
      const edit = page.getByRole("button", { name: /edit details/i });
      await edit.first().waitFor();
      {
        await edit.first().click();
        await page.locator("input[name=username]").waitFor();
      }
      await page.goto(base + "/problem-form?openAI=true");
      await page.waitForTimeout(250);
      await page.screenshot({
        path: path.join(output, "ai-dialog-" + width + ".png"),
        fullPage: false,
        animations: "disabled",
        timeout: 10000,
      });
      signedIn = false;
      await page.goto(base + "/");
      await page.getByPlaceholder("Id", { exact: true }).waitFor();
      assert.equal(await page.locator(".workspace-sidebar").count(), 0);
      await page.screenshot({
        path: path.join(output, "login-" + width + ".png"),
        fullPage: false,
        animations: "disabled",
        timeout: 10000,
      });
      await page.getByRole("button", { name: "Signup", exact: true }).click();
      await page.getByPlaceholder("Username", { exact: true }).waitFor();
      await page.screenshot({
        path: path.join(output, "signup-" + width + ".png"),
        fullPage: false,
        animations: "disabled",
        timeout: 10000,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "Signup overflow",
      );
      role = "faculty";
      signedIn = true;
      await page.goto(base + "/browse");
      await page
        .locator('a[href="/add-student-using-file"]')
        .waitFor({ state: "attached", timeout: 5000 })
        .catch(async (e) => {
          console.log(await page.locator("body").innerText());
          throw e;
        });
      role = "student";
      await page.goto(base + "/browse");
      await page
        .locator('.workspace-sidebar a[href="/make-problem"]')
        .waitFor({ state: "attached" });
      assert.equal(
        await page
          .getByRole("link", { name: "Sessions", exact: true, hidden: true })
          .count(),
        0,
      );
      await context.close();
      console.log(
        `Checked ${routes.length} routes, authentication and role navigation at ${width}px`,
      );
    }
    console.log(JSON.stringify(failures, null, 2));
    assert.equal(failures.length, 0, "Page layout or runtime failures");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
