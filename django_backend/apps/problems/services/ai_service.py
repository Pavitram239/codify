import json
import logging
import re
from typing import Any, Dict, List, Optional
import requests
from django.conf import settings

logger = logging.getLogger("apps.problems")

AVAILABLE_MODELS = [
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.7-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
]


class AIServiceError(Exception):
    """Custom exception raised for AI generation failures."""
    pass


class AIService:
    @staticmethod
    def get_api_key() -> str:
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        if not api_key:
            raise AIServiceError(
                "GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in your .env file."
            )
        return api_key

    @classmethod
    def generate_problem(
        cls,
        topic: str,
        difficulty: str = "easy",
        custom_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a complete coding problem based on topic, difficulty, and optional instructions.
        """
        difficulty = difficulty.lower()
        if difficulty not in ["easy", "medium", "hard"]:
            difficulty = "easy"

        user_prompt = f"""You are an expert computer science professor and competitive programming problem creator.
Create a high quality coding problem suitable for an automated assessment platform.

Topic: {topic}
Difficulty: {difficulty.capitalize()}
{"Additional Instructions: " + custom_prompt if custom_prompt else ""}

The problem must include:
1. Title: Clear, engaging, and standard competitive programming title.
2. Description: Detailed problem statement with background, task, and examples in markdown.
3. Input Format: Exact specification of standard input lines and types.
4. Output Format: Exact specification of standard output.
5. Constraints: Proper input bounds (e.g., array size, element range, time limit).
6. Tags: 2-5 relevant tags (e.g., ["Array", "Prefix Sum"]).
7. Sample I/O: Exactly 2 clear sample input and output pairs.
8. Test Cases: At least 4-6 diverse test cases:
   - 2 visible test cases (is_hidden: false) matching the samples.
   - 2-4 hidden test cases (is_hidden: true) covering edge cases:
     * Minimum possible input / single element
     * Extreme / maximum bounds
     * Negative or zero values (if applicable)
     * General randomized case
   - Assign reasonable marks (e.g. 5 or 10 marks per test case, total 20-50).
   - Set cpu_time_limit to 1.0 (seconds) and memory_limit to 128 (MB).

Respond ONLY with a valid JSON object strictly matching this schema:
{{
  "title": "string",
  "description": "string (markdown)",
  "difficulty": "easy" | "medium" | "hard",
  "inputFormat": "string",
  "outputFormat": "string",
  "constraints": "string",
  "tags": ["string"],
  "sampleIO": [
    {{"input": "string", "output": "string"}}
  ],
  "testCases": [
    {{
      "inputs": "string",
      "outputs": "string",
      "marks": 10,
      "cpu_time_limit": 1.0,
      "memory_limit": 128,
      "is_hidden": false
    }}
  ]
}}
"""
        return cls._call_gemini(user_prompt, fallback_difficulty=difficulty)

    @classmethod
    def convert_problem(
        cls,
        raw_text: str,
        difficulty: str = "easy",
    ) -> Dict[str, Any]:
        """
        Parse and convert raw text copied from LeetCode, HackerRank, or course material
        into the platform's standard structured problem schema.
        """
        user_prompt = f"""You are an expert competitive programming problem formatter.
The user provided raw text copied from LeetCode, HackerRank, or an exam paper.
Extract, standardize, and format this into our assessment platform schema.

Raw Problem Content:
\"\"\"
{raw_text}
\"\"\"

Target Default Difficulty (adjust if the content specifies otherwise): {difficulty}

Instructions:
1. Extract or infer the Title.
2. Standardize Description into clear markdown formatting.
3. Extract or specify clear Input Format and Output Format for standard console I/O (stdin/stdout).
4. Extract Constraints.
5. Extract or infer Tags.
6. Extract all Sample Input/Outputs into the sampleIO array.
7. Generate at least 4 test cases in testCases array:
   - Include the samples as visible test cases (is_hidden: false).
   - Generate at least 2-3 hidden test cases (is_hidden: true) with edge cases and larger boundary tests.
   - Assign marks (e.g., 5-10 per test case).
   - Set cpu_time_limit: 1.0, memory_limit: 128.

Respond ONLY with a valid JSON object strictly matching this schema:
{{
  "title": "string",
  "description": "string (markdown)",
  "difficulty": "easy" | "medium" | "hard",
  "inputFormat": "string",
  "outputFormat": "string",
  "constraints": "string",
  "tags": ["string"],
  "sampleIO": [
    {{"input": "string", "output": "string"}}
  ],
  "testCases": [
    {{
      "inputs": "string",
      "outputs": "string",
      "marks": 10,
      "cpu_time_limit": 1.0,
      "memory_limit": 128,
      "is_hidden": false
    }}
  ]
}}
"""
        return cls._call_gemini(user_prompt, fallback_difficulty=difficulty)

    @classmethod
    def _call_gemini(cls, prompt: str, fallback_difficulty: str = "easy") -> Dict[str, Any]:
        api_key = cls.get_api_key()

        configured_model = getattr(settings, "GEMINI_MODEL", "") or AVAILABLE_MODELS[0]
        models_to_try = [configured_model] + [m for m in AVAILABLE_MODELS if m != configured_model]

        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.4,
            },
        }

        last_error = None
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                response = requests.post(url, json=payload, timeout=45)
                if response.status_code in (404, 400):
                    # Model might be retired or unsupported, try next available model
                    error_detail = response.text
                    try:
                        err_json = response.json()
                        error_detail = err_json.get("error", {}).get("message", response.text)
                    except Exception:
                        pass
                    last_error = f"Model {model}: {error_detail}"
                    logger.warning("Gemini model %s returned %d, trying fallback. Detail: %s", model, response.status_code, error_detail)
                    continue

                if response.status_code != 200:
                    error_detail = response.text
                    try:
                        err_json = response.json()
                        error_detail = err_json.get("error", {}).get("message", response.text)
                    except Exception:
                        pass
                    logger.error("Gemini API returned %d: %s", response.status_code, error_detail)
                    raise AIServiceError(f"Gemini API Error ({response.status_code}): {error_detail}")

                data = response.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    raise AIServiceError("Gemini API returned empty candidates.")

                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise AIServiceError("Gemini API returned no content parts.")

                raw_json_text = parts[0].get("text", "").strip()

                # Clean markdown codeblocks if present
                if raw_json_text.startswith("```json"):
                    raw_json_text = raw_json_text[7:]
                elif raw_json_text.startswith("```"):
                    raw_json_text = raw_json_text[3:]
                if raw_json_text.endswith("```"):
                    raw_json_text = raw_json_text[:-3]
                raw_json_text = raw_json_text.strip()

                parsed = json.loads(raw_json_text)
                return cls._sanitize_and_validate(parsed, fallback_difficulty)

            except requests.RequestException as e:
                logger.exception("Network error calling Gemini API with model %s: %s", model, str(e))
                last_error = str(e)
                continue
            except json.JSONDecodeError as e:
                logger.exception("Failed to parse JSON from Gemini API: %s", str(e))
                raise AIServiceError("AI generated response could not be parsed as valid JSON. Please try again.")

        raise AIServiceError(f"All Gemini models failed. Last error: {last_error}")

    @classmethod
    def _sanitize_and_validate(cls, data: Dict[str, Any], fallback_difficulty: str) -> Dict[str, Any]:
        """
        Validate and normalize fields to conform with the Problem and TestCase schemas.
        """
        title = str(data.get("title", "")).strip() or "Untitled Problem"
        description = str(data.get("description", "")).strip()
        difficulty = str(data.get("difficulty", fallback_difficulty)).lower()
        if difficulty not in ["easy", "medium", "hard"]:
            difficulty = fallback_difficulty

        input_format = str(data.get("inputFormat", "")).strip()
        output_format = str(data.get("outputFormat", "")).strip()
        constraints = str(data.get("constraints", "")).strip()

        raw_tags = data.get("tags", [])
        tags = [str(t).strip() for t in raw_tags if str(t).strip()] if isinstance(raw_tags, list) else []

        raw_sample_io = data.get("sampleIO", [])
        sample_io = []
        if isinstance(raw_sample_io, list):
            for item in raw_sample_io:
                if isinstance(item, dict):
                    sample_io.append({
                        "input": str(item.get("input", "")).strip(),
                        "output": str(item.get("output", "")).strip(),
                    })

        raw_test_cases = data.get("testCases", [])
        test_cases = []
        if isinstance(raw_test_cases, list):
            for tc in raw_test_cases:
                if isinstance(tc, dict):
                    try:
                        marks = int(tc.get("marks", 10))
                    except (ValueError, TypeError):
                        marks = 10
                    try:
                        cpu = float(tc.get("cpu_time_limit", 1.0))
                        cpu = max(1.0, min(15.0, cpu))
                    except (ValueError, TypeError):
                        cpu = 1.0
                    try:
                        mem = int(tc.get("memory_limit", 128))
                        mem = max(1, min(256, mem))
                    except (ValueError, TypeError):
                        mem = 128

                    test_cases.append({
                        "inputs": str(tc.get("inputs", "")).strip(),
                        "outputs": str(tc.get("outputs", "")).strip(),
                        "marks": marks,
                        "cpu_time_limit": cpu,
                        "memory_limit": mem,
                        "is_hidden": bool(tc.get("is_hidden", False)),
                    })

        # Ensure at least one test case exists
        if not test_cases and sample_io:
            for s in sample_io:
                test_cases.append({
                    "inputs": s["input"],
                    "outputs": s["output"],
                    "marks": 10,
                    "cpu_time_limit": 1.0,
                    "memory_limit": 128,
                    "is_hidden": False,
                })

        total_marks = sum(tc["marks"] for tc in test_cases)

        return {
            "title": title,
            "description": description,
            "difficulty": difficulty,
            "inputFormat": input_format,
            "outputFormat": output_format,
            "constraints": constraints,
            "tags": tags,
            "sampleIO": sample_io,
            "testCases": test_cases,
            "totalMarks": total_marks,
        }
