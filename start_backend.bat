@echo off
echo Starting FinAnalyzer RAG Pro Backend...
set "ROOT=%~dp0"
pushd "%ROOT%backend"
"%ROOT%\.venv\Scripts\python.exe" main.py
popd
