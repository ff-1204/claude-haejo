#!/usr/bin/env node
// status.js 시험: 예시 기획(plan/)의 결과를 손으로 정한 기대 출력과 비교하고, 잘못된 입력이면 멈추는지 본다.
// 사용: node tests/run.js
// plan/은 이 저장소 git 안이라 커밋 시각이 갱신 줄보다 늦다. 그래서 기대 출력 비교는 git 밖 임시 폴더에 복사해 돌리거나
// --no-git으로 돌린다(git 상태에 따라 출력이 흔들리지 않게).
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const here = __dirname;
const script = path.join(here, '..', 'scripts', 'status.js');
const scoreScript = path.join(here, '..', '..', 'roadmap-score', 'scripts', 'score.js');
const run = (args, cwd = here) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
const norm = (s) => s.replace(/\r\n/g, '\n').trimEnd();
let failed = 0;
const temps = [];

function check(name, ok, detail) {
  console.log(`${ok ? '통과' : '실패'}: ${name}`);
  if (!ok) { failed++; if (detail) console.log(detail); }
}

// plan/을 임시 폴더의 plan/으로 복사한다. 돌려주는 값은 임시 폴더(cwd로 쓰면 출력 경로가 plan/…로 같다)
function copyPlan() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'status-test-'));
  temps.push(root);
  const dst = path.join(root, 'plan');
  fs.mkdirSync(dst);
  for (const n of fs.readdirSync(path.join(here, 'plan'))) fs.copyFileSync(path.join(here, 'plan', n), path.join(dst, n));
  return root;
}
const readU = (p) => fs.readFileSync(p, 'utf8');
const writeU = (p, s) => fs.writeFileSync(p, s, 'utf8');
const want = norm(readU(path.join(here, 'expected-status.md')));

// 1) 기대 출력과 같은가 (priority·로드맵이 낡음, 다음은 M2-3, 사용자 몫 M2-2)
//    git 밖 임시 폴더: git 검사는 조용히 빠진다
const t1 = copyPlan();
const r = run(['plan'], t1);
check('예시 기획 상태 (git 밖)', r.status === 0 && norm(r.stdout) === want, `--- 받은 출력\n${r.stdout}${r.stderr}`);
//    --no-git이면 저장소 안 plan/도 같은 출력
const r2 = run(['plan', '--no-git']);
check('예시 기획 상태 (--no-git)', r2.status === 0 && norm(r2.stdout) === want, `--- 받은 출력\n${r2.stdout}${r2.stderr}`);

// 2) 순서 줄 절을 고르면 그 줄이 없어 로드맵을 낡았다고 보지 않는다
const p = run(['plan', '--prefix', 'P28', '--no-git']);
check('--prefix 없는 절', p.status === 0 && p.stdout.includes('최신 (순서 줄 없음)'), p.stdout + p.stderr);

// 3) 체크리스트 이름이 한글이고 "> 문서:" 줄에 없어도 매핑 문서(persona-checklist-map.md)를 체크리스트로 잡지 않는다
{
  const root = copyPlan();
  const dir = path.join(root, 'plan');
  fs.renameSync(path.join(dir, 'checklist.md'), path.join(dir, '체크리스트.md'));
  const pf = path.join(dir, 'personas.md');
  writeU(pf, readU(pf).replace(/^> 문서: .*\n/m, ''));
  const c = run(['plan'], root);
  check('한글 체크리스트 찾기', c.status === 0 && c.stdout.includes('- 체크리스트: plan/체크리스트.md')
    && /\| milestones \|.*\| 낡음 \|/.test(c.stdout), c.stdout + c.stderr);
}

