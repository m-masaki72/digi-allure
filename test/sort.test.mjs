import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUP, createSort, pick, replay, maxPicks } from "../site/js/sort.js";

const idsOf = (n) => Array.from({ length: n }, (_, i) => `d${i}`);

// 好みの順（score が小さいほど好き）で選び続ける
function run(ids, score) {
  const s = createSort(ids);
  const history = [];
  while (s.group) {
    assert.ok(s.group.length >= 2 && s.group.length <= GROUP);
    const best = [...s.group].sort((a, b) => score(a) - score(b))[0];
    pick(s, best);
    history.push(best);
  }
  return { s, history };
}

test("一貫した好みで選べば、好きな順の上位5体がその順で決まる", () => {
  for (const n of [2, 3, 5, 6, 16, 17, 58, 64, 65]) {
    const ids = idsOf(n);
    const score = (id) => (Number(id.slice(1)) * 37) % n; // 並び順と好みをずらす
    const { s } = run(ids, score);
    const expect = [...ids].sort((a, b) => score(a) - score(b)).slice(0, Math.min(5, n));
    assert.deepEqual(s.top, expect, `n=${n}`);
    assert.ok(s.picks <= maxPicks(n), `n=${n}: ${s.picks} > ${maxPicks(n)}`);
  }
});

test("maxPicks: 58体なら33回まで", () => {
  // 葉は4体の組10個と3体の組6個 → 1位まで 16 + 4 + 1 回、2〜5位は1体ごとに最大3回
  assert.equal(maxPicks(58), 33);
  assert.ok(maxPicks(2) >= 1);
});

test("createSort: 余りは葉の組に散らし、2体だけの組を作らない", () => {
  for (const n of [3, 5, 6, 7, 10, 17, 30, 58, 65, 100]) {
    const s = createSort(idsOf(n));
    assert.ok(s.group.length >= 3, `n=${n}: 1問目が${s.group.length}択`);
    if (n === 5) continue; // 5体は 3 + 2 に分けるしかない
    const leaves = s.tree.slice(s.offset);
    for (let g = 0; g < leaves.length; g += GROUP) {
      const count = leaves.slice(g, g + GROUP).filter((x) => x !== null).length;
      assert.ok(count === 0 || count >= 3, `n=${n}: ${count}体の組`);
    }
  }
});

test("replay: 履歴から同じ状態を作り直せる", () => {
  const ids = idsOf(30);
  const { s, history } = run(ids, (id) => -Number(id.slice(1)));
  for (let k = 0; k <= history.length; k++) {
    const r = replay(ids, history.slice(0, k));
    assert.equal(r.picks, k);
    if (k === history.length) assert.deepEqual(r.top, s.top);
    else assert.ok(r.group.includes(history[k]));
  }
});

test("pick / replay: いま出ていない子は選べない", () => {
  const ids = idsOf(16);
  const s = createSort(ids);
  const outside = ids.find((id) => !s.group.includes(id));
  assert.throws(() => pick(s, outside));
  assert.throws(() => replay(ids, [outside]));
});
