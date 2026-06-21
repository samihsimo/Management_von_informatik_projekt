# RASE Rule Formalization Tool

## 1. Project Overview

This project is a proof-of-concept web application developed for **Task 3** of the RASE rule formalization project.

The goal of the application is to transform legal building regulation text into structured, machine-readable RASE elements using either:

* an offline mock extractor, or
* a real Gemini API integration.

The project connects the three main phases of the course work:

1. **Task 1:** Manual RASE annotation and human reference model.
2. **Task 2:** Prompt engineering with Prompt V1, V2, and V3.
3. **Task 3:** Software prototype for automatic RASE extraction, visualization, and comparison.

---

## 2. What the Application Does

The application allows a user to paste a legal regulation clause, select an extraction mode, and analyse the clause using the RASE methodology.

RASE means:

| Letter | Meaning       |
| ------ | ------------- |
| R      | Requirement   |
| A      | Applicability |
| S      | Selection     |
| E      | Exception     |

In this project, we also use:

| Type             | Meaning                                                           |
| ---------------- | ----------------------------------------------------------------- |
| MeasurementLogic | Calculation or measurement rule that supports compliance checking |

The application extracts and displays:

* Requirements
* Applicability conditions
* Selections
* Exceptions
* Measurement logic
* AI confidence values
* JSON output
* Prompt benchmark results
* Human vs Prompt comparison
* RASE structure graph

---

## 3. Main Features

### 3.1 Input Regulation

The user can paste a building regulation clause into the text area.

A predefined example for **§47 MBO – Aufenthaltsräume** can be loaded using the button:

```text
Load §47 Example
```

The user can then select one of two modes:

```text
Mock Mode (offline)
Gemini Mode (API)
```

If Gemini mode is selected, the user can also select:

```text
Prompt V1
Prompt V2
Prompt V3
```

---

### 3.2 Mock Mode

Mock Mode works offline and does not require an API key.

It uses deterministic Python rules and keyword matching to simulate RASE extraction.

Example:

```text
If the text contains "2,40 m" → create a Requirement rule.
If the text contains "Dachraum" → create an Applicability rule.
If the text contains "Gebäudeklassen 1 und 2" → create an Exception rule.
```

Mock Mode is useful for:

* testing the application without internet access,
* demonstrating the pipeline safely,
* ensuring the frontend and backend work correctly.

---

### 3.3 Gemini API Mode

Gemini Mode sends the input regulation to the Gemini API.

The backend combines:

```text
Prompt Version + Regulation Text
```

and sends it to Gemini.

Gemini returns structured JSON containing extracted RASE rules.

The API key is not stored in the frontend. It is read securely from the Windows environment variable:

```text
GEMINI_API_KEY
```

This protects the API key from being exposed in the browser.

---

## 4. Prompt Versions

The project supports three prompt versions.

### Prompt V1 – Basic

Prompt V1 gives the model a simple task:

```text
Extract RASE rules from this regulation.
```

It is used as the baseline.

### Prompt V2 – Structured

Prompt V2 gives the model a stronger structure:

* RASE type definitions
* JSON schema
* clearer distinction between Requirement, Applicability, Selection, Exception, and MeasurementLogic

### Prompt V3 – Expert

Prompt V3 is the most advanced prompt.

It includes:

* German building regulation context
* semantic interpretation rules
* measurement logic detection
* numeric threshold extraction
* confidence values
* strict JSON output

Prompt V3 is recommended for the best result.

---

## 5. Prompt Benchmark Mode

The application includes a **Compare Prompts** button.

When clicked, the backend runs:

```text
Prompt V1
Prompt V2
Prompt V3
```

on the same regulation text.

The benchmark table compares:

| Prompt | Rules Found | Average Confidence | Human Similarity |
| ------ | ----------- | ------------------ | ---------------- |

This feature demonstrates the improvement from Prompt V1 to Prompt V3 and directly visualizes the prompt-engineering work from Task 2.

---

## 6. Confidence Heatmap

