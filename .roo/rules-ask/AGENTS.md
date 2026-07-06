# Project Documentation Rules (Non-Obvious Only)

- Existing root `CLAUDE.md` mirrors an older root `AGENTS.md` and still describes NVIDIA as the LLM; current code uses Agnes for LLM and NVIDIA only for embeddings.
- `frontend/CLAUDE.md` is only an include pointer to `frontend/AGENTS.md`; the meaningful frontend rule is the Next 16 warning.
- The name `FinancialReportParser` and Qdrant collection `financial_reports` are legacy names; supported uploads include general PDF, Office, CSV, JSON, TXT, and Markdown.
- `tests/generate_mock_report.py` is a data generator, while root `test_*.py` files are manual endpoint probes.
