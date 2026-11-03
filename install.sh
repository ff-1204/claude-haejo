#!/usr/bin/env bash
# claude-haejo 설치·점검 (Git Bash, macOS, Linux). 사용법: ./install.sh [--check | --dry-run]
#   (옵션 없음)  skills/*를 ~/.claude/skills/에 복사한다. CLAUDE.md는 없을 때만 복사하고, 다르면 diff만 보인다.
#   --check      복사하지 않고 다른 파일만 보인다. 다르면 exit 1.
#   --dry-run    복사할 파일만 보이고 복사하지 않는다.
# *.local.md(이 PC에만 두는 규칙)는 복사하지도 비교하지도 않는다. ~/.claude에만 있는 파일은 지우지 않는다.
set -euo pipefail

mode=install
case "${1:-}" in
  "") ;;
  --check) mode=check ;;
  --dry-run) mode=dry ;;
  -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
  *) echo "모르는 옵션: $1 (--check, --dry-run)" >&2; exit 2 ;;
esac

repo="$(cd "$(dirname "$0")" && pwd)"
dest="$HOME/.claude"
diffs=0
cd "$repo"

# 줄바꿈(CRLF/LF)만 다르면 같은 파일로 본다 (Windows git의 autocrlf)
same() { [ -f "$2" ] && cmp -s <(tr -d '\r' < "$1") <(tr -d '\r' < "$2"); }

# 저장소 파일 하나를 ~/.claude 같은 자리와 맞춘다
sync_file() {
  local f="$1" t="$dest/$1" why
  if same "$f" "$t"; then return; fi
  if [ -f "$t" ]; then why="다름"; else why="없음"; fi
  case $mode in
    check) echo "$why: $f"; diffs=$((diffs + 1)) ;;
    dry) echo "복사할 것($why): $f" ;;
    install) mkdir -p "$(dirname "$t")"; cp "$f" "$t"; echo "복사($why): $f" ;;
  esac
}

while IFS= read -r f; do sync_file "$f"; done < <(find skills -type f ! -name '*.local.md' | sort)

# 저장소에서 빠진 파일은 알리기만 한다
for d in skills/*/; do
  [ -d "$dest/$d" ] || continue
  while IFS= read -r t; do
    f="${t#"$dest/"}"
    [ -f "$f" ] || echo "참고: 저장소에 없음(지우지 않음): $f"
  done < <(find "$dest/$d" -type f ! -name '*.local.md' | sort)
done

# CLAUDE.md는 기기마다 고친 줄이 있을 수 있어 덮지 않는다
t="$dest/CLAUDE.md"
if [ ! -f "$t" ]; then
  sync_file CLAUDE.md
elif ! same CLAUDE.md "$t"; then
  if [ "$mode" = check ]; then
    echo "다름: CLAUDE.md"; diffs=$((diffs + 1))
  else
    echo "CLAUDE.md가 이미 있고 다르다. 덮지 않는다. 필요한 줄은 손으로 합친다 (- 지금 파일, + 저장소):"
    diff -u -L "~/.claude/CLAUDE.md" -L "저장소 CLAUDE.md" <(tr -d '\r' < "$t") <(tr -d '\r' < CLAUDE.md) || true
  fi
fi

case $mode in
  check)
    if [ "$diffs" -gt 0 ]; then echo "다른 파일 $diffs개"; exit 1; fi
    echo "모두 같다" ;;
  dry) echo "복사하지 않았다 (--dry-run)" ;;
  install) echo "끝. 새 Claude Code 세션부터 쓴다." ;;
esac
