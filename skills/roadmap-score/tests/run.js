#!/usr/bin/env node
// score.js를 예시 시나리오로 돌려 기대 출력과 비교한다. 다르면 다른 줄을 보이고 exit 1.
// 사용법: node tests/run.js
// 기대 출력은 손으로 센 값이다. score.js를 고쳐 출력이 바뀌면 숫자를 다시 세어 확인한 뒤 고친다.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = __dirname;
const script = path.join(dir, '..', 'scripts', 'score.js');
const input = path.join(dir, 'scenarios.md');

// BOM + CRLF로 시작하고 첫 줄이 바로 페르소나 제목인 파일. 페르소나 앞 줄은 원래 세지 않으므로 결과는 expected.md와 같아야 한다.
const text = fs.readFileSync(input, 'utf8');
const bomInput = path.join(os.tmpdir(), `score-test-bom-${process.pid}.md`);
fs.writeFileSync(bomInput, '﻿' + text.slice(text.indexOf('### ')).replace(/\r?\n/g, '\r\n'));

const cases = [
  { name: '옵션 없음', args: [], expected: 'expected.md' },
  { name: '--prefix F', args: ['--prefix', 'F'], expected: 'expected-prefix-F.md' },
  { name: 'BOM·CRLF로 시작', file: bomInput, args: [], expected: 'expected.md' },
];

const lines = s => s.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');

let failed = 0;
for (const c of cases) {
  const r = spawnSync(process.execPath, [script, c.file || input, ...c.args], { encoding: 'utf8' });
  const actual = lines(r.stdout || '');
  const expected = lines(fs.readFileSync(path.join(dir, c.expected), 'utf8'));
  const diff = [];
  for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
    if (actual[i] === expected[i]) continue;
    if (expected[i] !== undefined) diff.push(`  ${i + 1}- ${expected[i]}`);
    if (actual[i] !== undefined) diff.push(`  ${i + 1}+ ${actual[i]}`);
  }
  if (r.status !== 0 || diff.length) {
    failed++;
    console.log(`실패: ${c.name} (${c.expected}, exit ${r.status})`);
    if (r.stderr) console.log(r.stderr.trimEnd());
    console.log(diff.join('\n'));
  } else {
    console.log(`통과: ${c.name}`);
  }
}
// 잘못된 옵션은 표를 내지 않고 exit 1로 멈춰야 한다
const badCases = [
  { name: '--depth 값 없음', args: ['--depth'] },
  { name: '--depth 0', args: ['--depth', '0'] },
  { name: '--people-weight 글자', args: ['--people-weight', 'abc'] },
  { name: '--grades 2개', args: ['--grades', '8,5'] },
  { name: '--prefix 값 없음', args: ['--prefix', '--depth', '2'] },
  { name: '모르는 옵션', args: ['--deep', '2'] },
];
for (const c of badCases) {
  const r = spawnSync(process.execPath, [script, input, ...c.args], { encoding: 'utf8' });
  if (r.status === 1 && !(r.stdout || '').trim() && (r.stderr || '').includes('오류')) {
    console.log(`통과: ${c.name}`);
  } else {
    failed++;
    console.log(`실패: ${c.name} (exit ${r.status}, 표를 내면 안 됨)`);
  }
}

fs.rmSync(bomInput, { force: true });
process.exit(failed ? 1 : 0);
