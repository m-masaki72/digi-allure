import { state } from "../state.js";
import { app, esc, art, meta, cardHTML, detailHref, toast } from "../ui.js";
import { MY_MIN_VOTES, TOP_N, myRanking, clearMyVotes } from "../mine.js";

const SITE_URL = "https://digi-allure.pages.dev/";

function podiumHTML(list, start = 1) {
  return `<ol class="podium${start > 1 ? " rest" : ""}">${list.map((d, i) => `<li>${cardHTML(d, `<div class="no">${i + start}位</div><div class="name">${esc(d.name)}</div>`)}</li>`).join("")}</ol>`;
}

function shareURL(top) {
  const url = `${SITE_URL}#/top5/${top.map((d) => encodeURIComponent(d.id)).join(",")}`;
  const text = `わたしの推し魅惑デジモンTop5\n${top.map((d, i) => `${i + 1}. ${d.name}`).join("\n")}\n#デジアリュール`;
  return { url, intent: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` };
}

// ---------- あなたのTop5 ----------
export function viewMy() {
  document.title = "推し診断の結果 — デジアリュール";
  const { votes: n, rows: ranked } = myRanking((id) => state.byId.has(id));
  if (n < MY_MIN_VOTES) {
    app.innerHTML = `
      <h1>推し診断の結果</h1>
      <p class="lead">推し診断（2択 ${MY_MIN_VOTES}問）でえらんだ結果から、あなただけの推しTop5を作ります。記録はこの端末のブラウザにだけ保存されます。</p>
      <p class="progress">あと <b>${MY_MIN_VOTES - n}</b> 問で結果が出ます（いま ${n} 問）</p>
      <div class="actions"><a class="btn primary" href="#/vote">推し診断をはじめる</a></div>`;
    return;
  }
  const rows = ranked.map((r) => ({ ...r, d: state.byId.get(r.id) }));
  const top = rows.slice(0, TOP_N).map((r) => r.d);
  const share = shareURL(top);
  const [first, ...rest] = top;
  app.innerHTML = `
    <section class="hero result">
      <a class="hero-art" href="${detailHref(first)}">${art(first)}</a>
      <div class="hero-body">
        <div class="hero-label">推し診断の結果</div>
        <p class="result-lead">あなたの推しNo.1は…</p>
        <div class="hero-name">${esc(first.name)}</div>
        <div class="meta">${meta(first)}</div>
        <div class="actions">
          <a class="btn primary" href="${esc(share.intent)}" target="_blank" rel="noopener">結果を X でシェア</a>
          <button class="btn" id="copy">リンクをコピー</button>
        </div>
      </div>
    </section>
    <h2>2位〜${TOP_N}位</h2>
    ${podiumHTML(rest, 2)}
    <p class="lead">あなたの ${n} 票から作った推しランキングです。診断を重ねるほど順位が正確になります。</p>
    <div class="actions">
      <a class="btn primary" href="#/vote">もう${MY_MIN_VOTES}問 診断する</a>
      <a class="btn" href="${detailHref(first)}">${esc(first.name)} をくわしく見る</a>
    </div>
    <h2>あなたの全順位</h2>
    <table class="rank">
      <thead><tr><th>順位</th><th>デジモン</th><th class="num">対戦</th><th class="num">勝ち</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr class="${i < 3 ? "top" : ""}">
        <td>${i + 1}</td><td><a href="${detailHref(r.d)}">${esc(r.d.name)}</a></td>
        <td class="num">${r.matches}</td><td class="num">${r.wins}</td></tr>`).join("")}</tbody>
    </table>
    <p class="lead small">この記録はこの端末のブラウザだけに保存されています。<button class="linkish" id="reset">記録を消す</button></p>`;
  document.getElementById("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      toast("リンクをコピーしました");
    } catch {
      toast("コピーできませんでした", true);
    }
  });
  document.getElementById("reset").addEventListener("click", () => {
    if (!confirm("あなたのTop5の記録を消します。よろしいですか？（ランキングへの投票は消えません）")) return;
    clearMyVotes();
    viewMy();
  });
}

// ---------- シェアされたTop5 ----------
export function viewSharedTop(arg) {
  const decode = (s) => { try { return decodeURIComponent(s); } catch { return ""; } };
  const top = [...new Set((arg ?? "").split(",").map(decode))]
    .map((id) => state.byId.get(id)).filter(Boolean).slice(0, TOP_N);
  document.title = "推しTop5 — デジアリュール";
  app.innerHTML = top.length ? `
    <h1>だれかの推しTop5</h1>
    <p class="lead">推し診断でえらばれた、だれかの推し魅惑デジモンです。</p>
    ${podiumHTML(top)}
    <div class="actions"><a class="btn primary" href="#/vote">あなたも推し診断する</a><a class="btn" href="#/">トップへ</a></div>`
    : '<p class="empty">このTop5は表示できません。<a href="#/vote">推し診断をする</a></p>';
}
