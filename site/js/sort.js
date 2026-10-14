// ---------- 推し診断の勝ち抜き木（4択で好きな1体を選ぶ） ----------
// 葉に並べた子を4体ずつ戦わせて1位を決め、1位を抜いて同じ枝だけ選び直すと2位が決まる（以下 target 位まで）
// functions/api/vote.js も同じ処理で選択の履歴を再生し、本当にこの並びから決まった Top5 かを確かめる
export const GROUP = 4;
export const TOP_N = 5;
const OPEN = "?"; // まだ勝者が決まっていない節

export function createSort(ids, target = TOP_N) {
  let size = 1, depth = 0;
  while (size < ids.length) { size *= GROUP; depth++; }
  const offset = (size - 1) / (GROUP - 1);
  const tree = Array(offset + size).fill(OPEN, 0, offset).fill(null, offset);
  const leaf = new Map();
  // 葉の組（GROUP 枠ずつ）には、なるべく3体以上をならして入れる。前から詰めると最後の組が2体だけになり、それが1問目に出てしまう
  // 1問目は後ろの組から出るので、多い組を後ろに置き、使う組は木全体に散らす
  const width = Math.min(GROUP, size);
  const groups = size / width;
  const used = Math.max(Math.ceil(ids.length / width), Math.min(groups, Math.floor(ids.length / 3)));
  const base = Math.floor(ids.length / used), extra = ids.length % used;
  for (let u = 0, k = 0; u < used; u++) {
    const count = base + (u >= used - extra ? 1 : 0);
    const g = Math.floor((u * groups) / used);
    for (let j = 0; j < count; j++) {
      const i = offset + g * width + j;
      tree[i] = ids[k++];
      leaf.set(tree[i], i);
    }
  }
  const s = { depth, offset, tree, leaf, top: [], target: Math.min(target, ids.length), node: -1, group: null, picks: 0 };
  advance(s);
  return s;
}

// 次に選んでもらう組（s.group）を決める。決まった順位は s.top に入り、終わったら s.group は null
function advance(s) {
  s.group = null;
  while (s.top.length < s.target) {
    // 子の番号が親より大きいので、後ろから見れば子は先に決まっている
    for (let i = s.offset - 1; i >= 0; i--) {
      if (s.tree[i] !== OPEN) continue;
      const live = s.tree.slice(i * GROUP + 1, i * GROUP + 1 + GROUP).filter((x) => x !== null);
      if (live.length < 2) { s.tree[i] = live[0] ?? null; continue; }
      s.node = i;
      s.group = live;
      return;
    }
    const winner = s.tree[0];
    if (winner === null) return;
    s.top.push(winner);
    // 1位を葉から外し、根までの節を選び直しにする
    let i = s.leaf.get(winner);
    s.tree[i] = null;
    while (i > 0) { i = Math.floor((i - 1) / GROUP); s.tree[i] = OPEN; }
  }
}

export function pick(s, id) {
  if (!s.group?.includes(id)) throw new Error("選べない子です");
  s.tree[s.node] = id;
  s.picks++;
  advance(s);
  return s;
}

// 選んだ子の履歴から途中の状態を作り直す。履歴が木と合わなければ例外
export function replay(ids, history, target = TOP_N) {
  const s = createSort(ids, target);
  for (const id of history) pick(s, id);
  return s;
}

// 選ぶ回数の上限（進み具合の表示用）。1位までは2体以上が勝ち上がってくる節の数、2位以降は1体ごとに最大で木の深さ分
export function maxPicks(n, target = TOP_N) {
  const s = createSort(Array.from({ length: n }, (_, i) => String(i)), target);
  const filled = s.tree.map((x) => x !== null);
  let picks = 0;
  for (let i = s.offset - 1; i >= 0; i--) {
    const kids = filled.slice(i * GROUP + 1, i * GROUP + 1 + GROUP).filter(Boolean).length;
    filled[i] = kids > 0;
    if (kids >= 2) picks++;
  }
  return picks + Math.max(0, s.target - 1) * s.depth;
}
