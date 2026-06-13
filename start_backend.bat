@echo off
echo Starting FinAnalyzer RAG Pro Backend...
set "ROOT=%~dp0"
"%ROOT%\.venv\Scripts\python.exe" "%ROOT%backend\main.py"
