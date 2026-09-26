#!/usr/bin/env python3
"""Check dedicated Google Cloud ADC against two small Vertex AI requests."""

import argparse
import json
import math
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


GENERATION_MODEL = "gemini-3.8-flash"
EMBEDDING_MODEL = "gemini-embedding-2"
EMBEDDING_DIMENSIONS = 1536
BASE_URL = "https://aiplatform.googleapis.com/v1"


def failure(message, **details):
    return {"ok": False, "message": message, **details}


def access_token(project, config):
    credential_path = config / "application_default_credentials.json"
    try:
        credential = json.loads(credential_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read dedicated ADC JSON: {type(exc).__name__}") from exc
    if not isinstance(credential, dict) or credential.get("quota_project_id") != project:
        raise ValueError("Dedicated ADC quota_project_id does not match --project")

    try:
        result = subprocess.run(
            ["gcloud", "auth", "application-default", "print-access-token", f"--project={project}"],
            env={**os.environ, "CLOUDSDK_CONFIG": str(config)},
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError(f"Cannot obtain ADC access token: {type(exc).__name__}") from exc
    if result.returncode != 0 or not result.stdout.strip():
        raise ValueError("Cannot obtain ADC access token; check dedicated gcloud login")
    return result.stdout.strip()


def vertex_request(project, token, model, method, payload):
    url = f"{BASE_URL}/projects/{project}/locations/global/publishers/google/models/{model}:{method}"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "x-goog-user-project": project,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.load(response)
    except urllib.error.HTTPError as exc:
        try:
            parsed = json.load(exc)
            error = parsed.get("error", {}) if isinstance(parsed, dict) else {}
        except (UnicodeError, ValueError):
            error = {}
        if not isinstance(error, dict):
            error = {}
        return None, failure(
            error.get("message") or "Google API request failed",
            http_status=exc.code,
            error_status=error.get("status"),
        )
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        return None, failure(f"Request failed: {type(exc).__name__}")
    if not isinstance(body, dict):
        return None, failure("Google API returned a non-object response")
    return body, None


def check_generation(project, token):
    payload = {
        "contents": [{"role": "user", "parts": [{"text": "Synthetic connection check. Reply with only CLOUD_OK."}]}],
        "generationConfig": {"maxOutputTokens": 64, "thinkingConfig": {"thinkingLevel": "LOW"}},
    }
    body, error = vertex_request(project, token, GENERATION_MODEL, "generateContent", payload)
    if error:
        return {"model": GENERATION_MODEL, **error}
    candidates = body.get("candidates")
    texts = []
    if isinstance(candidates, list):
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            content = candidate.get("content")
            parts = content.get("parts") if isinstance(content, dict) else None
            if isinstance(parts, list):
                texts.extend(part["text"] for part in parts if isinstance(part, dict)
                             and isinstance(part.get("text"), str) and not part.get("thought"))
    answer = "".join(texts)
    return {"ok": answer.strip() == "CLOUD_OK", "model": GENERATION_MODEL,
            "response": answer, **({} if answer else {"message": "No generation text returned"})}


def check_embedding(project, token):
    payload = {
        "content": {"parts": [{"text": "Represent this synthetic personal knowledge note for retrieval."}]},
        "outputDimensionality": EMBEDDING_DIMENSIONS,
    }
    body, error = vertex_request(project, token, EMBEDDING_MODEL, "embedContent", payload)
    if error:
        return {"model": EMBEDDING_MODEL, **error}
    embedding = body.get("embedding")
    values = embedding.get("values") if isinstance(embedding, dict) else None
    numbers = isinstance(values, list) and all(
        isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        for value in values
    )
    dimensions = len(values) if isinstance(values, list) else 0
    norm = math.hypot(*(values or [])) if numbers and dimensions == EMBEDDING_DIMENSIONS else None
    valid = numbers and dimensions == EMBEDDING_DIMENSIONS and norm is not None and math.isfinite(norm) and norm > 0
    return {"ok": valid, "model": EMBEDDING_MODEL, "dimensions": dimensions,
            "finite_values": bool(numbers), "l2_norm": norm,
            **({} if valid else {"message": "Embedding missing, malformed, or wrong dimension"})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, help="Google Cloud project ID")
    parser.add_argument("--gcloud-config", required=True, type=Path, help="Dedicated gcloud config directory")
    parser.add_argument("--only", choices=("generation", "embedding", "all"), default="all")
    args = parser.parse_args()
    report = {"project": args.project, "results": {}}
    if not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", args.project):
        report["error"] = failure("Invalid Google Cloud project ID")
    else:
        try:
            token = access_token(args.project, args.gcloud_config.expanduser())
        except ValueError as exc:
            report["error"] = failure(str(exc))
        else:
            if args.only in ("generation", "all"):
                report["results"]["generation"] = check_generation(args.project, token)
            if args.only in ("embedding", "all"):
                report["results"]["embedding"] = check_embedding(args.project, token)
    report["ok"] = bool(report["results"]) and all(
        result["ok"] for result in report["results"].values()
    ) and "error" not in report
    print(json.dumps(report, ensure_ascii=False, allow_nan=False))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
