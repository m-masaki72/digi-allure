import { state, navSeq, loadRanking, loadMonthly, publicRanking } from "../state.js";
import { app, esc, art, meta, monthLabel, detailHref, lineageHref, lineageGroups, cardHTML, creditOf } from "../ui.js";
import { MY_MIN_VOTES, myVoteCount } from "../mine.js";

const RANK_N = 5;
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
  const n = myVoteCount((id) => state.byId.has(id));
  return `<section class="hero">
    <a class="hero-art" href="${detailHref(hero)}">${art(hero)}</a>
    <div class="hero-body">
      <div class="hero-label">${isTop ? `${esc(monthLabel(monthly.current))}の人気投票 現在1位` : "今日の一体"}</div>
      <div class="hero-name">${esc(hero.name)}</div>
      <div class="meta">${meta(hero)}</div>
      <p class="catch">天使か、魔王か。選ぶのはテイマーのあなた。</p>
      <p>「どっちが好み？」を${MY_MIN_VOTES}問えらぶだけで、<b>あなたの推しTop5</b>がわかります。</p>
      <div class="actions">
        <a class="btn primary" href="#/vote">推し診断をはじめる（${MY_MIN_VOTES}問）</a>
        ${n >= MY_MIN_VOTES ? '<a class="btn" href="#/my">前回の診断結果を見る</a>' : '<a class="btn" href="#/list">図鑑を見る</a>'}
      </div>
    </div>
  </section>`;
}

function rankHTML(rows) {
  if (!rows.length) return '<p class="empty">まだ投票がありません。最初の1票をどうぞ！</p>';
  return `<ol class="ranklist">${rows.slice(0, RANK_N).map((r) => {
    const d = state.byId.get(r.id);
    const credit = creditOf(d);
    return `<li><a href="${detailHref(d)}"><span class="pos">${r.rank}</span>${art(d)}<span class="name">${esc(d.name)}</span><span class="sub">${r.wins}勝 / ${r.matches}戦</span>${credit ? `<span class="credit-line">${esc(credit)}</span>` : ""}</a></li>`;
  }).join("")}</ol>`;
}

// 今日の一体（hero に出ていなければ先頭）と、対戦数が少ない子を優先して出す（ランキングの偏りを減らす）
function pickupHTML(ranking, hero) {
  const today = todaysPick();
  const head = today === hero ? [] : [miniCard(today, "今日の一体")];
  const pool = shuffle(state.list.filter((d) => d !== today && d !== hero))
    .sort((a, b) => (ranking?.get(a.id)?.matches ?? 0) - (ranking?.get(b.id)?.matches ?? 0));
  return `<div class="grid">${head.join("")}${pool.slice(0, PICKUP_N - head.length).map((d) => miniCard(d)).join("")}</div>`;
}

// 系統の顔は通算レートが一番高い子。票がなければ図鑑No.が一番大きい子（後半の世代ほど女性型が多い）
function representative(list, ranking) {
  const score = (d) => [ranking?.get(d.id)?.matches ? ranking.get(d.id).elo : -Infinity, d.no ?? -Infinity];
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
    const hero = rows.length ? state.byId.get(rows[0].id) : todaysPick();
    app.innerHTML = `
      ${heroHTML(hero, rows.length > 0, monthly)}
      <section>
        <h2>${monthly ? `${esc(monthLabel(monthly.current))}の人気投票` : "人気投票"}</h2>
        ${monthly ? rankHTML(rows) : '<p class="empty">ランキングを読み込めませんでした</p>'}
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
