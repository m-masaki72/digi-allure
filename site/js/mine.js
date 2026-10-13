// ---------- あなたのTop5（自分の投票だけで作る個人ランキング） ----------
// 投票の記録はこの端末の localStorage にだけ置く（サーバーには個人の履歴を持たない）
const KEY = "digi-allure:my-votes";
const MAX_VOTES = 2000;
const K = 32;
export const MY_MIN_VOTES = 10;
export const TOP_N = 5;

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string") : [];
  } catch {
    return [];
  }
}

// 両方とも knows(id) が true の票だけ数える（非公開になった子・ID が変わった子の票は Top5 に使えないため）
export const myVoteCount = (knows, votes = read()) => votes.filter(([w, l]) => knows(w) && knows(l)).length;

// 記録後の全票を返す（呼び出し側で myVoteCount に渡して読み直しを省く）
export function recordMyVote(winner, loser) {
  const votes = read();
  votes.push([winner, loser]);
  const kept = votes.slice(-MAX_VOTES);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // プライベートモードなどで保存できなくても投票自体は済んでいる
  }
  return kept;
}

export function clearMyVotes() {
  try { localStorage.removeItem(KEY); } catch { /* 何もしない */ }
}

// 自分の票を古い順に Elo で積み上げる。knows(id) が false の個体（非公開になった子）は除く
export function myRanking(knows) {
  const r = new Map();
  const get = (id) => r.get(id) ?? r.set(id, { id, elo: 1500, matches: 0, wins: 0 }).get(id);
  let votes = 0;
  for (const [w, l] of read()) {
    if (!knows(w) || !knows(l)) continue;
    const a = get(w), b = get(l);
    const delta = K * (1 - 1 / (1 + 10 ** ((b.elo - a.elo) / 400)));
    a.elo += delta; b.elo -= delta;
    a.matches++; b.matches++; a.wins++;
    votes++;
  }
  return { votes, rows: [...r.values()].sort((x, y) => y.elo - x.elo || y.wins - x.wins) };
}
