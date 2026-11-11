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
    if (/already been registered|already registered|email_exists|email address.*already/i.test(m)) return "そのメールアドレスは、すでに使われています。";
    if (/should be different|same email/i.test(m)) return "今のメールアドレスと同じです。";
    if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return "メールアドレスの形式が正しくありません。";
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
    if (/approval required/i.test(m)) return "500KBを超えるファイルは、管理者の許可が必要です。";
    if (/exceeds approved size/i.test(m)) return "許可されたファイルの大きさ（申請の5％増しまで）を超えています。";
    if (/asset too large/i.test(m)) return "ファイルは1つ3MBまでです。";
    if (/too many assets/i.test(m)) return "登録できるのは、1企画につき20ファイルまでです。";
    if (/too many posts for assets/i.test(m)) return "HTMLが4個以上ある企画には、画像・音声を登録できません（ファイルがある企画は、HTMLを3個までです）。";
    if (/too many posts/i.test(m)) { const n = (m.match(/too many posts:\s*(\d+)/i) || [])[1]; return `この企画のHTMLは、上限${n ? "（" + n + "個）" : ""}に達しています（画像・音声のファイルがある企画は3個まで、ない企画は6個までです）。`; }
    if (/project quota/i.test(m)) return `この企画の画像・音声の容量が上限（${fmtSize(PROJECT_QUOTA)}）に達しています。使っていないファイルを削除してください。`;
    if (/too many groups/i.test(m)) return "グループは、1企画につき20個までです。";
    if (/duplicate group/i.test(m)) return "同じ名前のグループがすでにあります。";
    if (/invalid group name/i.test(m)) return "グループ名は1〜30文字で入力してください。";
    if (/group not found/i.test(m)) return "グループが見つかりません。";
    if (/asset not found/i.test(m)) return "ファイルが見つかりません（削除された可能性があります）。";
    if (/duplicate asset/i.test(m)) return "同じ名前のファイルがすでに登録されています。";
    if (/invalid asset name/i.test(m)) return "ファイル名か、ファイルの種類が使えません（画像・音声のみ。名前に / \\ : * ? \" < > | は使えません）。";
    if (/invalid asset data/i.test(m)) return "ファイルの中身を読み取れませんでした。";
    if (/no request needed/i.test(m)) return "500KB以下のファイルは、許可なしで添付できます。";
    if (/already decided/i.test(m)) return "この要請は、すでに回答されています。";
    if (/not allowed/i.test(m)) return "この操作はできません。";
    if (/message not found/i.test(m)) return "メッセージが見つかりません（削除された可能性があります）。";
    if (/too fast/i.test(m)) return "送信は3秒に1回までです。";
    if (/message too long/i.test(m)) return "一回の投稿で200文字までです。";
    if (/empty message/i.test(m)) return "メッセージを入力してください。";
    if (/invalid recipient/i.test(m)) return "この相手には送れません。";
    if (/account frozen/i.test(m)) return "アカウントが一時凍結されています。メール認証や本名の入力を完了すると、また使えるようになります。";
    if (/invalid name/i.test(m)) return "本名は1〜50文字で入力してください（改行などの特殊な文字は使えません）。";
    if (/name locked/i.test(m)) return "管理者が確認済みのため、ご自身では変更できません。変更したいときは管理者に連絡してください。";
    if (/name not entered/i.test(m)) return "まだ本名が入力されていません。";
    if (/user not found/i.test(m)) return "そのユーザーが見つかりません。";
    if (/nonce|reauthentication/i.test(m)) return "メールで届いた認証コードが違うか、期限切れです。コードをもう一度送って、やり直してください。";
    if (/same.*password|different from the old/i.test(m)) return "新しいパスワードは、今のパスワードと違うものにしてください。";
    if (/username taken/i.test(m)) return "そのユーザー名はすでに使われています。";
    if (/invalid username/i.test(m)) return "ユーザー名は半角英数字とアンダースコアの3〜20文字にしてください。";
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

  // 管理者のユーザー名（緑の「管理者」バッジ用）
  let adminNames = new Set();
  async function loadAdminNames() {
    try {
      const { data } = await sb.rpc("admin_usernames");
      adminNames = new Set((data || []).map(x => String(x).toLowerCase()));
    } catch (e) { /* バッジが出ないだけ */ }
  }
  // 「@名前」＋（管理者なら）緑の「管理者」マーク
  function nameTag(username, strong) {
    const name = username || "?";
    const t = h(strong ? "strong" : "span", {}, "@" + name);
    const isAdm = adminNames.has(String(name).toLowerCase());
    if (!username) return h("span", { class: "nametag" }, t);
    const go2 = e => { e.preventDefault(); e.stopPropagation(); location.hash = "#/user/" + encodeURIComponent(name); };
    t.classList.add("name-link");
    t.setAttribute("role", "link"); t.setAttribute("tabindex", "0"); t.setAttribute("title", "プロフィールを見る");
    t.addEventListener("click", go2);
    t.addEventListener("keydown", e => { if (e.key === "Enter") go2(e); });
    return h("span", { class: "nametag" }, t, isAdm ? h("span", { class: "badge open admin-badge" }, "管理者") : null);
  }

  // メール認証の状態（{verified, frozen, seconds_left}。SQL 未実行などで取れないときは null）
  let acct = null;
  async function loadAccountStatus() {
    acct = null;
    if (!session) return;
    try {
      // メールのリンクでログインしてきた場合は、ここで「認証済み」が記録される
      await sb.rpc("confirm_my_email");
      const { data, error } = await sb.rpc("my_account_status");
      if (!error && data) acct = data;
    } catch (e) { /* 取れなければ、催促は出さない */ }
  }
  const daysLeft = () => acct ? Math.max(0, Math.ceil(acct.seconds_left / 86400)) : 0;
  // 認証メールを送る（メール内のリンクを開くと、認証済みになる）
  async function sendVerifyMail(addr) {
    const { error } = await sb.auth.signInWithOtp({ email: addr || session.user.email, options: { shouldCreateUser: false, emailRedirectTo: BASE_URL } });
    if (error) throw error;
  }
  // 未読メッセージ数（DM）
  let dmUnread = 0;
  async function refreshDmUnread() {
    if (!session) { dmUnread = 0; return; }
    try {
      const { count, error } = await sb.from("direct_messages").select("id", { count: "exact", head: true })
        .eq("recipient_id", session.user.id).is("read_at", null);
      dmUnread = error ? 0 : (count || 0);
    } catch (e) { dmUnread = 0; }
  }
  let dmTimer = null;
  const bannerEl = document.getElementById("banner");
  let nagged = false, naggedName = false;
  // 本名の入力欄（本人用）。送信すると 1段階目（本人による入力）が完了し、管理者の確認待ちになる
  const nameDaysLeft = () => acct ? Math.max(0, Math.ceil((acct.name_seconds_left || 0) / 86400)) : 0;
  function nameForm(onDone, opts) {
    opts = opts || {};
    const inp = h("input", { type: "text", maxlength: 50, required: true, autocomplete: "name", placeholder: "例）山田 太郎", value: opts.value || "" });
    const btn = h("button", { class: "btn primary" + (opts.small ? " small" : ""), type: "submit" }, opts.label || "送信する");
    const form = h("form", { class: "name-form" }, inp, btn);
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const nm = inp.value.trim();
        if (!nm) throw new Error("本名を入力してください。");
        const { error } = await sb.rpc("set_my_real_name", { p_name: nm });
        if (error) throw error;
        await loadAccountStatus();
        toast("本名を送信しました。管理者の確認をお待ちください");
        if (onDone) onDone();
      });
    });
    return form;
  }
  function renderBanner() {
    bannerEl.replaceChildren();
    if (!session || !acct || acct.frozen) return;
    if (!acct.verified) {
      const d = daysLeft();
      const send = h("button", { class: "btn small primary", type: "button" }, "認証メールを送る");
      send.addEventListener("click", () => busy(send, async () => {
        await sendVerifyMail();
        toast("認証メールを送りました。届いたメールのリンクを開いてください");
        send.textContent = "もう一度送る";
      }));
      bannerEl.append(h("div", { class: "verify-banner" },
        h("span", {}, "📧 メールアドレスの認証がまだ済んでいません。",
          d <= 1 ? h("strong", {}, "あと1日未満で、") : h("strong", {}, `あと${d}日で、`),
          "このアカウントは一時凍結されます（メール認証を完了するまで使えなくなります）。"),
        send));
      if (!nagged) { nagged = true; toast(`メール認証がまだです。あと${d}日で凍結されます`, true); }
    }
    if (acct.name_required === true && !acct.name_entered) {
      const d = nameDaysLeft();
      bannerEl.append(h("div", { class: "verify-banner name-banner" },
        h("div", { class: "name-banner-text" }, "📝 本名（フルネーム）を入力してください。",
          h("strong", {}, " 入力された名前は、管理者にしか見えません（他のユーザーには表示されません）。"),
          h("span", {}, d <= 1 ? " 入力がないと、あと1日未満で、" : ` 入力がないと、あと${d}日で、`),
          "このアカウントは一時凍結されます。"),
        nameForm(() => { renderNav(); route(); }, { small: true })));
      if (!naggedName) { naggedName = true; toast(`本名の入力がまだです。あと${d}日で凍結されます`, true); }
    }
  }

  async function loadProfile() {
    profile = null;
    isAdmin = false;
    acct = null;
    if (!session) return;
    const { data } = await sb.from("profiles").select("id,username").eq("id", session.user.id).maybeSingle();
    profile = data;
    // 管理者かどうかの確認（画面の出し分け用。実際の権限はデータベース側で強制される）
    const { data: adm } = await sb.rpc("is_admin");
    isAdmin = adm === true;
    await loadAccountStatus();
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
      if (event === "USER_UPDATED") {
        // メールアドレスの変更の完了・申請などで、ユーザー情報が変わったとき
        if (location.hash.startsWith("#/account")) route();
        return;
      }
      if (event === "SIGNED_IN" && uid && uid === lastUserId && acct && !acct.verified) {
        // メールのリンクから戻ってきたときなど：認証が済んだかを確認する
        await loadAccountStatus();
        if (acct && acct.verified) { toast("メール認証が完了しました"); renderNav(); route(); }
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
    renderBanner();
    navEl.replaceChildren();
    if (session) {
      // append(null) は「null」という文字が入ってしまうので、使わない要素は配列から除く
      navEl.append(...[
        h("a", { class: "who", href: "#/account", title: "ユーザー名の変更" }, profile ? `@${profile.username}` : "", isAdmin ? h("span", { class: "badge open", style: "margin-left:.4rem" }, "管理者") : null),
        h("a", { class: "btn small nav-dm", href: "#/messages", title: dmUnread ? `未読メッセージ ${dmUnread}件` : "メッセージ" },
          "💬 メッセージ", dmUnread ? h("span", { class: "nav-badge" }, dmUnread > 99 ? "99+" : String(dmUnread)) : null),
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
      .select("id,type,created_at,read_at,project_id,comment_id,request_id,post_id,actor_id,asset_request_id,actor:profiles!actor_id(username),project:projects(title),post:posts(title),comment:comments(body),request:big_upload_requests(status,granted,note),asset_req:asset_requests!asset_request_id(file_name,size_bytes,status,limit_bytes)")
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
    if (n.type === "asset_request") {
      const r = n.asset_req;
      return `${who} さんが、ファイル「${r ? r.file_name : "?"}」（${r ? fmtSize(r.size_bytes) : "?"}）の添付許可を要請しています`;
    }
    if (n.type === "asset_approved") {
      const r = n.asset_req;
      return `ファイル「${r ? r.file_name : "?"}」の添付が許可されました（${r ? fmtSize(r.limit_bytes) : "?"}まで）。企画ページの「画像・音声ファイル」で、もう一度そのファイルを選んで登録してください`;
    }
    if (n.type === "asset_rejected") return `ファイル「${n.asset_req ? n.asset_req.file_name : "?"}」の添付は許可されませんでした`;
    if (n.type === "verify_request") return `${who} さんが、メール認証（アカウントの認証）を要請しています`;
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
      else if (n.type === "verify_request") content = verifyItem(n);
      else if (n.type === "asset_request") content = assetRequestItem(n);
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
    return !(n.type === "upload_request" && n.request && n.request.status === "pending")
        && !(n.type === "asset_request" && n.asset_req && n.asset_req.status === "pending");
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

  // 管理者向け：500KBを超えるファイルの添付許可（ファイルごと）
  function assetRequestItem(n) {
    const r = n.asset_req;
    const box = h("div", { class: "bell-item req" + (n.read_at ? "" : " unread") },
      h("div", { class: "t" }, notifText(n)),
      h("div", { class: "d" }, fmtDate(n.created_at)));
    if (!r) return box;
    if (r.status === "pending") {
      const ok = h("button", { class: "btn small primary", type: "button" }, `許可（${fmtSize(Math.ceil(r.size_bytes * 1.05))}まで）`);
      const no = h("button", { class: "btn small danger", type: "button" }, "却下");
      const decide = (approve, btn) => busy(btn, async () => {
        const { error } = await sb.rpc("decide_asset_request", { p_id: n.asset_request_id, p_approve: approve });
        if (error) throw error;
        markRead(n);
        toast(approve ? "添付を許可しました" : "却下しました");
        await loadNotifs();
      });
      ok.addEventListener("click", () => decide(true, ok));
      no.addEventListener("click", () => decide(false, no));
      box.append(h("div", { class: "bell-req-actions" }, ok, no));
    } else {
      box.append(h("div", { class: "ex" }, r.status === "rejected" ? "× 却下済み" : "✓ 許可済み"));
    }
    return box;
  }

  // 管理者向け：メール認証の要請（認証済みにする）
  function verifyItem(n) {
    const who = n.actor ? n.actor.username : "?";
    const box = h("div", { class: "bell-item req" + (n.read_at ? "" : " unread") },
      h("div", { class: "t" }, notifText(n)),
      h("div", { class: "d" }, fmtDate(n.created_at)));
    const ok = h("button", { class: "btn small primary", type: "button" }, `@${who} を認証済みにする`);
    ok.addEventListener("click", () => {
      if (!confirm(`@${who} を、メール認証済みにします（ログインできるようになります）。よろしいですか？`)) return;
      busy(ok, async () => {
        const { error } = await sb.rpc("admin_verify_user", { p_user: n.actor_id });
        if (error) throw error;
        markRead(n);
        toast(`@${who} を認証済みにしました`);
        renderBell();
      });
    });
    const list = h("a", { class: "btn small", href: "#/admin" }, "ユーザー管理");
    list.addEventListener("click", () => { markRead(n); bellOpen = false; renderBell(); });
    box.append(h("div", { class: "bell-req-actions" }, ok, list));
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
    if (!n.project_id) { renderBell(); return; }   // 承認・却下・要請の通知は、既読にするだけ
    bellOpen = false;
    renderBell();
    const target = `#/project/${n.project_id}`;
    pendingScroll = n.comment_id;
    if (location.hash === target) route(); else go(target);
  }

  document.addEventListener("click", () => { if (bellOpen) { bellOpen = false; renderBell(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && bellOpen) { bellOpen = false; renderBell(); } });
  setInterval(() => { if (session && !document.hidden) loadNotifs(); }, 60000);
  // 新着メッセージの数（右上の「メッセージ」ボタンの数字）を、20秒ごとに更新
  setInterval(async () => {
    if (!session || document.hidden) return;
    const before = dmUnread;
    await refreshDmUnread();
    if (before !== dmUnread) renderNav();
  }, 20000);

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

  /* ======================================================
   * 添付ファイル（画像・音声）
   * ==================================================== */
  const ASSET_FREE = 500000;       // 許可なしで添付できる大きさ
  const ASSET_MAX = 3000000;       // 1ファイルの上限
  const ASSET_COUNT_MAX = 20;      // 1企画あたりの数
  const PROJECT_QUOTA = 20000000;  // 1企画あたりの容量（合計）。SQL の add_project_asset の値と同じにする
  const ASSET_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|avif|mp3|wav|ogg|m4a|aac|flac|opus)$/i;
  const assetNameOk = n => !!n && n.length <= 100 && !/[\\/:*?"<>|\u0000-\u001f]/.test(n) && !/^\./.test(n) && ASSET_EXT.test(n);
  const fmtSize = b => b >= 1000000 ? (b / 1000000).toFixed(2) + "MB" : Math.max(1, Math.round(b / 1000)) + "KB";
  const isAudioName = n => /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(n);

  function fileToB64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = () => reject(new Error("ファイルを読み込めませんでした。"));
      r.readAsDataURL(file);
    });
  }
  const dataUri = (mime, b64) => `data:${mime};base64,${b64}`;
  const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  // HTML / CSS / JS の中の「ファイル名」を、データURIに置き換える（プレビュー用）。
  // 例：<img src="photo.png"> や url(./photo.png)、new Audio('sound.mp3')
  function inlineAssets(text, assets) {
    let out = text;
    (assets || []).forEach(a => {
      const esc = a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("(?<![\\w./%-])(?:\\./)?" + esc + "(?![\\w-])", "g");
      const uri = dataUri(a.mime, a.b64);
      out = out.replace(re, () => uri);
    });
    return out;
  }
  const previewDoc = (p, assets) => inlineAssets(compose(p, false), assets);

  // プレビューの全画面表示（全画面 API が使えない端末では、画面いっぱいの重ね表示にする）
  function previewWithFullscreen(doc) {
    const wrap = h("div", { class: "preview-wrap", tabindex: "-1" });
    const frame = previewFrame(doc);
    const btn = h("button", { class: "btn small preview-fs", type: "button", title: "プレビューを全画面で表示" }, "⛶ 全画面");
    const isFs = () => document.fullscreenElement === wrap || wrap.classList.contains("fs-fixed");
    const sync = () => { btn.textContent = isFs() ? "✕ 閉じる" : "⛶ 全画面"; };
    function enter() {
      if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => { wrap.classList.add("fs-fixed"); sync(); });
      else { wrap.classList.add("fs-fixed"); sync(); }
    }
    function leave() {
      if (document.fullscreenElement === wrap) document.exitFullscreen();
      wrap.classList.remove("fs-fixed"); sync();
    }
    btn.addEventListener("click", () => (isFs() ? leave() : enter()));
    document.addEventListener("fullscreenchange", sync);
    wrap.addEventListener("keydown", e => { if (e.key === "Escape") leave(); });
    wrap.append(btn, frame);
    return wrap;
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

  async function downloadPostZip(p, assets) {
    const zip = new JSZip();
    zip.file("index.html", compose(p, true));
    if (p.css) zip.file("style.css", p.css);
    if (p.js) zip.file("script.js", p.js);
    if (p.memo) zip.file("memo.txt", p.memo);
    // 添付ファイルは index.html と同じ場所に入れる（<img src="photo.png"> のまま参照できる）
    (assets || []).forEach(a => zip.file(a.name, b64ToBytes(a.b64)));
    download(safeName(p.title) + ".zip", await zip.generateAsync({ type: "blob" }));
  }

  async function downloadProjectZip(project, total) {
    // 見る権限のある投稿だけがコード付きで返ってくる（限定公開で見られない投稿は含まれない）
    const { data, error } = await sb.rpc("get_project_posts", { p_project: project.id });
    if (error) throw error;
    if (!data.length) { toast(total ? "ダウンロードできる投稿がありません（限定公開のため）" : "まだ投稿がありません", true); return; }
    const { data: assetRows } = await sb.rpc("get_project_assets", { p_project: project.id });
    const zip = new JSZip();
    data.forEach((p, i) => {
      const dir = zip.folder(String(i + 1).padStart(2, "0") + "_" + safeName(p.title));
      dir.file("index.html", compose(p, true));
      if (p.css) dir.file("style.css", p.css);
      if (p.js) dir.file("script.js", p.js);
      if (p.memo) dir.file("memo.txt", p.memo);
      (assetRows || []).filter(a => a.post_id === p.id).forEach(a => dir.file(a.name, b64ToBytes(a.b64)));
    });
    download(safeName(project.title) + ".zip", await zip.generateAsync({ type: "blob" }));
    if (total && data.length < total) toast(`限定公開の${total - data.length}件は、閲覧できないため含まれていません`);
  }

  /* ======================================================
   * ルーター
   * ==================================================== */
  async function route() {
    const token = ++renderToken;
    clearInterval(dmTimer);
    await loadAdminNames();
    { const before = dmUnread; await refreshDmUnread(); if (before !== dmUnread) renderNav(); }
    loadNotifs();   // ベルの更新（待たない）
    const seg = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
    try {
      let view;
      const [a, b, c] = seg;
      if (session && acct && !acct.verified) { await loadAccountStatus(); renderNav(); }   // 別のタブで認証した場合に追いつく
      if (session && acct && acct.frozen && a !== "login") view = viewFrozen();
      else if (!a) view = await viewHome();
      else if (a === "login") view = viewLogin();
      else if (a === "signup") view = viewSignup();
      else if (a === "forgot") view = viewForgot();
      else if (a === "reset") view = viewReset();
      else if (a === "admin") view = await viewAdmin();
      else if (a === "account") view = viewAccount();
      else if (a === "user" && b) view = await viewUser(decodeURIComponent(b));
      else if (a === "messages" && b === "all") view = await viewDmAll();
      else if (a === "messages" && b) view = await viewThread(decodeURIComponent(b), token);
      else if (a === "messages") view = await viewMessages();
      else if (a === "dm" && b && c) view = await viewDmPair(decodeURIComponent(b), decodeURIComponent(c));
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
  function viewFrozen() {
    const parts = [];
    const emailF = acct.email_frozen !== false && !acct.verified;   // 古いSQLのままなら、従来どおりメールの凍結とみなす
    const nameF = acct.name_frozen === true;
    const refresh = async () => {
      await loadAccountStatus();
      if (acct && !acct.frozen) { toast("凍結を解除しました"); renderNav(); route(); }
      else { renderNav(); route(); }
    };
    if (emailF) {
      const send = h("button", { class: "btn primary", type: "button" }, "認証メールを送る");
      send.addEventListener("click", () => busy(send, async () => {
        await sendVerifyMail();
        toast("認証メールを送りました。届いたメールのリンクを開いてください");
      }));
      const recheck = h("button", { class: "btn", type: "button" }, "認証が済んだので、確認する");
      recheck.addEventListener("click", () => busy(recheck, async () => {
        await loadAccountStatus();
        if (acct && !acct.frozen) { toast("凍結を解除しました"); renderNav(); route(); }
        else if (acct && acct.verified) { renderNav(); route(); }
        else toast("まだ認証が確認できません。メールのリンクを開いてから、もう一度お試しください", true);
      }));
      parts.push(h("div", { class: "frozen-part" },
        h("h2", {}, "📧 メール認証"),
        h("p", {}, "登録から1週間がたっても、メールアドレスの認証が済んでいません。"),
        h("div", { class: "notice" }, h("strong", {}, "メール認証を完了すると、使えるようになります。"),
          h("br"), "「認証メールを送る」を押して、届いたメールのリンクを開いてください（メールが届くまで数分かかることがあります。迷惑メールフォルダも確認してください）。"),
        h("div", { class: "actions" }, send, recheck)));
    }
    if (nameF) {
      parts.push(h("div", { class: "frozen-part" },
        h("h2", {}, "📝 本名の入力"),
        h("p", {}, "登録から3日がたっても、本名の入力がありませんでした。"),
        h("div", { class: "notice" }, h("strong", {}, "本名を入力すると、使えるようになります。"),
          h("br"), "入力された名前は、管理者にしか見えません（他のユーザーには表示されません）。管理者が、誰が使っているのかを把握するために使います。"),
        nameForm(refresh, { label: "本名を送信する" })));
    }
    if (!parts.length) {
      const re = h("button", { class: "btn", type: "button" }, "状態を確認する");
      re.addEventListener("click", () => busy(re, refresh));
      parts.push(h("div", { class: "actions" }, re));
    }
    return h("div", { class: "card narrow" },
      h("h1", {}, "🧊 アカウントが一時凍結されています"),
      ...parts);
  }

  function viewLogin() {
    if (session) { setTimeout(() => go("#/"), 0); return h("div"); }
    const u = h("input", { type: "text", autocomplete: "username", required: true, maxlength: 20 });
    const p = h("input", { type: "password", autocomplete: "current-password", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, "ログイン");
    const notConfirmed = h("div", {});
    const form = h("form", { class: "card narrow" },
      h("h1", {}, "ログイン"),
      field("ユーザー名", u), field("パスワード", p), btn, notConfirmed,
      h("p", { class: "hint-mail" }, "📧 新規登録のあとは、確認メールのリンクを開くまでログインできません。"),
      h("p", { class: "links" }, h("a", { href: "#/forgot" }, "パスワードを忘れた方"), " ・ ", h("a", { href: "#/signup" }, "新規登録")));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        notConfirmed.replaceChildren();
        const { data: email, error: e1 } = await sb.rpc("email_for_username", { p_username: u.value.trim() });
        if (e1) throw e1;
        if (!email) throw new Error("Invalid login credentials");
        const { error } = await sb.auth.signInWithPassword({ email, password: p.value });
        if (error && /Email not confirmed/i.test(error.message)) {
          // メール未認証：認証メールの再送／管理者への認証の要請
          const username = u.value.trim();
          const ask = h("button", { class: "btn primary", type: "button" }, "管理者に認証を要請する");
          ask.addEventListener("click", () => busy(ask, async () => {
            const { error: e3 } = await sb.rpc("request_email_verify", { p_username: username });
            if (e3) throw e3;
            ask.disabled = true;
            ask.textContent = "要請しました";
            toast("管理者に認証を要請しました。認証されるまでお待ちください");
          }));
          const resend = h("button", { class: "btn", type: "button" }, "確認メールを再送する");
          resend.addEventListener("click", () => busy(resend, async () => {
            const { error: e4 } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: BASE_URL } });
            if (e4) throw e4;
            toast("確認メールを再送しました");
          }));
          notConfirmed.replaceChildren(h("div", { class: "notice" },
            h("strong", {}, "メールアドレスの認証が済んでいません。"),
            h("br"), "届いたメールのリンクを開いてください。メールが届かないときは、管理者に認証を要請できます。",
            h("div", { class: "actions", style: "margin-top:.6rem" }, ask, resend)));
          return;
        }
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
          h("li", {}, "届いたメールの中のリンクを開いて、メール認証を完了する"),
          h("li", {}, "ユーザー名とパスワードでログインする")),
        h("p", { class: "muted", style: "margin:.4rem 0 0" }, "登録から1週間たっても認証が済んでいないと、アカウントが一時凍結され、認証を完了するまで使えなくなります。")),
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
          // 確認メールなしで登録できる設定のとき：すぐ使えるが、認証メールを送って認証を促す
          try { await sendVerifyMail(); toast("登録しました。認証メールを送りました。届いたメールのリンクを開いてください"); }
          catch (e) { toast("登録しました。画面上部のボタンから、認証メールを送ってください"); }
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
              h("br"), "届いたメールの中のリンクを開いてください。リンクを開くまで、ログインできません。登録から1週間たっても認証が済んでいないアカウントは、一時凍結されます。"),
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

  // 管理者用：本名の表示・登録・確認（2段階目は管理者だけ）。cur = {status:'none'|'entered'|'confirmed', real_name}
  function adminNameBox(userId, username, cur, onChanged) {
    const box = h("div", { class: "name-admin" });
    const save = async (name, confirmToo) => {
      const { error } = await sb.rpc("admin_set_real_name", { p_user: userId, p_name: name, p_confirm: !!confirmToo });
      if (error) throw error;
      cur = { status: confirmToo ? "confirmed" : "entered", real_name: name.trim() };
      toast(confirmToo ? "本名を登録し、確認済みにしました" : "本名を登録しました（まだ確認前です）");
      show();
      if (onChanged) onChanged(cur);
    };
    function edit() {
      box.replaceChildren();
      const inp = h("input", { type: "text", maxlength: 50, placeholder: "本名（フルネーム）", value: cur.real_name || "" });
      const b1 = h("button", { class: "btn small", type: "button" }, "保存");
      const b2 = h("button", { class: "btn small primary", type: "button" }, "保存して確認済みに");
      const b3 = h("button", { class: "btn small", type: "button" }, "やめる");
      const need = () => { const v = inp.value.trim(); if (!v) throw new Error("本名を入力してください。"); return v; };
      b1.addEventListener("click", () => busy(b1, () => save(need(), false)));
      b2.addEventListener("click", () => busy(b2, () => save(need(), true)));
      b3.addEventListener("click", show);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); b1.click(); } });
      box.append(inp, h("div", { class: "name-acts" }, b1, b2, b3));
      inp.focus();
    }
    function show() {
      box.replaceChildren();
      const st = cur.status || "none";
      box.append(h("div", { class: "name-line" },
        st === "none" ? h("span", { class: "muted" }, "（未入力）") : h("strong", {}, cur.real_name),
        st === "confirmed" ? h("span", { class: "badge open" }, "✓ 確認済み")
          : st === "entered" ? h("span", { class: "badge" }, "入力済み・未確認")
          : h("span", { class: "badge lock" }, "未入力")));
      const acts = h("div", { class: "name-acts" });
      if (st === "entered") {
        const c = h("button", { class: "btn small primary", type: "button" }, "確認済みにする");
        c.addEventListener("click", () => {
          if (!confirm(`@${username} の本名「${cur.real_name}」を、確認済みにします。よろしいですか？\n（確認後は、本人は名前を変更できません）`)) return;
          busy(c, async () => {
            const { error } = await sb.rpc("admin_confirm_real_name", { p_user: userId, p_confirm: true });
            if (error) throw error;
            cur = { status: "confirmed", real_name: cur.real_name };
            toast("確認済みにしました");
            show();
            if (onChanged) onChanged(cur);
          });
        });
        acts.append(c);
      }
      const e = h("button", { class: "btn small", type: "button" }, st === "none" ? "登録する" : "修正する");
      e.addEventListener("click", edit);
      acts.append(e);
      box.append(acts);
    }
    show();
    return box;
  }

  /* ======================================================
   * 管理者：ユーザー管理（ユーザー名・メールアドレスの一覧、アカウント削除）
   * ==================================================== */
  async function viewAdmin() {
    if (!session) return needLogin("ログインが必要です。");
    if (!isAdmin) return h("div", { class: "error-box" }, "管理者だけが開けるページです。");
    const { data, error } = await sb.rpc("admin_list_users");
    if (error) throw error;
    let rows = data || [];

    const search = h("input", { type: "search", class: "search", placeholder: "ユーザー名・メールアドレス・本名で検索…" });
    const nameFilter = h("select", { class: "name-filter", "aria-label": "本名の状態で絞り込み" },
      h("option", { value: "" }, "本名：すべて"),
      h("option", { value: "none" }, "本名：未入力"),
      h("option", { value: "entered" }, "本名：入力済み・未確認"),
      h("option", { value: "confirmed" }, "本名：確認済み"));
    const refresh = async () => {
      const r2 = await sb.rpc("admin_list_users");
      if (r2.error) throw r2.error;
      rows = r2.data || [];
      draw();
    };
    const tbody = h("tbody", {});
    const count = h("span", { class: "muted" }, "");
    const dateOnly = s => (s ? new Date(s).toLocaleDateString("ja-JP") : "—");

    function draw() {
      const q = search.value.trim().toLowerCase();
      const nf = nameFilter.value;
      const items = rows.filter(r => (!q || (r.username + " " + r.email + " " + (r.real_name || "")).toLowerCase().includes(q)) &&
        (!nf || (r.name_status || "none") === nf));
      count.textContent = `${items.length}人 / 全${rows.length}人`;
      tbody.replaceChildren();
      if (!items.length) tbody.append(h("tr", {}, h("td", { colspan: 7, class: "muted" }, "該当するユーザーがいません。")));
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
        if (!r.email_confirmed) {
          const ver = h("button", { class: "btn small", type: "button", style: "margin-right:.3rem" }, "認証済みにする");
          ver.addEventListener("click", () => {
            if (!confirm(`@${r.username} を、メール認証済みにします（凍結中なら解除されます）。よろしいですか？`)) return;
            busy(ver, async () => {
              const { error: e3 } = await sb.rpc("admin_verify_user", { p_user: r.user_id });
              if (e3) throw e3;
              toast("認証済みにしました");
              route();
            });
          });
          action = h("span", {}, ver, action);
        }
        tbody.append(h("tr", {},
          h("td", {}, nameTag(r.username, true), r.is_admin && !adminNames.has(String(r.username).toLowerCase()) ? h("span", { class: "badge open admin-badge" }, "管理者") : null),
          h("td", { class: "mail" }, r.email),
          h("td", {}, dateOnly(r.created_at)),
          h("td", { class: "namecell" }, r.name_status === undefined ? h("span", { class: "muted" }, "—")
            : adminNameBox(r.user_id, r.username, { status: r.name_status, real_name: r.real_name }, () => refresh().catch(e => toast(friendly(e), true)))),
          h("td", {}, r.email_confirmed ? h("span", { class: "badge open" }, "認証済み") : h("span", { class: "badge" }, "未認証"),
            r.frozen ? h("span", { class: "badge lock", style: "margin-left:.3rem" }, "🧊 凍結中") : null),
          h("td", {}, `${r.project_count} / ${r.post_count}`),
          h("td", {}, action)));
      });
    }
    search.addEventListener("input", draw);
    nameFilter.addEventListener("change", draw);
    draw();

    return h("section", {},
      h("div", { class: "page-head" }, h("h1", {}, "👤 ユーザー管理"), count),
      h("p", { class: "notice" }, "管理者だけが見られるページです。メールアドレスと本名は他の人には表示されません。取り扱いにご注意ください。",
        h("br"), "本名の確認は2段階です：①本人が入力（または管理者が登録）→ ②管理者が「確認済みにする」。登録から3日たっても本名が未入力のユーザーは、自動的に一時凍結されます（管理者は対象外）。"),
      h("div", { class: "search-row" }, search, nameFilter),
      h("div", { class: "card table-wrap" },
        h("table", { class: "table" },
          h("thead", {}, h("tr", {},
            h("th", {}, "ユーザー名"), h("th", {}, "メールアドレス"), h("th", {}, "登録日"),
            h("th", {}, "本名（管理者のみ）"), h("th", {}, "メール認証"), h("th", {}, "企画 / 投稿"), h("th", {}, "操作"))),
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
    const count = p.postCount || 0;
    return h("a", { class: "card project-card", href: `#/project/${p.id}` },
      h("h3", {}, p.title),
      p.description ? h("p", { class: "desc" }, p.description) : null,
      h("div", { class: "meta" },
        openBadge(p),
        h("span", {}, "企画主 ", nameTag(p.owner && p.owner.username)),
        h("span", {}, `投稿 ${count}件`)));
  }

  async function viewHome() {
    const { data, error } = await sb.from("projects")
      .select("id,title,description,allow_others_post,created_at,owner_id,owner:profiles!owner_id(username)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    // 投稿数は、投稿の project_id だけを取得して数える（1000件ずつ）
    const counts = {};
    for (let from = 0; from < 100000; from += 1000) {
      const r = await sb.from("posts").select("project_id").order("id").range(from, from + 999);
      if (r.error) break;
      (r.data || []).forEach(x => { counts[x.project_id] = (counts[x.project_id] || 0) + 1; });
      if (!r.data || r.data.length < 1000) break;
    }
    data.forEach(p => { p.postCount = counts[p.id] || 0; });

    const search = h("input", { type: "search", class: "search", placeholder: "企画を検索…" });
    const list = h("div", { class: "grid" });
    let onlyMine = false;
    const mineBtn = session ? h("button", { class: "btn", type: "button" }, "自分の企画") : null;
    if (mineBtn) mineBtn.addEventListener("click", () => {
      onlyMine = !onlyMine;
      mineBtn.classList.toggle("primary", onlyMine);
      mineBtn.textContent = onlyMine ? "✓ 自分の企画（解除する）" : "自分の企画";
      draw();
    });
    function draw() {
      const q = search.value.trim().toLowerCase();
      const items = data.filter(p => (!onlyMine || (session && p.owner_id === session.user.id)) &&
        (!q || (p.title + " " + p.description).toLowerCase().includes(q)));
      list.replaceChildren();
      if (!items.length) list.append(h("p", { class: "muted empty" }, onlyMine && !q ? "あなたが企画主の企画はまだありません。" : data.length ? "該当する企画がありません。" : "まだ企画がありません。最初の企画を作ってみましょう！"));
      items.forEach(p => list.append(projectCard(p)));
    }
    search.addEventListener("input", draw);
    draw();

    return h("section", {},
      h("div", { class: "page-head" },
        h("h1", {}, "企画一覧"),
        session ? h("a", { class: "btn primary", href: "#/new-project" }, "＋ 企画を作る") : null),
      h("div", { class: "search-row" }, search, mineBtn), list);
  }

  /* ======================================================
   * プロフィール
   * ==================================================== */
  const likeEsc = t => t.replace(/[\\%_]/g, m => "\\" + m);
  async function findProfile(name) {
    const { data, error } = await sb.from("profiles").select("id,username,created_at").ilike("username", likeEsc(name)).limit(1);
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  }

  async function viewUser(name) {
    const pf = await findProfile(name);
    if (!pf) return h("div", { class: "error-box" }, "そのユーザーは見つかりませんでした。");
    const [pr, po] = await Promise.all([
      sb.from("projects").select("id,title,description,created_at").eq("owner_id", pf.id).order("created_at", { ascending: false }),
      sb.from("posts").select("id,title,created_at,project:projects(title)").eq("author_id", pf.id).eq("is_public", true)
        .order("created_at", { ascending: false }).limit(50)
    ]);
    if (pr.error) throw pr.error;
    if (po.error) throw po.error;
    const me = session && session.user.id === pf.id;
    // 本名は、管理者にだけ表示する
    let nameCard = null;
    if (isAdmin) {
      const { data: rn, error: rnErr } = await sb.rpc("admin_get_real_name", { p_user: pf.id });
      if (!rnErr && rn) nameCard = h("div", { class: "card name-card" },
        h("h2", {}, "📝 本名（管理者にだけ見えています）"),
        adminNameBox(pf.id, pf.username, { status: rn.status, real_name: rn.real_name }));
    }
    const actions = !session ? h("a", { class: "btn small", href: "#/login" }, "ログインしてメッセージを送る")
      : me ? h("a", { class: "btn small", href: "#/account" }, "アカウント設定")
      : h("a", { class: "btn primary", href: `#/messages/${encodeURIComponent(pf.username)}` }, "💬 メッセージを送る");
    return h("div", {},
      h("div", { class: "card" },
        h("h1", {}, "@" + pf.username, adminNames.has(pf.username.toLowerCase()) ? h("span", { class: "badge open admin-badge", style: "margin-left:.5rem" }, "管理者") : null),
        h("div", { class: "meta" }, h("span", {}, "登録日 " + fmtDate(pf.created_at)),
          h("span", {}, `企画 ${pr.data.length}件`), h("span", {}, `公開投稿 ${po.data.length}件`)),
        h("div", { class: "actions" }, actions)),
      nameCard,
      h("h2", {}, "この人の企画"),
      pr.data.length
        ? h("div", { class: "grid" }, ...pr.data.map(p => h("a", { class: "card project-card", href: `#/project/${p.id}` },
            h("h3", {}, p.title), p.description ? h("p", { class: "desc" }, p.description) : null,
            h("div", { class: "meta" }, h("span", {}, fmtDate(p.created_at))))))
        : h("p", { class: "muted" }, "企画はまだありません。"),
      h("h2", {}, "この人の公開投稿"),
      po.data.length
        ? h("div", { class: "list" }, ...po.data.map(p => h("a", { class: "card post-item", href: `#/post/${p.id}` },
            h("strong", {}, p.title),
            h("span", { class: "muted" }, ` ／ 企画：${p.project ? p.project.title : "?"} ／ ${fmtDate(p.created_at)}`))))
        : h("p", { class: "muted" }, "公開投稿はまだありません。"));
  }

  /* ======================================================
   * メッセージ（DM）
   * ==================================================== */
  // 頭文字の丸アイコン（名前ごとに色が決まる）
  function avatar(name, size) {
    let hsh = 0; for (const ch of String(name)) hsh = (hsh * 31 + ch.charCodeAt(0)) % 360;
    return h("span", { class: "avatar" + (size ? " " + size : ""), style: `background:hsl(${hsh},55%,48%)`, "aria-hidden": "true" },
      String(name).charAt(0).toUpperCase());
  }
  const dmTime = iso => {
    const d = new Date(iso), now = new Date();
    const hm = d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === now.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  };
  const DM_SELECT = "id,sender_id,recipient_id,body,created_at,read_at,edited_at,sender:profiles!sender_id(username),recipient:profiles!recipient_id(username)";
  const dmNotice = () => h("p", { class: "muted dm-note" }, "メッセージは1週間で自動削除されます");

  async function viewMessages() {
    if (!session) return needLogin("メッセージを使うにはログインが必要です。");
    const me = session.user.id;
    const { data, error } = await sb.from("direct_messages").select(DM_SELECT)
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`).order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    const convs = new Map();
    (data || []).forEach(m => {
      const other = m.sender_id === me ? m.recipient : m.sender;
      const name = other ? other.username : "?";
      if (!convs.has(name)) convs.set(name, { name, last: m, unread: 0 });
      if (m.recipient_id === me && !m.read_at) convs.get(name).unread++;
    });
    const picker = userPicker({
      placeholder: "ユーザー名で検索して、新しくメッセージを送る…",
      exclude: uid => uid === me,
      onPick: u => { go(`#/messages/${encodeURIComponent(u.username)}`); }
    });
    const list = h("div", { class: "list" });
    if (!convs.size) list.append(h("p", { class: "muted" }, "メッセージはまだありません。ユーザーのプロフィールか、上の検索から送れます。"));
    convs.forEach(c => list.append(h("a", { class: "dm-conv" + (c.unread ? " unread" : ""), href: `#/messages/${encodeURIComponent(c.name)}` },
      avatar(c.name),
      h("div", { class: "dm-conv-main" },
        h("div", { class: "dm-conv-top" }, h("strong", {}, c.name), h("span", { class: "dm-conv-time" }, dmTime(c.last.created_at))),
        h("div", { class: "dm-preview" }, (c.last.sender_id === me ? "あなた：" : "") + c.last.body)),
      c.unread ? h("span", { class: "dm-dot", title: `未読 ${c.unread}` }, String(c.unread)) : null)));
    return h("div", {},
      h("h1", {}, "💬 メッセージ"),
      dmNotice(),
      isAdmin ? h("p", {}, h("a", { class: "btn small", href: "#/messages/all" }, "🛡 すべてのメッセージを見る（管理者）")) : null,
      h("div", { class: "dm-new" }, picker.node),
      h("div", { class: "dm-list" }, list));
  }

  // メッセージ1件。送った本人と管理者には「編集」「削除」が付く。reload は変更後の再読み込み。
  function dmBubble(m, meId, reload) {
    const mine = m.sender_id === meId;
    const canAct = !!reload && (mine || isAdmin);
    const bubble = h("div", { class: "dm-bubble" }, m.body);
    const meta = h("div", { class: "dm-time" },
      (m.sender && !mine ? m.sender.username + "・" : "") + dmTime(m.created_at) + (m.edited_at ? "（編集済み）" : ""));
    const row = h("div", { class: "dm-row" + (mine ? " mine" : ""), "data-id": m.id }, bubble, meta);
    if (!canAct) return row;

    const edit = h("button", { class: "dm-act", type: "button" }, "編集");
    const del = h("button", { class: "dm-act danger", type: "button" }, "削除");
    meta.append(edit, del);
    del.addEventListener("click", () => {
      if (!confirm("このメッセージを削除します。よろしいですか？")) return;
      busy(del, async () => {
        const { error } = await sb.rpc("delete_dm", { p_id: m.id });
        if (error) throw error;
        toast("メッセージを削除しました");
        await reload();
      });
    });
    edit.addEventListener("click", () => {
      row.classList.add("editing");
      const ta = h("textarea", { class: "dm-edit", rows: 2 });
      ta.value = m.body;
      const warn = h("div", { class: "dm-warn hidden", role: "alert" });
      const save = h("button", { class: "btn small primary", type: "button" }, "保存");
      const cancel = h("button", { class: "btn small", type: "button" }, "キャンセル");
      const done = () => { row.classList.remove("editing"); return reload(); };
      const doSave = () => busy(save, async () => {
        const nb = ta.value.trim();
        if (!nb) { warn.textContent = "メッセージを入力してください"; warn.classList.remove("hidden"); return; }
        if (!isAdmin && nb.length > 200) { warn.textContent = "一回の投稿で200文字までです"; warn.classList.remove("hidden"); return; }
        if (nb === m.body) { await done(); return; }
        const { error } = await sb.rpc("edit_dm", { p_id: m.id, p_body: nb });
        if (error) throw error;
        toast("メッセージを編集しました");
        await done();
      });
      save.addEventListener("click", doSave);
      cancel.addEventListener("click", done);
      ta.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); doSave(); }     // Shift+Enter で保存
        else if (e.key === "Escape") { e.preventDefault(); done(); }
      });
      row.replaceChildren(warn, ta, h("div", { class: "dm-edit-actions" }, cancel, save));
      ta.focus();
    });
    return row;
  }

  async function viewThread(name, token) {
    if (!session) return needLogin("メッセージを使うにはログインが必要です。");
    const pf = await findProfile(name);
    if (!pf) return h("div", { class: "error-box" }, "そのユーザーは見つかりませんでした。");
    if (pf.id === session.user.id) return h("div", { class: "error-box" }, "自分自身には送れません。");
    const me = session.user.id;
    const box = h("div", { class: "dm-box" });
    async function load() {
      const { data, error } = await sb.from("direct_messages").select(DM_SELECT)
        .or(`and(sender_id.eq.${me},recipient_id.eq.${pf.id}),and(sender_id.eq.${pf.id},recipient_id.eq.${me})`)
        .order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40 || !box.childElementCount;
      if (box.querySelector(".editing")) return;    // 編集中は、自動更新で入力を消さない
      box.replaceChildren(...(data.length ? data.map(m => dmBubble(m, me, load)) : [h("p", { class: "muted" }, "まだメッセージはありません。")]));
      if (stick) box.scrollTop = box.scrollHeight;
      if (data.some(m => m.recipient_id === me && !m.read_at)) {
        await sb.rpc("mark_dm_read", { p_with: pf.id });
        await refreshDmUnread(); renderNav();
      }
    }
    await load();
    dmTimer = setInterval(() => { if (token === renderToken && !document.hidden) load().catch(() => {}); }, 8000);

    const ta = h("textarea", { rows: 1, placeholder: isAdmin ? "メッセージを入力（制限なし）" : "メッセージを入力" });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; });
    // Enter は改行、Shift+Enter で送信
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    const counter = h("span", { class: "muted" }, "");
    const warn = h("div", { class: "dm-warn hidden", role: "alert" });
    const showWarn = msg => { warn.textContent = msg; warn.classList.remove("hidden"); clearTimeout(showWarn.t); showWarn.t = setTimeout(() => warn.classList.add("hidden"), 4000); };
    ta.addEventListener("input", () => {
      if (isAdmin) return;
      const over = ta.value.length > 200;
      counter.textContent = ta.value.length ? `${ta.value.length} / 200` : "";
      counter.classList.toggle("over", over);
      if (over) { warn.textContent = "一回の投稿で200文字までです"; warn.classList.remove("hidden"); }
      else if (warn.textContent.startsWith("一回の投稿")) warn.classList.add("hidden");
    });
    let lastSent = 0;
    const send = h("button", { class: "dm-send", type: "submit", title: "送信（Shift+Enter）", "aria-label": "送信" }, "➤");
    const form = h("form", { class: "dm-form" }, warn, h("div", { class: "dm-input" }, ta, send), counter);
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(send, async () => {
        const body = ta.value.trim();
        if (!body) return;
        if (!isAdmin && body.length > 200) { showWarn("一回の投稿で200文字までです"); return; }
        if (!isAdmin && Date.now() - lastSent < 3000) { showWarn("送信は3秒に1回までです"); return; }
        const { error } = await sb.rpc("send_dm", { p_to: pf.id, p_body: body });
        if (error) {
          if (/too fast/i.test(error.message)) { showWarn("送信は3秒に1回までです"); return; }
          if (/too long/i.test(error.message)) { showWarn("一回の投稿で200文字までです"); return; }
          throw error;
        }
        lastSent = Date.now();
        ta.value = ""; ta.style.height = "auto"; counter.textContent = ""; counter.classList.remove("over"); warn.classList.add("hidden");
        await load(); box.scrollTop = box.scrollHeight;
      });
    });
    return h("div", { class: "dm-app" },
      h("div", { class: "dm-head" },
        h("a", { class: "dm-back", href: "#/messages", "aria-label": "メッセージ一覧へ戻る" }, "←"),
        avatar(pf.username, "sm"), nameTag(pf.username, true)),
      box, form,
      h("p", { class: "dm-foot muted" }, "メッセージは1週間で自動削除されます"));
  }

  // 管理者：すべてのメッセージ
  async function viewDmAll() {
    if (!isAdmin) return h("div", { class: "error-box" }, "管理者だけが見られるページです。");
    const { data, error } = await sb.from("direct_messages").select(DM_SELECT).order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    const q = h("input", { type: "search", class: "search", placeholder: "ユーザー名・本文で絞り込み…" });
    const list = h("div", { class: "list" });
    function draw() {
      const t = q.value.trim().toLowerCase();
      list.replaceChildren();
      const rows = data.filter(m => !t || (`${m.sender && m.sender.username} ${m.recipient && m.recipient.username} ${m.body}`).toLowerCase().includes(t));
      if (!rows.length) list.append(h("p", { class: "muted" }, "該当するメッセージがありません。"));
      rows.forEach(m => {
        const a = m.sender ? m.sender.username : "?", b = m.recipient ? m.recipient.username : "?";
        list.append(h("a", { class: "dm-conv", href: `#/dm/${encodeURIComponent(a)}/${encodeURIComponent(b)}` },
          avatar(a),
          h("div", { class: "dm-conv-main" },
            h("div", { class: "dm-conv-top" }, h("strong", {}, `${a} → ${b}`), h("span", { class: "dm-conv-time" }, dmTime(m.created_at))),
            h("div", { class: "dm-preview" }, m.body))));
      });
    }
    q.addEventListener("input", draw);
    draw();
    return h("div", {}, h("p", {}, h("a", { href: "#/messages" }, "← メッセージ一覧")),
      h("h1", {}, "🛡 すべてのメッセージ（管理者）"),
      h("p", { class: "muted" }, "直近1週間・最新500件まで。クリックすると、その2人のやり取りを開きます。"), q, h("div", { class: "dm-list" }, list));
  }

  async function viewDmPair(a, b) {
    if (!isAdmin) return h("div", { class: "error-box" }, "管理者だけが見られるページです。");
    const [pa, pb] = await Promise.all([findProfile(a), findProfile(b)]);
    if (!pa || !pb) return h("div", { class: "error-box" }, "ユーザーが見つかりませんでした。");
    const box = h("div", { class: "dm-box" });
    async function load() {
      const { data, error } = await sb.from("direct_messages").select(DM_SELECT)
        .or(`and(sender_id.eq.${pa.id},recipient_id.eq.${pb.id}),and(sender_id.eq.${pb.id},recipient_id.eq.${pa.id})`)
        .order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      box.replaceChildren(...(data.length ? data.map(m => dmBubble(m, pa.id, load)) : [h("p", { class: "muted" }, "メッセージはありません。")]));
    }
    await load();
    return h("div", { class: "dm-app" },
      h("div", { class: "dm-head" }, h("a", { class: "dm-back", href: "#/messages/all", "aria-label": "戻る" }, "←"),
        avatar(pa.username, "sm"), h("strong", {}, "@" + pa.username), h("span", { class: "muted" }, "と"), avatar(pb.username, "sm"), h("strong", {}, "@" + pb.username),
        h("span", { class: "badge", style: "margin-left:auto" }, "🛡 管理者の閲覧")),
      box);
  }

  function viewAccount() {
    if (!session || !profile) return needLogin("ユーザー名を変更するにはログインが必要です。");
    const u = h("input", { type: "text", required: true, maxlength: 20, pattern: "[A-Za-z0-9_]{3,20}", value: profile.username, autocomplete: "off" });
    const btn = h("button", { class: "btn primary", type: "submit" }, "変更する");
    const form = h("form", { class: "card form" },
      h("h1", {}, "アカウント設定"),
      h("p", { class: "muted" }, "ユーザー名は半角英数字とアンダースコアの3〜20文字です。変更すると、ログイン時のユーザー名も新しい名前になります。投稿・コメントなどには新しい名前が表示されます。" +
        (isAdmin ? "管理者の権限は、名前を変えてもそのまま引き継がれます。" : "")),
      field("ユーザー名", u),
      h("div", { class: "actions" }, btn, h("a", { class: "btn", href: "#/" }, "戻る")));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const name = u.value.trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error("ユーザー名は半角英数字とアンダースコアの3〜20文字にしてください。");
        if (name === profile.username) throw new Error("今のユーザー名と同じです。");
        const { error } = await sb.rpc("change_username", { p_new: name });
        if (error) throw error;
        await loadProfile();
        await loadAdminNames();
        renderNav();
        toast("ユーザー名を変更しました");
        go("#/");
      });
    });
    return h("div", {}, form, realNameCard(), emailCard(), passwordCard());
  }

  // 自分の本名（1段階目：本人の入力 → 2段階目：管理者の確認）
  function realNameCard() {
    if (!acct || acct.name_required !== true) return null;   // 管理者、または SQL が未実行のとき
    const confirmed = acct.name_confirmed, entered = acct.name_entered;
    const status = confirmed ? h("span", { class: "badge open" }, "✓ 管理者が確認済み")
      : entered ? h("span", { class: "badge" }, "入力済み・管理者の確認待ち")
      : h("span", { class: "badge lock" }, "未入力");
    return h("div", { class: "card form" },
      h("h2", {}, "📝 本名", status),
      h("p", { class: "muted" }, "誰が使っているのかを管理者が把握するための情報です。",
        h("strong", {}, "入力された名前は、管理者にしか見えません。"), "他のユーザーには表示されません。" +
        (confirmed ? "管理者が確認済みのため、ご自身では変更できません。変更したいときは管理者に連絡してください。" : "")),
      confirmed ? h("p", {}, h("strong", {}, acct.my_real_name))
        : nameForm(() => route(), { value: acct.my_real_name || "", label: entered ? "修正して送り直す" : "送信する" }));
  }

  // メールアドレスの変更：今のパスワードで本人確認 → 確認メール内のリンクを開くと変更が完了
  function emailCard() {
    const cur = session.user.email || "";
    const pending = session.user.new_email || "";
    const ne = h("input", { type: "email", autocomplete: "email", required: true });
    const pw = h("input", { type: "password", autocomplete: "current-password", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, "確認メールを送る");
    const form = h("form", { class: "card form" },
      h("h2", {}, "✉️ メールアドレスの変更"),
      h("p", {}, "現在のメールアドレス：", h("strong", {}, cur)),
      pending ? h("div", { class: "notice" }, `📧 ${pending} への変更を、確認待ちです。届いたメールのリンクを開くと、変更が完了します（設定によっては、現在のアドレスにも確認メールが届き、両方のリンクを開く必要があります）。`) : null,
      h("p", { class: "muted" }, "メールアドレスは、パスワードを忘れたときの再設定や、認証メールの送り先に使われます。実際に受け取れるアドレスを入力してください。"),
      field("新しいメールアドレス", ne),
      field("今のパスワード（本人確認）", pw),
      h("div", { class: "actions" }, btn));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const next = ne.value.trim();
        if (next.toLowerCase() === cur.toLowerCase()) throw new Error("should be different");
        const { error: e1 } = await sb.auth.signInWithPassword({ email: cur, password: pw.value });
        if (e1) throw new Error("今のパスワードが違います。");
        const { data, error } = await sb.auth.updateUser({ email: next }, { emailRedirectTo: BASE_URL });
        if (error) throw error;
        pw.value = ""; ne.value = "";
        const u = data && data.user;
        if (u && !u.new_email && String(u.email || "").toLowerCase() === next.toLowerCase()) {
          // 確認なしで変更された設定：認証済みの記録を外し、新しいアドレスで認証し直してもらう（7日の猶予）
          await sb.rpc("reset_email_verification");
          try { await sendVerifyMail(next); } catch (e2) { /* 画面上部のボタンから再送できる */ }
          await loadAccountStatus();
          renderNav();
          toast("メールアドレスを変更しました。新しいアドレスに届いた認証メールのリンクを開いてください（7日以内）");
          return;
        }
        toast(`${next} に確認メールを送りました。届いたメールのリンクを開くと、変更が完了します`);
      });
    });
    return form;
  }

  // パスワード変更：①今のパスワード → ②メールに届く認証コード → ③新しいパスワード
  function passwordCard() {
    const old = h("input", { type: "password", autocomplete: "current-password", required: true });
    const sendBtn = h("button", { class: "btn", type: "submit" }, "① 認証コードをメールで送る");
    const code = h("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 12, placeholder: "メールに届いたコード" });
    const n1 = h("input", { type: "password", autocomplete: "new-password", minlength: 8 });
    const n2 = h("input", { type: "password", autocomplete: "new-password", minlength: 8 });
    const changeBtn = h("button", { class: "btn primary", type: "button" }, "② パスワードを変更する");
    const step2 = h("div", { class: "hidden" },
      h("div", { class: "notice" }, "📧 " + (session.user.email || "") + " に、認証コードを送りました。届いたコードと、新しいパスワードを入力してください。"),
      field("メールに届いた認証コード", code),
      field("新しいパスワード", n1, "8文字以上"),
      field("新しいパスワード（確認）", n2),
      h("div", { class: "actions" }, changeBtn));
    const form = h("form", { class: "card form" },
      h("h2", {}, "🔑 パスワードの変更"),
      h("p", { class: "muted" }, "安全のため、「今のパスワード」「メールで届く認証コード」「新しいパスワード」の3つが必要です。"),
      field("今のパスワード", old),
      h("div", { class: "actions" }, sendBtn),
      step2);
    let oldPw = "";
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(sendBtn, async () => {
        // 今のパスワードが正しいかを、実際にログインして確かめる
        const { error: e1 } = await sb.auth.signInWithPassword({ email: session.user.email, password: old.value });
        if (e1) throw new Error("今のパスワードが違います。");
        const { error: e2 } = await sb.auth.reauthenticate();
        if (e2) throw e2;
        oldPw = old.value;
        step2.classList.remove("hidden");
        toast("認証コードをメールで送りました");
      });
    });
    changeBtn.addEventListener("click", () => busy(changeBtn, async () => {
      if (!code.value.trim()) throw new Error("メールに届いた認証コードを入力してください。");
      if (n1.value.length < 8) throw new Error("新しいパスワードは8文字以上にしてください。");
      if (n1.value !== n2.value) throw new Error("新しいパスワードが一致しません。");
      if (n1.value === oldPw) throw new Error("新しいパスワードは、今のパスワードと違うものにしてください。");
      const { error } = await sb.auth.updateUser({ password: n1.value, nonce: code.value.trim(), current_password: oldPw });
      if (error) throw error;
      [old, code, n1, n2].forEach(i => { i.value = ""; });
      oldPw = "";
      step2.classList.add("hidden");
      toast("パスワードを変更しました");
    }));
    return form;
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
    const { data, error } = await sb.from("projects").select("*, owner:profiles!owner_id(username)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return data;
    // 共同編集者（企画主・管理者のほかに、設定変更と投稿ができる人）
    const { data: collabs } = await sb.from("project_collaborators").select("user_id,can_view_limited,can_edit_settings,can_post,user:profiles!user_id(username)").eq("project_id", id).order("created_at");
    data.collaborators = collabs || [];
    data.myCollab = session ? (data.collaborators.find(c => c.user_id === session.user.id) || null) : null;
    data.isCollab = !!data.myCollab;
    return data;
  }

  // 共同編集者の管理欄（追加・削除は企画主と管理者だけ。共同編集者本人は一覧を見るだけ）
  function collaboratorsBox(project, canManage) {
    const box = h("div", { class: "card" }, h("h2", {}, "👥 共同編集者"),
      h("p", { class: "muted", style: "margin-top:0" },
        "共同編集者に何を許可するかは、人ごとに企画主が決められます（限定公開の投稿を見る／企画の設定（企画名・説明・投稿許可）を変更する／企画へ投稿する）。他の人の投稿の編集・削除や、企画の削除はできません。"));
    const list = h("div", {});
    function drawList() {
      list.replaceChildren();
      if (!project.collaborators.length) list.append(h("p", { class: "muted" }, "共同編集者はいません。"));
      project.collaborators.forEach(c => {
        const row = h("div", { class: "picker-row collab-row" }, h("span", { class: "collab-name" }, "@" + (c.user ? c.user.username : "?")));
        const permDefs = [["can_view_limited", "限定公開を見る"], ["can_edit_settings", "企画の設定変更"], ["can_post", "投稿"]];
        const perms = h("span", { class: "perms" });
        permDefs.forEach(([key, label]) => {
          if (canManage) {
            const cb = h("input", { type: "checkbox" });
            cb.checked = c[key] !== false;
            cb.addEventListener("change", async () => {
              cb.disabled = true;
              const { error } = await sb.from("project_collaborators").update({ [key]: cb.checked }).eq("project_id", project.id).eq("user_id", c.user_id);
              cb.disabled = false;
              if (error) { cb.checked = !cb.checked; toast(friendly(error), true); return; }
              c[key] = cb.checked;
              toast("権限を変更しました");
            });
            perms.append(h("label", { class: "perm" }, cb, " " + label));
          } else {
            perms.append(h("span", { class: "badge " + (c[key] !== false ? "open" : "") }, label + (c[key] !== false ? "：可" : "：不可")));
          }
        });
        row.append(perms);
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
    if (!isOwnerOrAdmin && !(project.myCollab && project.myCollab.can_edit_settings)) return h("div", { class: "error-box" }, "企画主、または設定変更を許可された共同編集者だけが設定を変更できます。");

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
    return !!session && (project.owner_id === session.user.id || isAdmin || (project.myCollab && project.myCollab.can_post) || project.allow_others_post);
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
        h("div", { class: "meta" }, nameTag(name, true), h("span", {}, fmtDate(c.created_at))),
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
    const [project, postsRes, commentsRes, myViewRes, limitRes] = await Promise.all([
      fetchProject(id),
      sb.from("posts").select("id,title,created_at,author_id,is_public,allow_download,author:profiles!author_id(username)")
        .eq("project_id", id).order("created_at", { ascending: false }),
      sb.from("comments").select("id,body,created_at,author_id,parent_id,author:profiles!author_id(username)")
        .eq("project_id", id).order("created_at", { ascending: true }),
      // 自分が閲覧を許可されている限定公開の投稿
      session ? sb.from("post_viewers").select("post_id").eq("user_id", session.user.id) : Promise.resolve({ data: [] }),
      // この企画で投稿できるHTMLの数の上限（ファイルがあれば3個、なければ6個。SQL未更新なら null）
      sb.rpc("project_post_limit", { p_project: id })
    ]);
    if (!project) return notFound();
    const postLimit = limitRes && typeof limitRes.data === "number" ? limitRes.data : null;
    if (postsRes.error) throw postsRes.error;
    const posts = postsRes.data;
    const isOwner = !!session && (project.owner_id === session.user.id || isAdmin);
    const canEditProject = isOwner || !!(project.myCollab && project.myCollab.can_edit_settings);
    const canSeeLimited = isOwner || !!(project.myCollab && project.myCollab.can_view_limited);
    const myViewable = new Set((myViewRes.data || []).map(v => v.post_id));
    // 添付ファイル（画像・音声）のある投稿
    const hasAssets = new Set();
    if (posts.length) {
      const ar = await sb.from("asset_targets").select("post_id").in("post_id", posts.map(p => p.id));
      (ar.data || []).forEach(a => hasAssets.add(a.post_id));
    }
    // 画面の出し分け用（実際にコードが渡されるかどうかは、データベース側が判定する）
    const canSee = p => p.is_public !== false || (!!session && (p.author_id === session.user.id || canSeeLimited || myViewable.has(p.id)));

    const zipBtn = h("button", { class: "btn", type: "button" }, "⬇ 企画まるごとZIP");
    zipBtn.addEventListener("click", () => busy(zipBtn, () => downloadProjectZip(project, posts.length)));

    let postAction;
    if (canPost(project) && postLimit !== null && posts.length >= postLimit) postAction = h("span", { class: "badge lock", title: "画像・音声のファイルがある企画は3個まで、ない企画は6個までです" }, `HTMLの上限（${postLimit}個）に達しています`);
    else if (canPost(project)) postAction = h("a", { class: "btn primary", href: `#/project/${id}/new` }, "＋ コードを投稿");
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
          const { count, error } = await sb.from("posts").delete({ count: "exact" }).in("id", [...selected]);
          if (error) throw error;
          const done = count || 0;
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
        const dlOk = p.is_public === false || p.allow_download !== false || (!!session && (p.author_id === session.user.id || isOwner || !!project.myCollab));
        if (visible && !dlOk) {
          dlBtn = h("span", { class: "badge", title: "投稿者がダウンロードを許可していません" }, "⬇ ダウンロード不可");
        } else if (visible && hasAssets.has(p.id)) {
          // 添付ファイルがある投稿は、ZIPだけ
          dlBtn = h("button", { class: "btn small", type: "button" }, "⬇ ZIPでダウンロード");
          dlBtn.addEventListener("click", () => busy(dlBtn, async () => {
            const [pr, ar] = await Promise.all([sb.rpc("get_post", { p_id: p.id }), sb.rpc("get_post_assets", { p_post: p.id })]);
            if (pr.error) throw pr.error;
            if (!pr.data || !pr.data.can_view) throw new Error("この投稿は限定公開のため、ダウンロードできません。");
            if (!pr.data.can_download) throw new Error("この投稿は、投稿者がダウンロードを許可していません。");
            await downloadPostZip(pr.data, ar.data || []);
          }));
        } else if (visible) {
          dlBtn = h("button", { class: "btn small", type: "button" }, "⬇ htmlとしてダウンロード");
          dlBtn.addEventListener("click", () => busy(dlBtn, async () => {
            const { data, error } = await sb.rpc("get_post", { p_id: p.id });
            if (error) throw error;
            if (!data) throw new Error("投稿が見つかりません。");
            if (!data.can_view) throw new Error("この投稿は限定公開のため、ダウンロードできません。");
            if (!data.can_download) throw new Error("この投稿は、投稿者がダウンロードを許可していません。");
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
            h("div", { class: "meta" }, nameTag(p.author && p.author.username), h("span", {}, fmtDate(p.created_at)), hasAssets.has(p.id) ? h("span", { title: "画像・音声を使っています" }, "🖼 画像・音声あり") : null)),
          h("div", { class: "actions" },
            h("a", { class: "btn small", href: `#/post/${p.id}` }, "開く"),
            dlBtn)));
      });
    }
    function draw() { drawBulkBar(); drawList(); }
    draw();

    // 画像・音声ファイルの管理は、ふだんは隠しておき、ボタンを押したときだけ出す（初回に読み込む）
    let assetBtn = null, assetSlot = null;
    if (canManageAssets(project)) {
      assetSlot = h("div", { class: "asset-slot hidden" });
      assetBtn = h("button", { class: "btn", type: "button", "aria-expanded": "false" }, "🖼 画像・音声");
      let panel = null;
      assetBtn.addEventListener("click", () => {
        if (!panel) { panel = assetManager(project, posts); assetSlot.append(panel); }
        const open = assetSlot.classList.toggle("hidden") === false;
        assetBtn.setAttribute("aria-expanded", String(open));
        assetBtn.classList.toggle("primary", open);
        if (open) assetSlot.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    return h("section", {},
      h("div", { class: "card" },
        h("div", { class: "page-head" },
          h("div", {},
            h("h1", {}, project.title),
            h("div", { class: "meta" }, openBadge(project), h("span", {}, "企画主 ", nameTag(project.owner && project.owner.username)),
              project.collaborators.length ? h("span", {}, "共同編集者 ", ...project.collaborators.flatMap((c, i) => [i ? "、" : null, nameTag(c.user && c.user.username)].filter(Boolean))) : null,
              h("span", {}, fmtDate(project.created_at)))),
          h("div", { class: "actions" }, zipBtn, assetBtn, canEditProject ? h("a", { class: "btn", href: `#/project/${id}/edit` }, "⚙ 設定") : null)),
        project.description ? h("p", { style: "white-space:pre-wrap;margin:0" }, project.description) : null),
      assetSlot,
      h("div", { class: "page-head" }, h("h2", {}, postLimit !== null ? `投稿（${posts.length} / 上限${postLimit}）` : `投稿（${posts.length}）`), h("div", { class: "actions" }, bulkBtn, postAction)),
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

  /* ======================================================
   * 企画の画像・音声ファイル（企画ページで登録 → 使うHTML（投稿）を選ぶ）
   * ==================================================== */
  const canManageAssets = project => !!session && (project.owner_id === session.user.id || isAdmin || !!(project.myCollab && project.myCollab.can_post));
  const assetIcon = n => (isAudioName(n) ? "🎵" : "🖼");
  const postLabel = p => p.title + (p.is_public === false ? " 🔒" : "");

  // 「使うHTML」のチェック一覧。onChange(新しい選択の集合) を返す
  function postChecks(posts, selected, onChange, opts) {
    opts = opts || {};
    const box = h("div", { class: "target-list" });
    const cbs = posts.map(p => {
      const cb = h("input", { type: "checkbox" });
      cb.checked = selected.has(p.id);
      cb.addEventListener("change", () => {
        const next = new Set(posts.filter((_, i) => cbs[i].checked).map(x => x.id));
        onChange(next, cb);
      });
      box.append(h("label", { class: "perm" }, cb, " " + postLabel(p)));
      return cb;
    });
    if (!posts.length) box.append(h("span", { class: "muted" }, "この企画には、まだHTML（投稿）がありません。"));
    return { node: box, set(ids) { posts.forEach((p, i) => { cbs[i].checked = ids.has(p.id); }); }, get: () => new Set(posts.filter((_, i) => cbs[i].checked).map(x => x.id)) };
  }

  // 企画ページ：ファイルの登録のしかた（アップロード欄）
  function assetUploader(ctx) {
    const node = h("div", { class: "asset-upload" });
    const picks = [];
    const input = h("input", { type: "file", multiple: true, accept: "image/*,audio/*,.png,.jpg,.jpeg,.gif,.webp,.bmp,.ico,.avif,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus" });
    const groupSel = h("select", { "aria-label": "入れるグループ" });
    const list = h("div", { class: "asset-list" });
    const upBtn = h("button", { class: "btn primary", type: "button" }, "⬆ ファイルを登録する");
    let checks = null;
    const targetBox = h("div", { class: "upload-targets" });

    function stateOf(it) {
      const dup = ctx.getAssets().some(e => e.name === it.name) || picks.some(p => p !== it && p.name === it.name);
      if (!assetNameOk(it.name)) return { kind: "bad", text: "使えないファイル名か、種類です（画像・音声のみ。名前に / \\ : * ? \" < > | は使えません）" };
      if (dup) return { kind: "bad", text: "同じ名前のファイルがあります" };
      if (it.size > ASSET_MAX) return { kind: "bad", text: "1ファイル3MBまでです" };
      if (it.size <= ASSET_FREE || isAdmin) return { kind: "ok" };
      const reqs = ctx.getReqs();
      const appr = reqs.find(r => r.status === "approved" && r.file_name === it.name && it.size <= r.limit_bytes
        && !picks.some(p => p !== it && p.req && p.req.id === r.id));
      if (appr) return { kind: "approved", req: appr };
      if (reqs.some(r => r.status === "pending" && r.file_name === it.name && r.size_bytes === it.size)) return { kind: "pending" };
      const rej = reqs.find(r => r.status === "rejected" && r.file_name === it.name && r.size_bytes === it.size);
      return { kind: rej ? "rejected" : "need" };
    }

    function drawPicks() {
      list.replaceChildren();
      picks.forEach(it => {
        const st = stateOf(it);
        it.req = st.kind === "approved" ? st.req : null;
        const rm = h("button", { class: "btn small", type: "button" }, "外す");
        rm.addEventListener("click", () => { picks.splice(picks.indexOf(it), 1); drawPicks(); });
        const right = [];
        if (st.kind === "ok") right.push(h("span", { class: "badge open" }, "OK"));
        if (st.kind === "approved") right.push(h("span", { class: "badge open" }, `✓ 管理者が許可済み（${fmtSize(st.req.limit_bytes)}まで）`));
        if (st.kind === "pending") right.push(h("span", { class: "badge" }, "⏳ 管理者の許可待ち"));
        if (st.kind === "bad") right.push(h("span", { class: "badge lock" }, st.text));
        if (st.kind === "need" || st.kind === "rejected") {
          const ask = h("button", { class: "btn small primary", type: "button" }, "管理者に許可を要請");
          ask.addEventListener("click", () => busy(ask, async () => {
            const { error } = await sb.rpc("request_asset_upload", { p_name: it.name, p_size: it.size });
            if (error) throw error;
            await ctx.reloadReqs();
            toast("管理者に許可を要請しました。許可されると通知が届きます");
            drawPicks();
          }));
          right.push(st.kind === "rejected" ? h("span", { class: "badge lock" }, "却下されました") : h("span", { class: "badge" }, "500KB超：管理者の許可が必要"), ask);
        }
        list.append(h("div", { class: "asset-row" },
          h("span", { class: "asset-fname" }, assetIcon(it.name) + " " + it.name), h("span", { class: "muted" }, fmtSize(it.size)), ...right, rm));
      });
      upBtn.classList.toggle("hidden", !picks.length);
    }

    // グループを選んだら、そのグループのファイルが共通して使っているHTMLを、最初から選んでおく
    function inheritTargets() {
      const gid = groupSel.value;
      const mates = ctx.getAssets().filter(a => gid && a.group_id === gid);
      if (!mates.length || !checks) return;
      let common = null;
      mates.forEach(a => { const t = ctx.getTargets(a.id); common = common ? new Set([...common].filter(x => t.has(x))) : new Set(t); });
      checks.set(common || new Set());
    }
    groupSel.addEventListener("change", inheritTargets);

    input.addEventListener("change", () => {
      [...input.files].forEach(f => {
        if (ctx.getAssets().length + picks.length >= ASSET_COUNT_MAX) { toast(`登録できるのは、1企画につき${ASSET_COUNT_MAX}ファイルまでです`, true); return; }
        picks.push({ file: f, name: f.name, size: f.size, req: null });
      });
      input.value = "";
      drawPicks();
    });

    upBtn.addEventListener("click", () => busy(upBtn, async () => {
      const used = ctx.getAssets().reduce((n, a) => n + (a.size || 0), 0), adding = picks.reduce((n, x) => n + x.size, 0);
      if (used + adding > PROJECT_QUOTA) throw new Error(`この企画の容量の上限（${fmtSize(PROJECT_QUOTA)}）を超えます（いま${fmtSize(used)}、今回${fmtSize(adding)}）。ファイルを減らすか、使っていないファイルを削除してください。`);
      if (ctx.getPostCount() > 3) throw new Error("HTMLが4個以上ある企画には、画像・音声を登録できません（ファイルがある企画は、HTMLを3個までです）。");
      for (const it of picks) {
        const st = stateOf(it);
        if (st.kind === "bad") throw new Error(`「${it.name}」：${st.text}`);
        if (st.kind === "pending") throw new Error(`「${it.name}」は、管理者の許可待ちです。許可されると通知が届きます。それまでは、そのファイルを外してください。`);
        if (st.kind === "need" || st.kind === "rejected") throw new Error(`「${it.name}」は500KBを超えています。「管理者に許可を要請」を押すか、そのファイルを外してください。`);
      }
      const targets = checks ? [...checks.get()] : [];
      let done = 0, failed = null;
      for (const it of [...picks]) {
        const st = stateOf(it);
        try {
          const b64 = await fileToB64(it.file);
          const { error } = await sb.rpc("add_project_asset", {
            p_project: ctx.project.id, p_name: it.name, p_b64: b64,
            p_request: st.kind === "approved" ? st.req.id : null,
            p_group: groupSel.value || null, p_posts: targets
          });
          if (error) throw error;
          picks.splice(picks.indexOf(it), 1);
          done++;
        } catch (e) { failed = `「${it.name}」を登録できませんでした：${friendly(e)}`; break; }
      }
      if (done) toast(`${done}個のファイルを登録しました`);
      await ctx.onChanged();
      await ctx.reloadReqs();
      drawPicks();
      if (failed) throw new Error(failed);
    }));

    node.append(
      h("h3", {}, "⬆ ファイルを登録"),
      h("p", { class: "muted", style: "margin:.2rem 0 .6rem" },
        "png / jpg / gif / webp、mp3 / wav / ogg などを登録できます。1ファイル500KBまではそのまま登録できます（1企画の合計は20MBまで）。500KBを超えるファイルは、ファイルごとに管理者の許可が必要です（申請した大きさの5％増しまで・最大3MB）。"),
      input,
      h("div", { class: "upload-opts" }, h("label", {}, "入れるグループ：", groupSel)),
      targetBox, list, h("div", { class: "actions" }, upBtn));
    drawPicks();

    return {
      node,
      refresh() {
        const cur = groupSel.value;
        groupSel.replaceChildren(h("option", { value: "" }, "グループなし"), ...ctx.getGroups().map(g => h("option", { value: g.id }, g.name)));
        groupSel.value = ctx.getGroups().some(g => g.id === cur) ? cur : "";
        const posts = ctx.getPosts();
        const prev = checks ? checks.get() : new Set();
        checks = postChecks(posts, prev, () => {});
        targetBox.replaceChildren(h("div", { class: "muted", style: "margin:.4rem 0 .2rem" }, "使うHTML（登録するファイルを入れるHTML。あとからでも変えられます）："), checks.node);
        drawPicks();
      }
    };
  }

  // 企画ページ：登録済みファイルの管理（グループ分け・使うHTMLの選択）
  function assetManager(project, posts) {
    const root = h("div", { class: "card assets-manager" });
    let groups = [], assets = [], targets = new Map(), myReqs = [];
    const head = h("div", {});
    const listBox = h("div", { class: "asset-groups" });
    const tgt = id => targets.get(id) || new Set();
    const titleOf = id => { const p = posts.find(x => x.id === id); return p ? p.title : "?"; };

    async function reloadReqs() {
      const { data } = await sb.from("asset_requests").select("id,file_name,size_bytes,status,limit_bytes")
        .eq("user_id", session.user.id).order("created_at", { ascending: false });
      myReqs = data || [];
    }
    async function load() {
      const [g, a] = await Promise.all([
        sb.from("asset_groups").select("id,name").eq("project_id", project.id).order("created_at"),
        sb.from("project_assets").select("id,group_id,name,mime,size,created_at").eq("project_id", project.id).order("created_at")]);
      if (g.error) throw g.error;
      if (a.error) throw a.error;
      groups = g.data || [];
      assets = a.data || [];
      targets = new Map(assets.map(x => [x.id, new Set()]));
      if (assets.length) {
        const t = await sb.from("asset_targets").select("asset_id,post_id").in("asset_id", assets.map(x => x.id));
        if (t.error) throw t.error;
        (t.data || []).forEach(r => { if (targets.has(r.asset_id)) targets.get(r.asset_id).add(r.post_id); });
      }
      render();
    }

    const uploader = assetUploader({
      project, getAssets: () => assets, getGroups: () => groups, getTargets: tgt, getPosts: () => posts,
      getPostCount: () => posts.length, getReqs: () => myReqs, reloadReqs, onChanged: load
    });

    function groupSection(g, items) {
      const sec = h("div", { class: "asset-group" });
      const bar = h("div", { class: "asset-group-head" }, h("strong", {}, g ? "📁 " + g.name : "📂 グループなし"), h("span", { class: "muted" }, `（${items.length}）`));
      if (g) {
        const ren = h("button", { class: "btn small", type: "button" }, "名前を変える");
        ren.addEventListener("click", () => {
          const nm = prompt("グループの新しい名前（30文字まで）", g.name);
          if (nm === null) return;
          busy(ren, async () => {
            const { error } = await sb.rpc("rename_asset_group", { p_group: g.id, p_name: nm });
            if (error) throw error;
            await load();
          });
        });
        const del = h("button", { class: "btn small danger", type: "button" }, "グループを削除");
        del.addEventListener("click", () => {
          if (!confirm(`グループ「${g.name}」を削除します。中のファイルは消えず、「グループなし」になります。よろしいですか？`)) return;
          busy(del, async () => {
            const { error } = await sb.rpc("delete_asset_group", { p_group: g.id });
            if (error) throw error;
            await load();
          });
        });
        bar.append(h("span", { class: "grow" }), ren, del);
      }
      sec.append(bar);
      // グループ全体の使うHTMLを、まとめて設定
      if (g && items.length) {
        const all = posts.filter(p => items.every(a => tgt(a.id).has(p.id))).map(p => p.id);
        const pc = postChecks(posts, new Set(all), () => {});
        const apply = h("button", { class: "btn small primary", type: "button" }, "グループの全ファイルに適用");
        apply.addEventListener("click", () => {
          if (!confirm(`グループ「${g.name}」の全${items.length}ファイルが使うHTMLを、選んだものにそろえます（個別に選んでいた内容は上書きされます）。よろしいですか？`)) return;
          busy(apply, async () => {
            const { error } = await sb.rpc("set_asset_targets", { p_assets: items.map(a => a.id), p_posts: [...pc.get()] });
            if (error) throw error;
            toast("グループの全ファイルに適用しました");
            await load();
          });
        });
        sec.append(h("details", { class: "targets group-targets" },
          h("summary", {}, "このグループ全体で使うHTMLを、まとめて選ぶ"), pc.node,
          h("div", { class: "actions", style: "margin-top:.4rem" }, apply)));
      }
      if (!items.length) sec.append(h("p", { class: "muted", style: "margin:.3rem 0" }, "ファイルがありません。上の「入れるグループ」でこのグループを選んで登録するか、下のファイルのグループ欄から移してください。"));
      items.forEach(a => sec.append(fileRow(a)));
      return sec;
    }

    function fileRow(a) {
      const wrap = h("div", { class: "asset-file" });
      const gs = h("select", { "aria-label": "グループ" }, h("option", { value: "" }, "グループなし"), ...groups.map(g => h("option", { value: g.id }, g.name)));
      gs.value = a.group_id || "";
      gs.addEventListener("change", () => busy(gs, async () => {
        const { error } = await sb.rpc("move_assets_to_group", { p_assets: [a.id], p_group: gs.value || null });
        if (error) { gs.value = a.group_id || ""; throw error; }
        await load();
      }));
      const del = h("button", { class: "btn small danger", type: "button" }, "削除");
      del.addEventListener("click", () => {
        if (!confirm(`「${a.name}」を削除します。使っているHTMLからも外れます。よろしいですか？`)) return;
        busy(del, async () => {
          const { error } = await sb.rpc("delete_project_asset", { p_asset: a.id });
          if (error) throw error;
          await load();
        });
      });
      const summary = h("summary", {});
      const sumText = () => {
        const ids = [...tgt(a.id)];
        summary.textContent = ids.length ? "使うHTML：" + ids.map(titleOf).join("、") : "使うHTML：なし（どのHTMLのプレビュー・ダウンロードにも入りません）";
        summary.classList.toggle("none", !ids.length);
      };
      sumText();
      const pc = postChecks(posts, tgt(a.id), async (next, cb) => {
        cb.disabled = true;
        const { error } = await sb.rpc("set_asset_targets", { p_assets: [a.id], p_posts: [...next] });
        cb.disabled = false;
        if (error) { pc.set(tgt(a.id)); toast(friendly(error), true); return; }
        targets.set(a.id, next);
        sumText();
        toast("使うHTMLを変更しました");
      });
      wrap.append(
        h("div", { class: "asset-row" }, h("span", { class: "asset-fname" }, assetIcon(a.name) + " " + a.name), h("span", { class: "muted" }, fmtSize(a.size)), h("span", { class: "grow" }), gs, del),
        h("details", { class: "targets" }, summary, pc.node));
      return wrap;
    }

    function render() {
      const limit = assets.length ? 3 : 6;
      const used = assets.reduce((n, a) => n + (a.size || 0), 0);
      const pct = Math.min(100, Math.round(used / PROJECT_QUOTA * 100));
      head.replaceChildren(
        h("div", { class: "quota" + (pct >= 90 ? " warn" : "") },
          h("div", {}, `容量：${fmtSize(used)} / ${fmtSize(PROJECT_QUOTA)}（${pct}%）　ファイル：${assets.length} / ${ASSET_COUNT_MAX}`),
          h("div", { class: "quota-bar" }, h("div", { class: "quota-fill", style: `width:${pct}%` }))),
        h("p", { class: "notice" },
          `HTMLの数の上限：ファイルがある企画は3個まで、ない企画は6個までです（いま${posts.length}個・上限${limit}個）。`,
          posts.length > 3 && !assets.length ? h("strong", {}, " いまはHTMLが4個以上あるので、ファイルを登録するには、HTMLを3個以下にしてください。") : null,
          assets.length && posts.length > 3 ? h("strong", {}, " HTMLが上限を超えているため、新しいHTMLは投稿できません。") : null));
      uploader.refresh();
      listBox.replaceChildren();
      if (!assets.length && !groups.length) listBox.append(h("p", { class: "muted" }, "まだファイルがありません。"));
      groups.forEach(g => listBox.append(groupSection(g, assets.filter(a => a.group_id === g.id))));
      const loose = assets.filter(a => !a.group_id);
      if (loose.length) listBox.append(groupSection(null, loose));
    }

    // グループの作成
    const gName = h("input", { type: "text", maxlength: 30, placeholder: "例）キャラ画像、効果音" });
    const gBtn = h("button", { class: "btn", type: "button" }, "＋ グループを作る");
    const mkGroup = () => busy(gBtn, async () => {
      const nm = gName.value.trim();
      if (!nm) throw new Error("グループ名を入力してください。");
      const { error } = await sb.rpc("create_asset_group", { p_project: project.id, p_name: nm });
      if (error) throw error;
      gName.value = "";
      toast("グループを作りました");
      await load();
    });
    gBtn.addEventListener("click", mkGroup);
    gName.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); mkGroup(); } });

    root.append(
      h("h2", {}, "🖼 画像・音声ファイル"),
      h("p", { class: "muted", style: "margin-top:0" },
        "ファイルは、HTMLではなく企画に登録します。ファイルごとに「使うHTML」を選ぶと、そのHTMLのプレビューとZIPダウンロードに、ファイルが入ります（HTMLの中ではファイル名のまま書けます：", h("code", {}, '<img src="photo.png">'), "）。ファイルは「グループ」に分けて管理できます。"),
      head, uploader.node,
      h("div", { class: "group-create" }, h("strong", {}, "グループ："), gName, gBtn),
      listBox);
    Promise.all([reloadReqs(), load()]).then(() => render()).catch(e => root.append(h("div", { class: "error-box" }, "ファイルの一覧を読み込めませんでした：" + friendly(e) + "（データベースの更新が済んでいない可能性があります）")));
    return root;
  }

  // 投稿フォーム：この投稿（HTML）で使う画像・音声を、企画のファイルから選ぶ
  function assetSelect(project, post) {
    const node = h("div", { class: "assets-box" });
    let groups = [], assets = [], chosen = new Set(), orig = new Set(), loaded = false;
    const cache = new Map();
    const manage = canManageAssets(project);

    function draw() {
      node.replaceChildren();
      node.append(h("h3", {}, "🖼 この投稿で使う画像・音声"));
      if (!assets.length) {
        node.append(h("p", { class: "muted", style: "margin:.2rem 0" },
          loaded ? "この企画には、使える画像・音声がありません。" : "読み込み中…",
          loaded && manage && project.id ? h("span", {}, " ファイルは、企画ページの「画像・音声ファイル」で登録できます。") : null));
        return;
      }
      node.append(h("p", { class: "muted", style: "margin:.2rem 0 .6rem" },
        "企画に登録されたファイルから、このHTMLで使うものを選びます。選んだファイルは、このHTMLのプレビューとZIPダウンロードに入ります（HTMLの中ではファイル名のまま書けます）。"));
      const secs = [...groups.map(g => ({ name: "📁 " + g.name, items: assets.filter(a => a.group_id === g.id) })), { name: "📂 グループなし", items: assets.filter(a => !a.group_id) }];
      secs.forEach(s => {
        if (!s.items.length) return;
        const sec = h("div", { class: "asset-group" });
        const allOn = s.items.every(a => chosen.has(a.id));
        const toggle = h("button", { class: "btn small", type: "button" }, allOn ? "すべて外す" : "すべて選ぶ");
        toggle.addEventListener("click", () => { s.items.forEach(a => (allOn ? chosen.delete(a.id) : chosen.add(a.id))); draw(); });
        sec.append(h("div", { class: "asset-group-head" }, h("strong", {}, s.name), h("span", { class: "grow" }), toggle));
        s.items.forEach(a => {
          const cb = h("input", { type: "checkbox" });
          cb.checked = chosen.has(a.id);
          cb.addEventListener("change", () => { if (cb.checked) chosen.add(a.id); else chosen.delete(a.id); draw(); });
          sec.append(h("label", { class: "asset-pick" }, cb, h("span", { class: "asset-fname" }, assetIcon(a.name) + " " + a.name), h("span", { class: "muted" }, fmtSize(a.size))));
        });
        node.append(sec);
      });
    }
    draw();
    if (session) {
      Promise.all([
        sb.from("asset_groups").select("id,name").eq("project_id", project.id).order("created_at"),
        sb.from("project_assets").select("id,group_id,name,mime,size,created_at").eq("project_id", project.id).order("created_at"),
        post ? sb.from("asset_targets").select("asset_id").eq("post_id", post.id) : Promise.resolve({ data: [] })
      ]).then(([g, a, t]) => {
        groups = g.data || []; assets = a.data || [];
        orig = new Set((t.data || []).map(x => x.asset_id).filter(id => assets.some(x => x.id === id)));
        chosen = new Set(orig);
        loaded = true; draw();
      }).catch(() => { loaded = true; draw(); });
    }
    const changed = () => chosen.size !== orig.size || [...chosen].some(id => !orig.has(id));
    return {
      node,
      changed,
      // 保存した投稿に、選んだファイルを紐づける
      async save(postId) {
        if (!loaded || !changed()) return;
        const { error } = await sb.rpc("set_post_assets", { p_post: postId, p_assets: [...chosen] });
        if (error) throw error;
      },
      // プレビュー用：選んだファイルの中身
      async previewAssets() {
        const need = [...chosen].filter(id => !cache.has(id));
        for (let i = 0; i < need.length; i += 20) {
          const { data, error } = await sb.rpc("get_assets_data", { p_ids: need.slice(i, i + 20) });
          if (error) throw error;
          (data || []).forEach(a => cache.set(a.id, a));
        }
        return [...chosen].map(id => cache.get(id)).filter(Boolean);
      }
    };
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
    // 一般公開のときだけ出る「ダウンロードを許可する」
    const allowDl = h("input", { type: "checkbox", checked: editing ? post.allow_download !== false : true });
    const dlRow = h("label", { class: "check" }, allowDl,
      h("span", {}, "ダウンロードを許可する",
        h("small", { class: "hint" }, "オフにすると、他の人にはダウンロードボタンが出ません（プレビューとコードの閲覧はできます）。作成者・企画主・共同編集者・管理者は、この設定にかかわらずダウンロードできます。投稿したあとも変更できます。")));
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
    const syncVisibility = () => { limitedBox.classList.toggle("hidden", isPublic.checked); dlRow.classList.toggle("hidden", !isPublic.checked); };
    isPublic.addEventListener("change", syncVisibility);
    // 編集のときは、いまの閲覧者を読み込む
    const viewersReady = editing
      ? sb.from("post_viewers").select("user_id,user:profiles!user_id(username)").eq("post_id", post.id).then(r => {
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
    const assetsUI = assetSelect(project, post);
    const prevBtn = h("button", { class: "btn", type: "button" }, "▶ プレビュー");
    prevBtn.addEventListener("click", () => busy(prevBtn, async () => {
      const as = await assetsUI.previewAssets();
      previewBox.classList.remove("hidden");
      previewBox.replaceChildren(previewFrame(previewDoc({ title: title.value, html: html.value, css: css.value, js: js.value }, as)));
    }));

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
      assetsUI.node,
      publicRow, dlRow, limitedBox,
      field("メモ（任意）", memo, "改善した点・変更点・使い方などを自由に書けます（2000文字まで）。投稿ページに表示されます。"),
      bigBox,
      h("div", { class: "actions" }, btn, prevBtn, h("a", { class: "btn", href: back }, "キャンセル")),
      previewBox);

    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        const row = { title: title.value.trim(), html: html.value, css: css.value, js: js.value, memo: memo.value.trim(), is_public: isPublic.checked, allow_download: allowDl.checked };
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
          try { await assetsUI.save(post.id); }
          catch (e) { toast("使う画像・音声を保存できませんでした：" + friendly(e), true); go(`#/post/${post.id}/edit`); return; }
          toast("保存しました");
          go(`#/post/${post.id}`);
        } else {
          const newId = (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-" + String(Date.now()).padStart(12, "0").slice(-12));
          const { error } = await sb.from("posts")
            .insert({ ...row, id: newId, project_id: project.id, author_id: session.user.id });
          if (error) throw error;
          if (isBigNow && !isAdmin) await refreshQuota();
          await syncViewers(newId);
          try { await assetsUI.save(newId); }
          catch (e) {
            // 投稿そのものは保存済み。使うファイルは、編集画面から選び直す
            toast("使う画像・音声を保存できませんでした：" + friendly(e) + "（投稿は保存されています。編集から選び直してください）", true);
            go(`#/post/${newId}/edit`);
            return;
          }
          toast("投稿しました");
          go(`#/post/${newId}`);
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
    const [limRes, cntRes] = await Promise.all([sb.rpc("project_post_limit", { p_project: projectId }), sb.from("posts").select("id").eq("project_id", projectId)]);
    const lim = limRes && typeof limRes.data === "number" ? limRes.data : null;
    if (lim !== null && cntRes.data && cntRes.data.length >= lim)
      return h("div", { class: "error-box" }, `この企画のHTMLは、上限（${lim}個）に達しています。画像・音声のファイルがある企画は3個まで、ない企画は6個までです。`, h("br"), h("a", { href: `#/project/${projectId}` }, "企画に戻る"));
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

  // 限定公開の「公開対象」欄：コードを見られる人の一覧と、追加・削除（作成者・企画主・管理者）
  function viewersBox(post) {
    const box = h("div", { class: "card" }, h("h2", {}, "👁 公開対象（限定公開）"),
      h("p", { class: "muted", style: "margin-top:0" },
        "ここに追加した人は、この投稿のプレビュー・コードの閲覧・ダウンロードができます。作成者・企画主・管理者と、閲覧を許可された共同編集者は、追加しなくても見られます。"));
    const list = h("div", {});
    const viewers = new Map();
    function drawList() {
      list.replaceChildren();
      if (!viewers.size) list.append(h("p", { class: "muted" }, "追加された人はまだいません。"));
      viewers.forEach((name, uid) => {
        const del = h("button", { class: "btn small danger", type: "button" }, "外す");
        del.addEventListener("click", () => busy(del, async () => {
          const { error } = await sb.from("post_viewers").delete().eq("post_id", post.id).eq("user_id", uid);
          if (error) throw error;
          viewers.delete(uid);
          drawList(); picker.refresh();
        }));
        list.append(h("div", { class: "picker-row" }, h("span", {}, "@" + name), del));
      });
    }
    const picker = userPicker({
      placeholder: "ユーザー名で検索して、公開対象を追加…",
      exclude: uid => uid === post.author_id || uid === post.project.owner_id || viewers.has(uid),
      onPick: async u => {
        const { error } = await sb.from("post_viewers").insert({ post_id: post.id, user_id: u.id });
        if (error) throw error;
        viewers.set(u.id, u.username);
        toast(`@${u.username} に閲覧を許可しました`);
        drawList();
      }
    });
    box.append(list, picker.node);
    drawList();
    sb.from("post_viewers").select("user_id,user:profiles!user_id(username)").eq("post_id", post.id).then(r => {
      (r.data || []).forEach(v => viewers.set(v.user_id, v.user ? v.user.username : "?"));
      drawList();
    });
    return box;
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
          h("div", { class: "meta" }, nameTag(post.author && post.author.username), h("span", {}, fmtDate(post.created_at))),
          h("div", { class: "lock-box" },
            h("div", { class: "lock-icon" }, "🔒"),
            h("p", {}, h("strong", {}, "この投稿は限定公開です")),
            h("p", { class: "muted" }, "プレビュー・コードの閲覧・ダウンロードは、作成者に許可された人だけができます。「公開を要請」を押すと、あなたのユーザー名が作成者に通知されます。"),
            req)));
    }

    // 添付ファイル（画像・音声）
    const { data: assetData } = await sb.rpc("get_post_assets", { p_post: id });
    const assets = assetData || [];

    const htmlBtn = h("button", { class: "btn", type: "button" }, "⬇ HTML（1ファイル）");
    htmlBtn.addEventListener("click", () => downloadSingleHtml(post));
    const zipBtn = h("button", { class: "btn", type: "button" }, assets.length ? "⬇ ZIPでダウンロード（画像・音声つき）" : "⬇ ZIP（分割）");
    zipBtn.addEventListener("click", () => busy(zipBtn, () => downloadPostZip(post, assets)));

    const actions = h("div", { class: "actions" });
    // 添付ファイルがあるときは、HTMLが参照できるように、ZIPだけを出す
    if (post.can_download !== false) actions.append(...(assets.length ? [zipBtn] : [htmlBtn, zipBtn]));
    else actions.append(h("span", { class: "badge", title: "投稿者がダウンロードを許可していません" }, "⬇ ダウンロード不可"));
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
      if (post.is_public) {
        const dlOn = post.allow_download !== false;
        const dlToggle = h("button", { class: "btn", type: "button" }, dlOn ? "⬇ ダウンロードを禁止する" : "⬇ ダウンロードを許可する");
        dlToggle.addEventListener("click", () => busy(dlToggle, async () => {
          const { error } = await sb.from("posts").update({ allow_download: !dlOn }).eq("id", id);
          if (error) throw error;
          toast(dlOn ? "ダウンロードを禁止しました" : "ダウンロードを許可しました");
          route();
        }));
        actions.append(dlToggle);
      }
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
      preview: previewWithFullscreen(previewDoc(post, assets)),
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
            h("div", { class: "meta" }, nameTag(post.author && post.author.username), h("span", {}, fmtDate(post.created_at)))),
          actions),
        post.memo ? h("div", { class: "memo" },
          h("h3", {}, "📝 投稿者のメモ"),
          h("p", {}, post.memo)) : null,
        h("p", { class: "notice" }, "投稿者が書いたコードです。プレビューは隔離された領域で実行されています。ダウンロードしたコードは、内容を確認してから実行してください。"),
        tabs, body,
        assets.length ? h("div", { class: "assets-box" },
          h("h3", {}, `🖼 このHTMLで使う画像・音声（${assets.length}）`),
          h("p", { class: "muted", style: "margin:.2rem 0 .6rem" }, "企画に登録されたファイルのうち、このHTMLが使うものです。HTMLの中では、ファイル名のまま参照できます（例：", h("code", {}, `<img src="${assets[0].name}">`), "）。"),
          h("div", { class: "asset-grid" }, ...assets.map(a => h("div", { class: "asset-card" },
            isAudioName(a.name)
              ? h("audio", { controls: true, preload: "none", src: dataUri(a.mime, a.b64) })
              : h("img", { src: dataUri(a.mime, a.b64), alt: a.name, loading: "lazy" }),
            h("div", { class: "asset-name" }, a.name),
            h("div", { class: "muted" }, fmtSize(a.size) + (a.group ? "・" + a.group : "")))))) : null),
      (post.is_public === false && (isAuthor || isOwner)) ? viewersBox(post) : null);
  }

  /* 起動時は onAuthStateChange(INITIAL_SESSION) が最初の描画を行う */
})();
