#!/usr/bin/env node
// 시나리오 파일에서 묶음별 비중 점수(사람 수 × 가중치 + 단계 수)를 계산해 마크다운 표로 낸다.
// 사용법: node score.js scenarios.md [--depth 2] [--people-weight 2] [--grades 15,9,5] [--prefix F,I]
const fs = require('fs');

function parseArgs(argv) {
  const opts = { depth: 2, peopleWeight: 2, grades: [15, 9, 5], prefix: null, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--depth') opts.depth = Number(argv[++i]);
    else if (a === '--people-weight') opts.peopleWeight = Number(argv[++i]);
    else if (a === '--grades') opts.grades = argv[++i].split(',').map(Number);
    else if (a === '--prefix') opts.prefix = argv[++i].split(',');
    else if (!opts.file) opts.file = a;
  }
  if (!opts.file) {
    console.error('사용법: node score.js <시나리오 파일> [--depth 2] [--people-weight 2] [--grades 15,9,5] [--prefix F,I]');
    process.exit(1);
  }
  return opts;
}

// "### 01 이름 — 장면" 같은 페르소나 제목
const PERSONA = /^###\s+(\S+)\s+([^\s—–-]+)/;
// "1. …" 번호 단계
const STEP = /^\s*\d+\.\s+/;
// F01-02-03, D05-12-01, I20-10 같은 체크리스트 번호
const REF = /\b([A-Z]{1,3}\d{2}(?:-\d{2})+)/g;

function groupOf(ref, depth) {
  const parts = ref.split('-');
  return parts.slice(0, Math.min(depth, parts.length)).join('-');
}

function score(text, opts) {
  const pending = new Map(); // 묶음 → { people:Set, steps }
  const done = new Map();
  let persona = null;
  let steps = 0, unmapped = 0;
  for (const line of text.split(/\r?\n/)) {
    const p = line.match(PERSONA);
    if (p) { persona = `${p[1]} ${p[2]}`; continue; }
    if (!persona || !STEP.test(line)) continue;
    if (line.includes('❌')) { steps++; unmapped += line.match(REF) ? 0 : 1; continue; }
    const isPending = line.includes('🔜');
    const isDone = line.includes('✅');
    if (!isPending && !isDone) continue;
    steps++;
    const refs = [...line.matchAll(REF)].map(m => m[1])
      .filter(r => !opts.prefix || opts.prefix.some(x => r.startsWith(x)));
    if (refs.length === 0) { unmapped++; continue; }
    const table = isPending ? pending : done;
    for (const g of new Set(refs.map(r => groupOf(r, opts.depth)))) {
      if (!table.has(g)) table.set(g, { people: new Set(), steps: 0 });
      const e = table.get(g);
      e.people.add(persona);
      e.steps++;
    }
  }
  return { pending, done, steps, unmapped };
}

function rows(table, opts) {
  return [...table].map(([group, e]) => {
    const people = e.people.size;
    const points = people * opts.peopleWeight + e.steps;
    const g = opts.grades.findIndex(min => points >= min);
    return { group, people, steps: e.steps, points, grade: g === -1 ? opts.grades.length + 1 : g + 1, who: [...e.people] };
  }).sort((a, b) => b.points - a.points || b.people - a.people || a.group.localeCompare(b.group));
}

const opts = parseArgs(process.argv.slice(2));
const { pending, done, steps, unmapped } = score(fs.readFileSync(opts.file, 'utf8'), opts);

console.log(`> 단계 ${steps} · 번호 없는 단계 ${unmapped} · 점수 = 사람 수 × ${opts.peopleWeight} + 단계 수 · 등급 하한 ${opts.grades.join('/')}\n`);
console.log('## 아직 안 된 것 (🔜)\n');
console.log('| 순위 | 묶음 | 사람 | 단계 | 점수 | 등급 | 누구 |');
console.log('|---|---|---|---|---|---|---|');
rows(pending, opts).forEach((r, i) =>
  console.log(`| ${i + 1} | ${r.group} | ${r.people} | ${r.steps} | **${r.points}** | ${r.grade} | ${r.who.join(', ')} |`));
console.log('\n## 이미 된 것이 받치는 몫 (✅)\n');
console.log('| 묶음 | 사람 | 단계 | 점수 |');
console.log('|---|---|---|---|');
rows(done, opts).forEach(r => console.log(`| ${r.group} | ${r.people} | ${r.steps} | ${r.points} |`));
