// 시나리오 단계 줄을 읽는 공통 규칙. score.js와 status.js가 같이 쓴다(규칙은 여기 한 곳만 고친다).
'use strict';

// F01-02-03, D05-12-01, I20-10 같은 체크리스트 번호
const REF = /\b([A-Z]{1,3}\d{2}(?:-\d{2})+)/g;
const refsIn = (s) => [...s.matchAll(REF)].map((m) => m[1]);

// 시나리오 단계 표시: 🔜 계획됨 · ✅ 지금 됨 · ❌ 계획에 없음 (references/rules.md "번호와 표시")
const MARKS = ['🔜', '✅', '❌'];

// 한 단계 줄을 " / "로 나눠 조각마다 { seg, mark }를 낸다.
// 조각에 든 표시를 MARKS 순서로 모아 마지막 것을 그 조각의 표시로 본다. 표시가 없으면 mark는 null.
// 조각이 하나뿐이면(" / " 없음) 줄 전체의 표시를 본다. 그래서 " / " 없이 ✅와 🔜가 같이 있는 줄은 ✅ 한 표시다.
function splitPieces(line) {
  const segs = line.split(' / ');
  return segs.map((seg) => {
    const own = MARKS.filter((m) => (segs.length === 1 ? line : seg).includes(m));
    return { seg, mark: own.length ? own[own.length - 1] : null };
  });
}

module.exports = { MARKS, refsIn, splitPieces };
