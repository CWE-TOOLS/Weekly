@echo off
setlocal enabledelayedexpansion

set mode=%1
if "%mode%"=="" set mode=status

goto :%mode%

:help
echo.
echo === Claude API Toggle Script ===
echo.
echo Usage: toggle-claude.bat [mode]
echo.
echo Modes:
echo   api          - Switch to Anthropic API key
echo   subscription - Switch to Claude Code subscription (unset API key)
echo   status       - Check current configuration
echo   help         - Show this help message
echo.
echo Examples:
echo   toggle-claude.bat api
echo   toggle-claude.bat subscription
echo   toggle-claude.bat status
echo.
goto end

:status
echo.
echo === Current Claude Configuration ===
echo.
if defined ANTHROPIC_API_KEY (
    echo Mode: Anthropic API Key
    echo API Key (first 20 chars): !ANTHROPIC_API_KEY:~0,20!...
    echo.
    echo You are using your Anthropic API key for Claude requests.
) else (
    echo Mode: Claude Code Subscription
    echo.
    echo You are using your Claude Code subscription.
)
echo.
goto end

:api
set apiKeyFile=%~dp0api-key.txt
if not exist "%apiKeyFile%" (
    echo.
    echo [ERROR] API key file not found!
    echo.
    echo Please create a file named 'api-key.txt' in the same directory as this script.
    echo Put your Anthropic API key in that file (just the key, nothing else).
    echo.
    echo Example: sk-ant-api03-...
    echo.
    goto end
)
set apiKey=
for /f "tokens=*" %%i in (%apiKeyFile%) do set apiKey=%%i
if "!apiKey!"=="" (
    echo.
    echo [ERROR] API key file is empty!
    echo Please add your Anthropic API key to api-key.txt
    echo.
    goto end
)
set ANTHROPIC_API_KEY=%apiKey%
echo.
echo === Switched to Anthropic API ===
echo.
echo API Key (first 20 chars): !apiKey:~0,20!...
echo.
echo You are now using your Anthropic API key.
echo This setting applies to this terminal session only.
echo.
goto end

:subscription
if defined ANTHROPIC_API_KEY (
    set ANTHROPIC_API_KEY=
    echo.
    echo === Switched to Claude Code Subscription ===
    echo.
    echo API key has been removed from this session.
    echo You are now using your Claude Code subscription.
    echo.
) else (
    echo.
    echo === Already using Claude Code Subscription ===
    echo.
    echo No API key is currently set.
    echo.
)
goto end

:end
endlocal