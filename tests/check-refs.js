#!/usr/bin/env node
// 스킬 문서 안의 참조가 실제로 있는지 본다.
//   1) 마크다운 링크 ](경로) → 그 파일이 있나
//   2) "roadmap-<이름> N절", "SKILL.md N절", 맨 "N절" → 그 SKILL.md에 "## N." 제목이 있나
//   3) "<파일>.md \"<이름>\"" → 그 파일에 그 이름이 든 제목(#)이 있나
//   4) 권한 규칙의 자세한 문장이 roadmap-teammate 0절 밖에 되풀이되지 않나
// 틀린 곳이 있으면 목록을 내고 exit 1. 사용: node tests/check-refs.js
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');
const problems = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    // 스킬 안 tests/는 시험용 예시 문서라 보지 않는다
    if (e.isDirectory()) return e.name === 'tests' ? [] : walk(p);
    return p.endsWith('.md') ? [p] : [];
  });
}

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const headingCache = new Map();
function headings(file) {
  if (!headingCache.has(file)) {
    headingCache.set(file, read(file).split('\n').filter((l) => /^#{1,6} /.test(l)));
  }
  return headingCache.get(file);
}
const hasSection = (file, n) => headings(file).some((h) => h.startsWith(`## ${n}. `));
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');

// 이 파일이 속한 스킬 폴더 (skills/<이름>)
function skillOf(file) {
  const parts = path.relative(skillsDir, file).split(path.sep);
  return parts.length > 1 ? path.join(skillsDir, parts[0]) : null;
}

// 이름만 적힌 .md 파일을 찾는다: 같은 폴더 → 같은 스킬 → roadmap/references
function findMd(name, file) {
  const skill = skillOf(file);
  const tries = [path.join(path.dirname(file), name)];
  if (skill) tries.push(path.join(skill, name), path.join(skill, 'references', name));
  for (const s of fs.readdirSync(skillsDir)) tries.push(path.join(skillsDir, s, 'references', name));
  return tries.find((p) => fs.existsSync(p)) || null;
}

const files = [...walk(skillsDir), ...['CLAUDE.md', 'README.md', 'README.ko.md', 'README.ja.md'].map((f) => path.join(root, f))];

for (const file of files) {
  const lines = read(file).split('\n');
  const skill = skillOf(file);
  let inCode = false;
  lines.forEach((line, i) => {
    if (line.startsWith('```')) { inCode = !inCode; return; }
    if (inCode) return;
    const where = `${rel(file)}:${i + 1}`;

    // 1) 링크 (assets는 사용자 프로젝트에 놓일 문서 꼴이라 옆 문서 링크를 보지 않는다)
    const isAsset = file.split(path.sep).includes('assets');
    for (const m of isAsset ? [] : line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1].split('#')[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      if (!fs.existsSync(path.resolve(path.dirname(file), target))) problems.push(`${where} 링크 없음: ${m[1]}`);
    }

    // 2) N절. 맨 "N절"은 자기 SKILL.md에 "## N." 절이 있는 스킬(roadmap, roadmap-teammate)에서만 본다.
    //    다른 하위 스킬의 맨 "N절"은 매핑 문서 절이다. 매핑 문서를 말하는 줄도 건너뛴다.
    const ownSkill = skill && path.join(skill, 'SKILL.md');
    const numbered = ownSkill && fs.existsSync(ownSkill) && headings(ownSkill).some((h) => /^## \d+\. /.test(h));
    const mapLine = !numbered || /매핑|checklist-map/.test(line);
    for (const m of line.matchAll(/(roadmap(?:-[a-z]+)?|SKILL\.md)?\s?(\d+)(?:[~·](\d+))?절/g)) {
      const [, who, a, b] = m;
      let target = null;
      if (who && who.startsWith('roadmap')) target = path.join(skillsDir, who, 'SKILL.md');
      else if (who === 'SKILL.md') target = skill && path.join(skill, 'SKILL.md');
      else if (!mapLine && skill) target = path.join(skill, 'SKILL.md');
      if (!target) continue;
      if (!fs.existsSync(target)) { problems.push(`${where} 스킬 없음: ${m[0]}`); continue; }
      for (const n of b ? [a, b] : [a]) {
        if (!hasSection(target, n)) problems.push(`${where} 절 없음: ${m[0].trim()} → ${rel(target)}`);
      }
    }

    // 3) 파일 "이름"
    for (const m of line.matchAll(/([\w.-]+\.md)`?\)?\s?"([^"]+)"/g)) {
      const [, name, title] = m;
      const target = findMd(name, file);
      if (!target) { problems.push(`${where} 파일 없음: ${name}`); continue; }
      if (!headings(target).some((h) => h.includes(title))) problems.push(`${where} 제목 없음: ${name} "${title}"`);
    }
  });
}

// 4) 권한 규칙의 원본은 roadmap-teammate 0절 한 곳. 자세한 예외 문장이 다른 문서에 되풀이되면 잡는다
//    (다른 문서는 핵심만 두고 0절을 가리킨다).
const permOrigin = path.join(skillsDir, 'roadmap-teammate', 'SKILL.md');
const permDetails = ['브리프에 없는 권한만', '먼저 달거나 권하지', '직접 연 새 세션', '아직 푸시하지 마'];
for (const file of files) {
  if (file === permOrigin) continue;
  read(file).split('\n').forEach((line, i) => {
    for (const s of permDetails) {
      if (line.includes(s)) problems.push(`${rel(file)}:${i + 1} 권한 규칙 되풀이: "${s}" → roadmap-teammate 0절을 가리킬 것`);
    }
  });
}

if (problems.length) {
  console.error(`참조 오류 ${problems.length}개`);
  for (const p of problems) console.error('- ' + p);
  process.exit(1);
}
console.log(`참조 확인: 파일 ${files.length}개, 문제 없음`);
