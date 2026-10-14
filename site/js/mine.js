import { replay } from "./sort.js";

// ---------- あなたのTop5（推し診断の結果と途中経過） ----------
// どちらもこの端末の localStorage にだけ置く（サーバーには個人の履歴を持たない）
const RESULT_KEY = "digi-allure:my-top";
const PROGRESS_KEY = "digi-allure:sort";

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // プライベートモードなどで保存できなくても診断自体は続けられる
  }
}

// 前回の診断結果 { top, at, vote }。top は knows(id) が true の子（いまも公開中の子）だけを順に残す。なければ null
// vote はランキングへの投票の結果 { ok: true } | { ok: false, message }（古い結果にはない）
export function myResult(knows) {
  const v = load(RESULT_KEY);
  const top = Array.isArray(v?.top) ? v.top.filter((id) => typeof id === "string" && knows(id)) : [];
  return top.length ? { top, at: typeof v.at === "string" ? v.at : null, vote: v.vote ?? null } : null;
}
export const myTop = (knows) => myResult(knows)?.top ?? [];
export const saveMyTop = (top, vote) => save(RESULT_KEY, { top, at: new Date().toISOString(), vote });
export const clearMyTop = () => save(RESULT_KEY, null);

// 途中経過 { scope, ids, exp, token, history }（GET /api/sort の並びと、それまでに選んだ子）
// 通信できずに端末で並べたときは token が null で、結果はランキングに入らない
function sortProgress() {
  const v = load(PROGRESS_KEY);
  return v && Array.isArray(v.ids) && Array.isArray(v.history) ? v : null;
}
export const saveSortProgress = (p) => save(PROGRESS_KEY, p);

// 続きから再開できる途中経過 { p, s, expired }。1問以上答えていて、全員がいまも公開中で、履歴が並びと合うときだけ
// expired: 並びの有効期限が切れていて、最後まで答えても投票できない
export function resumableSort(scope, knows) {
  const p = sortProgress();
  if (!p || p.scope !== scope || !p.history.length || !p.ids.every(knows)) return null;
  try {
    const s = replay(p.ids, p.history);
    return s.group ? { p, s, expired: !!p.token && !(p.exp > Date.now()) } : null;
  } catch {
    return null;
  }
}
