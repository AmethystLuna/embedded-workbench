# SessionStart hook for embedded-workbench
# Reads session-start-content.md, wraps in JSON, outputs via stdout.
# All content lives in the .md file — no encoding-vulnerable inline strings.
param()
$ErrorActionPreference = "Stop"

$contentFile = Join-Path $PSScriptRoot "session-start-content.md"

if (-not (Test-Path $contentFile)) {
    $fallback = '{' + '"hookSpecificOutput":{' + '"hookEventName":"SessionStart",' + '"additionalContext":"embedded-workbench active (content file missing)"' + '}}'
    [Console]::WriteLine($fallback)
    exit 0
}

# Read content as UTF-8 without BOM
$content = [System.IO.File]::ReadAllText($contentFile, [System.Text.UTF8Encoding]::new($false))

# Manual JSON escape: backslash first, then quote, then control chars
$escaped = $content -replace '\\', '\\' -replace '"', '\"'
$escaped = $escaped -replace "`r`n", '\n' -replace "`n", '\n' -replace "`r", '\r' -replace "`t", '\t'

# Build JSON
$json = '{' + '"hookSpecificOutput":{' + '"hookEventName":"SessionStart",' + '"additionalContext":"' + $escaped + '"' + '}}'

# Output via Console.WriteLine to bypass PowerShell's encoding pipeline
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::WriteLine($json)
