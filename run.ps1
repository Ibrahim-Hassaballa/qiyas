# Run QiyasAI Copilot
Write-Host "Starting QiyasAI Copilot..." -ForegroundColor Cyan

# Start Backend
Write-Host "Starting Backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PYTHONPATH='.'; pip install -r Backend/requirements.txt; python -m Backend.Source.Main"

# Start Frontend
Write-Host "Starting Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Frontend; npm run dev"

Write-Host "QiyasAI Copilot is running!" -ForegroundColor Cyan