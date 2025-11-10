# Windows System Commands

This project is developed on **Windows** (MINGW64_NT-10.0-19045). The environment supports Git Bash, PowerShell, and Windows CMD.

## Shell Environment

### Available Shells
1. **Git Bash** (Recommended for *nix-like commands)
2. **PowerShell** (Windows native)
3. **CMD** (Legacy Windows command prompt)

### File System
- **Path separator**: Backslash `\` (Windows), Forward slash `/` (Git Bash)
- **Case sensitivity**: Windows is case-insensitive
- **Line endings**: CRLF (`\r\n`) on Windows, LF (`\n`) in Git

## Git Bash Commands (Preferred)

### File Operations
```bash
# List files
ls -la

# Find files
find . -name "*.js"
find . -type f -name "task-*.js"

# Search in files (grep)
grep -r "functionName" src/
grep -rn "TODO" src/  # With line numbers
grep -r "import.*state" src/ --include="*.js"

# Count lines of code
find src/ -name "*.js" -exec wc -l {} + | sort -n

# Create directory
mkdir -p src/new-feature

# Copy files
cp source.js dest.js
cp -r src/old/ src/new/

# Move/rename
mv old.js new.js

# Remove files
rm file.js
rm -rf directory/
```

### Git Commands
```bash
git status
git add .
git add src/file.js
git commit -m "Commit message"
git push origin main
git pull
git log --oneline --graph
git diff
git diff --staged
git branch
git checkout -b new-branch
git merge branch-name
```

### Process Management
```bash
# Find process by port
netstat -ano | findstr :8080

# Kill process (use PowerShell)
# See PowerShell section below
```

## PowerShell Commands

### File Operations
```powershell
# List files
Get-ChildItem
Get-ChildItem -Recurse

# Find files
Get-ChildItem -Recurse -Filter "*.js"
Get-ChildItem -Path src\ -Recurse -Include "*.js"

# Search in files
Select-String -Path src\*.js -Pattern "functionName" -Recurse
Select-String -Path src\ -Pattern "TODO" -Recurse | Select-Object Path, LineNumber

# Count lines
(Get-Content file.js).Length

# Create directory
New-Item -ItemType Directory -Path src\new-feature

# Copy files
Copy-Item source.js dest.js
Copy-Item -Recurse src\old\ src\new\

# Move/rename
Move-Item old.js new.js

# Remove files
Remove-Item file.js
Remove-Item -Recurse directory\
```

### Process Management
```powershell
# Find process by port
netstat -ano | findstr :8080

# Find process by name
Get-Process -Name "node"

# Kill process by PID
Stop-Process -Id 1234

# Kill process by name
Stop-Process -Name "node" -Force
```

### Network
```powershell
# Test connection
Test-NetConnection localhost -Port 8080

# Check open ports
netstat -ano
```

## CMD Commands (Legacy)

### File Operations
```cmd
# List files
dir
dir /s  # Recursive

# Find files
dir /s /b *.js

# Search in files (limited)
findstr /s /i "searchterm" *.js

# Create directory
mkdir src\new-feature

# Copy files
copy source.js dest.js
xcopy /s /e src\old src\new

# Remove files
del file.js
rmdir /s /q directory
```

## Development Server Commands

### Start Local Server
```bash
# Node.js http-server (Git Bash or PowerShell)
npx http-server -p 8080 -o

# Python 3 (Git Bash)
python -m http.server 8080

# Python 3 (PowerShell)
python -m http.server 8080
```

## File Paths

### Path Formats
```bash
# Windows absolute path
C:\Users\mike10\Documents\VScode projects\weekly

# Git Bash absolute path (Unix-style)
/c/Users/mike10/Documents/VScode\ projects/weekly

# Relative path (works in all shells)
src/core/app-controller.js
```

### Escaping Spaces
```bash
# Git Bash - Use backslash or quotes
cd /c/Users/mike10/Documents/VScode\ projects/weekly
cd "/c/Users/mike10/Documents/VScode projects/weekly"

# PowerShell - Use quotes
cd "C:\Users\mike10\Documents\VScode projects\weekly"

# CMD - Use quotes
cd "C:\Users\mike10\Documents\VScode projects\weekly"
```

## Environment Variables

### Git Bash
```bash
echo $PATH
export MY_VAR="value"
echo $MY_VAR
```

### PowerShell
```powershell
$env:PATH
$env:MY_VAR = "value"
echo $env:MY_VAR
```

### CMD
```cmd
echo %PATH%
set MY_VAR=value
echo %MY_VAR%
```

## Permissions

### Execution Policy (PowerShell)
```powershell
# Check current policy
Get-ExecutionPolicy

# Allow script execution (Admin required)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Bypass for single script
powershell -ExecutionPolicy Bypass -File script.ps1
```

### File Permissions
Windows uses different permission model than Unix (no chmod):
- Use File Explorer → Right-click → Properties → Security
- Or use `icacls` command (advanced)

## Common Issues

### Line Endings
```bash
# Check line endings
file index.html  # Git Bash

# Convert CRLF to LF
dos2unix file.js  # If dos2unix installed

# Git config for line endings
git config --global core.autocrlf true  # Windows
```

### Path Length Limit
Windows has 260-character path limit (pre-Windows 10 1607):
```powershell
# Enable long paths (Admin PowerShell, Windows 10+)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### Case Sensitivity
Windows filesystem is case-insensitive:
- `File.js` and `file.js` are the same file
- Git may show conflicts when pulling from case-sensitive systems

## Utility Scripts

### Toggle Claude Config
```bash
# Git Bash
./toggle-claude.sh

# PowerShell
.\toggle-claude.ps1

# CMD
toggle-claude.bat
```

## VS Code Integration

### Integrated Terminal
- Default: PowerShell or CMD
- Change to Git Bash: Terminal → Select Default Profile → Git Bash
- Split terminal: Multiple shells side-by-side

### Tasks
Can define tasks in `.vscode/tasks.json`:
```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Start Server",
            "type": "shell",
            "command": "npx http-server -p 8080",
            "group": "build"
        }
    ]
}
```

## Recommended Setup for This Project

1. **Primary shell**: Git Bash (for Unix-like commands)
2. **Secondary shell**: PowerShell (for Windows-specific tasks)
3. **VS Code**: Use Git Bash as integrated terminal
4. **Git**: Configure autocrlf: `git config --global core.autocrlf true`
5. **Live Server**: Use VS Code Live Server extension (easiest option)