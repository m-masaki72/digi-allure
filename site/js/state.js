import { api } from "./api.js";

export const SCOPE = "time-stranger";

export const state = {
  list: [],
  byId: new Map(),
  tags: null,      // { tags: [...], counts: [...] } API が使えないときは null
  ranking: null,   // Map(id -> { rank, elo, matches, wins }) 通算
  monthly: null,   // 今月の人気投票（バナー用）
  candidates: null, // 未掲載デジモン（リクエスト用）
  filters: { q: "", levels: new Set(), type: "", tag: "", sort: "no" },
};
// import 側からは代入できない（読み取りはライブバインディングで常に最新値）ので、進めるのは beginNav() だけ
export let navSeq = 0;
export const beginNav = () => ++navSeq;

export function tagCounts(id) {
  if (!state.tags) return [];
  const label = new Map(state.tags.tags.map((t) => [t.id, t.label]));
  return state.tags.counts
    .filter((c) => c.id === id)
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ ...c, label: label.get(c.tag_id) }));
}

export async function loadRanking(force = false) {
  if (state.ranking && !force) return state.ranking;
  const data = await api(`/api/ranking?scope=${SCOPE}`);
  state.ranking = new Map(data.ranking.map((r, i) => [r.id, { ...r, rank: i + 1 }]));
  return state.ranking;
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
