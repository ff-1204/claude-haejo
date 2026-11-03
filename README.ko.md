[English](README.md) | **한국어** | [日本語](README.ja.md)

# claude-haejo

**"클로드, ~해줘."** 한 마디로 기획부터 개발까지 맡기는 Claude Code 스킬 묶음입니다.

- **기획**: "처음부터 기획해줘" → 페르소나(가상의 사용자)부터 마일스톤(개발 단계)까지 문서로 만들어 줍니다.
- **개발 맡기기**: "M2 진행해줘" → 일을 하위 세션(따로 도는 Claude 대화)에 팀원처럼 나눠 맡기고, 결과를 확인해 보고합니다.
- **정할 것만 묻기**: 과정은 Claude가 정하고, 취향·돈·되돌리기 어려운 일만 선택 버튼으로 묻습니다.

![이 스킬이 하는 세 가지: 기획, 개발 맡기기, 정할 것만 묻기](docs/slides/04.png)

## 시작하기

1. Claude Code 창에 이렇게 붙여 넣으세요.
   ```text
   https://github.com/ff-1204/claude-haejo 를 받아서 설치해줘
   ```
2. 새 Claude Code 세션을 엽니다. 스킬은 새 세션부터 적용됩니다.
3. 프로젝트 폴더에서 이렇게 말하세요: **"처음부터 기획해줘"**

## 왜 쓰나

- **무엇부터 만들지 사람 기준으로 정합니다.** 페르소나의 하루 장면에서 필요한 기능을 뽑아, 많이 필요한 것부터 순서를 세웁니다.
- **점수가 흔들리지 않습니다.** 비중 점수는 Claude가 눈으로 세지 않고 스크립트(`score.js`)로 셉니다.
- **어디서 끊겨도 이어 합니다.** 문서마다 갱신 시각이 있어, 다음 세션이 어느 문서가 낡았는지 보고 거기서부터 합니다.
- **여러 일을 동시에, 서로 부딪히지 않게.** 일마다 하위 세션 하나, 브랜치 하나, PR 하나로 나눕니다.
- **보고만 믿지 않습니다.** 부모 세션이 PR에서 요약·테스트·범위·충돌 네 가지를 직접 확인한 뒤 머지를 묻습니다.
- **휴대폰으로 봐도 편합니다.** 보고는 짧게, 선택지는 번호를 붙여 보여 줍니다.

## 이렇게 말하세요

| 이렇게 말하면 | 이렇게 됩니다 |
|---|---|
| "처음부터 기획해줘" | 핵심 경험을 확인받고, 페르소나 5명 → 시나리오 → 점수 → 우선순위 → 마일스톤까지 씁니다 |
| "페르소나 하나 더 추가해줘: 주말에만 하는 직장인" | 그 사람과 시나리오를 더하고, 뒤 문서에서 바뀐 곳만 고칩니다 |
| "M2 진행해줘" | 남은 항목마다 하위 세션 하나 = PR(합쳐도 되는지 묻는 요청서) 하나로 맡기고, 확인 뒤 머지(합치기)할지 묻습니다 |
| "자러 갈게" | 떠나기 전에 권한만 묻고 계속 진행합니다. 돌아오면 정할 것을 모아 보여 줍니다 |
| "로드맵 어디까지 왔어?" | 마일스톤마다 끝난 수와 다음 항목만 알려 줍니다. 아무것도 고치지 않습니다 |

`/roadmap`, `/roadmap-teammate`처럼 슬래시로 불러도 됩니다. 기획 단계마다 하위 스킬이 따로 있어(`roadmap-core`, `-personas`, `-scenarios`, `-map`, `-score`, `-priority`, `-milestones`) 혼자 부를 수도 있습니다.

## 어떻게 움직이나

### 기획 흐름

```mermaid
flowchart TD
  say["사용자 말"] -->|"처음부터"| core["core<br/>핵심 경험"]
  say -->|"페르소나 더하기"| personas
  say -->|"M2 진행해줘"| teammate
  core --> personas["personas<br/>페르소나"] --> scenarios["scenarios<br/>하루 한 장면"]
  scenarios --> map["map<br/>체크리스트 잇기"] --> score["score<br/>점수"]
  score --> priority["priority<br/>개발 순서"] --> milestones["milestones<br/>마일스톤"]
  milestones --> teammate["teammate<br/>하위 세션에 맡기기"]
  teammate -->|"마일스톤 끝"| update["끝 표시 ·<br/>시나리오 갱신"]
  update --> score
```

- 말에 따라 들어가는 곳이 다릅니다. "페르소나 하나 더"는 처음부터 다시 하지 않고 personas부터 돕니다.
- 핵심 경험(사용자가 이 제품으로 하는 일 3~6개)은 "알아서 끝까지"라고 해도 꼭 확인받습니다. 여기가 틀리면 뒤가 모두 헛돕니다.
- 개발이 끝나면 시나리오를 갱신하고 점수를 다시 봅니다. 그래서 다음에 할 일이 늘 최신입니다.

### 하위 세션과 PR

![회사로 비유하면: 부모 세션은 팀장, 하위 세션은 팀원, PR은 결재 서류, 머지는 결재 승인](docs/slides/07.png)

