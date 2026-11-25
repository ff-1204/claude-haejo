#!/usr/bin/env node
// 기획 문서 다섯 개의 갱신 시각을 비교하고 내용도 확인해 낡은 단계를 찾고, 마일스톤·시나리오 진행 수를 센다.
// 기획 플로우(references/plan.md "지금 상태 보기")를 눈으로 비교하지 않게 하는 스크립트. 문서는 고치지 않는다(읽기만).
// 사용법: node status.js [기획 폴더] [--checklist <파일>] [--prefix <절>] [--no-git] [--no-content]
//   기획 폴더: personas.md가 있는 폴더(기본: 현재 폴더)
//   --checklist: 체크리스트 파일(기본: personas.md "> 문서:" 줄 → 폴더의 *checklist*.md·체크리스트*.md)
//   --prefix: 한 주제 기획의 절 번호(예: P28). 순서 줄 "<절>-00"을 읽는다. 기본은 I00, 없으면 처음 나온 순서 줄
//   --no-git: git 시각 검사를 끈다(기본: 기획 폴더가 git 안이면 손으로 고친 문서에 경고를 붙인다)
//   --no-content: 내용 검사를 끈다(시각만 비교한다)
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { refsIn, splitPieces } = require('./marks.js');

function fail(msg) {
  console.error(`오류: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { dir: null, checklist: null, prefix: null, git: true, content: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-git') opts.git = false;
    else if (a === '--no-content') opts.content = false;
    else if (a === '--checklist' || a === '--prefix') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--') || !v.trim()) fail(`${a} 뒤에 값이 필요해요`);
      opts[a.slice(2)] = v.trim();
    } else if (a.startsWith('--')) fail(`모르는 옵션이에요: ${a}`);
    else if (!opts.dir) opts.dir = a;
    else fail(`폴더는 하나만 줄 수 있어요: ${a}`);
  }
  opts.dir = path.resolve(opts.dir || '.');
  return opts;
}

const slash = (p) => p.split(path.sep).join('/');
const read = (p) => (p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
const TIME = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/;
// 맨 위 인용 블록에서 "> <이름>: 시각" 줄을 찾는다. 없으면 null
function quoteTime(text, name, from = 0) {
  if (!text) return null;
  const re = new RegExp(`^> ${name}: .*?${TIME.source}`, 'm');
  const m = text.slice(from).match(re);
  return m ? m[1] : null;
}
// 매핑 문서의 "## <n>." 절 아래 "> <이름>:" 줄
function sectionTime(text, n, name) {
  if (!text) return null;
  const at = text.search(new RegExp(`^## ${n}\\. `, 'm'));
  if (at < 0) return null;
  const rest = text.slice(at).split('\n').slice(1);
  for (const line of rest) {
    if (line.startsWith('## ')) break;
    const m = line.match(new RegExp(`^> ${name}: .*?${TIME.source}`));
    if (m) return m[1];
  }
  return null;
}

// concept.md(조사·기본 요소·규칙)는 시각을 비교하지 않지만, "> 문서:" 줄에 있어도 체크리스트로 잡히면 안 된다
const PLAN_DOCS = ['personas.md', 'persona-scenarios.md', 'persona-checklist-map.md', 'roadmap.md', 'concept.md'];

function findChecklist(dir, personas, given) {
  if (given) return path.resolve(given);
  const docs = (personas || '').match(/^> 문서: (.*)$/m);
  if (docs) {
    // 항목은 "checklist.md" 꼴이거나 "[../../checklist.md](../../checklist.md) (절 I36)"처럼 링크·덧말이 붙은 꼴이다
    const names = docs[1].split(' · ').map((s) => {
      const link = s.match(/\]\(([^)\s]+\.md)\)/);
      return link ? link[1] : (s.trim().match(/^\S+\.md/) || [s.trim()])[0];
    });
    const cl = names.find((n) => n.endsWith('.md') && !PLAN_DOCS.includes(n) && !n.includes('<'));
    if (cl) {
      // 기획 폴더 → 위 폴더들(저장소 루트까지) 차례로 찾는다
      for (let d = dir; ; d = path.dirname(d)) {
        if (fs.existsSync(path.join(d, cl))) return path.join(d, cl);
        if (fs.existsSync(path.join(d, '.git')) || path.dirname(d) === d) break;
      }
    }
  }
  // 기획 문서 네 개는 빼고 찾는다(persona-checklist-map.md도 "checklist"가 들어 있어 체크리스트로 잡히면 안 된다)
  const hit = fs.readdirSync(dir).find((n) => !PLAN_DOCS.includes(n) && /checklist.*\.md$|^체크리스트.*\.md$/i.test(n));
  return hit ? path.join(dir, hit) : null;
}

