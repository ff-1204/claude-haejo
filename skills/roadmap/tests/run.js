#!/usr/bin/env node
// status.js 시험: 예시 기획(plan/)의 결과를 손으로 정한 기대 출력과 비교하고, 잘못된 입력이면 멈추는지 본다.
// 사용: node tests/run.js
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const here = __dirname;
const script = path.join(here, '..', 'scripts', 'status.js');
const run = (args) => spawnSync(process.execPath, [script, ...args], { cwd: here, encoding: 'utf8' });
const norm = (s) => s.replace(/\r\n/g, '\n').trimEnd();
let failed = 0;

function check(name, ok, detail) {
  console.log(`${ok ? '통과' : '실패'}: ${name}`);
  if (!ok) { failed++; if (detail) console.log(detail); }
}

// 1) 기대 출력과 같은가 (priority·로드맵이 낡음, 다음은 M2-3, 사용자 몫 M2-2)
const r = run(['plan']);
const want = norm(fs.readFileSync(path.join(here, 'expected-status.md'), 'utf8'));
check('예시 기획 상태', r.status === 0 && norm(r.stdout) === want, `--- 받은 출력\n${r.stdout}${r.stderr}`);

// 2) 순서 줄 절을 고르면 그 줄이 없어 로드맵을 낡았다고 보지 않는다
const p = run(['plan', '--prefix', 'P28']);
check('--prefix 없는 절', p.status === 0 && p.stdout.includes('최신 (순서 줄 없음)'), p.stdout + p.stderr);

// 3) 잘못된 입력이면 결과 없이 exit 1
const bad = [
  ['personas.md 없는 폴더', ['.']],
  ['모르는 옵션', ['plan', '--nope']],
  ['값 없는 --prefix', ['plan', '--prefix']],
  ['폴더 두 개', ['plan', 'plan']],
];
for (const [name, args] of bad) {
  const b = run(args);
  check(name, b.status === 1 && b.stdout === '' && b.stderr.includes('오류'), `status ${b.status}\n${b.stdout}${b.stderr}`);
}

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
