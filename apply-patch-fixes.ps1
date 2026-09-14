param(
    [string]$Patch = ".\changes.patch"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Patch)) {
    Write-Host "ERROR: changes.patch was not found at $Patch" -ForegroundColor Red
    Write-Host "Put the patch file in the project root and run this script again."
    exit 1
}

$root = (Get-Location).Path
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $Patch), [System.Text.Encoding]::UTF8)

$currentFile = $null
$pendingOld = $null
$pendingNew = $null
$results = @()

function Apply-Replacement {
    param(
        [string]$RelativePath,
        [string]$OldLine,
        [string]$NewLine
    )

    $full = Join-Path $root $RelativePath

    if (-not (Test-Path $full)) {
        $script:results += "MISSING FILE | $RelativePath"
        return
    }

    $fileLines = [System.IO.File]::ReadAllLines($full, [System.Text.Encoding]::UTF8)
    $matches = @(
        for ($i = 0; $i -lt $fileLines.Count; $i++) {
            if ($fileLines[$i] -ceq $OldLine) { $i }
        }
    )

    if ($matches.Count -eq 0) {
        $script:results += "NOT FOUND   | $RelativePath"
        return
    }

    if ($matches.Count -gt 1) {
        $script:results += "MULTIPLE    | $RelativePath (matched $($matches.Count) lines; skipped)"
        return
    }

    $fileLines[$matches[0]] = $NewLine
    [System.IO.File]::WriteAllLines($full, $fileLines, (New-Object System.Text.UTF8Encoding($false)))
    $script:results += "APPLIED     | $RelativePath"
}

function Flush-Hunk {
    if ($null -ne $script:pendingOld -and $null -ne $script:pendingNew) {
        Apply-Replacement -RelativePath $script:currentFile -OldLine $script:pendingOld -NewLine $script:pendingNew
    }
    $script:pendingOld = $null
    $script:pendingNew = $null
}

foreach ($line in $lines) {
    if ($line.StartsWith("diff --git ")) {
        Flush-Hunk
        $currentFile = ($line -split " b/", 2)[1]
        continue
    }

    if ($line.StartsWith("@@ ")) {
        Flush-Hunk
        continue
    }

    if ($null -eq $currentFile) { continue }

    if ($line.StartsWith("--- ") -or $line.StartsWith("+++ ")) {
        continue
    }

    if ($line.StartsWith("-") -and -not $line.StartsWith("---")) {
        $pendingOld = $line.Substring(1)
        continue
    }

    if ($line.StartsWith("+") -and -not $line.StartsWith("+++")) {
        $pendingNew = $line.Substring(1)
        Flush-Hunk
        continue
    }
}

Flush-Hunk

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PATCH FIXES APPLIED" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$results | ForEach-Object {
    if ($_ -like "APPLIED*") {
        Write-Host $_ -ForegroundColor Green
    } elseif ($_ -like "NOT FOUND*" -or $_ -like "MULTIPLE*" -or $_ -like "MISSING*") {
        Write-Host $_ -ForegroundColor Yellow
    } else {
        Write-Host $_
    }
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "  git diff --check"
Write-Host "  npm run typecheck"
Write-Host "  npm run build"
