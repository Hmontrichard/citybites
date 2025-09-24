# PowerShell version of run-tests.sh for Windows users
Write-Host "Running tests for all apps..." -ForegroundColor Green

Write-Host "`n▶ apps/agent" -ForegroundColor Green
Write-Host "(no test script, running 'build' instead)" -ForegroundColor Yellow
npm --prefix apps/agent run build

Write-Host "`n▶ apps/frontend" -ForegroundColor Green
npm --prefix apps/frontend run test

Write-Host "`n▶ apps/mcp-citybites" -ForegroundColor Green
npm --prefix apps/mcp-citybites run test

Write-Host "`nAll done." -ForegroundColor Green