The Confidence Heatmap displays all extracted rules sorted by confidence.

Rules are grouped visually according to their confidence level:

| Confidence | Meaning           |
| ---------- | ----------------- |
| Green      | High confidence   |
| Yellow     | Medium confidence |
| Red        | Low confidence    |

This helps users identify which AI classifications are reliable and which may require human review.

---

## 7. Human vs Prompt Comparison

The Human vs Prompt Comparison table compares the human reference annotation from Task 1 with the results of Prompt V1, V2, and V3.

Example:

| Feature                  | Human | V1 | V2 | V3 |
| ------------------------ | ----- | -- | -- | -- |
| 2.40 m Requirement       | ✓     | ✓  | ✓  | ✓  |
| Dachraum Rule            | ✓     | ✗  | ✓  | ✓  |
| 1.50 m Measurement Logic | ✓     | ✗  | ✗  | ✓  |
| GK1/GK2 Exception        | ✓     | ✓  | ✓  | ✓  |

This feature shows how prompt quality affects the accuracy of the AI-generated RASE analysis.

---

## 8. RASE Structure Graph

The RASE Structure Graph visualizes the extracted RASE elements as connected nodes.

The graph groups nodes by RASE type:

| Type             | Color                         |
| ---------------- | ----------------------------- |
| Applicability    | Green                         |
| Requirement      | Red / Blue depending on style |
| Selection        | Yellow                        |
| Exception        | Orange / Red                  |
| MeasurementLogic | Purple                        |

The graph visualizes conceptual relationships between extracted RASE elements.

It is intended to illustrate the structure of the regulation and the interaction between:

* Applicability
* Requirements
* Measurement Logic
* Exceptions

Important note:

```text
The current graph shows conceptual relationships.
It does not yet automatically infer formal legal dependencies.
```

Future work could extend the graph by using LLM output to infer actual legal dependency relations.

---

## 9. JSON Output

The application returns structured JSON.

Example:

```json
{
  "metadata": {
    "building_code_reference": "Musterbauordnung (MBO) §47",
    "model": "gemini",
    "ai_confidence_level": 0.96,
    "input_hash": "sha256...",
    "mode": "gemini",
    "prompt_version": "v3"
  },
  "rules": [
    {
      "id": "rule-001",
      "paragraph": "Satz 1",
      "rase_type": "Requirement",
      "source_text": "lichte Raumhöhe von mindestens 2,40 m",
      "data_metric": "lichte_raumhoehe>=2.40m",
      "comparator": ">=",
      "target": "2.40",
      "unit": "m",
      "confidence": 0.98,
      "note": "Binding minimum clear height requirement."
    }
  ]
}
```

JSON is used because it is machine-readable and can be processed by software.

The frontend uses the JSON to generate:

* RASE result cards
* KPI values
* confidence heatmap
* comparison tables
* rule graph
* raw output view

---

## 10. Project Architecture

The application follows this architecture:

```text
User Input
   ↓
Frontend: index.html / app.js / styles.css
   ↓
Backend API: server.py
   ↓
Extraction Engine: rase_extractor.py
   ↓
Mock Mode OR Gemini API
   ↓
Structured JSON Output
   ↓
Frontend Visualization
```

---

## 11. File Structure

```text
project/
│
├── server.py
├── rase_extractor.py
├── README.md
│
├── examples/
│   └── mbo_47_excerpt.txt
│
└── static/
    ├── index.html
    ├── app.js
    └── styles.css
```

---

## 12. File Responsibilities

### server.py

`server.py` is the backend server.

It uses Python's built-in HTTP server.

It provides two API endpoints:

```text
POST /api/extract
POST /api/benchmark
```

### /api/extract

Runs one selected prompt version.

Example:

```json
{
  "text": "...",
  "mode": "gemini",
  "prompt_version": "v3"
}
```

### /api/benchmark

Runs all three prompt versions:

```text
v1, v2, v3
```

and returns all results together.

---

### rase_extractor.py

`rase_extractor.py` is the extraction engine.

It contains:

