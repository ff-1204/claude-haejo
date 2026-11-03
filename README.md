# claude-haejo

**"클로드, ~해줘."** 한 마디로 기획부터 개발 반복까지 맡기는 Claude Code 스킬 묶음이다.

- **기획**: "처음부터 기획해줘"라고 하면 핵심 경험 → 페르소나 → 시나리오 → 점수 → 우선순위 → 마일스톤까지 문서 다섯 개로 만들어 준다.
- **개발**: "M2 진행해줘"라고 하면 항목마다 하위 세션을 만들어 팀원처럼 맡기고, 결과는 [PR](#git-말-풀이) 하나로 받아 확인한 뒤 [머지](#git-말-풀이)할지 묻는다.
- **정할 것만 묻는다**: 과정은 Claude가 정하고, 취향·공개·돈·[커밋·머지](#git-말-풀이)처럼 사용자가 정할 것만 선택 버튼으로 한 번에 묻는다.

Claude Code를 쓰면서 "무엇부터 만들지"와 "여러 작업을 어떻게 나눠 맡길지"를 덜 고민하고 싶은 사람에게 맞다. 게임·앱·도구 어느 프로젝트에나 쓴다.

## 빨리 시작하기

```bash
git clone https://github.com/ff-1204/claude-haejo.git
cd claude-haejo
./install.sh            # Windows PowerShell: powershell -ExecutionPolicy Bypass -File .\install.ps1
```

새 Claude Code 세션을 열고 프로젝트 폴더에서 이렇게 말한다.

```
처음부터 기획해줘
```

자세한 설치 옵션은 아래 [설치](#설치)에 있다.

## 이렇게 말하면 이렇게 된다

| 이렇게 말하면 | 이렇게 된다 |
|---|---|
| "처음부터 기획해줘" | 핵심 경험 확인 → 페르소나 5명 → 사람마다 "하루 한 장면" 시나리오 → 체크리스트에 잇기 → 비중 점수 → 우선순위 → 마일스톤. 핵심 경험은 꼭 확인받는다 |
| "페르소나 하나 더 추가해줘: 주말에만 하는 직장인" | 그 사람과 시나리오를 더하고, 점수·우선순위·로드맵에서 바뀐 곳만 고친다 |
| "M2 진행해줘" | M2의 남은 항목마다 하위 세션 하나 = 브랜치 하나 = PR 하나. 부모 세션이 확인 4개를 본 뒤 머지할지 묻는다 |
| "M2 끝났어" | 로드맵에 ✅ 표시 → 시나리오의 🔜를 ✅로 → 점수·우선순위 다시 계산 |
| "테스트 반복해줘" | 테스트 → 개선 → 커밋을 회차로 돈다. 테스트 세션은 코드를 고치지 않고 보고서만 쓴다 |
| "자러 갈게" | 떠나기 전에 커밋·PR·머지 권한만 한 번 묻고, 그 뒤로는 묻지 않고 진행한다. 돌아오면 "확인해 주세요"와 "돌아오시면 정할 것"을 모아 보여 준다 |
| "로드맵 어디까지 왔어?" | 마일스톤마다 ✅ 수와 다음 항목만 보고한다. 아무것도 고치지 않는다 |

`/roadmap`, `/roadmap-teammate`처럼 슬래시로 불러도 된다. 하위 스킬은 `/roadmap-score`처럼 혼자도 부를 수 있다.

## 그림으로 보기

### 그림 1 — 구조

```mermaid
flowchart TD
  user["사용자 말"] --> roadmap["roadmap<br/>말 듣고 플로우 고르기"]
  subgraph sub["하위 스킬 (순서대로)"]
    core["core<br/>핵심 경험"] --> personas["personas<br/>페르소나 5명"]
    personas --> scenarios["scenarios<br/>하루 한 장면"]
    scenarios --> map["map<br/>체크리스트 잇기"]
    map --> score["score<br/>점수 score.js"]
    score --> priority["priority<br/>개발 순서"]
    priority --> milestones["milestones<br/>마일스톤"]
    milestones --> teammate["teammate<br/>하위 세션 맡기기"]
  end
  roadmap --> core
  alone["하위 세션으로 맡겨줘"] -.->|"혼자 부름"| teammate
  sub --> docs["문서 5개<br/>personas.md · persona-scenarios.md · 체크리스트<br/>persona-checklist-map.md · roadmap.md"]
```

이 그림에서 볼 점:

1. 위의 `roadmap`(상위 스킬)은 직접 문서를 쓰지 않는다. 사용자 말을 듣고 어느 플로우로 갈지 고른다.
2. 아래 하위 스킬이 순서대로 일한다. 앞 단계 문서가 뒤 단계의 재료다.
3. 결과는 모두 [문서 5개](#만드는-문서-5개)에 쌓인다. 다음에 다시 불러도 거기서 이어 한다.
4. `teammate`는 기획이 없어도 "하위 세션으로 맡겨줘", "테스트 반복해줘"처럼 혼자 불린다(점선).

### 그림 2 — 기획 흐름

```mermaid
flowchart TD
  say["사용자 말"] --> pick{"roadmap<br/>플로우 고르기"}
  pick -->|"처음부터 / 핵심 경험 바꾸기"| core["core<br/>핵심 경험 · 사용자 확인"]
  pick -->|"페르소나 더하기"| personas["personas"]
  pick -->|"점수 다시"| score["score"]
  pick -->|"M2 진행해줘"| teammate["teammate<br/>항목 하나 = PR 하나"]
  pick -->|"어디까지 왔어?"| status["상태 보고만<br/>아무것도 안 고침"]
  core --> personas --> scenarios["scenarios"] --> map["map"] --> score
  score --> priority["priority"] --> milestones["milestones"]
  milestones -->|"개발"| teammate
  teammate -->|"마일스톤 끝 / M2 끝났어"| finish["milestones 끝 표시<br/>scenarios 갱신"]
  finish -->|"점수 다시"| score
```

이 그림에서 볼 점:

1. 말에 따라 들어가는 곳이 다르다. "페르소나 하나 더"는 처음부터 다시 하지 않고 personas부터, "점수 다시"는 score부터 돈다.
2. 핵심 경험(core)은 "알아서 끝까지"라고 해도 사용자에게 꼭 확인받는다. 여기가 틀리면 뒤가 모두 헛돈다.
3. 개발이 끝나면 끝이 아니다. 시나리오의 🔜를 ✅로 바꾸고 점수와 우선순위를 다시 본다.
4. 문서마다 갱신 시각이 있어서 어느 단계가 낡았는지 알고 거기서부터 이어 한다.

### 그림 3 — 하위 세션과 PR

```mermaid
sequenceDiagram
  participant U as 사용자
  participant P as 부모 세션
  participant C as 하위 세션
  participant G as GitHub PR
  U->>P: 작업 맡김 (예: M2 진행해줘)
  P->>U: 선택 UI (모델 · 권한)
  U->>P: 답
  P->>C: 브리프 + 세션 시작
  Note over C: 자기 worktree · 브랜치
  C->>C: 구현 · 테스트
  C->>G: push, PR 생성 (요약 4칸)
  C-->>P: 끝났다는 알림
  P->>G: 확인 항목 4개
  Note over P,G: 요약 · 테스트 · 범위 · 충돌
  opt 하나라도 걸리면
    P->>C: SendMessage로 고치게
    C->>G: 같은 PR에 커밋 더함
  end
  P->>U: 머지할까요? (권한대로, 보고 꼴)
  U->>P: 예
  P->>G: 머지
  P->>C: 세션 보관
```

이 그림에서 볼 점:

1. 사용자가 정하는 곳은 두 곳이다. 시작할 때 권한을 고르고, 머지 직전에 "예"를 한다. 시작할 때 머지까지 맡기면 한 곳이다.
2. 하위 세션은 자기 [worktree](#git-말-풀이)와 브랜치에서 일해서 여러 작업이 서로 부딪히지 않는다. 고칠 것이 생겨도 새 PR을 만들지 않고 같은 PR에 커밋을 더한다.
3. 부모 세션은 코드를 다시 읽지 않고 PR에서 네 가지만 본다.

| 확인 항목 | 보는 것 |
|---|---|
| 요약 | PR 본문이 네 칸(무엇을 바꿨나 · 어떻게 확인했나 · 범위 밖 · 남은 것)을 다 채웠나 |
| 테스트 | CI나 테스트가 통과하나. CI가 없으면 본문의 확인 명령을 직접 돌려 본다 |
| 범위 | 바뀐 파일이 맡긴 범위 안인가 |
| 충돌 | 기본 브랜치(main)와 충돌이 없나 |

머지를 물을 때는 이 꼴로 보고한다. 머지 전에 결과를 다 알 수 있게 쓴다.

```
무엇: <PR 링크> — <체크리스트 번호> <한 줄>
확인: 요약 통과 · 테스트 통과 · 범위 통과 · 충돌 없음
확인 못 한 것·남은 것: <사람이 직접 해 볼 것 포함>
머지하면: 배포 여부 · 태그 · 따로 할 설치
1) 머지하고 정리 (추천) 2) 머지만 3) 아직 안 함
```

## git 말 풀이

커밋·push·PR·머지·태그가 처음이라면 이 표만 보면 된다. git은 파일의 바뀐 기록을 남기는 도구이고, GitHub는 그 기록을 올려 두는 사이트다.

| 말 | 쉽게 말하면 | 이 스킬에서는 |
|---|---|---|
| 저장소 (repository) | 프로젝트 폴더와 그 모든 바뀐 기록 | 스킬이 일하는 프로젝트 하나 |
| 브랜치 (branch) | 본 줄기(main)에서 갈라져 따로 고치는 가지 | 하위 세션 하나가 브랜치 하나를 쓴다 |
| 커밋 (commit) | 저장 시점 하나에 설명을 붙여 남기기 | 하위 세션이 고친 것을 자기 브랜치에 남길 때 |
| push | 내 컴퓨터의 기록을 GitHub에 올리기. 공개 저장소면 누구나 본다 | PR을 만들기 전에 |
| PR (pull request) | "이 변경을 본 줄기에 넣어도 될까요?" 요청서. 여기서 고치고 확인한다 | 항목 하나 = PR 하나. 부모 세션이 확인 4개를 본다 |
| 머지 (merge) | PR을 본 줄기 main에 합치기. 되돌릴 수는 있지만 흔적이 남는다 | 확인 뒤 사용자의 "예"를 받고 부모 세션이 한다 |
| 태그 (tag) | 특정 시점에 붙이는 이름표. 예: `v1.0` | 마일스톤이 끝나 머지된 뒤에 |
| worktree | 같은 저장소의 작업 폴더를 하나 더 두기 | 여러 하위 세션이 동시에 일해도 서로 부딪히지 않게 |

**왜 커밋·push·PR·머지·태그는 꼭 묻나.** 기록으로 남고, 남에게 보이고, 배포로 이어진다. 되돌리기 어렵거나 이미 누군가 봤을 수 있다. 그래서 "결재 빼고 알아서"라고 해도 이 다섯 가지는 스킬을 쓸 때마다 선택 버튼으로 묻는다. 고르는 것은 셋이다.

1. **PR까지 맡기고 머지는 묻기** (추천): 하위 세션이 커밋·push·PR까지 하고, 머지 직전에 한 번 묻는다.
2. **머지까지 맡기기**: 이번 실행만. 확인 4개가 통과하면 묻지 않고 머지하고 보고한다. 머지가 곧 배포인 프로젝트는 그래도 묻는다.
3. **그때마다 묻기**: 커밋·push·PR·머지마다 묻는다.

GitHub에 올리지 않는 프로젝트면 PR 없이 커밋만 묻는다.

## 누가 정하나

| 사용자가 정한다 | Claude가 정하고 보고한다 |
|---|---|
| 핵심 경험, 마일스톤 경계 | 진행 방식, 페르소나 수(기본 5명) |
| 화면 문구·보상·처음 흐름처럼 사람이 보는 것 | 매핑·점수·개발 순서 |
| [커밋·push·PR·머지·태그](#git-말-풀이) (스킬을 쓸 때마다 묻는다) | 비공개 저장소의 문서 위치 |
| 공개 저장소에 기획 문서를 둘지 | 어려운 것·사람 확인이 필요한 것을 뒤로 미루기 |
| 결제·계정·공개 전환 (사용자만 한다) | 내부 구조·코드·데이터 형식 |

물을 때는 선택 버튼으로 한 번에 묻고, 추천을 첫 번째에 둔다.

## 만드는 문서 5개

| 문서 | 내용 |
|---|---|
| `personas.md` | 맨 위에 핵심 경험·범위, 아래에 페르소나(한 명당 다섯 줄) |
| `persona-scenarios.md` | 사람마다 하루 한 장면 5~8단계, 단계마다 ✅ 됨 / 🔜 계획됨 / ❌ 계획에 없음 |
| 체크리스트 | 프로젝트에 있던 것을 쓰고, 없으면 `checklist.md`를 만든다. 번호는 바꾸지 않는다 |
| `persona-checklist-map.md` | 시나리오 단계 ↔ 체크리스트 번호, 비중 점수 표, 개발 순서 |
| `roadmap.md` | 날짜 없는 마일스톤과 세부 항목(한 줄 = 하위 세션 하나 = PR 하나) |

비중 점수는 `필요한 사람 수 × 2 + 나온 시나리오 단계 수`이고, `score.js`가 센다.

## 설치

필요한 것:

- [Claude Code](https://claude.com/claude-code)
- Node.js — 비중 점수 스크립트(`score.js`)를 돌릴 때
- [GitHub CLI](https://cli.github.com/)(`gh`) — 하위 세션이 PR을 만들 때. 없으면 브랜치 push까지만 한다

Git Bash, macOS, Linux:

```bash
./install.sh             # 설치
./install.sh --dry-run   # 복사할 파일만 보기
./install.sh --check     # 복사하지 않고 다른 파일만 보기 (다르면 exit 1)
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1            # 설치
powershell -ExecutionPolicy Bypass -File .\install.ps1 -DryRun    # 복사할 파일만 보기
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Check     # 다른 파일만 보기
```

- `skills/*`를 `~/.claude/skills/`에 복사한다.
- `CLAUDE.md`는 `~/.claude/CLAUDE.md`가 없을 때만 복사한다. 이미 있고 다르면 덮지 않고 다른 줄만 보여 준다. 필요한 줄은 손으로 합친다.
- `*.local.md`(아래 개인 규칙)는 복사하지도 비교하지도 않는다. `~/.claude`에만 있는 파일은 지우지 않는다.
- 새 Claude Code 세션부터 적용된다.

## 업데이트

```bash
git pull
./install.sh --check   # 무엇이 달라졌는지 먼저 보기
./install.sh
```

- `~/.claude`에서 직접 고친 것은 이 저장소에 복사해 커밋한다. `--check`로 빠뜨린 파일이 없는지 본다.
- 저장소에서 지운 파일은 `~/.claude`에서 지우지 않고 "저장소에 없음"으로 알리기만 한다.

## 개인 규칙

저장소 이름, 커밋 작성자, 내부 경로처럼 공개하면 안 되는 프로젝트 규칙은 `~/.claude/skills/roadmap-teammate/references/projects.local.md`에만 둔다. `*.local.md`는 git에 올라가지 않는다. 쓰는 형식은 [projects.md](skills/roadmap-teammate/references/projects.md)의 템플릿을 따른다.

## 폴더 구조

| 경로 | 내용 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | 모든 프로젝트에 적용되는 작업 방식 (`~/.claude/CLAUDE.md`로 설치) |
| [`skills/roadmap/`](skills/roadmap/SKILL.md) | 기획 상위 스킬. 말에 맞는 플로우를 골라 하위 스킬을 부른다. 공통 규칙은 [`references/rules.md`](skills/roadmap/references/rules.md) |
| `skills/roadmap-*/` | 하위 스킬 7개: [core](skills/roadmap-core/SKILL.md), [personas](skills/roadmap-personas/SKILL.md), [scenarios](skills/roadmap-scenarios/SKILL.md), [map](skills/roadmap-map/SKILL.md), [score](skills/roadmap-score/SKILL.md), [priority](skills/roadmap-priority/SKILL.md), [milestones](skills/roadmap-milestones/SKILL.md) |
| [`skills/roadmap-teammate/`](skills/roadmap-teammate/SKILL.md) | 하위 세션에 맡기기, PR과 머지, 테스트 반복, 자리 비움·마무리 |
| [`playbooks/persona-roadmap/`](playbooks/persona-roadmap/README.md) | 위 과정을 사람이 읽는 개요 |
| `install.sh`, `install.ps1` | 설치·점검 스크립트 |

## 더 읽기

- 과정 전체를 사람이 읽기 좋게: [playbooks/persona-roadmap/README.md](playbooks/persona-roadmap/README.md)
- 스킬로 나눈 이유: [playbooks/persona-roadmap/skills-plan.md](playbooks/persona-roadmap/skills-plan.md)
- 기획 플로우와 묻는 지점: [skills/roadmap/SKILL.md](skills/roadmap/SKILL.md)
- 하위 세션·PR·머지 규칙: [skills/roadmap-teammate/SKILL.md](skills/roadmap-teammate/SKILL.md)
- 테스트 반복: [qa-loop.md](skills/roadmap-teammate/references/qa-loop.md) · 자리 비움과 마무리: [wrap-up.md](skills/roadmap-teammate/references/wrap-up.md)
