import { SCOPE, state, navSeq, loadRanking, loadMonthly, publicRanking } from "../state.js";
import { app, esc, art, meta, monthLabel, detailHref, lineageHref, lineageGroups, cardHTML, creditOf } from "../ui.js";
import { myTop, resumableSort } from "../mine.js";
import { GROUP, TOP_N, maxPicks } from "../sort.js";

const RANK_N = 5;
const FEW_VOTES = 10; // 今月の投票（診断の回数）がこれ未満ならランキングより投票の呼びかけを前に出す
const PICKUP_N = 4;

// 日本時間の日付ごとに決まる「今日の一体」
function todaysPick() {
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return state.list[h % state.list.length];
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const miniCard = (d, label = "") => cardHTML(d,
  `${label ? `<div class="no">${esc(label)}</div>` : ""}<div class="name">${esc(d.name)}</div><div class="meta">${esc(d.lineage)}</div>`);

// hero: 今月1位（いなければ今日の一体）
function heroHTML(hero, isTop, monthly) {
  const knows = (id) => state.byId.has(id);
  const hasResult = myTop(knows).length > 0;
  const resuming = !!resumableSort(SCOPE, knows);
  return `<section class="hero">
    <a class="hero-art" href="${detailHref(hero)}">${art(hero)}</a>
    <div class="hero-body">
      <div class="hero-label">${isTop ? `${esc(monthLabel(monthly.current))}の人気投票 現在1位` : "今日の一体"}</div>
      <div class="hero-name">${esc(hero.name)}</div>
      <div class="meta">${meta(hero)}</div>
      <p class="catch">天使か、魔王か。選ぶのはテイマーのあなた。</p>
      <p>${GROUP}体から好みの1体を選んでいくだけで、<b>あなたの推しTop${TOP_N}</b>が決まります（最大${maxPicks(state.list.length)}問・2〜3分）。</p>
      <div class="actions">
        <a class="btn primary" href="#/vote">${resuming ? "推し診断の続きから" : "推し診断をはじめる"}</a>
        ${hasResult ? '<a class="btn" href="#/my">前回の診断結果を見る</a>' : '<a class="btn" href="#/list">図鑑を見る</a>'}
      </div>
    </div>
  </section>`;
}

// 目的別の入口（推しを知る／好みの系統から探す／みんなの人気を見る）
const ENTRIES = [
  ["#/vote", "推し診断", `${GROUP}択で絞り込んで、あなたの推しTop${TOP_N}を決めます`, true],
  ["#/types", "系統から探す", "天使・魔王・妖精…好みの系統や雰囲気から探せます"],
  ["#/ranking", "人気ランキング", "今月いちばん推されているのはだれ？"],
];
const entriesHTML = () => `<nav class="entries" aria-label="目的から選ぶ">${ENTRIES.map(([href, title, text, main]) =>
  `<a class="entry${main ? " main" : ""}" href="${href}"><span class="name">${title}</span><span class="sub">${text}</span></a>`).join("")}</nav>`;

// 票が少ないうちの順位はあてにならないので、上位3体だけ小さく出して投票を呼びかける
function rankSectionHTML(rows, votes) {
  if (votes >= FEW_VOTES) return rankHTML(rows, RANK_N);
  return `<div class="cta-card">
    <p><b>今月の人気投票は始まったばかり</b>（いま ${votes} 人分）。推し診断で決まったTop${TOP_N}が、そのまま票になります。</p>
    <a class="btn primary" href="#/vote">推し診断で投票する</a>
  </div>${rows.length ? rankHTML(rows, 3) : ""}`;
}

function rankHTML(rows, n) {
  return `<ol class="ranklist">${rows.slice(0, n).map((r) => {
    const d = state.byId.get(r.id);
    const credit = creditOf(d);
    return `<li><a href="${detailHref(d)}"><span class="pos">${r.rank}</span>${art(d)}<span class="name">${esc(d.name)}</span><span class="sub">${r.points}点</span>${credit ? `<span class="credit-line">${esc(credit)}</span>` : ""}</a></li>`;
  }).join("")}</ol>`;
}

// 今日の一体（hero に出ていなければ先頭）と、Top5 入りが少ない子を優先して出す（ランキングの偏りを減らす）
function pickupHTML(ranking, hero) {
  const today = todaysPick();
  const head = today === hero ? [] : [miniCard(today, "今日の一体")];
  const pool = shuffle(state.list.filter((d) => d !== today && d !== hero))
    .sort((a, b) => (ranking?.get(a.id)?.entries ?? 0) - (ranking?.get(b.id)?.entries ?? 0));
  return `<div class="grid">${head.join("")}${pool.slice(0, PICKUP_N - head.length).map((d) => miniCard(d)).join("")}</div>`;
}

// 系統の顔は通算の得点が一番高い子。票がなければ図鑑No.が一番大きい子（後半の世代ほど女性型が多い）
function representative(list, ranking) {
  const score = (d) => [ranking?.get(d.id)?.points ?? -Infinity, d.no ?? -Infinity];
  return list.reduce((best, d) => {
    const [a, b] = [score(d), score(best)];
    return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) ? d : best;
  });
}

function lineageHTML(ranking) {
  return `<div class="lineages">${lineageGroups().map(([name, list]) => `<a class="lineage" href="${lineageHref(name)}">
    ${art(representative(list, ranking))}<span class="name">${esc(name)}</span><span class="sub">${list.length}体</span></a>`).join("")}</div>`;
}

// ---------- トップ ----------
export async function viewHome() {
  const seq = navSeq;
  if (!state.list.length) {
    app.innerHTML = '<p class="empty">いま掲載しているデジモンはいません。</p>'; // 固定文言
    return;
  }
  const render = (monthly, ranking) => {
    const rows = publicRanking(monthly);
    const votes = monthly?.votes ?? 0;
    const isTop = rows.length > 0 && votes >= FEW_VOTES;
    const hero = isTop ? state.byId.get(rows[0].id) : todaysPick();
    app.innerHTML = `
      ${heroHTML(hero, isTop, monthly)}
      ${entriesHTML()}
      <section>
        <h2>${monthly ? `${esc(monthLabel(monthly.current))}の人気投票` : "人気投票"}</h2>
        ${monthly ? rankSectionHTML(rows, votes) : '<p class="empty">ランキングを読み込めませんでした</p>'}
        <div class="more"><a href="#/ranking">ランキングをすべて見る →</a></div>
      </section>
      <section>
        <h2>ピックアップ</h2>
        <p class="lead">今日の一体と、まだ票が少ない子たちです。</p>
        ${pickupHTML(ranking, hero)}
      </section>
      <section>
        <h2>系統から探す</h2>
        ${lineageHTML(ranking)}
        <div class="more"><a href="#/types">公式タイプ・ファンタグからも探す →</a></div>
      </section>
      <section>
        <h2>図鑑</h2>
        <p class="lead">管理人が「魅惑枠」に選んだデジモン ${state.list.length} 体を掲載しています。</p>
        <div class="actions"><a class="btn primary" href="#/list">図鑑を見る（全 ${state.list.length} 体）</a></div>
      </section>`;
  };
  if (!state.monthly || !state.ranking) app.innerHTML = '<p class="loading">読み込み中…</p>'; // 固定文言
  const [monthly, ranking] = await Promise.all([loadMonthly().catch(() => null), loadRanking().catch(() => null)]);
  if (seq === navSeq) render(monthly, ranking);
}
