import { api } from "../api.js";
import { SCOPE, state, navSeq } from "../state.js";
import { app, esc, art, meta, toast } from "../ui.js";
import { GROUP, TOP_N, createSort, replay, pick, maxPicks } from "../sort.js";
import { saveMyTop, resumableSort, saveSortProgress } from "../mine.js";

// ---------- 推し診断（4択の勝ち抜きで Top5 を決める） ----------
let voteKeyHandler = null;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function stopVoteKeys() {
  if (voteKeyHandler) {
    document.removeEventListener("keydown", voteKeyHandler);
    voteKeyHandler = null;
  }
}

// 次に出うる組の画像を先に読んでおく（どれを選んでも次の4体がすぐ出るように）
function preload(p, s) {
  for (const id of s.group) {
    const next = replay(p.ids, [...p.history, id]).group ?? [];
    for (const n of next) {
      const url = state.byId.get(n)?.image_url;
      if (url) new Image().src = url;
    }
  }
}

export async function viewVote() {
  const seq = navSeq;
  document.title = "推し診断 — デジアリュール";
  app.innerHTML = `
    <h1 class="vote-title">推し診断：いちばん好みは？</h1>
    <p class="lead vote-lead">直感で1体を選ぶだけ。最後にあなたの推しTop${TOP_N}が決まります。<span class="pc-only">キーボードは 1〜${GROUP} で選択。</span></p>
    <div class="quiz-progress"><progress id="gauge" max="1" value="0" aria-label="推し診断の進み具合"></progress><span id="count" aria-live="polite"></span></div>
    <p id="notice" class="notice" hidden></p>
    <div id="group"><p class="loading">候補を用意しています…</p></div>
    <div class="vote-foot">
      <button id="undo" disabled>1つ戻る</button><button id="restart">最初からやり直す</button>
      <p class="lead small">途中でやめても、この端末なら24時間以内は続きから再開できます。最後に決まったTop${TOP_N}は、みんなの人気ランキングに票として入ります（1位10点・2位5点・3位3点・4位2点・5位1点）。</p>
    </div>`;
  const notice = (text) => {
    const el = document.getElementById("notice");
    el.textContent = text;
    el.hidden = !text;
  };

  const knows = (id) => state.byId.has(id);
  let cur = resumableSort(SCOPE, knows);
  if (cur) {
    toast("前回の続きから再開しました");
    if (cur.expired) notice("前回の診断から24時間がたったため、この診断の結果はランキングに入りません。投票もしたいときは「最初からやり直す」を押してください。");
    else if (!cur.p.token) notice("この診断は通信できないときに始めたため、結果はランキングに入りません。");
  } else {
    let p;
    try {
      p = { ...(await api(`/api/sort?scope=${SCOPE}`)), history: [] };
    } catch {
      // 並びを配れないとき（通信エラー・プレビュー環境など）も、診断だけは端末で並べて遊べるようにする
      p = { scope: SCOPE, ids: shuffle(state.list.map((d) => d.id)), exp: 0, token: null, history: [] };
      notice("サーバーに接続できないため、今回の結果はランキングに入りません（診断はそのまま遊べます）。");
    }
    if (seq !== navSeq) return;
    if (p.ids.length < 2) {
      document.getElementById("group").innerHTML = '<p class="empty">推し診断できるデジモンがまだいません</p>';
      return;
    }
    cur = { p, s: createSort(p.ids) };
    saveSortProgress(p);
  }
  const { p } = cur;
  let { s } = cur;
  const total = maxPicks(p.ids.length);
  let busy = false;

  const choiceHTML = (d, i) => `<button class="choice" data-id="${esc(d.id)}" aria-label="${i + 1}番: ${esc(d.name)}（${esc(d.level)}・${esc(d.attribute)}・${esc(d.type)}）"><span class="key pc-only" aria-hidden="true">${i + 1}</span>${art(d)}<div class="body"><div class="name">${esc(d.name)}</div><div class="meta">${meta(d)}</div></div></button>`;

  function render(focus = false) {
    const stage = s.top.length ? `${s.top.length + 1}位決定戦` : "1位を決めています";
    document.getElementById("gauge").value = s.picks / total;
    document.getElementById("count").textContent = `Q.${s.picks + 1} / 最大${total}問・${stage}`;
    document.getElementById("undo").disabled = !p.history.length;
    const group = s.group.map((id) => state.byId.get(id));
    const box = document.getElementById("group");
    box.innerHTML = group.every(Boolean)
      ? `<div class="vote n${group.length}">${group.map(choiceHTML).join("")}</div>`
      : '<p class="error">表示できない子が含まれています。最初からやり直してください</p>';
    if (focus) box.querySelector(".choice")?.focus({ preventScroll: true });
    preload(p, s);
  }

  // 診断を終えたら1回だけ投票する。結果画面で投票できたかを伝えるため、ここで待つ
  async function submit() {
    if (!p.token) return { ok: false, message: "通信できないときに始めた診断のため、ランキングには入りませんでした" };
    try {
      await api("/api/vote", { method: "POST", body: JSON.stringify({ scope: p.scope, ids: p.ids, exp: p.exp, token: p.token, history: p.history }) });
      state.ranking = null;
      state.monthly = null;
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  async function choose(id, byKey) {
    if (busy || !s.group?.includes(id) || seq !== navSeq) return;
    busy = true;
    document.querySelector(".vote")?.classList.add("decided");
    document.querySelectorAll(".choice").forEach((b) => { b.disabled = true; b.classList.toggle("win", b.dataset.id === id); });
    const decided = s.top.length;
    pick(s, id);
    p.history.push(id);
    saveSortProgress(p);
    await new Promise((r) => setTimeout(r, 300));
    if (seq !== navSeq) return;
    if (!s.group) {
      document.getElementById("group").innerHTML = '<p class="loading">結果を集計しています…</p>';
      const vote = await submit();
      saveSortProgress(null);
      saveMyTop(s.top, vote);
      if (seq !== navSeq) return;
      toast("診断完了！結果を発表します");
      location.hash = "#/my";
      return;
    }
    if (s.top.length > decided) toast(`${s.top.length}位が決まりました！（発表は最後に）続いて${s.top.length + 1}位を選びます`);
    render(byKey);
    busy = false;
  }

  document.getElementById("group").addEventListener("click", (e) => {
    const b = e.target.closest(".choice");
    if (b) choose(b.dataset.id, e.detail === 0); // detail 0 はキーボード（Enter・Space）での押下
  });
  document.getElementById("undo").addEventListener("click", (e) => {
    if (busy || !p.history.length) return;
    p.history.pop();
    s = replay(p.ids, p.history);
    saveSortProgress(p);
    render(e.detail === 0);
  });
  document.getElementById("restart").addEventListener("click", () => {
    if (busy || !confirm("ここまでの選択を消して、最初からやり直しますか？")) return;
    saveSortProgress(null);
    stopVoteKeys();
    viewVote();
  });
  voteKeyHandler = (e) => {
    if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.repeat) return;
    if (e.target.closest?.("input, select, textarea, [contenteditable]")) return;
    const i = Number(e.key) - 1;
    if (Number.isInteger(i) && s.group?.[i]) choose(s.group[i], true);
  };
  document.addEventListener("keydown", voteKeyHandler);
  render();
}
