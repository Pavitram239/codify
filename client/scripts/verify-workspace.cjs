const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = process.env.WORKSPACE_URL || "http://127.0.0.1:5174";
const output = path.resolve(
  process.env.WORKSPACE_SCREENSHOTS || ".workspace-check",
);
fs.mkdirSync(output, { recursive: true });
const problems = [
  { _id: "problem-1", title: "Pair Sum", maxMarks: 30 },
  { _id: "problem-2", title: "Balanced Brackets", maxMarks: 30 },
  { _id: "problem-3", title: "Shortest Delivery Route", maxMarks: 40 },
];
const contests = [
  {
    _id: "contest-1",
    name: "Data Structures — Midterm",
    status: "upcoming",
    start_time: "2026-10-20T03:30:00Z",
    end_time: "2026-10-20T11:30:00Z",
    description: "Review arrays, stacks and shortest paths.",
    problems,
    created_by: { _id: "teacher-1" },
  },
  {
    _id: "contest-2",
    name: "Algorithms — Practice 03",
    status: "completed",
    start_time: "2026-10-13T03:30:00Z",
    end_time: "2026-10-13T11:30:00Z",
    problems,
    created_by: { _id: "teacher-1" },
  },
];
const submission = {
  _id: "submission-1",
  user_id: { username: "Aanya Shah", role: "student" },
  problem_id: problems[0],
  language: "python",
  createdAt: "2026-10-20T04:32:00Z",
  totalMarks: 30,
  numberOfTestCase: 2,
  numberOfTestCasePass: 2,
  execution_time: 38,
  memory_usage: 12.4,
  code: "print(sum(map(int, input().split())))",
  testCaseResults: [
    {
      input: "2 7",
      output: "9",
      expectedOutput: "9",
      passed: true,
      is_hidden: false,
    },
    {
      input: "hidden-private-input",
      output: "hidden-private-output",
      expectedOutput: "hidden-private-output",
      passed: true,
      is_hidden: true,
    },
  ],
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
  });
  try {
    for (const width of [320, 768, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1024 },
        timezoneId: "Asia/Kolkata",
      });
      const page = await context.newPage();
      let role = "student";
      let submittedPayload;
      let problemRequests = 0;
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install({ time: new Date("2026-10-13T04:30:00Z") });
      await page.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url());
        let json;
        if (url.pathname.endsWith("/auth/get-current-user"))
          json = {
            success: true,
            user: {
              _id: role === "student" ? "student-1" : "teacher-1",
              role,
              username: role === "student" ? "Aanya Shah" : "Dr. Meera Rao",
              profile: {
                name: role === "student" ? "Aanya Shah" : "Dr. Meera Rao",
              },
              institution: "Northstar University",
              subject: "CS204",
              batch: "b",
            },
          };
        else if (url.pathname.endsWith("/auth/csrf"))
          json = { csrfToken: "test-csrf-token" };
        else if (url.pathname.endsWith("/submissions/user/submissions"))
          json = {
            submissions: [
              {
                ...submission,
                totalMarks: 82,
                createdAt: "2026-10-13T04:30:00Z",
                status: "completed",
                problem_id: { title: "Algorithms — Practice 03" },
              },
            ],
          };
        else if (url.pathname.endsWith("/submissions/submission-1"))
          json = submission;
        else if (url.pathname.endsWith("/contests/create")) {
          submittedPayload = route.request().postDataJSON();
          json = { _id: "new-contest", ...submittedPayload };
        } else if (url.pathname.endsWith("/contests/contest-1"))
          json = contests[0];
        else if (url.pathname.endsWith("/contests")) json = contests;
        else if (url.pathname.endsWith("/problems")) {
          problemRequests++;
          json = { problems };
        } else
          json = {
            success: true,
            students: [],
            assignedStudents: [],
            problems: [],
            subjects: [],
          };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(json),
        });
      });
      const checkGeometry = async () => {
        await page.evaluate(() => document.fonts.ready);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          true,
          `Horizontal overflow at ${width}`,
        );
        const assets = await page
          .locator('img[src^="/design/"]:visible')
          .evaluateAll((images) =>
            images.map((image) => ({
              src: image.getAttribute("src"),
              loaded: image.complete && image.naturalWidth > 0,
              width: image.getBoundingClientRect().width,
              height: image.getBoundingClientRect().height,
            })),
          );
        for (const asset of assets) {
          assert(asset.loaded, `Missing ${asset.src}`);
          assert.equal(asset.width, 20, `Wrong width for ${asset.src}`);
          assert.equal(asset.height, 20, `Wrong height for ${asset.src}`);
        }
      };
      await page.goto(`${base}/browse`);
      await page
        .getByRole("heading", { name: "Good morning, Aanya" })
        .waitFor();
      await page.getByRole("heading", { name: "Coming up" }).waitFor();
      await checkGeometry();
      await page.screenshot({
        path: path.join(output, `home-${width}.png`),
        fullPage: true,
      });
      if (width === 320) {
        await page
          .getByRole("button", { name: "Open navigation menu" })
          .click();
        await page
          .getByRole("button", { name: "Close menu ×" })
          .waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
        assert.equal(
          await page
            .getByRole("button", { name: "Open navigation menu" })
            .getAttribute("aria-expanded"),
          "false",
        );
      }
      role = "faculty";
      await page.goto(`${base}/make-contest`);
      await page
        .getByRole("link", { name: "Data Structures — Midterm", exact: true })
        .waitFor();
      await checkGeometry();
      await page.screenshot({
        path: path.join(output, `assessments-${width}.png`),
        fullPage: true,
      });
      await page.getByLabel("Search", { exact: true }).fill("Algorithms");
      assert.equal(
        await page
          .getByRole("link", { name: "Data Structures — Midterm", exact: true })
          .count(),
        0,
      );
      await page.getByLabel("Search", { exact: true }).fill("");
      await page
        .getByLabel("Status", { exact: true })
        .selectOption("completed");
      assert.equal(
        await page
          .getByRole("link", { name: "Data Structures — Midterm", exact: true })
          .count(),
        0,
      );
      await page.goto(`${base}/submissions/submission-1`);
      await page
        .getByRole("heading", { name: "Aanya Shah’s submission" })
        .waitFor();
      await checkGeometry();
      await page.screenshot({
        path: path.join(output, `submission-${width}.png`),
        fullPage: true,
      });
      await page.getByText("View python source", { exact: true }).click();
      assert.equal(
        await page.getByText(submission.code, { exact: true }).isVisible(),
        true,
      );
      role = "student";
      await page.goto(`${base}/submissions/submission-1`);
      await page
        .getByRole("heading", { name: "Aanya Shah’s submission" })
        .waitFor();
      assert(
        !(await page.locator("#workspace-main").innerText()).includes(
          "hidden-private-input",
        ),
        "Student sees private test evidence",
      );
      role = "faculty";
      await page.goto(`${base}/create-contest`);
      await page
        .getByLabel("Assessment name", { exact: true })
        .fill("Data Structures — Midterm");
      await page
        .getByLabel("Description", { exact: true })
        .fill("Review arrays and stacks.");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("checkbox").first().check();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByLabel("Date", { exact: true }).nth(0).fill("2026-10-20");
      await page.getByLabel("Date", { exact: true }).nth(1).fill("2026-10-20");
      await checkGeometry();
      await page.screenshot({
        path: path.join(output, `schedule-${width}.png`),
        fullPage: true,
      });
      const before = problemRequests;
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      await page.reload();
      await page.getByLabel("Assessment name", { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Assessment name", { exact: true }).inputValue(),
        "Data Structures — Midterm",
      );
      assert(problemRequests > before, "Problems were not reloaded");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      assert.equal(await page.getByRole("checkbox").first().isChecked(), true);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByLabel("Time", { exact: true }).nth(1).fill("08:00");
      await page
        .getByRole("button", { name: "Continue to participants" })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "closing time" })
        .waitFor();
      assert.equal(submittedPayload, undefined);
      await page.getByLabel("Time", { exact: true }).nth(1).fill("17:00");
      await page
        .getByRole("button", { name: "Continue to participants" })
        .click();
      await page.waitForURL("**/assignContestToStudents/new-contest");
      assert.equal(submittedPayload.start_time, "2026-10-20T03:30:00.000Z");
      assert.equal(submittedPayload.end_time, "2026-10-20T11:30:00.000Z");
      assert.deepEqual(submittedPayload.problems, ["problem-1"]);
      assert.equal(errors.length, 0, errors.join("\n"));
      await context.close();
      console.log(
        `PASS: ${width}px layouts, assets, filters, evidence, drafts and scheduling`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