* prompt templates,
* mock extractor,
* Gemini extractor,
* JSON response parser,
* fallback logic.

If Gemini fails, the system falls back to Mock Mode.

This makes the application more robust during demonstrations.

---

### index.html

`index.html` defines the structure of the web interface.

It contains:

* input section,
* mode selector,
* prompt selector,
* RASE result area,
* confidence heatmap,
* benchmark table,
* human comparison table,
* RASE graph,
* raw JSON output.

---

### app.js

`app.js` controls the frontend logic.

It:

* loads the §47 example,
* sends requests to the backend,
* receives JSON,
* renders result cards,
* calculates similarity,
* displays heatmap,
* runs prompt benchmark,
* updates comparison tables,
* renders the graph.

---

### styles.css

`styles.css` controls the visual design.

It defines:

* layout,
* panels,
* cards,
* colors,
* buttons,
* graph styling,
* confidence heatmap,
* responsive design.

---

## 13. How to Run the Project

### Step 1: Open terminal in the project folder

```bash
cd "path/to/project"
```

### Step 2: Start the server

```bash
python server.py
```

### Step 3: Open the application

Open this URL in the browser:

```text
http://localhost:8000/static/index.html
```

---

## 14. Gemini API Setup

To use Gemini Mode, create a Gemini API key from Google AI Studio.

Then set it as an environment variable.

### Windows PowerShell

```powershell
setx GEMINI_API_KEY "YOUR_NEW_GEMINI_API_KEY"
```

Close PowerShell and open it again.

Check:

```powershell
echo $env:GEMINI_API_KEY
```

### Important

Never put the API key inside:

* index.html
* app.js
* GitHub
* screenshots
* emails

The API key is only read by the backend from:

```python
os.environ.get("GEMINI_API_KEY")
```

---

## 15. Example Workflow

1. Start the server.
2. Open the web app.
3. Click `Load §47 Example`.
4. Select `Gemini Mode`.
5. Select `Prompt V3`.
6. Click `Analyze RASE`.
7. Review:

   * extracted rules,
   * confidence values,
   * human match,
   * heatmap,
   * rule graph,
   * raw JSON.

To compare prompts:

1. Keep the same input regulation.
2. Click `Compare Prompts`.
3. The app runs V1, V2, and V3.
4. Review:

   * benchmark table,
   * Human vs Prompt Comparison.

---

## 16. Technical Contribution

The application demonstrates the complete workflow from legal text to structured rule representation.

It combines:

* legal rule formalization,
* prompt engineering,
* LLM integration,
* backend development,
* frontend visualization,
* human vs AI evaluation.

The project goes beyond simple text extraction because it includes:

* prompt benchmarking,
* confidence heatmap,
* human reference comparison,
* RASE structure graph,
* structured JSON output,
* fallback mock extractor.

---

## 17. Limitations

The current version has some limitations.

1. The human reference comparison is currently designed mainly for §47 MBO.
2. The RASE Structure Graph visualizes conceptual relationships, not automatically inferred formal legal dependencies.
3. Gemini output can vary depending on prompt version and model behavior.
4. The mock extractor is deterministic and only approximates real rule extraction.
5. The system does not yet validate building models against extracted rules.

---

## 18. Future Work

Possible future improvements include:

* upload support for PDF or HTML files,
* dynamic human reference upload,
* automatic legal dependency graph generation,
* support for multiple building code sections,
* real compliance checking against building data,
* export to HTML / JSON / PDF,
* comparison between Gemini, ChatGPT, Claude, and local models,
* improved evaluation metrics.

---

## 19. Final Summary

This project implements a working RASE Rule Formalization Tool.

It allows users to extract RASE elements from building regulations, compare different prompt versions, evaluate the AI output against a human reference, and visualize the regulation as structured machine-readable information.

The prototype demonstrates that Large Language Models can support regulatory rule formalization when combined with carefully designed prompts, structured JSON output, and human validation.



## Run locally
```bash
python server.py
```
Then open:
```text
http://localhost:8000/static/index.html