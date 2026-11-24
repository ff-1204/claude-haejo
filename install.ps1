<#
claude-haejo 설치·점검 (Windows PowerShell 5.1 이상). install.sh와 같은 동작이다.
  .\install.ps1             skills\*를 ~\.claude\skills\에 복사한다. CLAUDE.md는 없을 때만 복사하고, 다르면 다른 줄만 보인다. 버전은 ~\.claude\claude-haejo.json에 남긴다.
  .\install.ps1 -Check      복사하지 않고 다른 파일만 보인다. 다르거나 옛 하위 스킬 폴더가 남아 있으면 exit 1.
  .\install.ps1 -DryRun     복사할 파일만 보이고 복사하지 않는다.
  .\install.ps1 -Prune      옛 하위 스킬 폴더(roadmap-core 등 7개, 지금은 roadmap 하나로 합쳐짐)만 지운다. *.local.md가 든 폴더는 지우지 않는다.
  -HomeDir <폴더>           ~ 대신 쓸 폴더 (시험용)
*.local.md(이 PC에만 두는 규칙)는 복사하지도 비교하지도 않는다. -Prune 말고는 ~\.claude의 파일을 지우지 않는다.
실행이 막히면: powershell -ExecutionPolicy Bypass -File .\install.ps1
#>
param([switch]$Check, [switch]$DryRun, [switch]$Prune, [string]$HomeDir = $HOME)
$ErrorActionPreference = 'Stop'
# 한글 결과가 Git Bash·Claude 쪽에서 깨지지 않게 UTF-8로 낸다
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$repo = $PSScriptRoot
$dest = Join-Path $HomeDir '.claude'
$script:diffs = 0

# 옛 하위 스킬 폴더 (고정 목록). 이 폴더들이 설치본에 남아 있으면 옛 스킬이 계속 불릴 수 있다.
$oldSkills = @('roadmap-core', 'roadmap-personas', 'roadmap-scenarios', 'roadmap-map', 'roadmap-score', 'roadmap-priority', 'roadmap-milestones')
$oldFound = @($oldSkills | Where-Object { Test-Path -LiteralPath (Join-Path $dest "skills\$_") -PathType Container })

if ($Prune) {
  if ($oldFound.Count -eq 0) { Write-Output '지울 옛 하위 스킬 폴더 없음'; exit 0 }
  foreach ($n in $oldFound) {
    $d = Join-Path $dest "skills\$n"
    $keep = @(Get-ChildItem -LiteralPath $d -Recurse -File -Filter '*.local.md')
    if ($keep.Count -gt 0) {
      Write-Output "지우지 않음: skills/$n (이 PC에만 두는 *.local.md가 있다. 옮긴 뒤 다시 -Prune)"
      $keep | ForEach-Object { Write-Output "  - $($_.FullName.Substring($dest.Length + 1) -replace '\\', '/')" }
    } else {
      Remove-Item -LiteralPath $d -Recurse -Force
      Write-Output "지움: skills/$n"
    }
  }
  exit 0
}

# 줄바꿈(CRLF/LF)만 다르면 같은 파일로 본다 (Windows git의 autocrlf)
function Test-Same($a, $b) {
  if (-not (Test-Path -LiteralPath $b -PathType Leaf)) { return $false }
  $x = [IO.File]::ReadAllText($a) -replace "`r", ''
  $y = [IO.File]::ReadAllText($b) -replace "`r", ''
  return $x -ceq $y
}

# 저장소 파일 하나를 ~\.claude 같은 자리와 맞춘다
function Sync-File($rel) {
  $f = Join-Path $repo $rel
  $t = Join-Path $dest $rel
  if (Test-Same $f $t) { return }
  $why = if (Test-Path -LiteralPath $t) { '다름' } else { '없음' }
  $name = $rel -replace '\\', '/'
  if ($Check) { Write-Output "${why}: $name"; $script:diffs++ }
  elseif ($DryRun) { Write-Output "복사할 것(${why}): $name" }
  else {
    New-Item -ItemType Directory -Force -Path (Split-Path $t) | Out-Null
    Copy-Item -LiteralPath $f -Destination $t -Force
    Write-Output "복사(${why}): $name"
  }
}

$skills = Join-Path $repo 'skills'
Get-ChildItem -LiteralPath $skills -Recurse -File |
  Where-Object { $_.Name -notlike '*.local.md' } |
  Sort-Object FullName |
  ForEach-Object { Sync-File $_.FullName.Substring($repo.Length + 1) }

