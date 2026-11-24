#!/usr/bin/env node
// claude-haejo 새 버전 안내: 설치 기록(~/.claude/claude-haejo.json)의 버전과 GitHub의 최신 태그를 비교해
// 새 버전이 있으면 한 줄만 낸다. 받거나 설치하지는 않는다(안내만).
// 사용: node check-update.js [--force] [--home <폴더>] [--remote <주소나 로컬 저장소 경로>]
//   --force   캐시(~/.claude/claude-haejo-update.json: 성공 24시간, 실패 1시간)를 무시하고 다시 확인한다
//   --home    ~ 대신 쓸 폴더 (시험용)
//   --remote  태그를 읽을 원격 (시험용, 기본은 GitHub 저장소)
// 오프라인·git 없음·시간 초과·깨진 기록 같은 실패는 모두 조용히 넘어가고 exit 0이다. 스킬 흐름을 막지 않는다.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_REMOTE = 'https://github.com/ff-1204/claude-haejo.git';
const RELEASES = 'https://github.com/ff-1204/claude-haejo/releases/tag/';
const DAY_MS = 24 * 60 * 60 * 1000;
const FAIL_MS = 60 * 60 * 1000; // 확인에 실패하면 1시간은 다시 묻지 않는다(오프라인에서 매번 기다리지 않게)
const TIMEOUT_MS = 5000;
const VERSION = /^v(\d+)\.(\d+)\.(\d+)$/;

function fail(msg) {
  console.error(`오류: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { home: null, remote: DEFAULT_REMOTE, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') opts.force = true;
    else if (a === '--home' || a === '--remote') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) fail(`${a} 뒤에 값이 없어요`);
      opts[a.slice(2)] = v;
    } else fail(`모르는 옵션이에요: ${a} (--force, --home, --remote)`);
  }
  return opts;
}

// "v1.10.0" → [1, 10, 0], 꼴이 다르면 null
function parse(v) {
  const m = typeof v === 'string' && VERSION.exec(v);
  return m ? m.slice(1).map(Number) : null;
}
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// 원격의 vX.Y.Z 태그 중 가장 큰 것. 못 읽으면 null
function latestFromRemote(remote) {
  const r = spawnSync('git', ['ls-remote', '--tags', '--refs', remote], {
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (r.error || r.status !== 0 || typeof r.stdout !== 'string') return null;
  let best = null;
  for (const line of r.stdout.split(/\r?\n/)) {
    const tag = line.split('\t')[1];
    if (!tag || !tag.startsWith('refs/tags/')) continue;
    const name = tag.slice('refs/tags/'.length);
    const v = parse(name);
    if (v && (!best || compare(v, best.v) > 0)) best = { name, v };
  }
  return best && best.name;
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));

function main(opts) {
  const dir = path.join(opts.home || os.homedir(), '.claude');
  let installed;
  try {
    installed = readJson(path.join(dir, 'claude-haejo.json'));
  } catch {
    return; // 설치 기록이 없거나 깨짐
  }
  const mine = installed && parse(installed.version);
  if (!mine) return; // version이 null이거나 꼴이 다름

  // 캐시: { checkedAt, latest } 마지막 성공, failedAt 마지막 실패. --force면 시각을 보지 않고 다시 묻는다
  const cacheFile = path.join(dir, 'claude-haejo-update.json');
  let cache = {};
  try {
    const c = readJson(cacheFile);
    if (c && typeof c === 'object') cache = c;
  } catch { /* 캐시 없음이나 깨짐 */ }
  const fresh = (at, ms) => { const age = Date.now() - Date.parse(at); return age >= 0 && age < ms; };
  const known = parse(cache.latest) ? cache.latest : null; // 지난번에 성공한 값
  const save = (obj) => {
    try { fs.writeFileSync(cacheFile, JSON.stringify(obj, null, 2) + '\n', 'utf8'); } catch { /* 못 써도 안내는 한다 */ }
  };

  let latest = null;
  if (!opts.force && known && fresh(cache.checkedAt, DAY_MS)) latest = known;
  else if (!opts.force && fresh(cache.failedAt, FAIL_MS)) latest = known; // 실패 뒤 1시간은 묻지 않는다
  else {
    latest = latestFromRemote(opts.remote);
    if (latest) save({ checkedAt: new Date().toISOString(), latest });
    else {
      // 오프라인, git 없음, 시간 초과, 태그 없음: 실패 시각을 적고 지난번 값으로 비교한다
      save({ checkedAt: cache.checkedAt || null, latest: known, failedAt: new Date().toISOString() });
      latest = known;
    }
  }
  if (!latest) return;

  if (compare(parse(latest), mine) > 0) {
    console.log(`claude-haejo ${latest}이 나왔어요(지금 ${installed.version}). "claude-haejo 업데이트해줘"라고 하면 받아요. 바뀐 것: ${RELEASES}${latest}`);
  }
}

const opts = parseArgs(process.argv.slice(2));
try {
  main(opts);
} catch {
  // 어떤 실패도 스킬 흐름을 막지 않는다
}
process.exit(0);
