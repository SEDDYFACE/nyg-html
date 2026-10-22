(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const app = document.getElementById("app");
  const navEl = document.getElementById("nav");
  const toastEl = document.getElementById("toast");

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
  const MAX_CODE = 500000;

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
      navEl.append(
        h("span", { class: "who" }, profile ? `@${profile.username}` : "", isAdmin ? h("span", { class: "badge open", style: "margin-left:.4rem" }, "管理者") : null),
        h("a", { class: "btn small primary", href: "#/new-project" }, "＋ 企画を作る"),
        h("button", {
          class: "btn small", type: "button",
          onclick: async () => { await sb.auth.signOut(); toast("ログアウトしました"); go("#/"); }
        }, "ログアウト"));
    } else {
      navEl.append(
        h("a", { class: "btn small", href: "#/login" }, "ログイン"),
        h("a", { class: "btn small primary", href: "#/signup" }, "新規登録"));
    }
  }

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

  async function downloadProjectZip(project) {
    const { data, error } = await sb.from("posts").select("*").eq("project_id", project.id).order("created_at", { ascending: true });
    if (error) throw error;
    if (!data.length) { toast("まだ投稿がありません", true); return; }
    const zip = new JSZip();
    data.forEach((p, i) => {
      const dir = zip.folder(String(i + 1).padStart(2, "0") + "_" + safeName(p.title));
      dir.file("index.html", compose(p, true));
      if (p.css) dir.file("style.css", p.css);
      if (p.js) dir.file("script.js", p.js);
      if (p.memo) dir.file("memo.txt", p.memo);
    });
    download(safeName(project.title) + ".zip", await zip.generateAsync({ type: "blob" }));
  }

  /* ======================================================
   * ルーター
   * ==================================================== */
  async function route() {
    const token = ++renderToken;
    const seg = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
    try {
      let view;
      const [a, b, c] = seg;
      if (!a) view = await viewHome();
      else if (a === "login") view = viewLogin();
      else if (a === "signup") view = viewSignup();
      else if (a === "forgot") view = viewForgot();
      else if (a === "reset") view = viewReset();
      else if (a === "new-project") view = viewProjectForm(null);
      else if (a === "project" && b && c === "edit") view = await viewProjectEdit(b);
      else if (a === "project" && b && c === "new") view = await viewPostNew(b);
      else if (a === "project" && b) view = await viewProject(b);
      else if (a === "post" && b && c === "edit") view = await viewPostEdit(b);
      else if (a === "post" && b) view = await viewPost(b);
      else view = h("div", { class: "card" }, h("h2", {}, "ページが見つかりません"), h("a", { href: "#/" }, "トップへ戻る"));
      if (token !== renderToken) return;
      app.replaceChildren(view);
      window.scrollTo(0, 0);
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
    const btn = h("button", { class: "btn primary", type: "submit" }, "登録する");
    const form = h("form", { class: "card narrow" },
      h("h1", {}, "新規登録"),
      field("メールアドレス", email, "パスワードを忘れたときの再設定用です（他の人には表示されません）"),
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
          app.replaceChildren(h("div", { class: "card narrow" },
            h("h1", {}, "確認メールを送信しました"),
            h("p", {}, "メール内のリンクを開いて登録を完了してください。完了後、ユーザー名とパスワードでログインできます。"),
            h("p", { class: "links" }, h("a", { href: "#/login" }, "ログイン画面へ"))));
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

  async function fetchProject(id) {
    const { data, error } = await sb.from("projects").select("*, owner:profiles(username)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function viewProjectEdit(id) {
    if (!session) return needLogin("ログインが必要です。");
    const project = await fetchProject(id);
    if (!project) return notFound();
    if (project.owner_id !== session.user.id && !isAdmin) return h("div", { class: "error-box" }, "企画主だけが設定を変更できます。");

    const f = projectFormFields(project);
    const saveBtn = h("button", { class: "btn primary", type: "submit" }, "保存");
    const delBtn = h("button", { class: "btn danger", type: "button" }, "この企画を削除");
    const form = h("form", { class: "card" }, h("h1", {}, "企画の設定"), ...f.nodes,
      h("div", { class: "actions" }, saveBtn, h("a", { class: "btn", href: `#/project/${id}` }, "キャンセル"), delBtn));
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
    return form;
  }

  function canPost(project) {
    return !!session && (project.owner_id === session.user.id || project.allow_others_post);
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
    comments.forEach(c => {
      const item = h("div", { class: "comment" },
        h("div", { class: "meta" }, h("strong", {}, "@" + (c.author ? c.author.username : "?")), h("span", {}, fmtDate(c.created_at))),
        h("p", { class: "body" }, c.body));
      if (session && (c.author_id === session.user.id || project.owner_id === session.user.id || isAdmin)) {
        const del = h("button", { class: "btn small danger", type: "button" }, "削除");
        del.addEventListener("click", () => {
          if (!confirm("このコメントを削除します。よろしいですか？")) return;
          busy(del, async () => {
            const { error } = await sb.from("comments").delete().eq("id", c.id);
            if (error) throw error;
            toast("削除しました");
            route();
          });
        });
        item.append(del);
      }
      box.append(item);
    });
    return box;
  }

  async function viewProject(id) {
    const [project, postsRes, commentsRes] = await Promise.all([
      fetchProject(id),
      sb.from("posts").select("id,title,created_at,author_id,author:profiles(username)")
        .eq("project_id", id).order("created_at", { ascending: false }),
      sb.from("comments").select("id,body,created_at,author_id,author:profiles(username)")
        .eq("project_id", id).order("created_at", { ascending: true })
    ]);
    if (!project) return notFound();
    if (postsRes.error) throw postsRes.error;
    const posts = postsRes.data;
    const isOwner = !!session && (project.owner_id === session.user.id || isAdmin);

    const zipBtn = h("button", { class: "btn", type: "button" }, "⬇ 企画まるごとZIP");
    zipBtn.addEventListener("click", () => busy(zipBtn, () => downloadProjectZip(project)));

    let postAction;
    if (canPost(project)) postAction = h("a", { class: "btn primary", href: `#/project/${id}/new` }, "＋ コードを投稿");
    else if (!session && project.allow_others_post) postAction = h("a", { class: "btn primary", href: "#/login" }, "ログインして投稿");

    const list = h("div", {});
    if (!posts.length) list.append(h("p", { class: "muted" }, "まだ投稿がありません。"));
    posts.forEach(p => {
      list.append(h("div", { class: "card post-item" },
        h("div", { class: "info" },
          h("h3", {}, h("a", { href: `#/post/${p.id}` }, p.title)),
          h("div", { class: "meta" }, h("span", {}, "@" + (p.author ? p.author.username : "?")), h("span", {}, fmtDate(p.created_at)))),
        h("a", { class: "btn small", href: `#/post/${p.id}` }, "開く")));
    });

    return h("section", {},
      h("div", { class: "card" },
        h("div", { class: "page-head" },
          h("div", {},
            h("h1", {}, project.title),
            h("div", { class: "meta" }, openBadge(project), h("span", {}, "企画主 @" + (project.owner ? project.owner.username : "?")), h("span", {}, fmtDate(project.created_at)))),
          h("div", { class: "actions" }, zipBtn, isOwner ? h("a", { class: "btn", href: `#/project/${id}/edit` }, "⚙ 設定") : null)),
        project.description ? h("p", { style: "white-space:pre-wrap;margin:0" }, project.description) : null),
      h("div", { class: "page-head" }, h("h2", {}, `投稿（${posts.length}）`), postAction),
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
    const memo = h("textarea", {
      rows: 4, maxlength: 2000, value: (post && post.memo) || "",
      placeholder: "例：v2 ボタンの色を変更。スマホ表示を修正。使い方は〜"
    });

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
      for (const f of files) {
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        const kind = ext === "html" || ext === "htm" ? "html" : ext === "css" ? "css" : ext === "js" ? "js" : null;
        if (!kind) { errs.push(`${f.name}：対応していない形式です（.html / .css / .js のみ）`); continue; }
        if (found[kind]) { errs.push(`${f.name}：${kind.toUpperCase()} は1つだけ選べます`); continue; }
        if (f.size > MAX_CODE * 4) { errs.push(`${f.name}：大きすぎます`); continue; }
        const text = await f.text();
        if (text.length > MAX_CODE) { errs.push(`${f.name}：大きすぎます（${MAX_CODE.toLocaleString()}文字まで）`); continue; }
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
      h("p", { class: "notice" }, "投稿できるのは HTML / CSS / JavaScript のコードだけです（各500KBまで）。投稿したコードは誰でも閲覧・ダウンロードできます。"),
      field("タイトル", title),
      modeTabs, codeFields, fileBox,
      field("メモ（任意）", memo, "改善した点・変更点・使い方などを自由に書けます（2000文字まで）。投稿ページに表示されます。"),
      h("div", { class: "actions" }, btn, prevBtn, h("a", { class: "btn", href: back }, "キャンセル")),
      previewBox);

    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const row = { title: title.value.trim(), html: html.value, css: css.value, js: js.value, memo: memo.value.trim() };
        if (!row.title) throw new Error("タイトルを入力してください。");
        if (!row.html.trim() && !row.css.trim() && !row.js.trim()) throw new Error("HTML / CSS / JavaScript のいずれかを入力してください。");
        for (const k of ["html", "css", "js"]) {
          if (row[k].length > MAX_CODE) throw new Error(`${k.toUpperCase()} が大きすぎます（${MAX_CODE.toLocaleString()}文字まで）。`);
        }
        if (editing) {
          const { error } = await sb.from("posts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", post.id);
          if (error) throw error;
          toast("保存しました");
          go(`#/post/${post.id}`);
        } else {
          const { data, error } = await sb.from("posts")
            .insert({ ...row, project_id: project.id, author_id: session.user.id }).select("id").single();
          if (error) throw error;
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
    if (!canPost(project)) return h("div", { class: "error-box" }, "この企画は企画主のみ投稿できます。");
    return postForm(project, null);
  }

  async function fetchPost(id) {
    const { data, error } = await sb.from("posts")
      .select("*, author:profiles(username), project:projects(id,title,owner_id)").eq("id", id).maybeSingle();
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

    const htmlBtn = h("button", { class: "btn", type: "button" }, "⬇ HTML（1ファイル）");
    htmlBtn.addEventListener("click", () => downloadSingleHtml(post));
    const zipBtn = h("button", { class: "btn", type: "button" }, "⬇ ZIP（分割）");
    zipBtn.addEventListener("click", () => busy(zipBtn, () => downloadPostZip(post)));

    const actions = h("div", { class: "actions" }, htmlBtn, zipBtn);
    if (isAuthor) actions.append(h("a", { class: "btn", href: `#/post/${id}/edit` }, "編集"));
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
            h("h1", {}, post.title),
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
