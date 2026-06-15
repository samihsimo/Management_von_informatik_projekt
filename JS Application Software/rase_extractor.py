#!/usr/bin/env python3
import hashlib, json, os, re, urllib.request, urllib.error
from typing import Dict, Any

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com"
    "/v1beta/models/gemini-2.0-flash:generateContent"
)

def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

# ── Prompt templates ─────────────────────────────────────────────────────────

_SCHEMA_HINT = """{
  "metadata": {
    "building_code_reference": "<standard reference, e.g. MBO §47>",
    "model": "gemini",
    "ai_confidence_level": <0.0-1.0>,
    "input_hash": "<sha256 of input text>"
  },
  "rules": [
    {
      "id": "rule-001",
      "paragraph": "<e.g. Satz 1>",
      "rase_type": "Requirement | Applicability | Selection | Exception | MeasurementLogic",
      "source_text": "<verbatim clause from input>",
      "data_metric": "<machine-readable Python-style expression>",
      "comparator": null,
      "target": null,
      "unit": null,
      "confidence": <0.0-1.0>,
      "note": "<optional explanation>"
    }
  ]
}"""

def _build_prompt(text: str, version: str) -> str:
    if version == "v1":
        return (
            "Extract RASE rules from the following building regulation text.\n"
            "Return ONLY valid JSON with keys: metadata and rules.\n\n"
            f"Text:\n{text}"
        )
    if version == "v2":
        return (
            "You are a building-code analyst. Extract RASE (Requirement, Applicability, "
            "Selection, Exception, MeasurementLogic) rules from the text below.\n\n"
            "Return ONLY a JSON object (no markdown fences) with this structure:\n"
            f"{_SCHEMA_HINT}\n\n"
            "RASE types:\n"
            "  Requirement     – something that MUST be satisfied\n"
            "  Applicability   – defines the scope / when the rule applies\n"
            "  Selection       – a choice among alternatives\n"
            "  Exception       – a case where normal rules do not apply\n"
            "  MeasurementLogic– how a value is calculated or measured\n\n"
            f"Regulation text:\n{text}"
        )
    # v3 — default, most detailed
    return (
        "You are an expert in German building regulations and RASE semantic markup.\n\n"
        "Task: Analyse the regulation text and extract every distinct rule, obligation, "
        "exception, scope, or measurement definition as a separate RASE entry.\n\n"
        "RASE classification guide:\n"
        "  • Requirement      – a mandatory condition (müssen, mindestens, shall)\n"
        "  • Applicability    – scope: who or what the rule applies to\n"
        "  • Selection        – a choice among permitted alternatives\n"
        "  • Exception        – an explicit exclusion from a general rule\n"
        "  • MeasurementLogic – defines HOW a quantity is measured or computed\n\n"
        "Output rules:\n"
        "  1. Return ONLY a single JSON object. No markdown, no code fences.\n"
        "  2. Every numeric threshold must appear as a separate Requirement rule.\n"
        "  3. Fill comparator (>=, <=, ==, >, <), target (numeric string), unit, "
        "     and data_metric (machine-readable expression) wherever applicable.\n"
        "  4. Set confidence between 0.0 and 1.0 reflecting extraction certainty.\n"
        "  5. building_code_reference: identify the standard and section if stated.\n"
        "  6. Set input_hash to the SHA-256 hex digest of the original input text.\n\n"
        "Required JSON structure:\n"
        f"{_SCHEMA_HINT}\n\n"
        f"Regulation text:\n{text}"
    )

# ── Mock extractor ────────────────────────────────────────────────────────────

