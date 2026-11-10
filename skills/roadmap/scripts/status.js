#!/usr/bin/env node
// 기획 문서 다섯 개의 갱신 시각을 비교해 낡은 단계를 찾고, 마일스톤·시나리오 진행 수를 센다.
// roadmap 1절 "지금 상태 보기"를 눈으로 비교하지 않게 하는 스크립트. 문서는 고치지 않는다.
// 사용법: node status.js [기획 폴더] [--checklist <파일>] [--prefix <절>]
//   기획 폴더: personas.md가 있는 폴더(기본: 현재 폴더)
//   --checklist: 체크리스트 파일(기본: personas.md "> 문서:" 줄 → 폴더의 *checklist*.md·체크리스트*.md)
//   --prefix: 한 주제 기획의 절 번호(예: P28). 순서 줄 "<절>-00"을 읽는다. 기본은 I00, 없으면 처음 나온 순서 줄
'use strict';
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`오류: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { dir: null, checklist: null, prefix: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--checklist' || a === '--prefix') {
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

const PLAN_DOCS = ['personas.md', 'persona-scenarios.md', 'persona-checklist-map.md', 'roadmap.md'];

function findChecklist(dir, personas, given) {
  if (given) return path.resolve(given);
  const docs = (personas || '').match(/^> 문서: (.*)$/m);
  if (docs) {
    const names = docs[1].split(' · ').map((s) => s.trim());
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
  if (!checklist) return { prefix: null, time: null };
  const all = [...checklist.matchAll(/\b([A-Z]{1,3}\d{2})-00 순서 \((\d{4}-\d{2}-\d{2} \d{2}:\d{2})/g)];
  const pick = prefix ? all.find((m) => m[1] === prefix) : all.find((m) => m[1] === 'I00') || all[0];
  return pick ? { prefix: pick[1], time: pick[2] } : { prefix: prefix || null, time: null };
}

// 한 단계 줄의 조각별 표시. roadmap-score/scripts/score.js의 pieces()와 같은 규칙이다(그쪽을 바꾸면 여기도 같이):
// " / "로 나눈 조각마다 든 표시를 MARKS 순서로 모아 마지막 것을 그 조각의 표시로 본다.
// 조각이 하나뿐이면 줄 전체의 표시를 본다. 그래서 " / " 없이 ✅와 🔜가 같이 있는 줄은 ✅ 한 표시다.
const MARKS = ['🔜', '✅', '❌'];
function pieceMarks(line) {
  const segs = line.split(' / ');
  return segs.map((seg) => {
    const own = MARKS.filter((m) => (segs.length === 1 ? line : seg).includes(m));
    return own.length ? own[own.length - 1] : null;
  });
}

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

const opts = parseArgs(process.argv.slice(2));
const file = (n) => path.join(opts.dir, n);
const personas = read(file('personas.md'));
if (!personas) fail(`${opts.dir}에 personas.md가 없어요(아직 기획 전이거나 다른 폴더예요)`);
const scenarios = read(file('persona-scenarios.md'));
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

// 앞 단계가 뒤 단계보다 늦게 갱신됐으면 뒤 단계가 낡음. 처음 낡거나 없는 단계부터 이어 하면 된다.
let firstStale = null;
let prev = null;
console.log(`# 기획 상태: ${slash(path.relative(process.cwd(), opts.dir) || '.')}\n`);
console.log('| 단계 | 문서 | 시각 | 상태 |');
console.log('|---|---|---|---|');
for (const s of steps) {
  const t = s.time || s.fallback || null;
  let state;
  if (!exists[s.name]) state = '없음';
  else if (!t) state = '시각 없음';
  else if (prev && prev > t) state = '낡음';
  else state = '최신';
  if (s.time === null && s.fallback && exists[s.name]) state += ' (줄 없음, 머리 시각으로 봄)';
  if (!firstStale && !state.startsWith('최신')) firstStale = s.name;
  console.log(`| ${s.name} | ${s.doc} | ${t || '-'} | ${state} |`);
  if (t && (!prev || t > prev)) prev = t;
}
const rmTime = quoteTime(roadmap, '갱신');
let rmState;
if (!roadmap) rmState = '없음';
else if (!rmTime) rmState = '시각 없음';
else if (order.time && order.time > rmTime) rmState = '낡음';
else rmState = order.time ? '최신' : '최신 (순서 줄 없음)';
if (!firstStale && !rmState.startsWith('최신')) firstStale = 'milestones';
console.log(`| milestones | roadmap.md (순서 줄 ${order.prefix || '?'}-00: ${order.time || '-'}) | ${rmTime || '-'} | ${rmState} |`);
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
