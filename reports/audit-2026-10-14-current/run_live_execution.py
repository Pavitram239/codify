"""Audit-only isolated DB; benign code sent to local Judge0, never production users."""
import json
import time
from pathlib import Path
from rest_framework.test import APIClient
from apps.users.models import User
from apps.problems.models import Problem
from apps.submissions.models import Submission

client = APIClient()
client.force_authenticate(User.objects.get(username="audit.student"))
problem = Problem.objects.get(title="Audit Pair Sum")
programs = {
    "python": "a,b=map(int,input().split()); print(a+b)",
    "cpp": "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}",
    "java": "import java.util.*; public class Main { public static void main(String[] args){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}",
}
results = []
for language, code in programs.items():
    start = time.monotonic()
    response = client.post("/api/v1/compiler/run-code", {"problemId": str(problem.pk), "language": language, "code": code, "allTestCases": True}, format="json")
    data = response.data
    results.append({"language": language, "http": response.status_code, "seconds": round(time.monotonic()-start, 2), "response": data})
    print(language, response.status_code, results[-1]["seconds"], flush=True)
Path("../reports/audit-2026-10-14-current/evidence/live-judge0.json").write_text(json.dumps(results, default=str, indent=2), encoding="utf-8")