def extract_rules_mock(text: str) -> Dict[str, Any]:
    rules = []
    rule_id = 1

    def add_rule(rase_type, source_text, data_metric, confidence=0.85,
                 comparator=None, target=None, unit=None, paragraph=None, note=None):
        nonlocal rule_id
        rules.append({
            "id": f"rule-{rule_id:03d}",
            "paragraph": paragraph,
            "rase_type": rase_type,
            "source_text": source_text.strip(),
            "data_metric": data_metric,
            "comparator": comparator,
            "target": target,
            "unit": unit,
            "confidence": confidence,
            "note": note,
        })
        rule_id += 1

    normalized = " ".join(text.split())
    if "Aufenthaltsräume" in normalized:
        add_rule("Applicability", "Aufenthaltsräume", "type==Aufenthaltsraeume", 0.97, paragraph="Satz 1")
    if "2,40" in normalized or "2.40" in normalized:
        add_rule("Requirement", "lichte Raumhöhe von mindestens 2,40 m", "lichte_raumhoehe>=2.40m",
                 0.98, comparator=">=", target="2.40", unit="m", paragraph="Satz 1")
    if "Dachraum" in normalized:
        add_rule("Applicability", "Aufenthaltsräume im Dachraum", "type==AufenthaltsraeumeImDachraum",
                 0.96, paragraph="Satz 2",
                 note="Special case / lex specialis compared with the general 2.40 m rule.")
    if "2,20" in normalized or "2.20" in normalized:
        add_rule("Requirement", "lichte Raumhöhe von mindestens 2,20 m", "lichte_raumhoehe>=2.20m",
                 0.98, comparator=">=", target="2.20", unit="m", paragraph="Satz 2")
    if "Hälfte" in normalized or "half" in normalized or "50" in normalized:
        add_rule("Requirement", "mindestens der Hälfte ihrer Netto-Raumfläche", "netto_raumflaeche>=0.50",
                 0.94, comparator=">=", target="0.50", unit="ratio", paragraph="Satz 2")
    if "1,50" in normalized or "1.50" in normalized:
        add_rule("MeasurementLogic",
                 "Raumteile mit einer lichten Raumhöhe bis zu 1,50 m bleiben außer Betracht",
                 "measurement_logic: exclude_area_where_lichte_raumhoehe<=1.50m",
                 0.91, comparator="<=", target="1.50", unit="m", paragraph="Satz 2",
                 note="Not an independent RASE element; it defines calculation methodology.")
    if "Gebäudeklassen 1 und 2" in normalized or "Gebaeudeklassen 1 und 2" in normalized:
        add_rule("Exception", "Wohngebäuden der Gebäudeklassen 1 und 2",
                 "gebaeude_klasse in {GK1,GK2}",
                 0.98, paragraph="Satz 3", note="Sentences 1 and 2 do not apply.")

    if not rules:
        for s in re.split(r"(?<=[.!?])\s+", text.strip()):
            low = s.lower()
            if not s.strip():
                continue
            if any(k in low for k in ["must", "shall", "müssen", "mindestens"]):
                add_rule("Requirement", s, "generic_requirement=TRUE", 0.70)
            elif any(k in low for k in ["except", "gelten nicht", "not required", "nicht erforderlich"]):
                add_rule("Exception", s, "generic_exception=TRUE", 0.70)
            else:
                add_rule("Applicability", s, "generic_scope=TRUE", 0.55)

    avg_conf = round(sum(r["confidence"] for r in rules) / len(rules), 2) if rules else 0
    return {
        "metadata": {
            "building_code_reference": "Musterbauordnung (MBO) §47 / Custom input",
            "model": "mock-mode",
            "ai_confidence_level": avg_conf,
            "input_hash": sha256_text(text),
            "mode": "mock",
        },
        "rules": rules,
    }

# ── Gemini extractor ──────────────────────────────────────────────────────────

def _strip_code_fence(raw: str) -> str:
    """Remove markdown code fences Gemini occasionally wraps JSON in."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw.strip())
    return raw.strip()

def extract_rules_gemini(text: str, prompt_version: str = "v3") -> Dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY environment variable is not set.")

    prompt = _build_prompt(text, prompt_version)
    url = f"{GEMINI_ENDPOINT}?key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            gemini_resp = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini HTTP {exc.code}: {body}") from exc

    raw_text = (
        gemini_resp
        .get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    if not raw_text:
        raise RuntimeError("Gemini returned an empty response.")

    result = json.loads(_strip_code_fence(raw_text))

    result.setdefault("metadata", {})
    result.setdefault("rules", [])
    result["metadata"].setdefault("model", "gemini")
    result["metadata"].setdefault("input_hash", sha256_text(text))
    result["metadata"]["mode"] = "gemini"
    result["metadata"]["prompt_version"] = prompt_version

    return result

# ── Public entry point ────────────────────────────────────────────────────────

def extract(text: str, mode: str = "mock", prompt_version: str = "v3") -> Dict[str, Any]:
    if mode == "gemini":
        try:
            return extract_rules_gemini(text, prompt_version)
        except Exception as exc:
            fallback = extract_rules_mock(text)
            fallback["metadata"]["gemini_error"] = str(exc)
            fallback["metadata"]["mode"] = "gemini-fallback"
            return fallback
    return extract_rules_mock(text)

if __name__ == "__main__":
    import argparse
    from pathlib import Path
    parser = argparse.ArgumentParser()
    parser.add_argument("file", nargs="?")
    parser.add_argument("--mode", default="mock", choices=["mock", "gemini"])
    parser.add_argument("--prompt", default="v3", choices=["v1", "v2", "v3"])
    args = parser.parse_args()
    txt = (
        Path(args.file).read_text(encoding="utf-8")
        if args.file
        else input("Paste regulation text: ")
    )
    print(json.dumps(extract(txt, args.mode, args.prompt), indent=2, ensure_ascii=False))
