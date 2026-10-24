# claude-config

Claude Code 공통 설정과 스킬. 어느 기기에서든 같은 방식으로 일하게 하려고 둔다.

| 파일 | 내용 |
|---|---|
| `CLAUDE.md` | 모든 프로젝트에 적용되는 작업 방식 (`~/.claude/CLAUDE.md`) |
| `skills/roadmap/` + `skills/roadmap-*/` | 페르소나에서 마일스톤까지 기획하는 스킬. 상위 `roadmap`이 말을 듣고 하위 일곱 개(core, personas, scenarios, map, score, priority, milestones)를 순서대로 부른다 |
| `playbooks/persona-roadmap/` | 위 과정을 사람이 읽는 개요와 스킬로 나눈 계획 |
| `skills/roadmap-teammate/` | 작업을 팀원처럼 하위 세션에 맡기고, 끝나면 결과를 확인해 보고하는 스킬. 테스트 > 개선 > 커밋 반복 포함 |

## 설치

```bash
git clone https://github.com/ff-1204/claude-config.git
mkdir -p ~/.claude/skills
cp -r claude-config/skills/* ~/.claude/skills/
```

`CLAUDE.md`는 그 기기에 `~/.claude/CLAUDE.md`가 없으면 그대로 복사하고, 있으면 내용을 합친다.

```bash
cp -n claude-config/CLAUDE.md ~/.claude/CLAUDE.md
```

새 Claude Code 세션부터 쓸 수 있다.

- `/roadmap-teammate` 또는 "하위 세션으로 맡겨줘", "테스트 반복해줘"
- `/roadmap` 또는 "처음부터 기획해줘", "페르소나 하나 더 추가해줘", "로드맵 어디까지 왔어?" (하위 스킬은 `/roadmap-score`처럼 혼자도 부를 수 있다)

## 개인 프로젝트 규칙

저장소 이름, 커밋 작성자, 내부 경로처럼 공개하면 안 되는 프로젝트 규칙은 `~/.claude/skills/roadmap-teammate/references/projects.local.md`에만 둔다. `*.local.md`는 git에 올라가지 않는다. 쓰는 형식은 [projects.md](skills/roadmap-teammate/references/projects.md)의 템플릿을 따른다.

## 업데이트

`~/.claude`에서 고친 것은 이 저장소에 복사해 커밋한다. 다른 기기에서는 `git pull` 뒤 다시 복사한다.
