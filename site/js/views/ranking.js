import { api } from "../api.js";
import { SCOPE, state, navSeq, withRank, setRanking } from "../state.js";
import { app, esc, monthLabel, detailHref } from "../ui.js";

// ---------- ランキング ----------
// arg: 省略=今月の人気投票 / "all"=通算 / "YYYY-MM"=過去の月
export async function viewRanking(arg) {
  const seq = navSeq;
  const isAll = arg === "all";
  const month = isAll ? null : /^\d{4}-\d{2}$/.test(arg ?? "") ? arg : null;
  app.innerHTML = '<h1>人気ランキング</h1><p class="loading">集計中…</p>';
  let data;
  try {
    data = await api(isAll ? `/api/ranking?scope=${SCOPE}` : `/api/ranking?month=${month ?? "current"}`);
  } catch (e) {
    if (seq === navSeq) app.innerHTML = `<h1>人気ランキング</h1><p class="error">${esc(e.message)}</p>`;
    return;
  }
  if (isAll) setRanking(data.ranking);
  else if (!month) state.monthly = data;
  if (seq !== navSeq) return;
  const rows = withRank(data.ranking).filter((r) => state.byId.has(r.id));
  const total = rows.reduce((s, r) => s + r.matches, 0) / 2;
  const shown = isAll ? "all" : data.month;
  const tabs = [[data.current, `${monthLabel(data.current)}（開催中）`], ["all", "通算"],
    ...data.months.filter((m) => m !== data.current).map((m) => [m, `${monthLabel(m)}（確定）`])];
  const lead = isAll
    ? `サイト開設からの推し診断の票をすべて集計した通算ランキングです（累計 ${Math.round(total)} 票）。`
    : data.final
      ? `${monthLabel(data.month)}の人気投票の確定結果です（${Math.round(total)} 票）。`
      : `${monthLabel(data.month)}の人気投票を開催中です。毎月1日（日本時間）にリセットされ、月末の順位がその月の結果になります（現在 ${Math.round(total)} 票）。`;
  app.innerHTML = `
    <h1>人気ランキング</h1>
    <div class="tabs">${tabs.map(([k, label]) => `<a class="tab${k === shown ? " on" : ""}" href="#/ranking/${k === data.current ? "" : k}">${esc(label)}</a>`).join("")}</div>
    <p class="lead">${lead}対戦数が少ないうちは順位が大きく動きます。</p>
    ${rows.length ? "" : '<p class="empty">まだ投票がありません。最初の1票をどうぞ！</p>'}
    <table class="rank"${rows.length ? "" : " hidden"}>
      <thead><tr><th>順位</th><th>デジモン</th><th>世代・タイプ</th><th class="num">対戦</th><th class="num">勝率</th></tr></thead>
      <tbody>${rows.map((r) => {
        const d = state.byId.get(r.id);
        return `<tr class="${r.rank <= 3 ? "top" : ""}">
          <td>${r.rank}</td>
          <td><a href="${detailHref(d)}">${esc(d.name)}</a></td>
          <td>${esc(d.level)}・${esc(d.type)}</td>
          <td class="num">${r.matches}</td>
          <td class="num">${r.matches ? Math.round((r.wins / r.matches) * 100) + "%" : "—"}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>
    <div class="actions"><a class="btn primary" href="#/vote">推し診断で投票する</a></div>`;
}
