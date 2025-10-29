# Set the API key in the current PowerShell session
$env:ANTHROPIC_API_KEY = "YOUR_API_KEY_HERE"

Write-Host "ANTHROPIC_API_KEY has been set in this terminal session" -ForegroundColor Green
Write-Host ""
Write-Host "API Key (first 20 chars): $($env:ANTHROPIC_API_KEY.Substring(0,20))..." -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now run your Claude Code commands." -ForegroundColor Yellow
Write-Host "Note: This will only work in this terminal session." -ForegroundColor White