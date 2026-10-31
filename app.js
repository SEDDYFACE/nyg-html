(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const app = document.getElementById("app");
  const navEl = document.getElementById("nav");
  const toastEl = document.getElementById("toast");
  const bellEl = document.getElementById("bell");

  /* ======================================================
   * 小さなユーティリティ
   * （画面はすべて DOM API で組み立てるので、ユーザー入力が HTML として解釈されることはありません）
   * ==================================================== */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className = "show" + (isError ? " error" : "");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (toastEl.className = ""), 3500);
  }

  function fmtDate(s) {
    return new Date(s).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
  }

  function friendly(err) {
    const m = (err && err.message) || String(err);
    if (/Invalid login credentials/i.test(m)) return "ユーザー名またはパスワードが違います。";
    if (/Email not confirmed/i.test(m)) return "メールアドレスの確認が完了していません。届いたメールのリンクを開いてください。";
    if (/rate limit|too many/i.test(m)) return "短時間に操作が多すぎます。しばらくしてからやり直してください。";
    if (/row-level security/i.test(m)) return "この操作を行う権限がありません。";
    if (/duplicate key/i.test(m)) return "既に使われています。";
    if (/file too large/i.test(m)) return "500KBを超えるコードは、管理者の承認が必要です（残り回数がありません）。";
    if (/already pending/i.test(m)) return "すでに要請を送信済みです。管理者の承認をお待ちください。";
    if (/already decided/i.test(m)) return "この要請は、すでに回答済みです。";
    if (/admin only/i.test(m)) return "管理者だけが行える操作です。";
    if (/already requested/i.test(m)) return "すでに公開を要請済みです。作成者の対応をお待ちください。";
    if (/already public/i.test(m)) return "この投稿は、すでに閲覧できる状態です。";
    if (/cannot delete yourself/i.test(m)) return "自分自身のアカウントは削除できません。";
    if (/cannot delete admin/i.test(m)) return "管理者アカウントは削除できません。";
    return m;
  }

  function field(label, input, hint) {
    return h("label", { class: "field" },
      h("span", { class: "label" }, label), input,
      hint ? h("small", { class: "hint" }, hint) : null);
  }

  async function busy(btn, fn) {
    btn.disabled = true;
    try { await fn(); }
    catch (e) { console.error(e); toast(friendly(e), true); }
    finally { btn.disabled = false; }
  }

  function go(hash) { location.hash = hash; }

  /* ======================================================
   * 設定チェック & Supabase
   * ==================================================== */
  if (!cfg.SUPABASE_URL || /YOUR-/.test(cfg.SUPABASE_URL) || !cfg.SUPABASE_ANON_KEY || /YOUR-/.test(cfg.SUPABASE_ANON_KEY)) {
    app.replaceChildren(h("div", { class: "card" },
      h("h2", {}, "初期設定が必要です"),
      h("p", {}, "config.js に Supabase の URL と anon key を設定してください。（手順は README.md を参照）")));
    return;
  }

  const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { flowType: "pkce" }
  });
  const BASE_URL = location.origin + location.pathname;
  const NORMAL_MAX = 500000;    // 一般ユーザーの上限（文字数）
  const BIG_MAX = 2000000;      // 管理者・承認済みユーザーの上限（文字数）
  let bigQuota = 0;             // 承認された大容量投稿の残り回数

  let session = null;
  let profile = null;
  let isAdmin = false;     // 管理者か（データベース側の admins 表で決まる）
  let lastUserId;          // undefined = 未初期化
  let renderToken = 0;

  async function loadProfile() {
    profile = null;
    isAdmin = false;
    if (!session) return;
    const { data } = await sb.from("profiles").select("id,username").eq("id", session.user.id).maybeSingle();
    profile = data;
    // 管理者かどうかの確認（画面の出し分け用。実際の権限はデータベース側で強制される）
    const { data: adm } = await sb.rpc("is_admin");
    isAdmin = adm === true;
    await refreshQuota();
  }

  async function refreshQuota() {
    bigQuota = 0;
    if (!session) return;
    const { data } = await sb.from("upload_quota").select("remaining").eq("user_id", session.user.id).maybeSingle();
    bigQuota = data ? data.remaining : 0;
  }

  sb.auth.onAuthStateChange((event, s) => {
    session = s;
    // コールバック内で直接 await しない（supabase-js の推奨）
    setTimeout(async () => {
      const uid = s && s.user ? s.user.id : null;
      if (event === "PASSWORD_RECOVERY") {
        lastUserId = uid;
        await loadProfile();
        renderNav();
        if (location.hash !== "#/reset") go("#/reset"); else route();
        return;
      }
      if (event === "INITIAL_SESSION" || uid !== lastUserId) {
        lastUserId = uid;
        await loadProfile();
        renderNav();
        route();
      }
    }, 0);
  });

  function renderNav() {
    navEl.replaceChildren();
    if (session) {
      // append(null) は「null」という文字が入ってしまうので、使わない要素は配列から除く
      navEl.append(...[
        h("span", { class: "who" }, profile ? `@${profile.username}` : "", isAdmin ? h("span", { class: "badge open", style: "margin-left:.4rem" }, "管理者") : null),
        isAdmin ? h("a", { class: "btn small", href: "#/admin" }, "👤 ユーザー管理") : null,
        h("a", { class: "btn small primary", href: "#/new-project" }, "＋ 企画を作る"),
        h("button", {
          class: "btn small", type: "button",
          onclick: async () => { await sb.auth.signOut(); toast("ログアウトしました"); go("#/"); }
        }, "ログアウト")].filter(Boolean));
    } else {
      navEl.append(
        h("a", { class: "btn small", href: "#/login" }, "ログイン"),
        h("a", { class: "btn small primary", href: "#/signup" }, "新規登録"));
    }
  }

  /* ======================================================
   * 通知（サイト左上のベル）
   * ==================================================== */
  let notifs = [];
  let bellOpen = false;
  let pendingScroll = null;   // 通知から開いたとき、スクロールして見せるコメントのID

  async function loadNotifs() {
    if (!session) { notifs = []; bellOpen = false; renderBell(); return; }
    const { data, error } = await sb.from("notifications")
      .select("id,type,created_at,read_at,project_id,comment_id,request_id,post_id,actor_id,actor:profiles!actor_id(username),project:projects(title),post:posts(title),comment:comments(body),request:big_upload_requests(status,granted,note)")
      .order("created_at", { ascending: false }).limit(30);
    if (error) console.error(error);
    notifs = error ? [] : data;
    if (notifs.some(n => n.type === "upload_approved" && !n.read_at)) await refreshQuota();
    renderBell();
  }

  function notifText(n) {
    const who = "@" + (n.actor ? n.actor.username : "?");
    if (n.type === "upload_request") return `${who} さんが大容量投稿（500KB超・最大2MB）を要請しています`;
    if (n.type === "upload_approved") return `大容量投稿が承認されました（最大2MBを${n.request ? n.request.granted : "?"}回まで）`;
    if (n.type === "upload_rejected") return "大容量投稿の要請は承認されませんでした";
    if (n.type === "publish_request") return `${who} さんが、あなたの投稿「${n.post ? n.post.title : ""}」の公開を要請しています`;
    return n.type === "reply"
      ? `${who} さんがあなたのコメントに返信しました`
      : `${who} さんがあなたの企画「${n.project ? n.project.title : ""}」にコメントしました`;
  }

  function renderBell() {
    bellEl.replaceChildren();
    if (!session) return;
    const unread = notifs.filter(n => !n.read_at).length;
    const btn = h("button", { class: "bell-btn", type: "button", "aria-label": "通知" + (unread ? `（未読${unread}件）` : ""), "aria-expanded": String(bellOpen) },
      "🔔", unread ? h("span", { class: "bell-count" }, unread > 99 ? "99+" : String(unread)) : null);
    btn.addEventListener("click", e => { e.stopPropagation(); bellOpen = !bellOpen; renderBell(); });
    bellEl.append(btn);
    if (!bellOpen) return;

    const panel = h("div", { class: "bell-panel" });
    panel.addEventListener("click", e => e.stopPropagation());
    const head = h("div", { class: "bell-head" }, h("strong", {}, "通知"));
    const tools = h("div", { class: "bell-tools" });
    if (unread) {
      const all = h("button", { class: "btn small", type: "button" }, "すべて既読");
      all.addEventListener("click", () => busy(all, markAllRead));
      tools.append(all);
    }
    if (notifs.some(deletable)) {
      const del = h("button", { class: "btn small danger", type: "button" }, "すべて削除");
      del.addEventListener("click", () => {
        if (!confirm("通知をすべて削除します。よろしいですか？（回答待ちの大容量投稿の要請は残ります）")) return;
        busy(del, deleteAllNotifs);
      });
      tools.append(del);
    }
    head.append(tools);
    panel.append(head);
    if (!notifs.length) panel.append(h("p", { class: "muted bell-empty" }, "通知はまだありません。"));
    notifs.forEach(n => {
      let content;
      if (n.type === "upload_request") content = requestItem(n);
      else if (n.type === "publish_request") content = publishItem(n);
      else {
        content = h("button", { class: "bell-item" + (n.read_at ? "" : " unread"), type: "button" },
          h("div", { class: "t" }, notifText(n)),
          n.comment ? h("div", { class: "ex" }, n.comment.body) : null,
          h("div", { class: "d" }, fmtDate(n.created_at)));
        content.addEventListener("click", () => openNotif(n));
      }
      const row = h("div", { class: "bell-row" }, content);
      if (deletable(n)) {
        const x = h("button", { class: "bell-x", type: "button", title: "この通知を削除", "aria-label": "この通知を削除" }, "×");
        x.addEventListener("click", () => busy(x, () => deleteNotif(n)));
        row.append(x);
      }
      panel.append(row);
    });
    panel.append(h("p", { class: "muted bell-foot" }, "通知は1週間で自動的に削除されます。"));
    bellEl.append(panel);
  }

  // 回答待ちの大容量投稿の要請は、回答するまで削除できない
  function deletable(n) {
    return !(n.type === "upload_request" && n.request && n.request.status === "pending");
  }

  async function deleteNotif(n) {
    const { error } = await sb.from("notifications").delete().eq("id", n.id);
    if (error) throw error;
    notifs = notifs.filter(x => x.id !== n.id);
    renderBell();
  }

  async function deleteAllNotifs() {
    const ids = notifs.filter(deletable).map(n => n.id);
    if (!ids.length) return;
    const { error } = await sb.from("notifications").delete().in("id", ids);
    if (error) throw error;
    notifs = notifs.filter(n => !ids.includes(n.id));
    renderBell();
    toast("通知を削除しました");
  }

  // 投稿者向け：「公開を要請」された通知（要請した人に閲覧を許可する / 投稿を開く）
  function publishItem(n) {
    const who = n.actor ? n.actor.username : "?";
    const box = h("div", { class: "bell-item req" + (n.read_at ? "" : " unread") },
      h("div", { class: "t" }, notifText(n)),
      h("div", { class: "d" }, fmtDate(n.created_at)));
    const allow = h("button", { class: "btn small primary", type: "button" }, `@${who} に閲覧を許可`);
    allow.addEventListener("click", () => busy(allow, async () => {
      const { error } = await sb.from("post_viewers").insert({ post_id: n.post_id, user_id: n.actor_id });
      if (error && !/duplicate key/i.test(error.message)) throw error;
      markRead(n);
      toast(`@${who} に閲覧を許可しました`);
      renderBell();
    }));
    const open = h("button", { class: "btn small", type: "button" }, "投稿を開く");
    open.addEventListener("click", () => { markRead(n); bellOpen = false; renderBell(); go(`#/post/${n.post_id}`); });
    box.append(h("div", { class: "bell-req-actions" }, allow, open));
    return box;
  }

  function markRead(n) {
    if (n.read_at) return;
    n.read_at = new Date().toISOString();
    sb.from("notifications").update({ read_at: n.read_at }).eq("id", n.id).then(r => { if (r.error) console.error(r.error); });
  }

  // 管理者向け：大容量投稿の要請（承認する回数を決める / 却下する）
  function requestItem(n) {
    const r = n.request;
    const box = h("div", { class: "bell-item req" + (n.read_at ? "" : " unread") },
      h("div", { class: "t" }, notifText(n)),
      r && r.note ? h("div", { class: "ex" }, "理由：" + r.note) : null,
      h("div", { class: "d" }, fmtDate(n.created_at)));
    if (!r) return box;
    if (r.status === "pending") {
      const count = h("input", { type: "number", min: 1, max: 100, value: 1, "aria-label": "認める回数" });
      const ok = h("button", { class: "btn small primary", type: "button" }, "承認");
      const no = h("button", { class: "btn small danger", type: "button" }, "却下");
      const decide = (approve, btn) => busy(btn, async () => {
        const c = parseInt(count.value, 10);
        if (approve && !(c >= 1 && c <= 100)) throw new Error("回数は1〜100で入力してください。");
        const { error } = await sb.rpc("decide_big_upload", { p_request: n.request_id, p_count: approve ? c : 0, p_approve: approve });
        if (error) throw error;
        markRead(n);
        toast(approve ? `${c}回分を承認しました` : "却下しました");
        await loadNotifs();
      });
      ok.addEventListener("click", () => decide(true, ok));
      no.addEventListener("click", () => decide(false, no));
      box.append(h("div", { class: "bell-req-actions" }, count, "回まで", ok, no));
    } else {
      box.append(h("div", { class: "ex" }, r.status === "approved" ? `✓ 承認済み（${r.granted}回）` : "× 却下済み"));
    }
    return box;
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    const { error } = await sb.from("notifications").update({ read_at: now }).eq("user_id", session.user.id).is("read_at", null);
    if (error) throw error;
    notifs.forEach(n => { if (!n.read_at) n.read_at = now; });
    renderBell();
  }

  function openNotif(n) {
    markRead(n);
    // 大容量投稿の承認・却下の通知は、既読にするだけ（移動しない）
    if (!n.project_id) { renderBell(); return; }
    bellOpen = false;
    renderBell();
    const target = `#/project/${n.project_id}`;
    pendingScroll = n.comment_id;
    if (location.hash === target) route(); else go(target);
  }

  document.addEventListener("click", () => { if (bellOpen) { bellOpen = false; renderBell(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && bellOpen) { bellOpen = false; renderBell(); } });
  setInterval(() => { if (session && !document.hidden) loadNotifs(); }, 60000);

  /* ======================================================
   * コードの組み立て（プレビュー / ダウンロード共通）
   * ==================================================== */
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // linked=false: 1ファイルに埋め込み / linked=true: style.css, script.js を参照
  function compose(p, linked) {
    const css = p.css || "";
    const js = p.js || "";
    const styleTag = css
      ? (linked ? '<link rel="stylesheet" href="style.css">' : "<style>\n" + css.replace(/<\/style/gi, "<\\/style") + "\n</style>")
      : "";
    const scriptTag = js
      ? (linked ? '<script src="script.js"></' + "script>" : "<script>\n" + js.replace(/<\/script/gi, "<\\/script") + "\n</" + "script>")
      : "";
    const html = p.html || "";

    // HTML欄に <html> 全体を貼った場合にも対応
    if (/<html[\s>]|<!doctype/i.test(html)) {
      let out = html;
      if (styleTag) out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, () => styleTag + "\n</head>") : styleTag + "\n" + out;
      if (scriptTag) out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, () => scriptTag + "\n</body>") : out + "\n" + scriptTag;
      return out;
    }
    return "<!DOCTYPE html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
      "<title>" + escHtml(p.title || "") + "</title>\n" + styleTag + "\n</head>\n<body>\n" +
      html + "\n" + scriptTag + "\n</body>\n</html>\n";
  }

  // 投稿コードは「サンドボックス化した iframe」でだけ実行する。
  // allow-same-origin を付けないので、投稿コードからこのサイトのログイン情報等には触れない。
  function previewFrame(doc) {
    return h("iframe", {
      class: "preview",
      title: "プレビュー",
      sandbox: "allow-scripts allow-forms allow-modals",
      referrerpolicy: "no-referrer",
      srcdoc: doc
    });
  }

  function safeName(s) {
    return (String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 40)) || "post";
  }

  function download(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function downloadSingleHtml(p) {
    download(safeName(p.title) + ".html", new Blob([compose(p, false)], { type: "text/html;charset=utf-8" }));
  }

  async function downloadPostZip(p) {
    const zip = new JSZip();
    zip.file("index.html", compose(p, true));
    if (p.css) zip.file("style.css", p.css);
    if (p.js) zip.file("script.js", p.js);
    if (p.memo) zip.file("memo.txt", p.memo);
    download(safeName(p.title) + ".zip", await zip.generateAsync({ type: "blob" }));
  }

  async function downloadProjectZip(project, total) {
    // 見る権限のある投稿だけがコード付きで返ってくる（限定公開で見られない投稿は含まれない）
    const { data, error } = await sb.rpc("get_project_posts", { p_project: project.id });
    if (error) throw error;
    if (!data.length) { toast(total ? "ダウンロードできる投稿がありません（限定公開のため）" : "まだ投稿がありません", true); return; }
    const zip = new JSZip();
    data.forEach((p, i) => {
      const dir = zip.folder(String(i + 1).padStart(2, "0") + "_" + safeName(p.title));
      dir.file("index.html", compose(p, true));
      if (p.css) dir.file("style.css", p.css);
      if (p.js) dir.file("script.js", p.js);
      if (p.memo) dir.file("memo.txt", p.memo);
    });
    download(safeName(project.title) + ".zip", await zip.generateAsync({ type: "blob" }));
    if (total && data.length < total) toast(`限定公開の${total - data.length}件は、閲覧できないため含まれていません`);
  }

  /* ======================================================
   * ルーター
   * ==================================================== */
  async function route() {
    const token = ++renderToken;
    loadNotifs();   // ベルの更新（待たない）
    const seg = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
    try {
      let view;
      const [a, b, c] = seg;
      if (!a) view = await viewHome();
      else if (a === "login") view = viewLogin();
      else if (a === "signup") view = viewSignup();
      else if (a === "forgot") view = viewForgot();
      else if (a === "reset") view = viewReset();
      else if (a === "admin") view = await viewAdmin();
      else if (a === "new-project") view = viewProjectForm(null);
      else if (a === "project" && b && c === "edit") view = await viewProjectEdit(b);
      else if (a === "project" && b && c === "new") view = await viewPostNew(b);
      else if (a === "project" && b) view = await viewProject(b);
      else if (a === "post" && b && c === "edit") view = await viewPostEdit(b);
      else if (a === "post" && b) view = await viewPost(b);
      else view = h("div", { class: "card" }, h("h2", {}, "ページが見つかりません"), h("a", { href: "#/" }, "トップへ戻る"));
      if (token !== renderToken) return;
      app.replaceChildren(view);
      const target = pendingScroll && document.getElementById("c-" + pendingScroll);
      pendingScroll = null;
      if (target) { target.scrollIntoView({ block: "center" }); target.classList.add("flash"); }
      else window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      if (token !== renderToken) return;
      app.replaceChildren(h("div", { class: "error-box" }, "エラーが発生しました：" + friendly(e)));
    }
  }
  window.addEventListener("hashchange", route);

  /* ======================================================
   * 認証まわり
   * ==================================================== */
  function viewLogin() {
    if (session) { setTimeout(() => go("#/"), 0); return h("div"); }
    const u = h("input", { type: "text", autocomplete: "username", required: true, maxlength: 20 });
    const p = h("input", { type: "password", autocomplete: "current-password", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, "ログイン");
    const form = h("form", { class: "card narrow" },
      h("h1", {}, "ログイン"),
      field("ユーザー名", u), field("パスワード", p), btn,
      h("p", { class: "hint-mail" }, "📧 新規登録のあとは、確認メールのリンクを開くまでログインできません。"),
      h("p", { class: "links" }, h("a", { href: "#/forgot" }, "パスワードを忘れた方"), " ・ ", h("a", { href: "#/signup" }, "新規登録")));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const { data: email, error: e1 } = await sb.rpc("email_for_username", { p_username: u.value.trim() });
        if (e1) throw e1;
        if (!email) throw new Error("Invalid login credentials");
        const { error } = await sb.auth.signInWithPassword({ email, password: p.value });
        if (error) throw error;
        toast("ログインしました");
        go("#/");
      });
    });
    return form;
  }

  function viewSignup() {
    if (session) { setTimeout(() => go("#/"), 0); return h("div"); }
    const email = h("input", { type: "email", autocomplete: "email", required: true });
    const u = h("input", { type: "text", autocomplete: "username", required: true, maxlength: 20, pattern: "[A-Za-z0-9_]{3,20}" });
    const p1 = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: 8 });
    const p2 = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: 8 });
    const btn = h("button", { class: "btn primary", type: "submit" }, "登録して確認メールを受け取る");
    const form = h("form", { class: "card narrow" },
      h("h1", {}, "新規登録"),
      h("div", { class: "notice mail-steps" },
        h("strong", {}, "📧 メールアドレスの認証が必要です"),
        h("ol", {},
          h("li", {}, "下の項目を入力して、「登録して確認メールを受け取る」を押す"),
          h("li", {}, "届いた確認メールの中のリンクを開く（開くまでログインできません）"),
          h("li", {}, "ユーザー名とパスワードでログインする"))),
      field("メールアドレス（確認メールが届きます）", email, "実際に受け取れるアドレスを入力してください。パスワードを忘れたときの再設定にも使います（他の人には表示されません）"),
      field("ユーザー名", u, "半角英数字とアンダースコア、3〜20文字。ログイン時に使います"),
      field("パスワード", p1, "8文字以上"),
      field("パスワード（確認）", p2),
      btn,
      h("p", { class: "links" }, "アカウントをお持ちの方は ", h("a", { href: "#/login" }, "ログイン")));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const username = u.value.trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error("ユーザー名は半角英数字とアンダースコアの3〜20文字にしてください。");
        if (p1.value.length < 8) throw new Error("パスワードは8文字以上にしてください。");
        if (p1.value !== p2.value) throw new Error("パスワードが一致しません。");
        const { data: ok, error: e1 } = await sb.rpc("username_available", { p_username: username });
        if (e1) throw e1;
        if (!ok) throw new Error("そのユーザー名は既に使われています。");
        const { data, error } = await sb.auth.signUp({
          email: email.value.trim(),
          password: p1.value,
          options: { data: { username }, emailRedirectTo: BASE_URL }
        });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("このメールアドレスは既に登録されています。");
        }
        if (data.session) {
          toast("登録しました");
          go("#/");
        } else {
          const sentTo = email.value.trim();
          const resend = h("button", { class: "btn small", type: "button" }, "確認メールを再送する");
          resend.addEventListener("click", () => busy(resend, async () => {
            const { error: e2 } = await sb.auth.resend({ type: "signup", email: sentTo, options: { emailRedirectTo: BASE_URL } });
            if (e2) throw e2;
            toast("確認メールを再送しました");
          }));
          app.replaceChildren(h("div", { class: "card narrow" },
            h("h1", {}, "📧 確認メールを送信しました"),
            h("p", {}, "送信先：", h("strong", {}, sentTo)),
            h("div", { class: "notice" }, h("strong", {}, "まだ登録は完了していません。"),
              h("br"), "届いたメールの中のリンクを開いてください。リンクを開くまで、ログインできません。"),
            h("ul", { class: "mail-tips" },
              h("li", {}, "メールが届くまで、数分かかることがあります"),
              h("li", {}, "届かないときは、迷惑メールフォルダを確認してください"),
              h("li", {}, "メールアドレスを間違えたときは、もう一度新規登録からやり直してください")),
            h("div", { class: "actions" }, resend),
            h("p", { class: "links" }, "リンクを開いたあとは ", h("a", { href: "#/login" }, "ログイン画面へ"))));
        }
      });
    });
    return form;
  }

  function viewForgot() {
    const email = h("input", { type: "email", autocomplete: "email", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, "再設定メールを送る");
    const form = h("form", { class: "card narrow" },
      h("h1", {}, "パスワードの再設定"),
      h("p", { class: "muted" }, "登録したメールアドレスを入力してください。再設定用のリンクをお送りします。"),
      field("メールアドレス", email), btn,
      h("p", { class: "links" }, h("a", { href: "#/login" }, "ログインへ戻る")));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: BASE_URL });
        if (error) throw error;
        // 登録の有無は教えない
        form.replaceChildren(h("h1", {}, "送信しました"),
          h("p", {}, "登録されているメールアドレスであれば、再設定用のメールが届きます。メール内のリンクを、このブラウザで開いてください。"),
          h("p", { class: "links" }, h("a", { href: "#/login" }, "ログインへ戻る")));
      });
    });
    return form;
  }

  function viewReset() {
    if (!session) {
      return h("div", { class: "card narrow" }, h("h1", {}, "リンクが無効です"),
        h("p", {}, "再設定メールのリンクを、メールを請求したのと同じブラウザで開いてください。リンクの期限切れの場合は、もう一度メールを請求してください。"),
        h("p", { class: "links" }, h("a", { href: "#/forgot" }, "再設定メールを送る")));
    }
    const p1 = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: 8 });
    const p2 = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: 8 });
    const btn = h("button", { class: "btn primary", type: "submit" }, "パスワードを変更");
    const form = h("form", { class: "card narrow" },
      h("h1", {}, "新しいパスワード"),
      field("新しいパスワード", p1, "8文字以上"), field("新しいパスワード（確認）", p2), btn);
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        if (p1.value !== p2.value) throw new Error("パスワードが一致しません。");
        const { error } = await sb.auth.updateUser({ password: p1.value });
        if (error) throw error;
        toast("パスワードを変更しました");
        go("#/");
      });
    });
    return form;
  }

  /* ======================================================
   * 管理者：ユーザー管理（ユーザー名・メールアドレスの一覧、アカウント削除）
   * ==================================================== */
  async function viewAdmin() {
    if (!session) return needLogin("ログインが必要です。");
    if (!isAdmin) return h("div", { class: "error-box" }, "管理者だけが開けるページです。");
    const { data, error } = await sb.rpc("admin_list_users");
    if (error) throw error;
    const rows = data || [];

    const search = h("input", { type: "search", class: "search", placeholder: "ユーザー名・メールアドレスで検索…" });
    const tbody = h("tbody", {});
    const count = h("span", { class: "muted" }, "");
    const dateOnly = s => (s ? new Date(s).toLocaleDateString("ja-JP") : "—");

    function draw() {
      const q = search.value.trim().toLowerCase();
      const items = rows.filter(r => !q || (r.username + " " + r.email).toLowerCase().includes(q));
      count.textContent = `${items.length}人 / 全${rows.length}人`;
      tbody.replaceChildren();
      if (!items.length) tbody.append(h("tr", {}, h("td", { colspan: 6, class: "muted" }, "該当するユーザーがいません。")));
      items.forEach(r => {
        const self = r.user_id === session.user.id;
        let action;
        if (r.is_admin || self) {
          action = h("span", { class: "muted" }, self ? "（自分）" : "管理者");
        } else {
          action = h("button", { class: "btn small danger", type: "button" }, "削除");
          action.addEventListener("click", () => {
            const typed = prompt(
              `アカウント「${r.username}」（${r.email}）を削除します。\n` +
              `このユーザーの企画${r.project_count}件・投稿${r.post_count}件、コメント、通知もすべて削除され、元に戻せません。\n\n` +
              `実行するには、ユーザー名「${r.username}」を入力してください。`);
            if (typed === null) return;
            if (typed.trim() !== r.username) { toast("ユーザー名が一致しないため、削除しませんでした", true); return; }
            busy(action, async () => {
              const { error: e2 } = await sb.rpc("admin_delete_user", { p_user: r.user_id });
              if (e2) throw e2;
              toast(`「${r.username}」を削除しました`);
              route();
            });
          });
        }
        tbody.append(h("tr", {},
          h("td", {}, h("strong", {}, "@" + r.username), r.is_admin ? h("span", { class: "badge open", style: "margin-left:.4rem" }, "管理者") : null),
          h("td", { class: "mail" }, r.email),
          h("td", {}, dateOnly(r.created_at)),
          h("td", {}, r.email_confirmed ? h("span", { class: "badge open" }, "認証済み") : h("span", { class: "badge" }, "未認証")),
          h("td", {}, `${r.project_count} / ${r.post_count}`),
          h("td", {}, action)));
      });
    }
    search.addEventListener("input", draw);
    draw();

    return h("section", {},
      h("div", { class: "page-head" }, h("h1", {}, "👤 ユーザー管理"), count),
      h("p", { class: "notice" }, "管理者だけが見られるページです。メールアドレスは他の人には表示されません。取り扱いにご注意ください。"),
      search,
      h("div", { class: "card table-wrap" },
        h("table", { class: "table" },
          h("thead", {}, h("tr", {},
            h("th", {}, "ユーザー名"), h("th", {}, "メールアドレス"), h("th", {}, "登録日"),
            h("th", {}, "メール認証"), h("th", {}, "企画 / 投稿"), h("th", {}, "操作"))),
          tbody)));
  }

  /* ======================================================
   * 企画
   * ==================================================== */
  function openBadge(p) {
    return p.allow_others_post
      ? h("span", { class: "badge open" }, "みんなで投稿OK")
      : h("span", { class: "badge" }, "企画主のみ投稿");
  }

  function projectCard(p) {
    const count = p.posts && p.posts[0] ? p.posts[0].count : 0;
    return h("a", { class: "card project-card", href: `#/project/${p.id}` },
      h("h3", {}, p.title),
      p.description ? h("p", { class: "desc" }, p.description) : null,
      h("div", { class: "meta" },
        openBadge(p),
        h("span", {}, "企画主 @" + (p.owner ? p.owner.username : "?")),
        h("span", {}, `投稿 ${count}件`)));
  }

  async function viewHome() {
    const { data, error } = await sb.from("projects")
      .select("id,title,description,allow_others_post,created_at,owner:profiles(username),posts(count)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const search = h("input", { type: "search", class: "search", placeholder: "企画を検索…" });
    const list = h("div", { class: "grid" });
    function draw() {
      const q = search.value.trim().toLowerCase();
      const items = data.filter(p => !q || (p.title + " " + p.description).toLowerCase().includes(q));
      list.replaceChildren();
      if (!items.length) list.append(h("p", { class: "muted empty" }, data.length ? "該当する企画がありません。" : "まだ企画がありません。最初の企画を作ってみましょう！"));
      items.forEach(p => list.append(projectCard(p)));
    }
    search.addEventListener("input", draw);
    draw();

    return h("section", {},
      h("div", { class: "page-head" },
        h("h1", {}, "企画一覧"),
        session ? h("a", { class: "btn primary", href: "#/new-project" }, "＋ 企画を作る") : null),
      search, list);
  }

  function projectFormFields(project) {
    const title = h("input", { type: "text", required: true, maxlength: 60, value: project ? project.title : "" });
    const desc = h("textarea", { rows: 4, maxlength: 500, value: project ? project.description : "" });
    const allow = h("input", { type: "checkbox", checked: project ? project.allow_others_post : false });
    const allowRow = h("label", { class: "check" }, allow,
      h("span", {}, "他の人もこの企画に投稿できるようにする",
        h("small", { class: "hint" }, "オフの場合、投稿できるのは企画主だけです。どちらの場合も、投稿されたコードは誰でもダウンロードできます。後から変更できます。")));
    return { title, desc, allow, nodes: [field("企画名", title), field("説明（任意）", desc, "500文字まで"), allowRow] };
  }

  function viewProjectForm(project) {
    if (!session) return needLogin("企画を作るにはログインが必要です。");
    const f = projectFormFields(project);
    const btn = h("button", { class: "btn primary", type: "submit" }, "企画を作成");
    const form = h("form", { class: "card" }, h("h1", {}, "新しい企画"), ...f.nodes,
      h("div", { class: "actions" }, btn, h("a", { class: "btn", href: "#/" }, "キャンセル")));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const { data, error } = await sb.from("projects").insert({
          owner_id: session.user.id,
          title: f.title.value.trim(),
          description: f.desc.value.trim(),
          allow_others_post: f.allow.checked
        }).select("id").single();
        if (error) throw error;
        toast("企画を作成しました");
        go(`#/project/${data.id}`);
      });
    });
    return form;
  }

  // ユーザー名で検索して選ぶ部品（共同編集者・限定公開の閲覧者の追加で共通に使う）
  //   onPick(user)：候補の「追加」を押したとき。exclude(id)：候補から除くかどうか
  function userPicker({ placeholder, onPick, exclude }) {
    const input = h("input", { type: "search", placeholder: placeholder || "ユーザー名で検索…", autocomplete: "off" });
    const results = h("div", { class: "picker-results" });
    let timer = null, seq = 0;
    async function search() {
      const q = input.value.trim();
      const my = ++seq;
      if (!q) { results.replaceChildren(); return; }
      const esc = q.replace(/[\\%_]/g, m => "\\" + m);
      const { data, error } = await sb.from("profiles").select("id,username").ilike("username", `%${esc}%`).order("username").limit(10);
      if (my !== seq) return;
      results.replaceChildren();
      if (error) { results.append(h("p", { class: "muted" }, "検索できませんでした。")); return; }
      const list = (data || []).filter(u => !(exclude && exclude(u.id)));
      if (!list.length) { results.append(h("p", { class: "muted" }, "該当するユーザーがいません。")); return; }
      list.forEach(u => {
        const add = h("button", { class: "btn small primary", type: "button" }, "追加");
        add.addEventListener("click", () => busy(add, async () => { await onPick(u); search(); }));
        results.append(h("div", { class: "picker-row" }, h("span", {}, "@" + u.username), add));
      });
    }
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(search, 250); });
    return { node: h("div", { class: "picker" }, input, results), refresh: search };
  }

  async function fetchProject(id) {
    const { data, error } = await sb.from("projects").select("*, owner:profiles(username)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return data;
    // 共同編集者（企画主・管理者のほかに、設定変更と投稿ができる人）
    const { data: collabs } = await sb.from("project_collaborators").select("user_id,user:profiles(username)").eq("project_id", id).order("created_at");
    data.collaborators = collabs || [];
    data.isCollab = !!session && data.collaborators.some(c => c.user_id === session.user.id);
    return data;
  }

  // 共同編集者の管理欄（追加・削除は企画主と管理者だけ。共同編集者本人は一覧を見るだけ）
  function collaboratorsBox(project, canManage) {
    const box = h("div", { class: "card" }, h("h2", {}, "👥 共同編集者"),
      h("p", { class: "muted", style: "margin-top:0" },
        "共同編集者は、この企画の設定（企画名・説明・投稿許可）の変更と、企画への投稿ができます。他の人の投稿の編集・削除や、企画の削除はできません。"));
    const list = h("div", {});
    function drawList() {
      list.replaceChildren();
      if (!project.collaborators.length) list.append(h("p", { class: "muted" }, "共同編集者はいません。"));
      project.collaborators.forEach(c => {
        const row = h("div", { class: "picker-row" }, h("span", {}, "@" + (c.user ? c.user.username : "?")));
        if (canManage) {
          const del = h("button", { class: "btn small danger", type: "button" }, "外す");
          del.addEventListener("click", () => busy(del, async () => {
            const { error } = await sb.from("project_collaborators").delete().eq("project_id", project.id).eq("user_id", c.user_id);
            if (error) throw error;
            project.collaborators = project.collaborators.filter(x => x.user_id !== c.user_id);
            drawList(); picker && picker.refresh();
          }));
          row.append(del);
        }
        list.append(row);
      });
    }
    let picker = null;
    box.append(list);
    if (canManage) {
      picker = userPicker({
        placeholder: "ユーザー名で検索して、共同編集者を追加…",
        exclude: id => id === project.owner_id || project.collaborators.some(c => c.user_id === id),
        onPick: async u => {
          const { error } = await sb.from("project_collaborators").insert({ project_id: project.id, user_id: u.id });
          if (error) throw error;
          project.collaborators.push({ user_id: u.id, user: { username: u.username } });
          toast(`@${u.username} を共同編集者に追加しました`);
          drawList();
        }
      });
      box.append(picker.node);
    }
    drawList();
    return box;
  }

  async function viewProjectEdit(id) {
    if (!session) return needLogin("ログインが必要です。");
    const project = await fetchProject(id);
    if (!project) return notFound();
    const isOwnerOrAdmin = project.owner_id === session.user.id || isAdmin;
    if (!isOwnerOrAdmin && !project.isCollab) return h("div", { class: "error-box" }, "企画主・共同編集者だけが設定を変更できます。");

    const f = projectFormFields(project);
    const saveBtn = h("button", { class: "btn primary", type: "submit" }, "保存");
    const delBtn = h("button", { class: "btn danger", type: "button" }, "この企画を削除");
    const form = h("form", { class: "card" }, h("h1", {}, "企画の設定"), ...f.nodes,
      h("div", { class: "actions" }, saveBtn, h("a", { class: "btn", href: `#/project/${id}` }, "キャンセル"), isOwnerOrAdmin ? delBtn : null));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(saveBtn, async () => {
        const { error } = await sb.from("projects").update({
          title: f.title.value.trim(),
          description: f.desc.value.trim(),
          allow_others_post: f.allow.checked
        }).eq("id", id);
        if (error) throw error;
        toast("保存しました");
        go(`#/project/${id}`);
      });
    });
    delBtn.addEventListener("click", () => {
      if (!confirm("この企画と、中のすべての投稿を削除します。元に戻せません。よろしいですか？")) return;
      busy(delBtn, async () => {
        const { error } = await sb.from("projects").delete().eq("id", id);
        if (error) throw error;
        toast("企画を削除しました");
        go("#/");
      });
    });
    return h("div", {}, form, collaboratorsBox(project, isOwnerOrAdmin));
  }

  function canPost(project) {
    return !!session && (project.owner_id === session.user.id || project.isCollab || isAdmin || project.allow_others_post);
  }

  // 企画ページのコメント欄（改善すべき点などを書き込める）
  function commentsSection(project, commentsRes) {
    const box = h("div", { class: "card" });
    if (commentsRes.error) {
      box.append(h("h2", {}, "コメント"),
        h("p", { class: "muted" }, "コメントを読み込めませんでした。（データベースの更新が済んでいない可能性があります）"));
      return box;
    }
    const comments = commentsRes.data;
    box.append(h("h2", {}, `💬 コメント（${comments.length}）`),
      h("p", { class: "muted", style: "margin-top:0" }, "この企画への改善点・感想などを書き込めます。"));

    if (session) {
      const body = h("textarea", { rows: 3, maxlength: 1000, required: true, placeholder: "例：スマホで表示が崩れます。ボタンを大きくするとよさそうです。" });
      const btn = h("button", { class: "btn primary", type: "submit" }, "コメントする");
      const form = h("form", { class: "comment-form" }, body, h("div", { class: "actions" }, btn));
      form.addEventListener("submit", e => {
        e.preventDefault();
        busy(btn, async () => {
          const text = body.value.trim();
          if (!text) throw new Error("コメントを入力してください。");
          const { error } = await sb.from("comments").insert({ project_id: project.id, author_id: session.user.id, body: text });
          if (error) throw error;
          toast("コメントしました");
          route();
        });
      });
      box.append(form);
    } else {
      box.append(h("p", {}, h("a", { href: "#/login" }, "ログイン"), "するとコメントできます。"));
    }

    if (!comments.length) box.append(h("p", { class: "muted" }, "まだコメントがありません。"));

    // 返信は親コメントの下に表示する（親 → 子のツリー）
    const byParent = new Map();
    comments.forEach(c => {
      const k = c.parent_id || "";
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(c);
    });

    function renderComment(c, depth) {
      const name = c.author ? c.author.username : "?";
      const kids = byParent.get(c.id) || [];
      const actions = h("div", { class: "actions" });
      const replyHolder = h("div", {});
      const item = h("div", { class: "comment", id: "c-" + c.id },
        h("div", { class: "meta" }, h("strong", {}, "@" + name), h("span", {}, fmtDate(c.created_at))),
        h("p", { class: "body" }, c.body), actions, replyHolder);

      if (session) {
        const replyBtn = h("button", { class: "btn small", type: "button" }, "↩ 返信");
        replyBtn.addEventListener("click", () => {
          if (replyHolder.firstChild) { replyHolder.replaceChildren(); return; }
          const ta = h("textarea", { rows: 2, maxlength: 1000, required: true, placeholder: `@${name} さんへの返信` });
          const send = h("button", { class: "btn small primary", type: "submit" }, "返信する");
          const cancel = h("button", { class: "btn small", type: "button", onclick: () => replyHolder.replaceChildren() }, "キャンセル");
          const f = h("form", { class: "comment-form reply-form" }, ta, h("div", { class: "actions" }, send, cancel));
          f.addEventListener("submit", e => {
            e.preventDefault();
            busy(send, async () => {
              const text = ta.value.trim();
              if (!text) throw new Error("返信を入力してください。");
              const { error } = await sb.from("comments").insert({ project_id: project.id, author_id: session.user.id, body: text, parent_id: c.id });
              if (error) throw error;
              toast("返信しました");
              route();
            });
          });
          replyHolder.append(f);
          ta.focus();
        });
        actions.append(replyBtn);
      }

      if (session && (c.author_id === session.user.id || project.owner_id === session.user.id || isAdmin)) {
        const del = h("button", { class: "btn small danger", type: "button" }, "削除");
        del.addEventListener("click", () => {
          const msg = kids.length ? "このコメントを削除します。これに対する返信もすべて削除されます。よろしいですか？" : "このコメントを削除します。よろしいですか？";
          if (!confirm(msg)) return;
          busy(del, async () => {
            const { error } = await sb.from("comments").delete().eq("id", c.id);
            if (error) throw error;
            toast("削除しました");
            route();
          });
        });
        actions.append(del);
      }

      if (kids.length) {
        const wrap = h("div", { class: "replies" + (depth >= 3 ? " flat" : "") });
        kids.forEach(k => wrap.append(renderComment(k, depth + 1)));
        item.append(wrap);
      }
      return item;
    }

    (byParent.get("") || []).forEach(c => box.append(renderComment(c, 0)));
    return box;
  }

  async function viewProject(id) {
    const [project, postsRes, commentsRes, myViewRes] = await Promise.all([
      fetchProject(id),
      sb.from("posts").select("id,title,created_at,author_id,is_public,author:profiles(username)")
        .eq("project_id", id).order("created_at", { ascending: false }),
      sb.from("comments").select("id,body,created_at,author_id,parent_id,author:profiles(username)")
        .eq("project_id", id).order("created_at", { ascending: true }),
      // 自分が閲覧を許可されている限定公開の投稿
      session ? sb.from("post_viewers").select("post_id").eq("user_id", session.user.id) : Promise.resolve({ data: [] })
    ]);
    if (!project) return notFound();
    if (postsRes.error) throw postsRes.error;
    const posts = postsRes.data;
    const isOwner = !!session && (project.owner_id === session.user.id || isAdmin);
    const canEditProject = isOwner || project.isCollab;
    const myViewable = new Set((myViewRes.data || []).map(v => v.post_id));
    // 画面の出し分け用（実際にコードが渡されるかどうかは、データベース側が判定する）
    const canSee = p => p.is_public !== false || (!!session && (p.author_id === session.user.id || canEditProject || myViewable.has(p.id)));

    const zipBtn = h("button", { class: "btn", type: "button" }, "⬇ 企画まるごとZIP");
    zipBtn.addEventListener("click", () => busy(zipBtn, () => downloadProjectZip(project, posts.length)));

    let postAction;
    if (canPost(project)) postAction = h("a", { class: "btn primary", href: `#/project/${id}/new` }, "＋ コードを投稿");
    else if (!session && project.allow_others_post) postAction = h("a", { class: "btn primary", href: "#/login" }, "ログインして投稿");

    // 投稿一覧（まとめて削除モード付き）
    // 削除できるのは、企画主・管理者はすべての投稿、それ以外の人は自分の投稿だけ
    const canDel = p => !!session && (isOwner || p.author_id === session.user.id);
    const deletable = posts.filter(canDel);
    let selecting = false;
    const selected = new Set();
    const list = h("div", {});
    const bulkBar = h("div", { class: "card bulk-bar hidden" });
    const bulkBtn = deletable.length
      ? h("button", { class: "btn", type: "button", onclick: () => { selecting = !selecting; selected.clear(); draw(); } }, "🗑 まとめて削除")
      : null;

    function drawBulkBar() {
      bulkBar.classList.toggle("hidden", !selecting);
      bulkBar.replaceChildren();
      if (!selecting) return;
      const n = selected.size;
      const allOn = n === deletable.length;
      const toggleAll = h("button", { class: "btn small", type: "button" }, allOn ? "すべて解除" : "すべて選択");
      toggleAll.addEventListener("click", () => {
        selected.clear();
        if (!allOn) deletable.forEach(p => selected.add(p.id));
        draw();
      });
      const del = h("button", { class: "btn small danger", type: "button" }, `選択した${n}件を削除`);
      del.disabled = n === 0;
      del.addEventListener("click", () => {
        if (!confirm(`選択した${n}件の投稿を削除します。元に戻せません。よろしいですか？`)) return;
        busy(del, async () => {
          const { data, error } = await sb.from("posts").delete().in("id", [...selected]).select("id");
          if (error) throw error;
          const done = data ? data.length : 0;
          toast(done === n ? `${done}件を削除しました` : `${n}件中${done}件を削除しました（権限のない投稿は削除されません）`, done !== n);
          route();
        });
      });
      const cancel = h("button", { class: "btn small", type: "button", onclick: () => { selecting = false; selected.clear(); draw(); } }, "キャンセル");
      bulkBar.append(h("span", { class: "muted" }, `${n}件選択中`), toggleAll, del, cancel);
    }

    function drawList() {
      list.replaceChildren();
      if (!posts.length) list.append(h("p", { class: "muted" }, "まだ投稿がありません。"));
      posts.forEach(p => {
        // 投稿のコードを取得して、HTML1ファイルとしてそのままダウンロード
        const visible = canSee(p);
        let dlBtn;
        if (visible) {
          dlBtn = h("button", { class: "btn small", type: "button" }, "⬇ htmlとしてダウンロード");
          dlBtn.addEventListener("click", () => busy(dlBtn, async () => {
            const { data, error } = await sb.rpc("get_post", { p_id: p.id });
            if (error) throw error;
            if (!data) throw new Error("投稿が見つかりません。");
            if (!data.can_view) throw new Error("この投稿は限定公開のため、ダウンロードできません。");
            downloadSingleHtml(data);
          }));
        } else if (!session) {
          dlBtn = h("a", { class: "btn small", href: "#/login" }, "ログインして公開を要請");
        } else {
          dlBtn = h("button", { class: "btn small", type: "button" }, "🔒 公開を要請");
          dlBtn.addEventListener("click", () => busy(dlBtn, async () => {
            const { error } = await sb.rpc("request_post_publish", { p_post: p.id });
            if (error) throw error;
            dlBtn.textContent = "✓ 要請しました";
            dlBtn.disabled = true;
            toast(`@${p.author ? p.author.username : "作成者"} に公開を要請しました`);
          }));
        }
        let pick = null;
        if (selecting && canDel(p)) {
          pick = h("input", { type: "checkbox", class: "pick", checked: selected.has(p.id), "aria-label": `「${p.title}」を選択` });
          pick.addEventListener("change", () => { if (pick.checked) selected.add(p.id); else selected.delete(p.id); draw(); });
        }
        list.append(h("div", { class: "card post-item" + (pick && pick.checked ? " picked" : "") },
          pick,
          h("div", { class: "info" },
            h("h3", {}, h("a", { href: `#/post/${p.id}` }, p.title), p.is_public === false ? h("span", { class: "badge lock", style: "margin-left:.5rem" }, visible ? "🔒 限定公開" : "🔒 限定公開（閲覧不可）") : null),
            h("div", { class: "meta" }, h("span", {}, "@" + (p.author ? p.author.username : "?")), h("span", {}, fmtDate(p.created_at)))),
          h("div", { class: "actions" },
            h("a", { class: "btn small", href: `#/post/${p.id}` }, "開く"),
            dlBtn)));
      });
    }
    function draw() { drawBulkBar(); drawList(); }
    draw();

    return h("section", {},
      h("div", { class: "card" },
        h("div", { class: "page-head" },
          h("div", {},
            h("h1", {}, project.title),
            h("div", { class: "meta" }, openBadge(project), h("span", {}, "企画主 @" + (project.owner ? project.owner.username : "?")),
              project.collaborators.length ? h("span", {}, "共同編集者 " + project.collaborators.map(c => "@" + (c.user ? c.user.username : "?")).join("、")) : null,
              h("span", {}, fmtDate(project.created_at)))),
          h("div", { class: "actions" }, zipBtn, canEditProject ? h("a", { class: "btn", href: `#/project/${id}/edit` }, "⚙ 設定") : null)),
        project.description ? h("p", { style: "white-space:pre-wrap;margin:0" }, project.description) : null),
      h("div", { class: "page-head" }, h("h2", {}, `投稿（${posts.length}）`), h("div", { class: "actions" }, bulkBtn, postAction)),
      bulkBar,
      list,
      commentsSection(project, commentsRes));
  }

  /* ======================================================
   * 投稿
   * ==================================================== */
  function needLogin(msg) {
    return h("div", { class: "card narrow" }, h("h2", {}, msg), h("p", { class: "links" }, h("a", { href: "#/login" }, "ログイン"), " ・ ", h("a", { href: "#/signup" }, "新規登録")));
  }
  function notFound() {
    return h("div", { class: "card" }, h("h2", {}, "見つかりませんでした"), h("a", { href: "#/" }, "トップへ戻る"));
  }

  function postForm(project, post) {
    const editing = !!post;
    const title = h("input", { type: "text", required: true, maxlength: 80, value: post ? post.title : "" });
    let titleAuto = false;   // タイトルがファイル名から自動入力された状態か
    title.addEventListener("input", () => { titleAuto = false; });   // 自分で編集したら、以後は上書きしない
    const mk = (v, ph) => h("textarea", { class: "code", rows: 12, spellcheck: "false", autocapitalize: "off", placeholder: ph, value: v || "" });
    const html = mk(post && post.html, "<h1>Hello!</h1>\n<button id=\"btn\">押してね</button>");
    const css = mk(post && post.css, "h1 { color: tomato; }");
    const js = mk(post && post.js, "document.getElementById('btn').onclick = () => alert('hi');");
    // 公開設定（オフ＝限定公開。限定公開のときは、閲覧できる人をユーザー名で追加できる）
    const isPublic = h("input", { type: "checkbox", checked: editing ? post.is_public !== false : true });
    const publicRow = h("label", { class: "check" }, isPublic,
      h("span", {}, "このhtmlを一般公開する",
        h("small", { class: "hint" }, "オフにすると限定公開になります。企画の投稿一覧には表示されますが、閲覧を許可された人以外は、プレビュー・コード閲覧・ダウンロードができません。投稿したあとも変更できます。")));
    const viewers = new Map();       // いま選ばれている閲覧者（user_id → ユーザー名）
    const origViewers = new Map();   // 保存済みの閲覧者
    const viewerList = h("div", {});
    function drawViewers() {
      viewerList.replaceChildren();
      if (!viewers.size) viewerList.append(h("p", { class: "muted", style: "margin:.2rem 0" }, "閲覧できる人は、まだ追加されていません。"));
      [...viewers].forEach(([uid, name]) => {
        const del = h("button", { class: "btn small danger", type: "button" }, "外す");
        del.addEventListener("click", () => { viewers.delete(uid); drawViewers(); viewerPicker.refresh(); });
        viewerList.append(h("div", { class: "picker-row" }, h("span", {}, "@" + name), del));
      });
    }
    const viewerPicker = userPicker({
      placeholder: "ユーザー名で検索して、閲覧できる人を追加…",
      exclude: id => id === session.user.id || viewers.has(id),
      onPick: async u => { viewers.set(u.id, u.username); drawViewers(); }
    });
    const limitedBox = h("div", { class: "notice limited-box" },
      h("strong", {}, "🔒 限定公開"),
      h("p", { style: "margin:.2rem 0 .5rem" }, "作成者・企画主・共同編集者・管理者と、下で追加した人だけが、コードを見られます。（保存したときに反映されます）"),
      viewerList, viewerPicker.node);
    const syncVisibility = () => limitedBox.classList.toggle("hidden", isPublic.checked);
    isPublic.addEventListener("change", syncVisibility);
    // 編集のときは、いまの閲覧者を読み込む
    const viewersReady = editing
      ? sb.from("post_viewers").select("user_id,user:profiles(username)").eq("post_id", post.id).then(r => {
          (r.data || []).forEach(v => { const n = v.user ? v.user.username : "?"; origViewers.set(v.user_id, n); if (!viewers.has(v.user_id)) viewers.set(v.user_id, n); });
          drawViewers();
        })
      : Promise.resolve();
    drawViewers();
    syncVisibility();

    const memo = h("textarea", {
      rows: 4, maxlength: 2000, value: (post && post.memo) || "",
      placeholder: "例：v2 ボタンの色を変更。スマホ表示を修正。使い方は〜"
    });

    // このフォームで使える上限（管理者・承認済み・すでに大容量の投稿の編集は 2MB まで）
    const wasBig = editing && Math.max((post.html || "").length, (post.css || "").length, (post.js || "").length) > NORMAL_MAX;
    const cap = () => (isAdmin || bigQuota > 0 || wasBig) ? BIG_MAX : NORMAL_MAX;
    const kb = n => Math.round(n / 1000).toLocaleString() + "KB";

    // 500KB を超えたときに出す「管理者への要請」欄
    const bigBox = h("div", { class: "notice hidden" });
    async function showBigNotice() {
      bigBox.classList.remove("hidden");
      bigBox.replaceChildren(h("p", { style: "margin:0" }, "確認中…"));
      const { data } = await sb.from("big_upload_requests").select("id").eq("user_id", session.user.id).eq("status", "pending").maybeSingle();
      if (data) {
        bigBox.replaceChildren(h("p", { style: "margin:0" }, "📨 大容量投稿の要請を送信済みです。管理者の承認をお待ちください（承認されるとベルに通知が届きます）。"));
        return;
      }
      const note = h("textarea", { rows: 2, maxlength: 500, placeholder: "例：デモ用に約1.2MBのHTMLを投稿したいです。" });
      const send = h("button", { class: "btn small primary", type: "button" }, "管理者に要請を送る");
      send.addEventListener("click", () => busy(send, async () => {
        const { error } = await sb.rpc("request_big_upload", { p_note: note.value.trim() });
        if (error) throw error;
        toast("管理者に要請を送りました");
        showBigNotice();
      }));
      bigBox.replaceChildren(
        h("p", { style: "margin:0 0 .4rem" }, "500KBを超えるコードを投稿するには、管理者の承認が必要です。承認されると、最大2MBのコードを、認められた回数だけ投稿できます。"),
        note, h("div", { class: "actions", style: "margin-top:.4rem" }, send));
    }

    const previewBox = h("div", { class: "preview-box hidden" });
    const prevBtn = h("button", { class: "btn", type: "button" }, "▶ プレビュー");
    prevBtn.addEventListener("click", () => {
      previewBox.classList.remove("hidden");
      previewBox.replaceChildren(previewFrame(compose({ title: title.value, html: html.value, css: css.value, js: js.value }, false)));
    });

    /* ---- 入力方法の切り替え（コード入力 / ファイル添付） ---- */
    const codeFields = h("div", {},
      field("HTML", html, "<body> の中身でも、<html> から始まる完全なHTMLでもOK。CSS や JavaScript をこの中（<style> / <script>）に直接書く場合は、下の欄は空のままで大丈夫です。"),
      field("CSS（任意）", css, "HTMLの中に <style> で書いた場合は空のままでOK"),
      field("JavaScript（任意）", js, "HTMLの中に <script> で書いた場合は空のままでOK"));

    const fileInput = h("input", { type: "file", accept: ".html,.htm,.css,.js", multiple: true });
    const fileInfo = h("ul", { class: "file-list" });
    const fileBox = h("div", { class: "hidden" },
      field("ファイルを選択", fileInput,
        ".html（.htm）・.css・.js のファイルを選べます（複数選択可、各種類1つずつ、各500KBまで）。HTMLだけでもOKです。選んだ内容は「コード入力」に切り替えて確認・修正できます。"),
      fileInfo);

    function showFileInfo(items, errors) {
      fileInfo.replaceChildren();
      items.forEach(t => fileInfo.append(h("li", { class: "ok" }, "✓ " + t)));
      errors.forEach(t => fileInfo.append(h("li", { class: "ng" }, "× " + t)));
    }

    fileInput.addEventListener("change", async () => {
      const files = [...fileInput.files];
      if (!files.length) { showFileInfo([], []); return; }
      const found = {};
      const okList = [];
      const errs = [];
      let needBig = false;
      for (const f of files) {
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        const kind = ext === "html" || ext === "htm" ? "html" : ext === "css" ? "css" : ext === "js" ? "js" : null;
        if (!kind) { errs.push(`${f.name}：対応していない形式です（.html / .css / .js のみ）`); continue; }
        if (found[kind]) { errs.push(`${f.name}：${kind.toUpperCase()} は1つだけ選べます`); continue; }
        if (f.size > BIG_MAX * 4) { errs.push(`${f.name}：大きすぎます（最大2MBまで）`); continue; }
        const text = await f.text();
        if (text.length > BIG_MAX) { errs.push(`${f.name}：大きすぎます（最大2MBまで）`); continue; }
        if (text.length > cap()) { errs.push(`${f.name}：500KBを超えています（管理者の承認が必要です）`); needBig = true; continue; }
        if (text.includes("\u0000")) { errs.push(`${f.name}：テキストファイルではありません`); continue; }
        found[kind] = text;
        okList.push(`${f.name}（${kind.toUpperCase()}）`);
      }
      if (okList.length) {
        html.value = found.html || "";
        css.value = found.css || "";
        js.value = found.js || "";
        // タイトルが空、または前回ファイル名から自動で入れたままなら、選択したファイル名（HTML優先）を入れる
        if (!title.value.trim() || titleAuto) {
          const pick = files.find(f => /\.html?$/i.test(f.name)) || files.find(f => /\.(css|js)$/i.test(f.name));
          if (pick) { title.value = pick.name.replace(/\.[^.]+$/, "").slice(0, 80); titleAuto = true; }
        }
      }
      showFileInfo(okList, errs);
      if (needBig && !isAdmin) showBigNotice();
    });

    function setMode(mode) {
      const isFile = mode === "file";
      codeFields.classList.toggle("hidden", isFile);
      fileBox.classList.toggle("hidden", !isFile);
      modeCode.classList.toggle("active", !isFile);
      modeFile.classList.toggle("active", isFile);
    }
    const modeCode = h("button", { class: "tab", type: "button", onclick: () => setMode("code") }, "コード入力");
    const modeFile = h("button", { class: "tab", type: "button", onclick: () => setMode("file") }, "ファイル添付");
    const modeTabs = h("div", { class: "tabs" }, modeFile, modeCode);
    setMode(editing ? "code" : "file");   // 新規は「ファイル添付」から、編集は既存コードが見える「コード入力」から

    const btn = h("button", { class: "btn primary", type: "submit" }, editing ? "保存" : "投稿する");
    const back = editing ? `#/post/${post.id}` : `#/project/${project.id}`;
    const form = h("form", { class: "card" },
      h("h1", {}, editing ? "投稿を編集" : "コードを投稿"),
      h("p", { class: "muted" }, "企画：" + project.title),
      h("p", { class: "notice" },
        "投稿できるのは HTML / CSS / JavaScript のコードだけです。投稿したコードは誰でも閲覧・ダウンロードできます。",
        h("br"),
        isAdmin ? "管理者は、各最大2MBまで投稿できます。"
          : bigQuota > 0 ? `各500KBまで。大容量投稿（各最大2MB）の残り回数：${bigQuota}回`
          : "各500KBまで。超える場合は、管理者に要請できます（承認されると最大2MBまで）。"),
      field("タイトル", title),
      modeTabs, codeFields, fileBox,
      publicRow, limitedBox,
      field("メモ（任意）", memo, "改善した点・変更点・使い方などを自由に書けます（2000文字まで）。投稿ページに表示されます。"),
      bigBox,
      h("div", { class: "actions" }, btn, prevBtn, h("a", { class: "btn", href: back }, "キャンセル")),
      previewBox);

    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const row = { title: title.value.trim(), html: html.value, css: css.value, js: js.value, memo: memo.value.trim(), is_public: isPublic.checked };
        if (!row.title) throw new Error("タイトルを入力してください。");
        if (!row.html.trim() && !row.css.trim() && !row.js.trim()) throw new Error("HTML / CSS / JavaScript のいずれかを入力してください。");
        for (const k of ["html", "css", "js"]) {
          if (row[k].length > BIG_MAX) throw new Error(`${k.toUpperCase()} が大きすぎます（最大2MBまで）。`);
          if (row[k].length > cap()) {
            showBigNotice();
            throw new Error(`${k.toUpperCase()} が500KBを超えています。管理者の承認が必要です（下の「要請」から申請できます）。`);
          }
        }
        // 承認済みの回数を使う投稿（すでに大容量の投稿の編集は消費しない）
        const isBigNow = ["html", "css", "js"].some(k => row[k].length > NORMAL_MAX);
        if (isBigNow && !isAdmin && !wasBig && !confirm(`500KBを超える投稿です。大容量投稿の残り回数（${bigQuota}回）を1回消費します。よろしいですか？`)) return;
        // 閲覧者の追加・削除を、保存済みの状態との差分で反映する
        const syncViewers = async postId => {
          await viewersReady;
          const add = [...viewers.keys()].filter(id => !origViewers.has(id));
          const remove = [...origViewers.keys()].filter(id => !viewers.has(id));
          if (add.length) {
            const { error } = await sb.from("post_viewers").insert(add.map(user_id => ({ post_id: postId, user_id })));
            if (error) throw error;
          }
          if (remove.length) {
            const { error } = await sb.from("post_viewers").delete().eq("post_id", postId).in("user_id", remove);
            if (error) throw error;
          }
        };
        if (editing) {
          const { error } = await sb.from("posts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", post.id);
          if (error) throw error;
          await syncViewers(post.id);
          toast("保存しました");
          go(`#/post/${post.id}`);
        } else {
          const { data, error } = await sb.from("posts")
            .insert({ ...row, project_id: project.id, author_id: session.user.id }).select("id").single();
          if (error) throw error;
          if (isBigNow && !isAdmin) await refreshQuota();
          await syncViewers(data.id);
          toast("投稿しました");
          go(`#/post/${data.id}`);
        }
      });
    });
    return form;
  }

  async function viewPostNew(projectId) {
    if (!session) return needLogin("投稿するにはログインが必要です。");
    const project = await fetchProject(projectId);
    if (!project) return notFound();
    if (!canPost(project)) return h("div", { class: "error-box" }, "この企画は、企画主・共同編集者のみ投稿できます。");
    return postForm(project, null);
  }

  // 投稿の取得。コード（html / css / js / memo）は、閲覧権限がないと空で返ってくる（can_view = false）
  async function fetchPost(id) {
    const { data, error } = await sb.rpc("get_post", { p_id: id });
    if (error) throw error;
    return data;
  }

  async function viewPostEdit(id) {
    if (!session) return needLogin("ログインが必要です。");
    const post = await fetchPost(id);
    if (!post) return notFound();
    if (post.author_id !== session.user.id && !isAdmin) return h("div", { class: "error-box" }, "投稿者本人だけが編集できます。");
    return postForm(post.project, post);
  }

  async function viewPost(id) {
    const post = await fetchPost(id);
    if (!post) return notFound();
    const isAuthor = !!session && (post.author_id === session.user.id || isAdmin);   // 管理者は編集も可
    const isOwner = !!session && (post.project.owner_id === session.user.id || isAdmin);

    // 限定公開で、閲覧権限がない場合：プレビュー・コード・ダウンロードは出さず、「公開を要請」だけ出す
    if (!post.can_view) {
      let req;
      if (!session) req = h("a", { class: "btn primary", href: "#/login" }, "ログインして公開を要請");
      else {
        req = h("button", { class: "btn primary", type: "button" }, "🔒 公開を要請");
        req.addEventListener("click", () => busy(req, async () => {
          const { error } = await sb.rpc("request_post_publish", { p_post: id });
          if (error) throw error;
          req.textContent = "✓ 要請しました";
          req.disabled = true;
          toast(`@${post.author ? post.author.username : "作成者"} に公開を要請しました`);
        }));
      }
      return h("section", {},
        h("p", {}, h("a", { href: `#/project/${post.project.id}` }, "← " + post.project.title)),
        h("div", { class: "card locked" },
          h("h1", {}, post.title, h("span", { class: "badge lock", style: "margin-left:.6rem" }, "🔒 限定公開")),
          h("div", { class: "meta" }, h("span", {}, "@" + (post.author ? post.author.username : "?")), h("span", {}, fmtDate(post.created_at))),
          h("div", { class: "lock-box" },
            h("div", { class: "lock-icon" }, "🔒"),
            h("p", {}, h("strong", {}, "この投稿は限定公開です")),
            h("p", { class: "muted" }, "プレビュー・コードの閲覧・ダウンロードは、作成者に許可された人だけができます。「公開を要請」を押すと、あなたのユーザー名が作成者に通知されます。"),
            req)));
    }

    const htmlBtn = h("button", { class: "btn", type: "button" }, "⬇ HTML（1ファイル）");
    htmlBtn.addEventListener("click", () => downloadSingleHtml(post));
    const zipBtn = h("button", { class: "btn", type: "button" }, "⬇ ZIP（分割）");
    zipBtn.addEventListener("click", () => busy(zipBtn, () => downloadPostZip(post)));

    const actions = h("div", { class: "actions" }, htmlBtn, zipBtn);
    if (isAuthor) {
      actions.append(h("a", { class: "btn", href: `#/post/${id}/edit` }, "編集"));
      // 公開設定のワンタッチ切り替え（閲覧者の追加は「編集」から）
      const toggle = h("button", { class: "btn", type: "button" }, post.is_public ? "🔒 限定公開にする" : "🌐 一般公開にする");
      toggle.addEventListener("click", () => {
        if (post.is_public && !confirm("限定公開にします。閲覧を許可した人以外は、この投稿のコードを見られなくなります。よろしいですか？")) return;
        busy(toggle, async () => {
          const { error } = await sb.from("posts").update({ is_public: !post.is_public }).eq("id", id);
          if (error) throw error;
          toast(post.is_public ? "限定公開にしました" : "一般公開にしました");
          route();
        });
      });
      actions.append(toggle);
    }
    if (isAuthor || isOwner) {
      const del = h("button", { class: "btn danger", type: "button" }, "削除");
      del.addEventListener("click", () => {
        if (!confirm("この投稿を削除します。よろしいですか？")) return;
        busy(del, async () => {
          const { error } = await sb.from("posts").delete().eq("id", id);
          if (error) throw error;
          toast("削除しました");
          go(`#/project/${post.project.id}`);
        });
      });
      actions.append(del);
    }

    // タブ（プレビュー / HTML / CSS / JS）
    const panels = {
      preview: previewFrame(compose(post, false)),
      html: h("pre", { class: "codeview" }, post.html || "（なし）"),
      css: h("pre", { class: "codeview" }, post.css || "（なし）"),
      js: h("pre", { class: "codeview" }, post.js || "（なし）")
    };
    const labels = { preview: "プレビュー", html: "HTML", css: "CSS", js: "JavaScript" };
    const tabs = h("div", { class: "tabs" });
    const body = h("div", {});
    function show(key) {
      [...tabs.children].forEach(t => t.classList.toggle("active", t.dataset.key === key));
      body.replaceChildren(panels[key]);
    }
    Object.keys(labels).forEach(k => {
      const t = h("button", { class: "tab", type: "button", "data-key": k }, labels[k]);
      t.addEventListener("click", () => show(k));
      tabs.append(t);
    });
    show("preview");

    return h("section", {},
      h("p", {}, h("a", { href: `#/project/${post.project.id}` }, "← " + post.project.title)),
      h("div", { class: "card" },
        h("div", { class: "page-head" },
          h("div", {},
            h("h1", {}, post.title, post.is_public === false ? h("span", { class: "badge lock", style: "margin-left:.6rem" }, "🔒 限定公開") : null),
            h("div", { class: "meta" }, h("span", {}, "@" + (post.author ? post.author.username : "?")), h("span", {}, fmtDate(post.created_at)))),
          actions),
        post.memo ? h("div", { class: "memo" },
          h("h3", {}, "📝 投稿者のメモ"),
          h("p", {}, post.memo)) : null,
        h("p", { class: "notice" }, "投稿者が書いたコードです。プレビューは隔離された領域で実行されています。ダウンロードしたコードは、内容を確認してから実行してください。"),
        tabs, body));
  }

  /* 起動時は onAuthStateChange(INITIAL_SESSION) が最初の描画を行う */
})();