```mermaid
sequenceDiagram
  participant U as 사용자
  participant P as 부모 세션
  participant C as 하위 세션
  participant G as GitHub PR
  U->>P: M2 진행해줘
  P->>U: 권한 묻기 (선택 버튼)
  P->>C: 할 일 안내 + 세션 시작
  C->>C: 자기 브랜치에서 구현 · 테스트
  C->>G: push, PR 만들기
  P->>G: 확인 4개
  Note over P,G: 요약 · 테스트 · 범위 · 충돌
  P->>C: 걸리면 같은 PR에서 고치게
  P->>U: 머지할까요?
  U->>P: 예
  P->>G: 머지
```

- 하위 세션은 자기 브랜치(본 줄기에서 갈라진 가지)에서 일해서, 여러 일이 동시에 돌아도 서로 부딪히지 않습니다.
- 부모 세션은 코드를 다시 읽지 않고 PR에서 네 가지만 봅니다: 요약이 다 찼나, 테스트가 통과하나, 맡긴 범위 안인가, 충돌이 없나.
- 머지는 squash로 합니다. PR 하나가 결과만 적은 커밋 하나로 남습니다.
- 사용자가 정하는 곳은 시작할 때 권한, 머지 직전 "예" 두 곳뿐입니다.

![팀원 보고만 믿지 않습니다: 요약, 테스트, 범위, 충돌 네 가지 확인](docs/slides/09.png)

## 사용자에게 꼭 묻는 것

나머지는 Claude가 정하고 보고하지만, 이것들은 묻습니다.

- **핵심 경험·화면 문구 같은 취향**: 사람이 보고 느끼는 것이라 Claude가 대신 정하지 않습니다.
- **결제·계정**: 돈과 계정은 사용자만 다룹니다.
- **커밋**(바뀐 내용을 기록으로 남기기)·**push**(그 기록을 GitHub에 올리기)
- **PR**(변경을 합쳐도 되는지 묻는 요청서)·**머지**(PR을 본 줄기 main에 합치기)
- **태그**(특정 시점에 붙이는 이름표, 예: `v1.0`)

커밋부터 태그까지는 기록으로 남고, 남에게 보이고, 배포로 이어질 수 있습니다. 그래서 "알아서 해줘"라고 해도 스킬을 쓸 때마다 묻습니다. 고르는 것은 셋입니다: **PR까지 맡기고 머지는 묻기**(추천) / 이번만 머지까지 맡기기 / 그때마다 묻기.

같은 화면에서 커밋 끝의 `Co-Authored-By: Claude …` 줄(꼬리표)도 고릅니다: **남기기**(추천) / 빼고 본문에 "Claude로 진행함" 한 줄 / 둘 다 빼기.

## 설치·업데이트

필요한 것: [Claude Code](https://claude.com/claude-code), [Git](https://git-scm.com/), Node.js(점수 계산), [GitHub CLI](https://cli.github.com/) `gh`(PR 만들기, 없으면 push까지만).

Claude Code 창에 말로 하면 됩니다. 어느 것이든 **새 세션부터** 적용됩니다.

| 이렇게 말하면 | Claude가 하는 일 |
|---|---|
| `https://github.com/ff-1204/claude-haejo 를 받아서 설치해줘` | 저장소를 clone하고 `install.sh`(Windows는 `install.ps1`)를 돌려 스킬을 `~/.claude/skills/`에 복사합니다 |
| `claude-haejo 업데이트해줘` | `git pull`로 받은 뒤 `--check`로 바뀔 파일을 먼저 보여 주고 다시 설치합니다 |
| `claude-haejo 설치 상태 확인해줘` | `--check`로 저장소와 설치본이 다른 파일만 알려 줍니다. 아무것도 복사하지 않습니다 |

- `~/.claude/CLAUDE.md`가 이미 있으면 덮지 않고 다른 줄만 보여 줍니다. 넣을지는 직접 고르세요.
- 이 PC에만 두는 규칙(`*.local.md`)은 복사하지도 지우지도 않습니다.

<details>
<summary>명령어로 직접 하려면</summary>

```bash
git clone https://github.com/ff-1204/claude-haejo.git
cd claude-haejo
./install.sh             # Windows PowerShell: powershell -ExecutionPolicy Bypass -File .\install.ps1
./install.sh --check     # 복사하지 않고 다른 파일만 보기 (PowerShell: -Check)
./install.sh --dry-run   # 복사할 파일만 보기 (PowerShell: -DryRun)
git pull && ./install.sh # 업데이트
```

</details>

## 더 알아보기

- 처음 보는 사람용 발표자료(13장): [docs/presentation.md](docs/presentation.md)
- 기획 플로우와 묻는 지점: [skills/roadmap/SKILL.md](skills/roadmap/SKILL.md)
- 만드는 문서 5개와 공통 규칙: [skills/roadmap/references/rules.md](skills/roadmap/references/rules.md)
- 하위 세션·PR·머지, 테스트 반복, 자리 비움: [skills/roadmap-teammate/SKILL.md](skills/roadmap-teammate/SKILL.md)
- 공개하면 안 되는 개인 규칙(`*.local.md`) 쓰는 법: [projects.md](skills/roadmap-teammate/references/projects.md)
- 과정 전체를 사람이 읽기 좋게: [playbooks/persona-roadmap/README.md](playbooks/persona-roadmap/README.md)
