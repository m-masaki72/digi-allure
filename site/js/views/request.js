import { api } from "../api.js";
import { state, navSeq } from "../state.js";
import { app, esc, toast } from "../ui.js";

// ---------- 掲載リクエスト ----------
export async function viewRequest() {
  const seq = navSeq;
  if (!state.candidates) {
    state.candidates = await fetch("/data/candidates.json").then((r) => r.json());
    if (seq !== navSeq) return;
  }
  const byName = new Map(state.candidates.map((c) => [c.name, c]));
  app.innerHTML = `
    <h1>掲載リクエスト</h1>
    <p class="lead">「この子もお色気枠では？」というデジモンを推薦してください。管理人が参考にして掲載を検討します（タイムストレンジャー登場デジモンのみ）。</p>
    <form class="request-form" id="reqform">
      <label for="reqname">デジモン</label>
      <input id="reqname" list="reqlist" placeholder="名前を入力して候補から選択" autocomplete="off" required>
      <datalist id="reqlist">${state.candidates.map((c) => `<option value="${esc(c.name)}">${esc(c.level)}</option>`).join("")}</datalist>
      <label for="reqcomment">推しポイント（任意・200文字まで。管理人だけが読みます）</label>
      <textarea id="reqcomment" maxlength="200" rows="3"></textarea>
      <div><button class="btn primary" type="submit">リクエストする</button></div>
    </form>
    <h2>リクエストの多いデジモン</h2>
    <div id="reqtop"><p class="loading">読み込み中…</p></div>`;

  async function renderTop() {
    const box = document.getElementById("reqtop");
    try {
      const { requests } = await api("/api/requests");
      if (seq !== navSeq) return;
      box.innerHTML = requests.length
        ? `<table class="rank"><thead><tr><th>順位</th><th>デジモン</th><th>世代</th><th class="num">リクエスト</th></tr></thead><tbody>${requests
            .map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.level)}</td><td class="num">${r.n}</td></tr>`)
            .join("")}</tbody></table>`
        : '<p class="empty">まだリクエストはありません。</p>';
    } catch (e) {
      box.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    }
  }

  document.getElementById("reqform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("reqname").value.trim();
    const target = byName.get(name);
    if (!target) {
      toast(state.list.some((d) => d.name === name) ? "そのデジモンはすでに掲載されています" : "候補の中から選んでください", true);
      return;
    }
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await api("/api/requests", { method: "POST", body: JSON.stringify({ id: target.id, comment: document.getElementById("reqcomment").value }) });
      toast(`${target.name} をリクエストしました`);
      e.target.reset();
      renderTop();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
  renderTop();
}