# 저장소에서 빠진 파일은 알리기만 한다
foreach ($d in Get-ChildItem -LiteralPath $skills -Directory) {
  $td = Join-Path $dest "skills\$($d.Name)"
  if (-not (Test-Path -LiteralPath $td)) { continue }
  Get-ChildItem -LiteralPath $td -Recurse -File |
    Where-Object { $_.Name -notlike '*.local.md' } |
    Sort-Object FullName |
    ForEach-Object {
      $rel = $_.FullName.Substring($dest.Length + 1)
      if (-not (Test-Path -LiteralPath (Join-Path $repo $rel))) {
        Write-Output "참고: 저장소에 없음(지우지 않음): $($rel -replace '\\', '/')"
      }
    }
}

# CLAUDE.md는 기기마다 고친 줄이 있을 수 있어 덮지 않는다
$src = Join-Path $repo 'CLAUDE.md'
$t = Join-Path $dest 'CLAUDE.md'
if (-not (Test-Path -LiteralPath $t)) {
  Sync-File 'CLAUDE.md'
} elseif (-not (Test-Same $src $t)) {
  if ($Check) { Write-Output '다름: CLAUDE.md'; $script:diffs++ }
  else {
    Write-Output 'CLAUDE.md가 이미 있고 다르다. 덮지 않는다. 필요한 줄은 손으로 합친다 (- 지금 파일, + 저장소):'
    Compare-Object (Get-Content -LiteralPath $t -Encoding UTF8) (Get-Content -LiteralPath $src -Encoding UTF8) |
      ForEach-Object { if ($_.SideIndicator -eq '<=') { "- $($_.InputObject)" } else { "+ $($_.InputObject)" } }
  }
}

# 설치한 버전을 ~\.claude\claude-haejo.json에 남긴다 (skills\ 밖이라 -Check 비교에 걸리지 않는다).
# 새 버전 안내(skills/roadmap/scripts/check-update.js)가 읽는다. git이나 태그가 없으면 version은 null.
function Write-Version {
  # git 오류(태그 없음 등)가 설치를 멈추지 않게 이 함수 안에서는 오류를 넘긴다 (PowerShell 5.1은 2>$null도 오류로 본다)
  $ErrorActionPreference = 'SilentlyContinue'
  $tag = $null; $commit = $null; $ahead = $null
  if (Get-Command git -ErrorAction SilentlyContinue) {
    try {
      $c = (& git -C $repo rev-parse --short HEAD 2>$null | Out-String).Trim()
      if ($LASTEXITCODE -eq 0 -and $c) { $commit = $c }
      $d = (& git -C $repo describe --tags --abbrev=0 2>$null | Out-String).Trim()
      if ($LASTEXITCODE -eq 0 -and $d -cmatch '^v\d+\.\d+\.\d+$') {
        $tag = $d
        $n = (& git -C $repo rev-list --count "$tag..HEAD" 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $n -match '^\d+$') { $ahead = [int]$n }
      }
    } catch { }
  }
  $info = [ordered]@{
    version     = $tag
    commit      = $commit
    ahead       = $ahead
    repo        = $repo
    installedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
  }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  # BOM 없는 UTF-8 (PowerShell 5.1의 Set-Content -Encoding UTF8은 BOM을 붙인다)
  [IO.File]::WriteAllText((Join-Path $dest 'claude-haejo.json'), ($info | ConvertTo-Json) + "`n", [Text.UTF8Encoding]::new($false))
  if ($tag) { Write-Output "버전 기록: $tag (~/.claude/claude-haejo.json)" }
  else { Write-Output '버전 기록: 태그를 못 읽어 version 없이 적었다 (~/.claude/claude-haejo.json)' }
}
if (-not $Check -and -not $DryRun) { Write-Version }

# 옛 하위 스킬 폴더는 지우지 않고 눈에 띄게 알린다 (-Check에서는 다른 파일로 센다)
if ($oldFound.Count -gt 0) {
  Write-Output ''
  Write-Output '!! 옛 하위 스킬 폴더가 남아 있다 (지금은 roadmap 스킬 하나로 합쳐짐):'
  foreach ($n in $oldFound) { Write-Output "!!   ~/.claude/skills/$n" }
  Write-Output '!! 남아 있으면 Claude가 옛 스킬을 계속 불러 옛 규칙대로 할 수 있다.'
  Write-Output '!! 지우려면: .\install.ps1 -Prune   (Git Bash·macOS·Linux: ./install.sh --prune)'
  Write-Output ''
  if ($Check) { $script:diffs += $oldFound.Count }
}

if ($Check) {
  if ($script:diffs -gt 0) { Write-Output "다른 파일 $($script:diffs)개"; exit 1 }
  Write-Output '모두 같다'
} elseif ($DryRun) {
  Write-Output '복사하지 않았다 (-DryRun)'
} else {
  Write-Output '끝. 새 Claude Code 세션부터 쓴다.'
}
