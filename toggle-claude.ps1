# Claude API Toggle Script
# Easily switch between Anthropic API key and Claude Code subscription

param(
    [Parameter(Position=0)]
    [ValidateSet('api', 'subscription', 'status', 'help')]
    [string]$Mode = 'status'
)

function Show-Help {
    Write-Host "`n=== Claude API Toggle Script ===" -ForegroundColor Cyan
    Write-Host "`nUsage: .\toggle-claude.ps1 [mode]`n" -ForegroundColor White
    Write-Host "Modes:" -ForegroundColor Yellow
    Write-Host "  api          - Switch to Anthropic API key" -ForegroundColor Green
    Write-Host "  subscription - Switch to Claude Code subscription (unset API key)" -ForegroundColor Green
    Write-Host "  status       - Check current configuration" -ForegroundColor Green
    Write-Host "  help         - Show this help message" -ForegroundColor Green
    Write-Host "`nExamples:" -ForegroundColor Yellow
    Write-Host "  .\toggle-claude.ps1 api" -ForegroundColor Gray
    Write-Host "  .\toggle-claude.ps1 subscription" -ForegroundColor Gray
    Write-Host "  .\toggle-claude.ps1 status" -ForegroundColor Gray
    Write-Host ""
}

function Show-Status {
    Write-Host "`n=== Current Claude Configuration ===" -ForegroundColor Cyan
    
    if ($env:ANTHROPIC_API_KEY) {
        Write-Host "`nMode: " -NoNewline -ForegroundColor White
        Write-Host "Anthropic API Key" -ForegroundColor Green
        Write-Host "API Key (first 20 chars): $($env:ANTHROPIC_API_KEY.Substring(0, [Math]::Min(20, $env:ANTHROPIC_API_KEY.Length)))..." -ForegroundColor Yellow
        Write-Host "`nYou are using your Anthropic API key for Claude requests." -ForegroundColor White
    } else {
        Write-Host "`nMode: " -NoNewline -ForegroundColor White
        Write-Host "Claude Code Subscription" -ForegroundColor Green
        Write-Host "`nYou are using your Claude Code subscription." -ForegroundColor White
    }
    Write-Host ""
}

function Set-ApiMode {
    # Check if API key is already configured
    $apiKeyFile = Join-Path $PSScriptRoot "api-key.txt"
    
    if (-not (Test-Path $apiKeyFile)) {
        Write-Host "`n[ERROR] API key file not found!" -ForegroundColor Red
        Write-Host "`nPlease create a file named 'api-key.txt' in the same directory as this script." -ForegroundColor Yellow
        Write-Host "Put your Anthropic API key in that file (just the key, nothing else)." -ForegroundColor Yellow
        Write-Host "`nExample: sk-ant-api03-..." -ForegroundColor Gray
        Write-Host ""
        return
    }
    
    $apiKey = Get-Content $apiKeyFile -Raw
    $apiKey = $apiKey.Trim()
    
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        Write-Host "`n[ERROR] API key file is empty!" -ForegroundColor Red
        Write-Host "Please add your Anthropic API key to api-key.txt" -ForegroundColor Yellow
        Write-Host ""
        return
    }
    
    $env:ANTHROPIC_API_KEY = $apiKey
    
    Write-Host "`n=== Switched to Anthropic API ===" -ForegroundColor Green
    Write-Host "`nAPI Key (first 20 chars): $($apiKey.Substring(0, [Math]::Min(20, $apiKey.Length)))..." -ForegroundColor Cyan
    Write-Host "`nYou are now using your Anthropic API key." -ForegroundColor White
    Write-Host "This setting applies to this terminal session only." -ForegroundColor Gray
    Write-Host ""
}

function Set-SubscriptionMode {
    # Unset the API key to use Claude Code subscription
    if ($env:ANTHROPIC_API_KEY) {
        Remove-Item Env:\ANTHROPIC_API_KEY
        Write-Host "`n=== Switched to Claude Code Subscription ===" -ForegroundColor Green
        Write-Host "`nAPI key has been removed from this session." -ForegroundColor White
        Write-Host "You are now using your Claude Code subscription." -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "`n=== Already using Claude Code Subscription ===" -ForegroundColor Yellow
        Write-Host "`nNo API key is currently set." -ForegroundColor White
        Write-Host ""
    }
}

# Main logic
switch ($Mode) {
    'api' {
        Set-ApiMode
    }
    'subscription' {
        Set-SubscriptionMode
    }
    'status' {
        Show-Status
    }
    'help' {
        Show-Help
    }
}