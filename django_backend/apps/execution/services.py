import base64
import time
import requests
from django.conf import settings

LANGUAGE_MAP = {
    "python": 71,
    "cpp": 54,
    "java": 62,
    "javascript": 63,
}


def get_language_id(language: str):
    return LANGUAGE_MAP.get(language.lower())


def decode_base64(base64_str: str) -> str:
    if not base64_str:
        return ""
    try:
        return base64.b64decode(base64_str).decode("utf-8", errors="replace")
    except Exception:
        return str(base64_str)


def normalize_output(output: str) -> str:
    if not output or not isinstance(output, str):
        return ""
    return output.replace("\r\n", "\n").strip()


class Judge0Client:
    def __init__(self, base_url: str = None, token: str = None):
        self.base_url = (base_url or getattr(settings, "JUDGE0_BASE_URL", "http://localhost:2358")).rstrip("/")
        self.token = token or getattr(settings, "JUDGE0_TOKEN", "")

    def _get_headers(self, request_id: str = ""):
        headers = {
            "Content-Type": "application/json",
        }
        if self.token:
            headers["X-Auth-Token"] = self.token
        if request_id:
            headers["X-Request-ID"] = request_id
        return headers

    def submit_one(self, submission_data: dict, retry_count: int = 3) -> dict:
        url = f"{self.base_url}/submissions"
        headers = self._get_headers()

        for attempt in range(retry_count):
            try:
                resp = requests.post(url, json=submission_data, headers=headers, timeout=10)
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                err_detail = ""
                if hasattr(e, "response") and e.response is not None:
                    try:
                        err_detail = f" (Judge0 response: {e.response.text})"
                    except Exception:
                        pass
                if attempt == retry_count - 1:
                    raise RuntimeError(f"Judge0 submission failed: {e}{err_detail}")
                time.sleep(0.5 * (attempt + 1))

    def fetch_result(self, token: str, max_wait_time: float = 30.0) -> dict:
        url = f"{self.base_url}/submissions/{token}?base64_encoded=true&fields=*"
        headers = self._get_headers()
        start_time = time.time()

        while True:
            if time.time() - start_time > max_wait_time:
                raise TimeoutError("Execution time exceeded maximum wait time.")

            try:
                resp = requests.get(url, headers=headers, timeout=10)
                resp.raise_for_status()
                data = resp.json()

                status_id = data.get("status", {}).get("id", 1)
                # 1 = In Queue, 2 = Processing
                if status_id <= 2:
                    time.sleep(0.5)
                    continue

                compile_output = decode_base64(data.get("compile_output"))
                stderr = decode_base64(data.get("stderr"))
                status_error = "Time Limit Exceeded" if status_id == 5 else None

                return {
                    **data,
                    "compilationError": compile_output or None,
                    "standardError": stderr or None,
                    "error": status_error or compile_output or stderr or None,
                }
            except Exception as e:
                if time.time() - start_time > max_wait_time - 2:
                    raise RuntimeError(f"Judge0 result fetch failed: {e}")
                time.sleep(0.5)

    def execute_test_cases(self, code: str, language: str, test_cases: list) -> list:
        language_id = get_language_id(language)
        if not language_id:
            raise ValueError(f"Unsupported programming language: {language}")

        results = []
        for tc in test_cases:
            # Memory limit: Judge0 enforces min 2048 KB (2 MB) and max 512000 KB (512 MB).
            # Modern runtimes (JVM for Java, Python runtime) require sufficient RAM.
            try:
                raw_mem = float(tc.memory_limit) if tc.memory_limit else 128.0
            except (ValueError, TypeError):
                raw_mem = 128.0

            mem_kb = int(raw_mem * 1024)
            # Java JVM requires at least 64-128 MB to avoid OutOfMemoryError
            if language_id == 62:
                mem_kb = max(mem_kb, 131072)
            else:
                mem_kb = max(mem_kb, 32768)
            mem_kb = min(mem_kb, 512000)

            # CPU time limit: Judge0 supports [0.5, 15.0]
            try:
                raw_cpu = float(tc.cpu_time_limit) if tc.cpu_time_limit else 2.0
            except (ValueError, TypeError):
                raw_cpu = 2.0
            cpu_sec = max(0.5, min(raw_cpu, 15.0))

            submission_payload = {
                "source_code": code,
                "language_id": language_id,
                "stdin": tc.inputs or "",
                "expected_output": tc.outputs or "",
                "cpu_time_limit": cpu_sec,
                "memory_limit": mem_kb,
            }

            sub_resp = self.submit_one(submission_payload)
            token = sub_resp.get("token")
            if not token:
                raise RuntimeError("Judge0 did not return a submission token.")

            result_data = self.fetch_result(token)
            raw_stdout = decode_base64(result_data.get("stdout") or "").strip()
            norm_stdout = normalize_output(raw_stdout)
            norm_expected = normalize_output(tc.outputs or "")

            error = result_data.get("error")
            passed = (norm_stdout == norm_expected) and not error

            exec_time = float(result_data.get("time") or 0.0)
            exec_mem = float(result_data.get("memory") or 0.0)

            marks_awarded = tc.marks if (passed and tc.marks) else 0

            results.append({
                "input": tc.inputs or "",
                "expectedOutput": tc.outputs or "",
                "output": raw_stdout,
                "error": error,
                "passed": passed,
                "time": exec_time,
                "memory": exec_mem,
                "is_hidden": tc.is_hidden,
                "marks": marks_awarded,
            })

        return results