// 4) "일부만"은 " / "로 나눈 조각에 표시가 섞인 단계만 (score.js pieces()와 같은 규칙)
//    1단계: 조각 하나에 ✅와 🔜가 같이 있다 → score.js는 ✅ 한 표시로 센다 → 일부만이 아니다
//    2단계: 조각마다 ✅ / 🔜 → 일부만
{
  const root = copyPlan();
  const sf = path.join(root, 'plan', 'persona-scenarios.md');
  writeU(sf, '# 시나리오\n\n> 갱신: 2026-11-03 11:00 (status.js 시험)\n\n## A. 고르는 사람\n\n### 01 하나 — 아침\n'
    + '1. 목록을 연다 ✅ (F01-01), 정렬은 아직 🔜 (F03-01)\n'
    + '2. 목록을 본다 ✅ (F01-02) / 정렬한다 🔜 (F03-01)\n');
  const s = run(['plan'], root);
  check('일부만 세기 (조각 기준)', s.status === 0 && s.stdout.includes('- 시나리오: 단계 2 · ✅ 1 · 🔜 0 · 일부만 1 · ❌ 0\n'), s.stdout + s.stderr);
  // score.js도 같은 줄을 같은 규칙으로 센다: F03의 🔜는 2단계 한 번뿐
  const sc = spawnSync(process.execPath, [scoreScript, sf], { encoding: 'utf8' });
  check('score.js와 같은 수', sc.status === 0 && /\| 1 \| F03-01 \| 1 \| 1 \|/.test(sc.stdout), sc.stdout + sc.stderr);
}

// 5) git 시각: 갱신 줄보다 (모든 기획 문서의 가장 늦은 갱신 + 여유) 뒤에 바뀐 문서에 경고만 붙는다
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
if (!hasGit) console.log('건너뜀: git 시각 시험 (git 없음)');
else {
  const root = copyPlan();
  const dir = path.join(root, 'plan');
  const git = (args, date) => spawnSync('git', ['-C', dir, '-c', 'user.name=test', '-c', 'user.email=test@example.com',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], {
    encoding: 'utf8',
    env: date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env,
  });
  git(['init', '-q']);
  git(['add', '.']);
  // 흐름 끝에 한꺼번에 커밋(가장 늦은 갱신 12:10보다 20분 뒤) → 헛경고 없음
  const c1 = git(['commit', '-q', '-m', 'plan'], '2026-11-03T12:30:00');
  const g1 = run(['plan'], root);
  check('git: 흐름 끝 커밋은 경고 없음', c1.status === 0 && norm(g1.stdout) === want, c1.stderr + g1.stdout + g1.stderr);

  // 이틀 뒤 시나리오를 손으로 고쳐 커밋, 로드맵은 손으로 고치고 커밋 안 함
  const sf = path.join(dir, 'persona-scenarios.md');
  writeU(sf, readU(sf) + '\n손으로 더한 줄\n');
  git(['add', 'persona-scenarios.md']);
  const c2 = git(['commit', '-q', '-m', 'hand'], '2026-11-05T09:00:00');
  const rf = path.join(dir, 'roadmap.md');
  writeU(rf, readU(rf) + '\n손으로 더한 줄\n');
  const t = new Date(2026, 10, 6, 10, 0);
  fs.utimesSync(rf, t, t);
  const g2 = run(['plan'], root);
  const out = g2.stdout;
  check('git: 손으로 고친 문서 경고', c2.status === 0
    && /\| scenarios \|.*\| 최신 · 손으로 고침\?\(갱신 줄보다 뒤에 바뀜: 2026-11-05 09:00\) \|/.test(out)
    && /\| milestones \|.*\| 낡음 · 손으로 고침\?\(갱신 줄보다 뒤에 바뀜: 2026-11-06 10:00, 커밋 안 됨\) \|/.test(out)
    && /\| personas \|.*\| 최신 \|/.test(out)
    && out.includes('- 이어 할 곳: priority'), c2.stderr + out + g2.stderr);
  const g3 = run(['plan', '--no-git'], root);
  check('git: --no-git이면 경고 없음', norm(g3.stdout) === want, g3.stdout + g3.stderr);
}

// 6) 잘못된 입력이면 결과 없이 exit 1
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

for (const t of temps) fs.rmSync(t, { recursive: true, force: true });
if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
