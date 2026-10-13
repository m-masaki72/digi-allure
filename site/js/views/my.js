import { state } from "../state.js";
import { app, esc, cardHTML, detailHref, toast } from "../ui.js";
import { MY_MIN_VOTES, TOP_N, myRanking, clearMyVotes } from "../mine.js";

const SITE_URL = "https://digi-allure.pages.dev/";

function podiumHTML(list) {
  return `<ol class="podium">${list.map((d, i) => `<li>${cardHTML(d, `<div class="no">${i + 1}位</div><div class="name">${esc(d.name)}</div>`)}</li>`).join("")}</ol>`;
}

function shareURL(top) {
  const url = `${SITE_URL}#/top5/${top.map((d) => encodeURIComponent(d.id)).join(",")}`;
  const text = `わたしの推しお色気デジモンTop5\n${top.map((d, i) => `${i + 1}. ${d.name}`).join("\n")}\n#デジアリュール`;
  return { url, intent: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` };
}

// ---------- あなたのTop5 ----------
export function viewMy() {
  document.title = "あなたのTop5 — デジアリュール";
  const { votes: n, rows: ranked } = myRanking((id) => state.byId.has(id));
  if (n < MY_MIN_VOTES) {
    app.innerHTML = `
      <h1>あなたのTop5</h1>
      <p class="lead">2択投票でえらんだ結果から、あなただけの推しランキングを作ります。投票の記録はこの端末のブラウザにだけ保存されます。</p>
      <p class="progress">あと <b>${MY_MIN_VOTES - n}</b> 票で Top5 が出ます（いま ${n} 票）</p>
      <div class="actions"><a class="btn primary" href="#/vote">2択投票をはじめる</a></div>`;
    return;
  }
  const rows = ranked.map((r) => ({ ...r, d: state.byId.get(r.id) }));
  const top = rows.slice(0, TOP_N).map((r) => r.d);
  const share = shareURL(top);
  app.innerHTML = `
    <h1>あなたのTop5</h1>
    <p class="lead">あなたの ${n} 票から作った推しランキングです。投票するほど順位が正確になります。</p>
    ${podiumHTML(top)}
    <div class="actions">
      <a class="btn primary" href="${esc(share.intent)}" target="_blank" rel="noopener">X でシェア</a>
      <button class="btn" id="copy">リンクをコピー</button>
      <a class="btn" href="#/vote">続けて投票する</a>
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
    <p class="lead">2択投票でえらばれた、だれかの推しお色気デジモンです。</p>
    ${podiumHTML(top)}
    <div class="actions"><a class="btn primary" href="#/vote">あなたのTop5も作る</a><a class="btn" href="#/">トップへ</a></div>`
    : '<p class="empty">このTop5は表示できません。<a href="#/vote">あなたのTop5を作る</a></p>';
}
