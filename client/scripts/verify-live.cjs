const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const env = Object.fromEntries(fs.readFileSync(path.resolve(__dirname, "../../.env"), "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 }, timezoneId: "Asia/Kolkata" });
  const api = "http://localhost:3100/api/v1";
  let problemId;
  let csrf;
  const headers = { Origin: "http://localhost:5173" };
  try {
    const tokenResponse = await context.request.get(`${api}/auth/csrf`);
    assert.equal(tokenResponse.status(), 200);
    csrf = (await tokenResponse.json()).csrfToken;
    headers["X-CSRFToken"] = csrf;
    const login = await context.request.post(`${api}/auth/login`, { headers, data: { id: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD } });
    assert.equal(login.status(), 200);
    assert.equal((await login.json()).success, true);
    assert.equal((await context.request.get(`${api}/auth/get-current-user`)).status(), 200);
    console.log("PASS: Live administrator login and cookie authentication");
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:5173/browse");
    await page.getByRole("heading", { name: "Coming up", exact: true }).waitFor();
    await page.getByRole("heading", { name: "No upcoming assessments", exact: true }).waitFor();
    await page.getByRole("link", { name: "Assessments", exact: true }).first().click();
    await page.getByText("No assessments yet.", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: Deployed Figma home and assessment list with live API data");
    const problem = await context.request.post(`${api}/problems`, { headers, data: { title: "Temporary startup verification", description: "Add two integers.", difficulty: "easy", inputFormat: "Two integers", outputFormat: "Their sum", sampleIO: [{ input: "2 3", output: "5" }], testCases: [{ inputs: "2 3", outputs: "5", marks: 10, cpu_time_limit: 1, memory_limit: 128, is_hidden: false }, { inputs: "4 5", outputs: "9", marks: 10, cpu_time_limit: 1, memory_limit: 128, is_hidden: true }] } });
    assert.equal(problem.status(), 201);
    problemId = (await problem.json())._id;
    const execution = await context.request.post(`${api}/compiler/run-code`, { headers, timeout: 90000, data: { code: "a,b=map(int,input().split());print(a+b)", language: "python", problemId, allTestCases: true } });
    const result = await execution.json();
    assert.equal(execution.status(), 200, result.message);
    console.log("Code execution:", JSON.stringify({ allPassed: result.allPassed, results: result.testResults.map((test) => ({ passed: test.passed, error: test.error })) }));
    assert.equal(result.allPassed, true, "Judge0 did not pass the live execution check");
    assert.equal(result.savedSubmission.totalMarks, 20);
    console.log("PASS: Django → Judge0 → visible and hidden test evaluation → saved submission");
  } finally {
    if (problemId) await context.request.delete(`${api}/problems/${problemId}`, { headers });
    if (csrf) await context.request.post(`${api}/auth/logout`, { headers });
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
