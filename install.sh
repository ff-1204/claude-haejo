#!/usr/bin/env bash
# claude-haejo 설치·점검 (Git Bash, macOS, Linux). 사용법: ./install.sh [--check | --dry-run | --prune]
#   (옵션 없음)  skills/*를 ~/.claude/skills/에 복사한다. CLAUDE.md는 없을 때만 복사하고, 다르면 diff만 보인다. 버전은 ~/.claude/claude-haejo.json에 남긴다.
#   --check      복사하지 않고 다른 파일만 보인다. 다르거나 옛 하위 스킬 폴더가 남아 있으면 exit 1.
#   --dry-run    복사할 파일만 보이고 복사하지 않는다.
#   --prune      옛 하위 스킬 폴더(roadmap·roadmap-teammate 등 9개, 지금은 haejo 하나로 합쳐짐)만 지운다. *.local.md가 든 폴더는 지우지 않는다.
#                --check나 --dry-run과 같이 주면 지우지 않고 지울 폴더만 보인다(--check면 옛 폴더가 있을 때 exit 1).
# *.local.md(이 PC에만 두는 규칙)는 복사하지도 비교하지도 않는다. --prune 말고는 ~/.claude의 파일을 지우지 않는다.
set -euo pipefail

# 인자를 모두 읽는다. 모르는 옵션과 뜻이 안 맞는 조합은 exit 2로 거부한다.
opt_check=0; opt_dry=0; opt_prune=0
for a in "$@"; do
  case "$a" in
    --check) opt_check=1 ;;
    --dry-run) opt_dry=1 ;;
    --prune) opt_prune=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "오류: 모르는 옵션: $a (쓸 수 있는 것: --check, --dry-run, --prune)" >&2; exit 2 ;;
  esac
done
if [ "$opt_check" = 1 ] && [ "$opt_dry" = 1 ]; then
  echo "오류: --check와 --dry-run은 같이 쓸 수 없다" >&2; exit 2
fi
mode=install
if [ "$opt_check" = 1 ]; then mode=check; fi
if [ "$opt_dry" = 1 ]; then mode=dry; fi
if [ "$opt_prune" = 1 ]; then
  if [ "$mode" = install ]; then mode=prune; else mode=prune-preview; fi
fi

repo="$(cd "$(dirname "$0")" && pwd)"
dest="$HOME/.claude"
diffs=0
cd "$repo"

# 옛 하위 스킬 폴더 (고정 목록). 이 폴더들이 설치본에 남아 있으면 옛 스킬이 계속 불릴 수 있다.
old_skills="roadmap roadmap-teammate roadmap-core roadmap-personas roadmap-scenarios roadmap-map roadmap-score roadmap-priority roadmap-milestones"
new_skill="haejo"
old_found=""
for n in $old_skills; do
  if [ -d "$dest/skills/$n" ]; then old_found="$old_found $n"; fi
done

# 옛 폴더의 *.local.md 가운데 새 스킬 폴더 같은 자리에 똑같은 사본이 없는 것만 낸다 (사본이 있으면 지워도 잃는 것이 없다)
unmoved_locals() {
  local d="$1" f
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    cmp -s "$f" "$dest/skills/$new_skill/${f#"$d"/}" || echo "$f"
  done < <(find "$d" -type f -name '*.local.md' | sort)
}

if [ "$mode" = prune ] || [ "$mode" = prune-preview ]; then
  if [ -z "$old_found" ]; then echo "지울 옛 하위 스킬 폴더 없음"; exit 0; fi
  for n in $old_found; do
    d="$dest/skills/$n"
    keep="$(unmoved_locals "$d")"
    if [ -n "$keep" ]; then
      echo "지우지 않음: skills/$n (이 PC에만 두는 *.local.md가 있다. 옮긴 뒤 다시 --prune)"
      echo "$keep" | sed "s|^$dest/|  - |"
    elif [ "$mode" = prune-preview ]; then
      echo "지울 폴더: skills/$n"
    else
      rm -rf "$d"
      echo "지움: skills/$n"
    fi
  done
  if [ "$mode" = prune-preview ]; then
    echo "아무것도 지우지 않았다 (미리 보기. 지우려면 --prune만 준다)"
    # --check와 같이 주면 --check처럼 옛 폴더가 남아 있는 것 자체로 exit 1
    if [ "$opt_check" = 1 ]; then exit 1; fi
  fi
  exit 0
