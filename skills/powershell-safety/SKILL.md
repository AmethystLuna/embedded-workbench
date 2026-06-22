---
name: powershell-safety
description: "Use when generating or executing PowerShell commands in Windows terminals — avoid bash-style syntax, unsafe chaining, or fragile quoting."
---

# PowerShell Command Safety

- Use PowerShell syntax, not bash or cmd.exe syntax. Avoid `&&`, `export`, `VAR=value cmd`, `source`, or shell assumptions that don't match PowerShell parsing.
- Assume Windows PowerShell semantics unless the user or repository explicitly says otherwise.

## File Encoding

Windows PowerShell 5.1 has inconsistent default encodings across cmdlets. This is a leading cause of garbled text, broken builds, and corrupted config files — especially with non-ASCII content (Chinese, CJK, diacritics).

### Default Encodings by Cmdlet

| Cmdlet | Default (PS 5.1) | Default (PS 7+) |
| -------- | :---------------: | :---------------: |
| `Out-File` | UTF-16 LE (with BOM) | UTF-8 (no BOM) |
| `Set-Content` | ANSI (system code page) | UTF-8 (no BOM) |
| `Add-Content` | ANSI (system code page) | UTF-8 (no BOM) |
| `Get-Content` | BOM-detect, fallback to ANSI | UTF-8 |
| `> redirect` | UTF-16 LE | UTF-8 (no BOM) |
| `>> redirect` | UTF-16 LE | UTF-8 (no BOM) |

### Mandatory Rules

- **Always pass `-Encoding utf8` when writing files other tools will read**: `Out-File`, `Set-Content`, `Add-Content`. **Caution on PS 5.1**: `-Encoding utf8` produces UTF-8 **with** BOM (bytes EF BB BF). Some tools (GCC, clang, older Python) choke on this. For source files (`.c`, `.h`, `.py`) use `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))` instead.
- **When reading files, specify the expected encoding**: `Get-Content -Encoding utf8` for UTF-8 files, `Get-Content -Encoding Unicode` for UTF-16 LE. Don't rely on auto-detection in PS 5.1.
- **For UTF-8 without BOM on PS 5.1**: Use `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))`. The `$false` means no BOM. This is essential for `.c`, `.h`, `.json`, `.yml`, `.md`, and `.py` files.
- **`$OutputEncoding`** controls how PowerShell sends text to native executables via pipeline. Set it to UTF-8 without BOM when piping to tools that expect it: `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)`.
- **NEVER use `>` on PS 5.1 for files that will be read by non-PowerShell tools.** Use `Out-File -Encoding utf8` or `Set-Content -Encoding utf8` instead.

### Symptoms of Encoding Mismatch

- Chinese/Japanese/Korean text appears as `?`, `??`, or garbled ideograms
- GCC/clang reports "stray \\357" (UTF-8 BOM) or "stray \\377" (UTF-16 LE BOM) — BOM bytes misinterpreted as source code
- JSON/XML parsers fail on first character (BOM before `{` or `<`)
- `git diff` shows "Binary files differ" (UTF-16 detected as binary)
- Files created by PowerShell may be larger than expected: UTF-16 uses 2 bytes per ASCII character (~50% larger for mixed CJK+ASCII text, up to 2x for pure ASCII)

- Prefer standard PowerShell cmdlets: `Get-ChildItem`, `Select-String`, `Where-Object`, `Select-Object`, `ForEach-Object`, `Test-Path`, `Resolve-Path`, `Join-Path`.
- Quote Windows paths that may contain spaces. Single quotes for literal strings, double quotes only when interpolation is required.
- Before generating commands with side effects, verify working directory, target path, and file existence with `Get-Location`, `Test-Path`, or `Resolve-Path`.
- Prefer one clear step per line over complex one-liners. Break flows apart when path changes, pipelines, or side effects are involved.
- When combining commands, use `;` for sequencing. Don't rely on shell-specific chaining.
- When mixing cmdlets with native executables, check both `$?` and `$LASTEXITCODE` for native tools.
- Treat wildcard expansion, regex quoting, and pipeline input as PowerShell semantics, not text-shell semantics.
- Avoid aliases in reusable commands. Spell out cmdlet names so intent is obvious.
- For destructive, recursive, or wide-scope commands, require an explicit path. Don't generate broad delete/move/replace commands unless explicitly asked.
- If a command is read-only, keep it read-only. Don't combine inspection and mutation in one step.
- Before presenting a command, mentally dry-run its quoting, directory dependency, wildcard scope, and target files.
