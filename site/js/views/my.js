import { SCOPE, state } from "../state.js";
import { app, esc, art, meta, cardHTML, detailHref, toast, creditOf } from "../ui.js";
import { myResult, clearMyTop, resumableSort } from "../mine.js";
import { GROUP, TOP_N, maxPicks } from "../sort.js";

const SITE_URL = "https://digi-allure.pages.dev/";
const knows = (id) => state.byId.has(id);
const quizSize = () => `${GROUP}択・最大${maxPicks(state.list.length)}問・2〜3分`;

function podiumHTML(list, start = 1) {
  return `<ol class="podium${start > 1 ? " rest" : ""}">${list.map((d, i) => `<li>${cardHTML(d, `<div class="no">${i + start}位</div><div class="name">${esc(d.name)}</div>`)}</li>`).join("")}</ol>`;
}

function shareURL(top) {
  const url = `${SITE_URL}#/top5/${top.map((d) => encodeURIComponent(d.id)).join(",")}`;
  const text = `わたしの推し魅惑デジモンTop${top.length}\n${top.map((d, i) => `${i + 1}. ${d.name}`).join("\n")}\n#デジアリュール`;
  return { url, intent: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` };
}

const dateLabel = (iso) => {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 9 * 3600e3);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

function voteHTML(vote) {
  if (!vote) return "";
  return vote.ok
    ? `<p class="vote-status ok">このTop${TOP_N}は今月の人気投票に入りました（1位10点・2位5点・3位3点・4位2点・5位1点）。</p>`
    : `<p class="vote-status">${esc(vote.message)}</p>`;
}

// スクリーンショットでそのままシェアできるよう、題・順位・サイト名を1枚に収める
// 2位以下の画像は小さく出典ラベルが収まらないので、カードの下にまとめて出す
function resultCardHTML(top, at) {
  const [first, ...rest] = top;
  const credits = [...new Set(rest.map(creditOf).filter(Boolean))];
  return `<section class="result-card">
    <div class="rc-head"><span class="rc-title">わたしの推し魅惑デジモン Top${top.length}</span><span class="rc-date">${esc(dateLabel(at))}</span></div>
    <a class="rc-first" href="${detailHref(first)}">${art(first)}<div class="rc-first-body"><div class="rc-rank">1位</div><div class="rc-name">${esc(first.name)}</div><div class="meta">${meta(first)}</div></div></a>
    ${rest.length ? `<ol class="rc-rest">${rest.map((d, i) => `<li><a href="${detailHref(d)}">${art(d)}<span class="rc-rank">${i + 2}位</span><span class="rc-name">${esc(d.name)}</span></a></li>`).join("")}</ol>` : ""}
    ${credits.length ? `<div class="rc-credit">${credits.map(esc).join("／")}</div>` : ""}
    <div class="rc-foot"><b>デジアリュール</b> 選ばれし魅惑のデジモン図鑑<span>digi-allure.pages.dev</span></div>
  </section>`;
}

// ---------- あなたのTop5 ----------
export function viewMy() {
  document.title = "推し診断の結果 — デジアリュール";
  const result = myResult(knows);
  if (!result) {
    const resuming = !!resumableSort(SCOPE, knows);
    app.innerHTML = `
      <h1>推し診断の結果</h1>
      <p class="lead">${GROUP}体から1体を選ぶのをくり返して、あなただけの推しTop${TOP_N}を決めます（${quizSize()}）。結果はこの端末のブラウザにだけ保存されます。</p>
      <div class="actions"><a class="btn primary" href="#/vote">${resuming ? "推し診断の続きから" : "推し診断をはじめる"}</a></div>`;
    return;
  }
  const top = result.top.map((id) => state.byId.get(id));
  const share = shareURL(top);
  app.innerHTML = `
    <h1>推し診断の結果</h1>
    ${resultCardHTML(top, result.at)}
    <div class="actions result-actions">
      <a class="btn primary" href="${esc(share.intent)}" target="_blank" rel="noopener">結果を X でシェア</a>
      <button class="btn" id="copy">リンクをコピー</button>
    </div>
    ${voteHTML(result.vote)}
    <div class="actions result-actions">
      <a class="btn" href="#/vote">もう一度診断する</a>
      <a class="btn" href="#/ranking">みんなのランキングを見る</a>
    </div>
    <p class="lead small">この結果はこの端末のブラウザだけに保存されています。<button class="linkish" id="reset">結果を消す</button></p>`;
  document.getElementById("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      toast("リンクをコピーしました");
    } catch {
      toast("コピーできませんでした", true);
    }
  });
  document.getElementById("reset").addEventListener("click", () => {
    if (!confirm("あなたのTop5の結果を消します。よろしいですか？（ランキングへの投票は消えません）")) return;
    clearMyTop();
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
    <h1>だれかの推しTop${top.length}</h1>
    <p class="lead">推し診断で選ばれた、だれかの推し魅惑デジモンです。</p>
    ${podiumHTML(top)}
    <div class="actions"><a class="btn primary" href="#/vote">あなたも推し診断する</a><a class="btn" href="#/">トップへ</a></div>
    <p class="lead small">推し診断は${quizSize()}。直感で選ぶだけで、あなたの推しTop${TOP_N}が決まります。</p>`
    : '<p class="empty">このTop5は表示できません。<a href="#/vote">推し診断をする</a></p>';
}