fi

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

# 옛 스킬 폴더에 있던 *.local.md(이 PC에만 두는 규칙)를 새 스킬 폴더 같은 자리로 복사한다. 옛 파일은 그대로 둔다.
if [ "$mode" != check ]; then
  for n in $old_found; do
    d="$dest/skills/$n"
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      r="${f#"$d"/}"; t="$dest/skills/$new_skill/$r"
      if [ -f "$t" ]; then
        cmp -s "$f" "$t" || echo "참고: 둘 다 있고 다름(덮지 않음): skills/$n/$r 와 skills/$new_skill/$r"
      elif [ "$mode" = dry ]; then
        echo "옮길 것(복사): skills/$n/$r → skills/$new_skill/$r"
      else
        mkdir -p "$(dirname "$t")"; cp "$f" "$t"
        echo "옮김(복사): skills/$n/$r → skills/$new_skill/$r"
      fi
    done < <(find "$d" -type f -name '*.local.md' | sort)
  done
fi

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

# 설치한 버전을 ~/.claude/claude-haejo.json에 남긴다 (skills/ 밖이라 --check 비교에 걸리지 않는다).
# 새 버전 안내(skills/haejo/scripts/check-update.js)가 읽는다. git이나 태그가 없으면 version은 null.
json_str() { # 문자열이면 JSON 따옴표로, 비었으면 null
  if [ -z "$1" ]; then printf 'null'; return; fi
  local s="${1//\\/\\\\}"
  printf '"%s"' "${s//\"/\\\"}"
}
write_version() {
  local tag="" commit="" ahead="" where
  if command -v git >/dev/null 2>&1; then
    commit="$(git -C "$repo" rev-parse --short HEAD 2>/dev/null || true)"
    tag="$(git -C "$repo" describe --tags --abbrev=0 2>/dev/null || true)"
    if [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      ahead="$(git -C "$repo" rev-list --count "$tag..HEAD" 2>/dev/null || true)"
    else
      tag=""
    fi
  fi
  where="$(pwd -W 2>/dev/null || pwd)" # Git Bash면 Windows 경로(D:/…)로 적는다
  mkdir -p "$dest"
  {
    printf '{\n'
    printf '  "version": %s,\n' "$(json_str "$tag")"
    printf '  "commit": %s,\n' "$(json_str "$commit")"
    printf '  "ahead": %s,\n' "${ahead:-null}"
    printf '  "repo": %s,\n' "$(json_str "$where")"
    printf '  "installedAt": "%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '}\n'
  } > "$dest/claude-haejo.json"
  if [ -n "$tag" ]; then echo "버전 기록: $tag (~/.claude/claude-haejo.json)"
  else echo "버전 기록: 태그를 못 읽어 version 없이 적었다 (~/.claude/claude-haejo.json)"; fi
}
if [ "$mode" = install ]; then write_version; fi

# 옛 하위 스킬 폴더는 지우지 않고 눈에 띄게 알린다 (--check에서는 다른 파일로 센다)
if [ -n "$old_found" ]; then
  echo ""
  echo "!! 옛 하위 스킬 폴더가 남아 있다 (지금은 haejo 스킬 하나로 합쳐짐):"
  for n in $old_found; do echo "!!   ~/.claude/skills/$n"; done
  echo "!! 남아 있으면 Claude가 옛 스킬을 계속 불러 옛 규칙대로 할 수 있다."
  echo "!! 지우려면: ./install.sh --prune   (Windows PowerShell: .\\install.ps1 -Prune)"
  echo ""
  if [ "$mode" = check ]; then
    for n in $old_found; do diffs=$((diffs + 1)); done
  fi
fi

case $mode in
  check)
    if [ "$diffs" -gt 0 ]; then echo "다른 파일 $diffs개"; exit 1; fi
    echo "모두 같다" ;;
  dry) echo "복사하지 않았다 (--dry-run)" ;;
  install) echo "끝. 새 Claude Code 세션부터 쓴다." ;;
esac