function orderTime(checklist, prefix) {
  if (!checklist) return { prefix: null, time: null, line: null };
  const all = [...checklist.matchAll(/\b([A-Z]{1,3}\d{2})-00 순서 \((\d{4}-\d{2}-\d{2} \d{2}:\d{2})[^\n]*/g)];
  const pick = prefix ? all.find((m) => m[1] === prefix) : all.find((m) => m[1] === 'I00') || all[0];
  return pick ? { prefix: pick[1], time: pick[2], line: pick[0] } : { prefix: prefix || null, time: null, line: null };
}

// 한 단계 줄의 조각별 표시. 규칙은 marks.js의 splitPieces()에 있고 score.js도 같은 것을 쓴다.
const pieceMarks = (line) => splitPieces(line).map((p) => p.mark);

// 시나리오 단계 수: 첫 페르소나 제목 뒤의 "1. …" 줄만
// 일부만 = " / "로 나눈 조각에 ✅와 다른 표시(🔜·❌)가 섞인 단계 (rules.md "번호와 표시")
function scenarioCounts(text) {
  const c = { all: 0, done: 0, planned: 0, partial: 0, none: 0, unmarked: 0 };
  if (!text) return null;
  let started = false;
  for (const line of text.split('\n')) {
    if (/^###\s+\d{2,}\s/.test(line)) { started = true; continue; }
    if (/^## /.test(line)) { started = /^## [A-Z]\. /.test(line) ? started : false; continue; }
    if (!started || !/^\s*\d+\.\s+/.test(line)) continue;
    c.all++;
    const marks = pieceMarks(line);
    const ok = marks.includes('✅'), plan = marks.includes('🔜'), no = marks.includes('❌');
    if (ok && (plan || no)) c.partial++;
    else if (ok) c.done++;
    else if (plan) c.planned++;
    else if (no) c.none++;
    else c.unmarked++;
  }
  return c;
}

// roadmap.md "### M1 …" 아래 "| M1-1 …" 줄
function milestones(text) {
  if (!text) return [];
  const list = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^###\s+(M\d+)\b\s*(.*)$/);
    if (h) { cur = { id: h[1], name: h[2].trim(), items: [] }; list.push(cur); continue; }
    if (/^##\s/.test(line)) { cur = null; continue; }
    const r = cur && line.match(/^\|\s*(M\d+-\d+)\b([^|]*)\|\s*([^|]*)\|/);
    if (r) cur.items.push({ id: r[1], done: r[2].includes('✅'), what: r[3].trim(), user: line.includes('(사용자)') });
  }
  return list;
}

// ---- git 시각: 갱신 줄보다 뒤에 손으로 고친 문서 찾기 ----
// 갱신 줄은 스킬이 문서를 쓸 때만 바뀐다. 사용자가 손으로 고치면 줄은 그대로라 "최신"으로 보인다.
// 그래서 문서마다 마지막으로 바뀐 시각(커밋 안 된 변경이 있으면 파일 수정 시각, 없으면 마지막 커밋 시각)을 읽어
// 기준보다 늦으면 경고만 붙인다("이어 할 곳"은 바꾸지 않는다).
// 기준 = 모든 기획 문서의 갱신 줄 중 가장 늦은 시각 + 60분.
//   - 흐름은 보통 여러 문서를 차례로 갱신한 뒤 끝에 한꺼번에 커밋한다. 문서 자기 갱신 시각과 비교하면
//     앞 단계 문서(personas.md 등)가 늘 헛경고를 받으므로, 가장 늦은 갱신과 비교한다.
//   - 마지막 갱신 뒤 검토·커밋까지 몇 분~수십 분 걸리는 게 보통이라 60분 여유를 둔다.
//   - 그래서 갱신 뒤 60분 안의 손 고침이나, 뒤 단계 갱신보다 먼저 한 손 고침은 못 잡는다(헛경고보다 놓침을 고름).
// git이 없거나 기획 폴더가 저장소 밖이면 아무것도 하지 않는다.
const GIT_GRACE_MIN = 60;
function gitOut(dir, args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return r.error || r.status !== 0 ? null : r.stdout.trim();
}
function changedAt(dir, name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) return null;
  const dirty = gitOut(dir, ['status', '--porcelain', '--', name]);
  if (dirty === null) return null;
  if (dirty) return { time: fs.statSync(p).mtime, dirty: true };
  const iso = gitOut(dir, ['log', '-1', '--format=%cI', '--', name]);
  return iso ? { time: new Date(iso), dirty: false } : null;
}
// "YYYY-MM-DD HH:MM"(갱신 줄, 이 컴퓨터 시간대) ↔ Date
const toDate = (s) => { const [y, mo, d, h, mi] = s.match(/\d+/g).map(Number); return new Date(y, mo - 1, d, h, mi); };
const two = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
// 행 이름 → 경고 문구
function handEdits(dir, stamps) {
  if (gitOut(dir, ['rev-parse', '--is-inside-work-tree']) !== 'true') return {};
  const latest = stamps.filter(Boolean).sort().pop();
  if (!latest) return {};
  const limit = toDate(latest).getTime() + GIT_GRACE_MIN * 60000;
  const rows = { 'personas.md': 'personas', 'persona-scenarios.md': 'scenarios', 'persona-checklist-map.md': 'map', 'roadmap.md': 'milestones' };
  const warn = {};
  for (const [doc, row] of Object.entries(rows)) {
    const c = changedAt(dir, doc);
    if (c && c.time.getTime() > limit) warn[row] = ` · 손으로 고침?(갱신 줄보다 뒤에 바뀜: ${fmt(c.time)}${c.dirty ? ', 커밋 안 됨' : ''})`;
  }
  return warn;
}

// ---- 내용 검사: 시각을 빠뜨려도 낡은 문서를 잡는다 ----
// 단계마다 { stale: [걸린 것], skip: 못 본 이유 } 를 낸다. 꼴이 달라 판단할 수 없으면 낡음을 만들지 않고 skip만 적는다.
// 번호 꼴(F01-02-03, I20-10 …)은 marks.js의 refsIn()이 읽는다.
const groupOf = (ref, depth) => ref.split('-').slice(0, depth).join('-');
// 번호 r이 묶음 g에 드나: 같거나, g의 아래 조각(쪼갠 조각 F03-02-03-01 포함)이거나, g를 감싸는 위 번호
const inGroup = (r, g) => r === g || r.startsWith(`${g}-`) || g.startsWith(`${r}-`);
const SCORE_JS = path.join(__dirname, 'score.js');
const PERSONA_ID = /^###\s+(\d{2,})\b/;
const STEP_LINE = /^\s*\d+\.\s+/;

// "## <n>." 절 본문 (다음 "## " 앞까지). 없으면 null
function section(text, n) {
  if (!text) return null;
  const at = text.search(new RegExp(`^## ${n}\\. `, 'm'));
  if (at < 0) return null;
  const lines = text.slice(at).split('\n');
  const end = lines.findIndex((l, i) => i > 0 && l.startsWith('## '));
  return lines.slice(0, end < 0 ? undefined : end).join('\n');
}
// 마크다운 표에서 머리 칸 이름으로 칸을 찾아 줄마다 { 칸이름: 값 } 을 낸다. 머리가 없으면 null
function tableRows(text, need) {
  const lines = (text || '').split('\n');
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const hi = lines.findIndex((l) => l.trim().startsWith('|') && need.every((n) => cells(l).includes(n)));
  if (hi < 0) return null;
  const head = cells(lines[hi]);
  const rows = [];
  for (const l of lines.slice(hi + 2)) {
    if (!l.trim().startsWith('|')) break;
    const c = cells(l);
    rows.push(Object.fromEntries(head.map((h, i) => [h, (c[i] || '').replace(/\*\*/g, '').trim()])));
  }
  return rows;
}
// score.js를 자식 프로세스로 돌려 머리 수와 🔜 표(묶음 → 점수)를 읽는다. 못 읽으면 { error }
function runScore(scenariosPath, args) {
  const r = spawnSync(process.execPath, [SCORE_JS, scenariosPath, ...args], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return { error: `score.js 실패: ${(r.stderr || '').trim().split('\n')[0] || r.status}` };
  const head = r.stdout.match(/번호 없는 단계 (\d+) · 표시 없는 단계 (\d+)/);
  const pend = r.stdout.split('## 이미 된 것')[0];
  const rows = tableRows(pend, ['묶음', '점수']);
  if (!head || !rows) return { error: 'score.js 출력 꼴이 다름' };
  return { unmapped: Number(head[1]), unmarked: Number(head[2]), points: new Map(rows.map((x) => [x['묶음'], x['점수']])) };
}
// "> 점수:" 줄에 적힌 score.js 옵션. 없으면 status.js의 --prefix와 기본값
function scoreArgs(map, prefix) {
  const sec = section(map, 1) || '';
  const line = (sec.match(/^> 점수: .*$/m) || [''])[0];
  const args = [];
  let depth = 2;
  for (const [name, re] of [['--depth', /--depth\s+(\d+)/], ['--people-weight', /--people-weight\s+(\d+)/],
    ['--grades', /--grades\s+([\d.]+,[\d.]+,[\d.]+)/], ['--prefix', /--prefix\s+([A-Z0-9,]+)/]]) {
    const m = line.match(re);
    if (m) { args.push(name, m[1]); if (name === '--depth') depth = Number(m[1]); }
  }
  if (prefix && !/--prefix/.test(line)) args.push('--prefix', prefix);
  return { args, depth };
}
// 시나리오 단계 줄(첫 페르소나 제목 뒤의 "1. …")에 나온 번호. score.js가 세는 줄과 같다
function scenarioRefs(text) {
  const out = new Set();
  let started = false;
  for (const line of (text || '').split('\n')) {
    if (PERSONA_ID.test(line)) { started = true; continue; }
    if (started && STEP_LINE.test(line)) refsIn(line).forEach((r) => out.add(r));
  }
  return out;
}

function contentChecks(ctx) {
  const { personas, scenarios, scenariosPath, map, checklist, roadmap, order, prefix } = ctx;
  const res = {};
  const list = (xs) => (xs.length > 5 ? `${xs.slice(0, 5).join(', ')} 외 ${xs.length - 5}개` : xs.join(', '));

  // scenarios: 페르소나마다 장면이 있나
  if (scenarios) {
    const ids = (t) => new Set(t.split('\n').map((l) => (l.match(PERSONA_ID) || [])[1]).filter(Boolean));
    const want = ids(personas), have = ids(scenarios);
    if (!want.size) res.scenarios = { stale: [], skip: 'personas.md에 ### NN 제목 없음' };
    else {
      const miss = [...want].filter((id) => !have.has(id));
      res.scenarios = { stale: miss.length ? [`장면 없는 페르소나: ${list(miss)}`] : [] };
    }
  }

  // map: 번호·표시 없는 단계(score.js와 같은 수), 체크리스트에 없는 번호
  if (scenarios && map) {
    const sc = runScore(scenariosPath, []);
    const stale = [];
    const skips = [];
    if (sc.error) skips.push(sc.error);
    else {
      if (sc.unmapped) stale.push(`번호 없는 단계 ${sc.unmapped}`);
      if (sc.unmarked) stale.push(`표시 없는 단계 ${sc.unmarked}`);
    }
    if (!checklist) skips.push('체크리스트 없음');
    else {
      const miss = [...scenarioRefs(scenarios)].filter((r) => !new RegExp(`\\b${r}(?!\\d)`).test(checklist)).sort();
      if (miss.length) stale.push(`체크리스트에 없는 번호: ${list(miss)}`);
    }
    res.map = { stale, skip: skips.join(', ') || null };
  }

  // score: score.js 🔜 표와 매핑 1절 표가 같은가
  const { args, depth } = scoreArgs(map, prefix);
  const docRows = tableRows(section(map, 1), ['묶음', '점수']);
  if (scenarios && map) {
    if (!docRows) res.score = { stale: [], skip: '매핑 1절에 묶음·점수 표 없음' };
    else {
      const sc = runScore(scenariosPath, args);
      if (sc.error) res.score = { stale: [], skip: sc.error };
      else {
        const doc = new Map(docRows.map((x) => [x['묶음'], x['점수']]));
        const diff = [], absent = [], extra = [];
        for (const [g, p] of sc.points) {
          if (!doc.has(g)) absent.push(g);
          else if (doc.get(g) !== p) diff.push(`${g} ${doc.get(g)} → ${p}`);
        }
        for (const g of doc.keys()) if (!sc.points.has(g)) extra.push(g);
        const stale = [];
        if (diff.length) stale.push(`점수 다름: ${list(diff)}`);
        if (absent.length) stale.push(`표에 없는 묶음: ${list(absent)}`);
        if (extra.length) stale.push(`다시 센 표에 없는 묶음: ${list(extra)}`);
        res.score = { stale };
      }
    }
  }

  // 순서에 든 번호: 매핑 3절 표 줄마다 첫 번호(할 일 칸, "왜 이 자리"에 든 다른 번호는 말일 뿐) + 체크리스트 순서 줄의 번호
  // 3절 위 글줄("기대는 기존 항목: …")의 번호는 보지 않는다
  const orderTable = (section(map, 3) || '').split('\n').filter((l) => /^\s*\|/.test(l));
  const orderRefs = [...orderTable.map((l) => refsIn(l)[0]).filter(Boolean), ...refsIn(order.line || '')]
    .filter((r) => !/^[A-Z]{1,3}\d{2}-00$/.test(r));
  const hasOrder = orderTable.length > 2 || !!order.line;

  // priority: 1절 🔜 묶음이 모두 순서에 있나
  if (map) {
    if (!docRows) res.priority = { stale: [], skip: '매핑 1절에 묶음·점수 표 없음' };
    else if (!hasOrder) res.priority = { stale: [], skip: '매핑 3절 순서 표와 체크리스트 순서 줄 없음' };
    else {
      const miss = docRows.map((x) => x['묶음']).filter((g) => g && !orderRefs.some((r) => inGroup(r, g)));
      res.priority = { stale: miss.length ? [`순서에 없는 묶음: ${list(miss)}`] : [] };
    }
  }

  // milestones: 순서의 묶음(끝난 ✅·보류 ⏸와 바탕 일 절 <절>-00 빼고)이 로드맵 세부 항목에 있나
  if (roadmap) {
    if (!hasOrder) res.milestones = { stale: [], skip: '순서 표·순서 줄 없음' };
    else {
      const rmRefs = roadmap.split('\n').filter((l) => /^\|\s*M\d+-\d+/.test(l)).flatMap(refsIn);
      const lines = [...(checklist || '').split('\n'), ...orderTable];
      // 그 묶음 번호로 시작하는 체크리스트 줄·순서 표 줄에 ✅나 ⏸가 있으면 셀 것에서 뺀다
      const closed = (g) => lines.some((l) => {
        const first = refsIn(l)[0];
        return first && inGroup(first, g) && /✅|⏸/.test(l);
      });
      const groups = [...new Set(orderRefs.map((r) => groupOf(r, depth)))]
        .filter((g) => !/^[A-Z]{1,3}\d{2}-00$/.test(g));
      const miss = groups.filter((g) => !closed(g) && !rmRefs.some((r) => inGroup(r, g)));
      res.milestones = { stale: miss.length ? [`로드맵에 없는 묶음: ${list(miss)}`] : [] };
    }
  }
  return res;
}

const opts = parseArgs(process.argv.slice(2));
const file = (n) => path.join(opts.dir, n);
const personas = read(file('personas.md'));
if (!personas) fail(`${opts.dir}에 personas.md가 없어요(아직 기획 전이거나 다른 폴더예요)`);
const scenariosPath = file('persona-scenarios.md');
const scenarios = read(scenariosPath);
const map = read(file('persona-checklist-map.md'));
const roadmap = read(file('roadmap.md'));
const checklistPath = findChecklist(opts.dir, personas, opts.checklist);
const checklist = read(checklistPath);
const order = orderTime(checklist, opts.prefix);

const mapHead = quoteTime(map, '갱신');
const steps = [
  { name: 'personas', doc: 'personas.md', time: quoteTime(personas, '갱신') },
  { name: 'scenarios', doc: 'persona-scenarios.md', time: quoteTime(scenarios, '갱신') },
  { name: 'map', doc: 'persona-checklist-map.md 머리', time: mapHead },
  { name: 'score', doc: 'persona-checklist-map.md 1절 > 점수', time: sectionTime(map, 1, '점수'), fallback: mapHead },
  { name: 'priority', doc: 'persona-checklist-map.md 3절 > 순서', time: sectionTime(map, 3, '순서'), fallback: mapHead },
];
const exists = { personas: !!personas, scenarios: !!scenarios, map: !!map, score: !!map, priority: !!map };
const rmTime = quoteTime(roadmap, '갱신');
const warn = opts.git ? handEdits(opts.dir, [...steps.map((s) => s.time), rmTime, order.time]) : {};

const content = opts.content
  ? contentChecks({ personas, scenarios, scenariosPath, map, checklist, roadmap, order, prefix: opts.prefix })
  : {};

// 시각: 앞 단계가 뒤 단계보다 늦게 갱신됐으면 뒤 단계가 낡음.
// 내용: 위 contentChecks가 걸린 것이 있으면 낡음. 둘 중 하나라도 걸리면 낡음이고, "왜" 칸에 무엇이 걸렸는지 적는다.
// 시각으로만 낡으면 "낡음(시각만)"(내용 검사를 켰을 때). 처음 낡거나 없는 단계부터 이어 하면 된다.
function verdict(name, baseState, timeStale) {
  const c = content[name];
  const contentStale = !!(c && c.stale.length);
  const why = [];
  if (contentStale) why.push(`내용: ${c.stale.join(' · ')}`);
  if (timeStale) why.push('시각: 앞 단계가 더 늦음');
  if (c && c.skip) why.push(`내용 검사 못 함(${c.skip})`);
  let state = baseState;
  if (state.startsWith('최신') && contentStale) state = '낡음';
  else if (state === '낡음' && opts.content && !contentStale && !(c && c.skip) && c) state = '낡음(시각만)';
  return { state, why: why.join(' · ') || '-' };
}
let firstStale = null;
let prev = null;
console.log(`# 기획 상태: ${slash(path.relative(process.cwd(), opts.dir) || '.')}\n`);
console.log('| 단계 | 문서 | 시각 | 상태 | 왜 |');
console.log('|---|---|---|---|---|');
for (const s of steps) {
  const t = s.time || s.fallback || null;
  let base;
  let timeStale = false;
  if (!exists[s.name]) base = '없음';
  else if (!t) base = '시각 없음';
  else if (prev && prev > t) { base = '낡음'; timeStale = true; }
  else base = '최신';
  const v = exists[s.name] ? verdict(s.name, base, timeStale) : { state: base, why: '-' };
  let state = v.state;
  if (s.time === null && s.fallback && exists[s.name]) state += ' (줄 없음, 머리 시각으로 봄)';
  if (!firstStale && !state.startsWith('최신')) firstStale = s.name;
  console.log(`| ${s.name} | ${s.doc} | ${t || '-'} | ${state}${warn[s.name] || ''} | ${v.why} |`);
  if (t && (!prev || t > prev)) prev = t;
}
let rmBase;
let rmTimeStale = false;
if (!roadmap) rmBase = '없음';
else if (!rmTime) rmBase = '시각 없음';
else if (order.time && order.time > rmTime) { rmBase = '낡음'; rmTimeStale = true; }
else rmBase = order.time ? '최신' : '최신 (순서 줄 없음)';
const rv = roadmap ? verdict('milestones', rmBase, rmTimeStale) : { state: rmBase, why: '-' };
if (!firstStale && !rv.state.startsWith('최신')) firstStale = 'milestones';
console.log(`| milestones | roadmap.md (순서 줄 ${order.prefix || '?'}-00: ${order.time || '-'}) | ${rmTime || '-'} | ${rv.state}${warn.milestones || ''} | ${rv.why} |`);
console.log(`\n- 체크리스트: ${checklistPath ? slash(path.relative(process.cwd(), checklistPath)) : '못 찾음'}`);
console.log(`- 이어 할 곳: ${firstStale || '없음 (모두 최신)'}`);

const sc = scenarioCounts(scenarios);
if (sc) {
  console.log(`- 시나리오: 단계 ${sc.all} · ✅ ${sc.done} · 🔜 ${sc.planned} · 일부만 ${sc.partial} · ❌ ${sc.none}${sc.unmarked ? ` · 표시 없음 ${sc.unmarked}` : ''}`);
}

const ms = milestones(roadmap);
if (ms.length) {
  console.log('\n| 마일스톤 | 이름 | ✅/전체 | 다음 |');
  console.log('|---|---|---|---|');
  for (const m of ms) {
    const done = m.items.filter((x) => x.done).length;
    const next = m.items.find((x) => !x.done && !x.user);
    console.log(`| ${m.id} | ${m.name} | ${done}/${m.items.length} | ${next ? `${next.id} ${next.what}` : '-'} |`);
  }
  const target = ms.find((m) => m.items.some((x) => !x.done));
  const next = target && target.items.find((x) => !x.done && !x.user);
  console.log(`\n- 다음 세부 항목: ${next ? `${next.id} ${next.what} (${target.id})` : '없음'}`);
  const userItems = ms.flatMap((m) => m.items.filter((x) => !x.done && x.user).map((x) => x.id));
  if (userItems.length) console.log(`- 사용자 몫: ${userItems.join(', ')}`);
}
