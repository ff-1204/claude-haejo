# claude-haejo

"클로드, ~해줘." 한 마디로 기획부터 개발 반복까지 맡기는 Claude Code 공통 설정과 스킬. 어느 기기에서든 같은 방식으로 일하게 하려고 둔다.

| 파일 | 내용 |
|---|---|
| `CLAUDE.md` | 모든 프로젝트에 적용되는 작업 방식 (`~/.claude/CLAUDE.md`) |
| `skills/roadmap/` + `skills/roadmap-*/` | 페르소나에서 마일스톤까지 기획하는 스킬. 상위 `roadmap`이 말을 듣고 하위 일곱 개(core, personas, scenarios, map, score, priority, milestones)를 순서대로 부른다 |
| `playbooks/persona-roadmap/` | 위 과정을 사람이 읽는 개요와 스킬로 나눈 계획 |
| `skills/roadmap-teammate/` | 작업을 팀원처럼 하위 세션에 맡기고, 끝나면 결과를 확인해 보고하는 스킬. 테스트 > 개선 > 커밋 반복 포함 |

## 설치

```bash
git clone https://github.com/ff-1204/claude-haejo.git
cd claude-haejo
./install.sh
```

Windows PowerShell이면 `./install.sh` 대신:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

- `skills/*`를 `~/.claude/skills/`에 복사한다. `*.local.md`(아래 개인 규칙)는 건드리지 않는다.
- `CLAUDE.md`는 `~/.claude/CLAUDE.md`가 없을 때만 복사한다. 있고 다르면 덮지 않고 다른 줄만 보인다. 필요한 줄은 손으로 합친다.
- `--dry-run`(PowerShell은 `-DryRun`)은 복사할 파일만 보인다.

새 Claude Code 세션부터 쓸 수 있다.

- `/roadmap-teammate` 또는 "하위 세션으로 맡겨줘", "테스트 반복해줘"
- `/roadmap` 또는 "처음부터 기획해줘", "페르소나 하나 더 추가해줘", "로드맵 어디까지 왔어?" (하위 스킬은 `/roadmap-score`처럼 혼자도 부를 수 있다)

## 개인 프로젝트 규칙

저장소 이름, 커밋 작성자, 내부 경로처럼 공개하면 안 되는 프로젝트 규칙은 `~/.claude/skills/roadmap-teammate/references/projects.local.md`에만 둔다. `*.local.md`는 git에 올라가지 않는다. 쓰는 형식은 [projects.md](skills/roadmap-teammate/references/projects.md)의 템플릿을 따른다.

## 업데이트

- 다른 기기에서는 `git pull` 뒤 `./install.sh`(또는 `install.ps1`)를 다시 돌린다.
- `./install.sh --check`(PowerShell은 `-Check`)는 복사하지 않고 저장소와 `~/.claude`가 다른 파일만 보인다. 모두 같으면 exit 0, 다르면 exit 1.
- `~/.claude`에서 고친 것은 이 저장소에 복사해 커밋한다. `--check`로 빠뜨린 파일이 없는지 본다.
- 저장소에서 지운 파일은 `~/.claude`에서 지우지 않고 "저장소에 없음"으로 알리기만 한다.
