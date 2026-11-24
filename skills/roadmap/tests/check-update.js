#!/usr/bin/env node
// check-update.js 시험: 네트워크 없이 임시 폴더의 로컬 git 저장소에 태그를 달고 --remote로 가리킨다.
// 사용: node tests/check-update.js
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const script = path.join(__dirname, '..', 'scripts', 'check-update.js');
let failed = 0;
const temps = [];
const tmp = (name) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `check-update-${name}-`)); temps.push(d); return d; };

function check(name, ok, detail) {
  console.log(`${ok ? '통과' : '실패'}: ${name}`);
  if (!ok) { failed++; if (detail) console.log(detail); }
}
const run = (args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const show = (r) => `status ${r.status}\n--- stdout\n${r.stdout}--- stderr\n${r.stderr}`;
const silent = (r) => r.status === 0 && r.stdout === '' && r.stderr === '';
const line = (latest, mine) => `claude-haejo ${latest}이 나왔어요(지금 ${mine}). "claude-haejo 업데이트해줘"라고 하면 받아요. `
  + `바뀐 것: https://github.com/ff-1204/claude-haejo/releases/tag/${latest}\n`;
const says = (r, latest, mine) => r.status === 0 && r.stdout.replace(/\r\n/g, '\n') === line(latest, mine) && r.stderr === '';

// 태그를 단 로컬 저장소
function remote(tags) {
  const dir = tmp('remote');
  const git = (...args) => spawnSync('git', ['-C', dir, '-c', 'user.name=test', '-c', 'user.email=test@example.com',
    '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { encoding: 'utf8' });
  git('init', '-q');
  git('commit', '-q', '--allow-empty', '-m', 'first');
  for (const t of tags) git('tag', t);
  return dir;
}
// ~/.claude/claude-haejo.json을 둔 임시 HOME. record가 문자열이면 그대로 쓴다(깨진 JSON 시험)
function home(record) {
  const h = tmp('home');
  const dir = path.join(h, '.claude');
  fs.mkdirSync(dir);
  if (record !== undefined) {
    const text = typeof record === 'string' ? record : JSON.stringify(record, null, 2);
    fs.writeFileSync(path.join(dir, 'claude-haejo.json'), text, 'utf8');
  }
  return h;
}
const installed = (version) => ({ version, commit: 'abc1234', ahead: 0, repo: '/x/claude-haejo', installedAt: '2026-11-01T00:00:00Z' });
const cacheOf = (h) => path.join(h, '.claude', 'claude-haejo-update.json');

// 잘못된 옵션은 git과 상관없이 본다
{
  const r = run(['--nope']);
  check('모르는 옵션', r.status === 1 && r.stdout === '' && r.stderr.includes('오류') && r.stderr.includes('--nope'), show(r));
  const r2 = run(['--home']);
  check('값 없는 --home', r2.status === 1 && r2.stdout === '' && r2.stderr.includes('오류'), show(r2));
}

// 설치 기록이 없으면 원격을 보지 않고 조용히 끝난다
{
  const h = home();
  const r = run(['--home', h, '--remote', path.join(h, 'nowhere')]);
  check('설치 기록 없음', silent(r) && !fs.existsSync(cacheOf(h)), show(r));
  const n = run(['--home', home(installed(null)), '--remote', path.join(h, 'nowhere')]);
  check('version: null', silent(n), show(n));
  const b = run(['--home', home('{ "version": "v1.3.0", '), '--remote', path.join(h, 'nowhere')]);
  check('깨진 JSON', silent(b), show(b));
}

const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
if (!hasGit) console.log('건너뜀: 원격 태그 시험 (git 없음)');
else {
  const r14 = remote(['v1.2.0', 'v1.3.0', 'v1.4.0', 'v2.0', 'release-9', 'v9.9.9-beta']);
  const r110 = remote(['v1.9.0', 'v1.10.0', 'v1.2.0']);

  // 새 버전 있음 → 한 줄, 캐시에 적힘
  const h = home(installed('v1.3.0'));
  const a = run(['--home', h, '--remote', r14]);
  check('새 버전 있음 → 한 줄', says(a, 'v1.4.0', 'v1.3.0'), show(a));
  let cache = null;
  try { cache = JSON.parse(fs.readFileSync(cacheOf(h), 'utf8')); } catch { /* 아래에서 실패 */ }
  check('캐시 기록', cache && cache.latest === 'v1.4.0' && Date.now() - Date.parse(cache.checkedAt) < 60000, JSON.stringify(cache));

  // 24시간 안이면 원격이 바뀌어도 캐시 값을 쓴다, --force면 다시 확인한다
  const c = run(['--home', h, '--remote', r110]);
  check('24시간 캐시 사용', says(c, 'v1.4.0', 'v1.3.0'), show(c));
  const f = run(['--home', h, '--remote', r110, '--force']);
  check('--force는 캐시 무시', says(f, 'v1.10.0', 'v1.3.0'), show(f));
  // 하루 넘은 캐시는 다시 확인한다
  fs.writeFileSync(cacheOf(h), JSON.stringify({ checkedAt: new Date(Date.now() - 2 * 86400000).toISOString(), latest: 'v1.4.0' }));
  const s = run(['--home', h, '--remote', r110]);
  check('낡은 캐시는 다시 확인', says(s, 'v1.10.0', 'v1.3.0'), show(s));

  const same = run(['--home', home(installed('v1.4.0')), '--remote', r14]);
  check('같은 버전 → 출력 없음', silent(same), show(same));
  const newer = run(['--home', home(installed('v2.1.0')), '--remote', r14]);
  check('설치본이 더 큼 → 출력 없음', silent(newer), show(newer));
  const num = run(['--home', home(installed('v1.9.0')), '--remote', r110]);
  check('v1.10.0 > v1.9.0 (숫자로 비교)', says(num, 'v1.10.0', 'v1.9.0'), show(num));

  // 닿지 않는 원격 → 출력 없음, 캐시도 쓰지 않는다
  const hu = home(installed('v1.3.0'));
  const u = run(['--home', hu, '--remote', path.join(hu, 'no-such-repo')]);
  check('닿지 않는 원격 → 출력 없음·exit 0', silent(u) && !fs.existsSync(cacheOf(hu)), show(u));
  // 깨진 캐시는 없는 것으로 본다
  fs.writeFileSync(cacheOf(hu), 'not json');
  const bc = run(['--home', hu, '--remote', r14]);
  check('깨진 캐시는 다시 확인', says(bc, 'v1.4.0', 'v1.3.0'), show(bc));
}

for (const t of temps) fs.rmSync(t, { recursive: true, force: true });
if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log('\n모두 통과');
