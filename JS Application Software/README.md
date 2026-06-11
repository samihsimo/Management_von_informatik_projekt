# RASE Task 3 – Proof of Concept Application

## Goal
Legal regulation text → RASE extraction → JSON output → Human vs AI comparison → Logic tree visualization.

## Features
- Paste legal building regulation text
- Offline mock extraction mode
- Structured JSON output
- RASE cards
- Human vs AI comparison for §47 MBO
- Similarity score
- Prompt evolution viewer
- Legal logic tree

## Run locally
```bash
python server.py
```
Then open:
```text
http://localhost:8000/static/index.html
```

## Files
- `server.py`: minimal Python HTTP server
- `rase_extractor.py`: core extraction logic
- `static/index.html`: frontend dashboard
- `static/app.js`: browser logic
- `static/styles.css`: styling
- `examples/`: example clauses

Mock mode works without API keys. Live mode is currently a placeholder and can be extended later with OpenAI, Claude, or Gemini.
