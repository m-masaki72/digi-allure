import { api } from "./api.js";

export const SCOPE = "time-stranger";

export const state = {
  list: [],
  byId: new Map(),
  tags: null,      // { tags: [...], counts: [...] } API が使えないときは null
  ranking: null,   // Map(id -> { rank, points, firsts, entries }) 通算
  monthly: null,   // 今月の人気投票（バナー用）
  candidates: null, // 未掲載デジモン（リクエスト用）
  filters: { q: "", levels: new Set(), lineage: "", type: "", tag: "", sort: "no" },
};
// import 側からは代入できない（読み取りはライブバインディングで常に最新値）ので、進めるのは beginNav() だけ
export let navSeq = 0;
export const beginNav = () => ++navSeq;

// 一覧はカードごとに引くので、state.tags が差し替わったときだけ作り直す
let tagIndex = { src: null, labels: new Map(), byId: new Map() };
function indexTags() {
  if (tagIndex.src === state.tags) return tagIndex;
  const labels = new Map((state.tags?.tags ?? []).map((t) => [t.id, t.label]));
  const byId = new Map();
  for (const c of [...(state.tags?.counts ?? [])].sort((a, b) => b.n - a.n)) {
    if (!byId.has(c.id)) byId.set(c.id, []);
    byId.get(c.id).push({ ...c, label: labels.get(c.tag_id) });
  }
  return (tagIndex = { src: state.tags, labels, byId });
}
export const tagLabels = () => indexTags().labels;
export const tagCounts = (id) => indexTags().byId.get(id) ?? [];

export const withRank = (ranking) => ranking.map((r, i) => ({ ...r, rank: i + 1 }));
// 月間ランキングのうち公開中の子だけ（API は得点0の子を返さない）
export const publicRanking = (monthly) => withRank(monthly?.ranking ?? []).filter((r) => state.byId.has(r.id));
export const setRanking = (ranking) => (state.ranking = new Map(withRank(ranking).map((r) => [r.id, r])));

export async function loadRanking(force = false) {
  if (state.ranking && !force) return state.ranking;
  const data = await api(`/api/ranking?scope=${SCOPE}`);
  return setRanking(data.ranking);
}
export async function loadMonthly() {
  if (!state.monthly) state.monthly = await api("/api/ranking?month=current");
  return state.monthly;
}
export async function loadTags(force = false) {
  if (state.tags && !force) return state.tags;
  state.tags = await api("/api/tags");
  return state.tags;
}
