#!/usr/bin/env bash
# install.sh 옛 하위 스킬 폴더 시험: 알림, --check, --prune, 미리 보기 조합, 모르는 옵션.
# 사용: bash tests/install-old.sh <임시 폴더>   (그 폴더를 HOME으로 쓴다. 안의 내용은 지운다)
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
tmp="${1:?임시 폴더를 준다}"
rm -rf "$tmp"; mkdir -p "$tmp"
export HOME="$tmp/home"
s="$HOME/.claude/skills"
inst() { bash "$repo/install.sh" "$@"; }
fail() { echo "실패: $*"; exit 1; }
# 명령의 종료 코드를 set -e에 걸리지 않게 읽는다
code() { local c=0; "$@" > "$tmp/last.txt" 2>&1 || c=$?; echo "$c"; }

mkdir -p "$s/roadmap-score" "$s/roadmap-core" "$s/roadmap-teammate/references"
echo old > "$s/roadmap-score/SKILL.md"
echo mine > "$s/roadmap-core/notes.local.md"
echo rules > "$s/roadmap-teammate/references/projects.local.md"

# 1) 설치 때 알림
inst > "$tmp/out.txt"
grep -q "옛 하위 스킬 폴더가 남아 있다" "$tmp/out.txt" || fail "설치 때 알림 없음"
grep -q "skills/roadmap-score" "$tmp/out.txt" || fail "알림에 폴더 이름 없음"
echo "통과: 설치 때 알림"

# 2) --check는 exit 1
[ "$(code inst --check)" = 1 ] || fail "옛 폴더가 있는데 --check가 1이 아님"
echo "통과: --check exit 1"

# 3) 미리 보기 조합은 아무것도 지우지 않는다
for combo in "--dry-run --prune" "--prune --dry-run" "--check --prune" "--prune --check"; do
  c="$(code inst $combo)"
  [ -d "$s/roadmap-score" ] || fail "$combo 뒤 roadmap-score가 지워짐"
  grep -q "지울 폴더: skills/roadmap-score" "$tmp/last.txt" || fail "$combo가 지울 폴더를 안 보임"
  case "$combo" in
    *--check*) [ "$c" = 1 ] || fail "$combo exit $c (1이어야 함)" ;;
    *) [ "$c" = 0 ] || fail "$combo exit $c (0이어야 함)" ;;
  esac
  echo "통과: $combo → 안 지움, exit $c"
done

# 4) 모르는 옵션·안 맞는 조합은 exit 2, 아무것도 안 지움
for bad in "--bogus" "--prune --bogus" "--check --dry-run" "--prun"; do
  c="$(code inst $bad)"
  [ "$c" = 2 ] || fail "$bad exit $c (2여야 함)"
  grep -q "오류" "$tmp/last.txt" || fail "$bad에 오류 문장 없음"
  [ -d "$s/roadmap-score" ] || fail "$bad 뒤 roadmap-score가 지워짐"
  echo "통과: $bad → exit 2"
done

# 4-1) 설치가 옛 폴더의 local.md를 haejo 같은 자리로 복사했다 (옛 파일은 그대로)
[ -f "$s/haejo/references/projects.local.md" ] || fail "projects.local.md가 haejo로 복사되지 않음"
[ -f "$s/haejo/notes.local.md" ] || fail "notes.local.md가 haejo로 복사되지 않음"
[ -f "$s/roadmap-teammate/references/projects.local.md" ] || fail "옛 projects.local.md가 없어짐"
grep -q "옮김(복사): skills/roadmap-teammate/references/projects.local.md" "$tmp/out.txt" || fail "옮김 알림 없음"
echo "통과: 설치가 local.md를 haejo로 복사"
# 사본이 없는 local.md가 든 폴더는 남기는지 보려고 notes 사본만 지운다
rm "$s/haejo/notes.local.md"

# 5) --prune: 사본이 없는 local.md가 든 폴더는 남기고, 똑같은 사본이 있는 폴더는 지운다
inst --prune > /dev/null
[ ! -d "$s/roadmap-score" ] || fail "--prune 뒤 roadmap-score가 남음"
[ -f "$s/roadmap-core/notes.local.md" ] || fail "local.md가 지워짐"
[ ! -d "$s/roadmap-teammate" ] || fail "사본이 있는데 roadmap-teammate가 남음"
[ "$(cat "$s/haejo/references/projects.local.md")" = rules ] || fail "haejo의 projects.local.md가 달라짐"
[ "$(code inst --check)" = 1 ] || fail "local.md 폴더가 남았는데 --check가 1이 아님"
echo "통과: --prune이 local.md 폴더는 남김"

# 6) 비우면 지워지고 --check exit 0
rm "$s/roadmap-core/notes.local.md"
inst --prune > /dev/null
[ ! -d "$s/roadmap-core" ] || fail "roadmap-core가 남음"
inst --check > /dev/null || fail "--prune 뒤 --check가 0이 아님"
echo "통과: --prune 뒤 --check exit 0"
echo "install.sh 옛 폴더 시험 모두 통과"
