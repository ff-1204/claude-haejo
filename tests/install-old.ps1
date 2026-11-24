<#
install.ps1 옛 하위 스킬 폴더 시험: 알림, -Check, -Prune, 미리 보기 조합, 숨김 *.local.md, 모르는 옵션·줄인 이름.
사용: .\tests\install-old.ps1 <임시 폴더> [-Way inline|file]
  inline  지금 PowerShell에서 & .\install.ps1 로 부른다
  file    지금 PowerShell과 같은 실행 파일로 -File 로 부른다 (powershell.exe면 5.1)
#>
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$Tmp = [string]$args[0]
$Way = 'inline'
if ($args.Count -ge 3 -and $args[1] -eq '-Way') { $Way = [string]$args[2] }
if (-not $Tmp) { throw '임시 폴더를 준다' }

$ps = Join-Path (Split-Path $PSScriptRoot) 'install.ps1'
$exe = (Get-Process -Id $PID).Path
if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse -Force }
$h = Join-Path $Tmp 'home'
$s = Join-Path $h '.claude\skills'

# install.ps1을 부르고 (종료 코드, 출력)을 돌려준다
function Inst([string[]]$a) {
  $all = @('-HomeDir', $h) + $a
  if ($Way -eq 'file') { $out = & $exe -NoProfile -ExecutionPolicy Bypass -File $ps @all 2>&1 | Out-String }
  else { $out = & $ps @all 2>&1 | Out-String }
  return @($LASTEXITCODE, $out)
}
function Fail([string]$m) { Write-Output "실패: $m"; exit 1 }

New-Item -ItemType Directory -Force (Join-Path $s 'roadmap-score'), (Join-Path $s 'roadmap-core'), (Join-Path $s 'roadmap-map') | Out-Null
Set-Content (Join-Path $s 'roadmap-score\SKILL.md') 'old'
Set-Content (Join-Path $s 'roadmap-core\notes.local.md') 'mine'
# 숨김 속성 *.local.md
$hidden = Join-Path $s 'roadmap-map\hidden.local.md'
Set-Content $hidden 'mine'
(Get-Item $hidden).Attributes = 'Hidden'

# 1) 설치 때 알림
$r = Inst @()
if ($r[0] -ne 0) { Fail "설치 exit $($r[0])" }
if ($r[1] -notmatch '옛 하위 스킬 폴더가 남아 있다' -or $r[1] -notmatch 'skills/roadmap-score') { Fail '설치 때 알림 없음' }
Write-Output '통과: 설치 때 알림'

# 2) -Check는 exit 1
$r = Inst @('-Check')
if ($r[0] -ne 1) { Fail "-Check exit $($r[0]) (1이어야 함)" }
Write-Output '통과: -Check exit 1'

# 3) 미리 보기 조합은 아무것도 지우지 않는다
foreach ($combo in @(@('-DryRun', '-Prune'), @('-Prune', '-DryRun'), @('-Check', '-Prune'), @('-Prune', '-Check'))) {
  $r = Inst $combo
  $name = $combo -join ' '
  if (-not (Test-Path (Join-Path $s 'roadmap-score'))) { Fail "$name 뒤 roadmap-score가 지워짐" }
  if ($r[1] -notmatch '지울 폴더: skills/roadmap-score') { Fail "${name}: 지울 폴더를 안 보임" }
  $want = if ($combo -contains '-Check') { 1 } else { 0 }
  if ($r[0] -ne $want) { Fail "$name exit $($r[0]) ($want이어야 함)" }
  Write-Output "통과: $name → 안 지움, exit $($r[0])"
}

# 4) 모르는 옵션·줄인 이름·안 맞는 조합은 exit 2, 아무것도 안 지움
foreach ($bad in @(@('-Bogus'), @('-P'), @('-Pru'), @('-Prune', '-Bogus'), @('-Check', '-DryRun'), @('--prune'))) {
  $r = Inst $bad
  $name = $bad -join ' '
  if ($r[0] -ne 2) { Fail "$name exit $($r[0]) (2여야 함)" }
  if ($r[1] -notmatch '오류') { Fail "${name}: 오류 문장 없음" }
  if (-not (Test-Path (Join-Path $s 'roadmap-score'))) { Fail "${name} 뒤 roadmap-score가 지워짐" }
  Write-Output "통과: ${name} → exit 2"
}

# 5) -Prune: *.local.md(숨김 포함)가 든 폴더는 남긴다
$r = Inst @('-Prune')
if ($r[0] -ne 0) { Fail "-Prune exit $($r[0])" }
if (Test-Path (Join-Path $s 'roadmap-score')) { Fail 'roadmap-score가 남음' }
if (-not (Test-Path (Join-Path $s 'roadmap-core\notes.local.md'))) { Fail 'local.md가 지워짐' }
if (-not (Test-Path -LiteralPath $hidden)) { Fail '숨김 local.md가 든 폴더가 지워짐' }
Write-Output '통과: -Prune이 local.md(숨김 포함) 폴더는 남김'

# 6) 비우면 지워지고 -Check exit 0
Remove-Item (Join-Path $s 'roadmap-core\notes.local.md')
Remove-Item -LiteralPath $hidden -Force
$r = Inst @('-Prune')
if ((Test-Path (Join-Path $s 'roadmap-core')) -or (Test-Path (Join-Path $s 'roadmap-map'))) { Fail '빈 옛 폴더가 남음' }
$r = Inst @('-Check')
if ($r[0] -ne 0) { Fail "-Prune 뒤 -Check exit $($r[0])" }
Write-Output "install.ps1 옛 폴더 시험 모두 통과 ($Way, PowerShell $($PSVersionTable.PSVersion))"
