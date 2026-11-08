<#
claude-haejo 설치·점검 (Windows PowerShell 5.1 이상). install.sh와 같은 동작이다.
  .\install.ps1             skills\*를 ~\.claude\skills\에 복사한다. CLAUDE.md는 없을 때만 복사하고, 다르면 다른 줄만 보인다.
  .\install.ps1 -Check      복사하지 않고 다른 파일만 보인다. 다르면 exit 1.
  .\install.ps1 -DryRun     복사할 파일만 보이고 복사하지 않는다.
  -HomeDir <폴더>           ~ 대신 쓸 폴더 (시험용)
*.local.md(이 PC에만 두는 규칙)는 복사하지도 비교하지도 않는다. ~\.claude에만 있는 파일은 지우지 않는다.
실행이 막히면: powershell -ExecutionPolicy Bypass -File .\install.ps1
#>
param([switch]$Check, [switch]$DryRun, [string]$HomeDir = $HOME)
$ErrorActionPreference = 'Stop'
# 한글 결과가 Git Bash·Claude 쪽에서 깨지지 않게 UTF-8로 낸다
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$repo = $PSScriptRoot
$dest = Join-Path $HomeDir '.claude'
$script:diffs = 0

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

if ($Check) {
  if ($script:diffs -gt 0) { Write-Output "다른 파일 $($script:diffs)개"; exit 1 }
  Write-Output '모두 같다'
} elseif ($DryRun) {
  Write-Output '복사하지 않았다 (-DryRun)'
} else {
  Write-Output '끝. 새 Claude Code 세션부터 쓴다.'
}
