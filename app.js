(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const app = document.getElementById("app");
  const navEl = document.getElementById("nav");
  const toastEl = document.getElementById("toast");
  const bellEl = document.getElementById("bell") || (() => {
    const el = document.createElement("span"); el.id = "bell"; (navEl && navEl.parentNode ? navEl.parentNode : document.body).append(el); return el;
  })();

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
    if (/reason required/i.test(m)) return "理由を入力してください。";
    if (/reason too long/i.test(m)) return "理由は200文字までです。";
    if (/delta too large|invalid value/i.test(m)) return "数が大きすぎます（または、正しくありません）。";
    if (/too many attempts/i.test(m)) return "ユーザー名でのログインを、まちがえすぎました。15分ほど待つか、メールアドレスを入力してログインしてください。";
    if (/you blocked this user/i.test(m)) return "ブロックしているユーザーには、メッセージを送れません。ブロックを解除してください。";
    if (/cannot send/i.test(m)) return "このユーザーには、メッセージを送れません。";
    if (/too many blocks/i.test(m)) return "ブロックできるのは、200人までです。";
    if (/Invalid login credentials/i.test(m)) return "ユーザー名またはパスワードが違います。";
    if (/Email not confirmed/i.test(m)) return "メールアドレスの確認が完了していません。届いたメールのリンクを開いてください。";
    if (/already been registered|already registered|email_exists|email address.*already/i.test(m)) return "そのメールアドレスは、すでに使われています。";
    if (/should be different|same email/i.test(m)) return "今のメールアドレスと同じです。";
    if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return "メールアドレスの形式が正しくありません。";
    if (/rate limit|too many(?! (assets|posts))/i.test(m)) return "短時間に操作が多すぎます。しばらくしてからやり直してください。";
    if (/row-level security/i.test(m)) return "この操作を行う権限がありません。";
    if (/duplicate key/i.test(m)) return "既に使われています。";
    if (/posts_js_files_check/i.test(m)) return `JavaScriptのファイルは、1つの投稿に${JS_MAX_FILES}個までです。`;
    if (/file too large/i.test(m)) return "500KBを超えるコードは、管理者の承認が必要です（残り回数がありません）。";
    if (/already pending/i.test(m)) return "すでに要請を送信済みです。管理者の承認をお待ちください。";
    if (/already decided/i.test(m)) return "この要請は、すでに回答済みです。";
    if (/admin only/i.test(m)) return "管理者だけが行える操作です。";
    if (/already requested/i.test(m)) return "すでに要請済みです。相手の対応をお待ちください。";
    if (/invalid quota/i.test(m)) return "容量の指定が正しくありません（3MBを超え、10MB以下で指定してください）。";
    if (/already public/i.test(m)) return "この投稿は、すでに閲覧できる状態です。";
    if (/cannot delete yourself/i.test(m)) return "自分自身のアカウントは削除できません。";
    if (/approval required/i.test(m)) return "500KBを超えるファイルは、管理者の許可が必要です。";
    if (/exceeds approved size/i.test(m)) return "許可されたファイルの大きさ（申請の5％増しまで）を超えています。";
    if (/asset too large/i.test(m)) return "ファイルが、この企画の容量より大きいです（1ファイルは、企画の容量までです。容量は、管理者に要請して広げられます）。";
    if (/login required/i.test(m)) return "ログインしている人だけが、この操作をできます。";
    if (/cloud not enabled/i.test(m)) return "このHTMLには、Cloudが許可されていません。";
    if (/cloud full/i.test(m)) return "このHTMLのCloudは、記録できる人数（200人）がいっぱいです。";
    if (/invalid score/i.test(m)) return "Cloudに記録できるのは、数字のスコアだけです。";
    if (/invalid better/i.test(m)) return "指定が正しくありません。";
    if (/user not found/i.test(m)) return "そのユーザー名のユーザーが見つかりません。";
    if (/too many posts for assets/i.test(m)) return "HTMLが3個以上ある企画には、画像・音声を登録できません（ファイルがある企画は、HTMLを2個までです）。";
    if (/too many posts/i.test(m)) { const n = (m.match(/too many posts:\s*(\d+)/i) || [])[1]; return `この企画のHTMLは、上限${n ? "（" + n + "個）" : ""}に達しています（画像・音声のファイルがある企画は2個まで、ない企画は4個までです）。`; }
    if (/project quota/i.test(m)) return "この企画の画像・音声の容量が上限に達しています。使っていないファイルを削除するか、「容量を広げる」から管理者に許可を要請してください。";
    if (/too many groups/i.test(m)) return "グループは、1企画につき20個までです。";
    if (/duplicate group/i.test(m)) return "同じ名前のグループがすでにあります。";
    if (/invalid group name/i.test(m)) return "グループ名は1〜30文字で入力してください。";
    if (/group not found/i.test(m)) return "グループが見つかりません。";
    if (/asset not found/i.test(m)) return "ファイルが見つかりません（削除された可能性があります）。";
    if (/duplicate asset/i.test(m)) return "同じ名前のファイルがすでに登録されています。";
    if (/invalid asset name/i.test(m)) return "ファイル名か、ファイルの種類が使えません（画像・音声・JSON・CSVのみ。名前に / \\ : * ? \" < > | は使えません）。";
    if (/invalid asset data/i.test(m)) return "ファイルの中身を読み取れませんでした。";
    if (/upload missing/i.test(m)) return "ファイルの保存が確認できませんでした。もう一度お試しください。";
    if (/exceeds approved size/i.test(m)) return "許可された大きさ（申請の5％増しまで）を超えています。";
    if (/mime type|not supported/i.test(m) && /storage|bucket|mime/i.test(m)) return "このファイルの種類は保存できません（画像・音声・JSON・CSVのみ）。";
    if (/maximum allowed size|payload too large|too large/i.test(m)) return "ファイルが大きすぎます（1つ、企画の容量まで。最大10MB）。";
    if (/row-level security|Unauthorized|not authorized/i.test(m) && /storage|bucket|object|row-level/i.test(m)) return "このファイルを保存・取り出す権限がありません。";
    if (/resource already exists|Duplicate/i.test(m)) return "同じ場所にすでにファイルがあります。もう一度お試しください。";
    if (/Object not found|not found/i.test(m) && /object|bucket/i.test(m)) return "ファイルが見つかりません。";
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
  const bannerEl = document.getElementById("banner") || (() => {   // index.html が古くて、欄がなくても動くようにする
    const el = document.createElement("div"); el.id = "banner"; app.parentNode.insertBefore(el, app); return el;
  })();
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
      .select("id,type,created_at,read_at,project_id,comment_id,request_id,post_id,actor_id,asset_request_id,quota_request_id,actor:profiles!actor_id(username),project:projects(title),post:posts(title),comment:comments(body),request:big_upload_requests(status,granted,note),asset_req:asset_requests!asset_request_id(file_name,size_bytes,status,limit_bytes),quota_req:quota_requests!quota_request_id(wanted,status)")
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
    if (n.type === "quota_request") return `${who} さんが、企画「${n.project ? n.project.title : "?"}」の画像・音声の容量を${n.quota_req ? fmtSize(n.quota_req.wanted) : "?"}に広げる許可を要請しています`;
    if (n.type === "quota_approved") return `企画「${n.project ? n.project.title : "?"}」の画像・音声の容量が、${n.quota_req ? fmtSize(n.quota_req.wanted) : "広げた大きさ"}に広がりました`;
    if (n.type === "quota_rejected") return `企画「${n.project ? n.project.title : "?"}」の容量を広げる要請は、許可されませんでした`;
    if (n.type === "project_update") return `お気に入りの企画「${n.project ? n.project.title : "?"}」に、新しいバージョンが公開されました${n.post ? "（" + n.post.title + "）" : ""}`;
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
      else if (n.type === "quota_request") content = quotaRequestItem(n);
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
        && !(n.type === "asset_request" && n.asset_req && n.asset_req.status === "pending")
        && !(n.type === "quota_request" && n.quota_req && n.quota_req.status === "pending");
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

  // 管理者向け：企画の画像・音声の容量を広げる許可
  function quotaRequestItem(n) {
    const r = n.quota_req;
    const box = h("div", { class: "bell-item req" + (n.read_at ? "" : " unread") },
      h("div", { class: "t" }, notifText(n)),
      h("div", { class: "d" }, fmtDate(n.created_at)));
    if (!r) return box;
    if (r.status === "pending") {
      const ok = h("button", { class: "btn small primary", type: "button" }, `許可（${fmtSize(r.wanted)}に）`);
      const no = h("button", { class: "btn small danger", type: "button" }, "却下");
      const open = h("button", { class: "btn small", type: "button" }, "企画を開く");
      const decide = (approve, btn) => busy(btn, async () => {
        const { error } = await sb.rpc("decide_quota_request", { p_id: n.quota_request_id, p_approve: approve });
        if (error) throw error;
        markRead(n);
        toast(approve ? "容量を広げました" : "却下しました");
        await loadNotifs();
      });
      ok.addEventListener("click", () => decide(true, ok));
      no.addEventListener("click", () => decide(false, no));
      open.addEventListener("click", () => { markRead(n); bellOpen = false; renderBell(); go(`#/project/${n.project_id}`); });
      box.append(h("div", { class: "bell-req-actions" }, ok, no, open));
    } else {
      box.append(h("div", { class: "ex" }, r.status === "rejected" ? "× 却下済み" : "✓ 許可済み"));
    }
    return box;
  }

  // 管理者向け：メール認証の要請（認証済みにする）
  function verifyItem(n) {
    const who = n.actor ? n.actor.username : "?";
    const nameLine = h("div", { class: "ex" }, "本名：確認中…");
    const box = h("div", { class: "bell-item req" + (n.read_at ? "" : " unread") },
      h("div", { class: "t" }, notifText(n)),
      nameLine,
      h("div", { class: "d" }, fmtDate(n.created_at)));
    sb.rpc("admin_get_real_name", { p_user: n.actor_id }).then(({ data, error }) => {
      if (error || !data) { nameLine.textContent = "本名：取得できませんでした"; return; }
      nameLine.textContent = data.status === "none" ? "本名：未入力"
        : `本名：${data.real_name}（${data.status === "confirmed" ? "管理者が確認済み" : "未確認"}）`;
    });
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
    const target = n.type === "project_update" && n.post_id ? `#/post/${n.post_id}` : `#/project/${n.project_id}`;
    pendingScroll = n.comment_id;
    if (location.hash === target) route(); else go(target);
  }

  document.addEventListener("click", () => { if (bellOpen) { bellOpen = false; renderBell(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && bellOpen) { bellOpen = false; renderBell(); } });
  // 定期的な確認（通知・メッセージの未読数）。ログと通信を減らすため、間隔をのばしている。
  //   ふだん：未読数は60秒ごと、通知は120秒ごと。5分以上、何も操作していないときは、未読数180秒・通知300秒ごと。
  //   タブが隠れている間は確認しない。タブに戻ったときは、間隔を過ぎていれば、すぐ確認する。
  const POLL = { dm: [60000, 180000], notif: [120000, 300000], idleAfter: 300000 };
  let lastActive = Date.now(), lastDm = Date.now(), lastNotif = Date.now();
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach(ev =>
    document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true }));
  async function pollTick() {
    if (!session || document.hidden) return;
    const now = Date.now(), idle = now - lastActive > POLL.idleAfter ? 1 : 0;
    if (now - lastNotif >= POLL.notif[idle]) { lastNotif = now; loadNotifs(); }
    if (now - lastDm >= POLL.dm[idle]) {
      lastDm = now;
      const before = dmUnread;
      await refreshDmUnread();
      if (before !== dmUnread) renderNav();
    }
  }
  setInterval(pollTick, 10000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pollTick(); });

  /* ======================================================
   * コードの組み立て（プレビュー / ダウンロード共通）
   * ==================================================== */
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- 複数のJavaScriptファイル ----
  // JavaScript 欄の中に、ファイルごとの区切り行（例：「/* ===== file: game.js ===== */」）を書くと、別々のファイルとして扱う。
  // 区切り行がなければ、これまでどおり1つのファイル（script.js）。サーバー（データベース）の形は変えていない。
  const JS_DEFAULT_NAME = "script.js";
  const JS_MAX_FILES = 20;
  const jsNameOk = n => /^[A-Za-z0-9_][A-Za-z0-9_.\- ]{0,58}\.js$/i.test(n) && !/\.\./.test(n);
  const jsMarker = name => `/* ===== file: ${name} ===== */`;
  const reEsc = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // JavaScript 欄の文章 → [{ name, code }]（名前がない・使えない・重なる名前には、script.js / script2.js … を付ける）
  function parseJsFiles(js) {
    const text = String(js || "");
    const re = /^[ \t]*\/\*\s*=+\s*file:\s*([^\r\n*]*?)\s*=+\s*\*\/[ \t]*$/gm;
    const chunks = [];
    let last = 0, name = null, m, first = true;
    // 区切りの直後の最初の改行は、区切り行の一部。次の区切りの前の空行（joinJsFiles が入れるもの）も、1つだけ取る
    const push = (nm, code, marked, more) => {
      if (!code.trim()) return;
      if (marked) code = code.replace(/^\r?\n/, "");
      if (more) code = code.replace(/(\r?\n)\r?\n$/, "$1");
      chunks.push({ name: nm, code });
    };
    while ((m = re.exec(text))) { push(name, text.slice(last, m.index), !first, true); first = false; name = m[1].trim(); last = re.lastIndex; }
    push(name, text.slice(last), !first, false);
    const used = new Set();
    const uniq = base => { let k = 1, c = base + ".js"; while (used.has(c.toLowerCase())) { k++; c = base + k + ".js"; } return c; };
    return chunks.map(c => {
      let nm = c.name && jsNameOk(c.name) && !used.has(c.name.toLowerCase()) ? c.name : uniq(c.name && jsNameOk(c.name) ? c.name.replace(/\.js$/i, "") : "script");
      used.add(nm.toLowerCase());
      return { name: nm, code: c.code };
    });
  }
  // [{ name, text }] → JavaScript 欄の文章（1ファイルずつ、区切り行をつける）
  const joinJsFiles = files => files.map(f => jsMarker(f.name) + "\n" + f.text.replace(/\s+$/, "") + "\n").join("\n");

  const scriptInline = (code, asModule) => "<script" + (asModule ? ' type="module"' : "") + ">\n" + code.replace(/<\/script/gi, "<\\/script") + "\n</" + "script>";
  const scriptRefRe = name => new RegExp("<script\\b[^>]*?\\bsrc\\s*=\\s*([\"']?)(?:\\./)?" + reEsc(name) + "\\1(?=[\\s>/])[^>]*>\\s*</script\\s*>", "i");

  // linked=false: 1ファイルに埋め込み / linked=true: style.css, （JavaScriptの各ファイル）を参照
  function compose(p, linked) {
    const css = p.css || "";
    const styleTag = css
      ? (linked ? '<link rel="stylesheet" href="style.css">' : "<style>\n" + css.replace(/<\/style/gi, "<\\/style") + "\n</style>")
      : "";
    let html = p.html || "";
    // JavaScript：HTMLの中に <script src="名前.js"> があれば、そのファイルは、その位置に入れる（なければ、最後に順に並べる）
    const pending = [];
    for (const f of parseJsFiles(p.js)) {
      const re = scriptRefRe(f.name);
      const hit = html.match(re);
      if (!hit) { pending.push(f); continue; }
      if (linked) continue;                                     // ダウンロード（ZIP）では、HTMLの <script src> のまま、ファイルを同じ場所に置く
      const tag = hit[0];
      if (/\bdefer\b|\btype\s*=\s*["']?module/i.test(tag)) { html = html.replace(re, () => ""); pending.push({ ...f, mod: /\btype\s*=\s*["']?module/i.test(tag) }); }   // defer・module は、ページを読み終えてから動くので、最後に入れる
      else html = html.replace(re, () => scriptInline(f.code));
    }
    const scriptTag = pending.map(f => linked ? '<script src="' + f.name + '"></' + "script>" : scriptInline(f.code, f.mod)).join("\n");

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
      sandbox: "allow-scripts allow-forms allow-modals allow-pointer-lock",
      referrerpolicy: "no-referrer",
      srcdoc: doc
    });
  }

  /* ======================================================
   * 添付ファイル（画像・音声）
   * ==================================================== */
  const ASSET_FREE = 500000;       // 許可なしで添付できる大きさ
  // 1ファイルの上限は、その企画の容量まで（容量が3MBなら3MB、5MBなら5MB、7MBなら7MB、10MBなら10MB）。500KBを超えるファイルは、ファイルごとに管理者の許可が必要
  const QUOTA_BASE = 3000000;      // 1企画あたりの画像・音声の容量（合計）：ふだん
  const QUOTA_MAX = 10000000;      // 管理者の許可で広げられる最大
  const quotaOf = project => (project && project.asset_quota) || QUOTA_BASE;
  const ASSET_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|avif|svg|mp3|wav|ogg|m4a|aac|flac|opus|json|csv)$/i;
  const assetNameOk = n => !!n && n.length <= 100 && !/[\\/:*?"<>|\u0000-\u001f]/.test(n) && !/^\./.test(n) && ASSET_EXT.test(n);
  const fmtSize = b => b >= 1000000 ? (b / 1000000).toFixed(2) + "MB" : Math.max(1, Math.round(b / 1000)) + "KB";
  const isAudioName = n => /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(n);
  const isJsonName = n => /\.json$/i.test(n);
  const isCsvName = n => /\.csv$/i.test(n);
  const isTextDataName = n => isJsonName(n) || isCsvName(n);   // JSON・CSV：画像・音声ではない、データのファイル

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

  // 画像・音声の中身は Supabase Storage（非公開の置き場）に入っている。データベースには、場所（path）だけがある。
  // 見る権限は、Storage 側にも同じ決まりがあるので、見てはいけない人は取り出せない。
  const ASSET_BUCKET = "project-assets";
  const assetB64Cache = new Map();   // path -> base64（同じ画面の間は、取り出し直さない。ファイルは上書きされない）
  // 一度取り出した画像・音声は、ブラウザ（IndexedDB）にも覚えさせて、次に開いたときの通信を減らす。
  //  ・path にはファイルごとの番号が入っていて、同じ path のファイルが書き換わることはない（なので、古くなることがない）
  //  ・path は、見る権限のある人にだけ、サーバーが教える。覚えさせた中身を取り出せるのは、その path を知っている人だけ
  //  ・覚えさせる量は、合計約50MBまで。超えたら、使われていない古いものから消す。使えない環境では、覚えさせずに動く
  const ASSET_IDB_MAX = 50 * 1024 * 1024;
  let assetDbP = null;
  function assetDb() {
    if (!assetDbP) {
      assetDbP = new Promise(resolve => {
        try {
          const r = indexedDB.open("kh-assets", 1);
          r.onupgradeneeded = () => { r.result.createObjectStore("files", { keyPath: "path" }); r.result.createObjectStore("meta", { keyPath: "path" }); };
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => resolve(null);
          r.onblocked = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    }
    return assetDbP;
  }
  const idbReq = r => new Promise(res => { r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
  async function idbGetAsset(path) {
    try {
      const db = await assetDb(); if (!db) return null;
      const tx = db.transaction(["files", "meta"], "readwrite");
      const f = await idbReq(tx.objectStore("files").get(path));
      if (!f || typeof f.b64 !== "string") return null;
      const m = await idbReq(tx.objectStore("meta").get(path));
      if (m && Date.now() - m.used > 3600 * 1000) tx.objectStore("meta").put({ ...m, used: Date.now() });   // 使った時刻を更新（1時間に1回まで）
      return f.b64;
    } catch (e) { return null; }
  }
  async function idbPutAsset(path, b64) {
    try {
      const db = await assetDb(); if (!db) return;
      await new Promise(res => {
        const tx = db.transaction(["files", "meta"], "readwrite");
        tx.objectStore("files").put({ path, b64 });
        tx.objectStore("meta").put({ path, size: b64.length, used: Date.now() });
        tx.oncomplete = () => res(); tx.onerror = () => res(); tx.onabort = () => res();
      });
      // 合計が上限を超えたら、使われていない古いものから消す
      const metas = (await idbReq(db.transaction("meta").objectStore("meta").getAll())) || [];
      let total = metas.reduce((n, m) => n + (m.size || 0), 0);
      if (total <= ASSET_IDB_MAX) return;
      metas.sort((a, b) => a.used - b.used);
      const tx = db.transaction(["files", "meta"], "readwrite");
      for (const m of metas) {
        if (total <= ASSET_IDB_MAX || m.path === path) break;
        tx.objectStore("files").delete(m.path); tx.objectStore("meta").delete(m.path);
        total -= m.size || 0;
      }
    } catch (e) { /* 覚えさせられなくても、動作には影響しない */ }
  }
  async function fetchAssetB64(path) {
    if (assetB64Cache.has(path)) return assetB64Cache.get(path);
    let b64 = await idbGetAsset(path);
    if (b64 == null) {
      const { data, error } = await sb.storage.from(ASSET_BUCKET).download(path);
      if (error) throw error;
      b64 = await fileToB64(data);
      idbPutAsset(path, b64);   // 覚えさせる（待たない）
    }
    assetB64Cache.set(path, b64);
    return b64;
  }
  // 一覧（id・name・mime・path・b64 など）の path のものに、b64 を付けて返す。古い方式（b64つき）はそのまま
  async function withAssetData(list) {
    const out = (list || []).map(a => ({ ...a }));
    const todo = out.filter(a => !a.b64 && a.path);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(4, todo.length) }, async () => {
      while (i < todo.length) { const a = todo[i++]; a.b64 = await fetchAssetB64(a.path); }
    }));
    return out;
  }
  // 企画のファイルを、Storage からまとめて消す（企画・ユーザーの削除の前に呼ぶ。失敗しても、削除そのものは止めない）
  async function purgeProjectFiles(projectId) {
    try {
      const bucket = sb.storage.from(ASSET_BUCKET);
      for (let n = 0; n < 5; n++) {
        const { data } = await bucket.list(projectId, { limit: 100 });
        const names = (data || []).filter(o => o && o.name).map(o => `${projectId}/${o.name}`);
        if (!names.length) break;
        const { error } = await bucket.remove(names);
        if (error) break;
      }
    } catch (e) { /* 残ったファイルは、容量を少し使うだけ */ }
  }

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

  // プレビューの全画面表示（全画面 API が使えない端末では、画面いっぱいの重ね表示にする）。
  // ボタン（「全画面」「別タブで開く」）は、枠の外の、下に置く。playUrl があれば、「別タブで開く」を出す。
  function previewWithFullscreen(doc, playUrl) {
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
    const newTab = playUrl ? h("a", { class: "btn small preview-newtab", href: playUrl, target: "_blank", rel: "noopener", title: "プレビューだけを、新しいタブで開く" }, "↗ 別タブで開く") : null;
    wrap.append(frame, h("div", { class: "preview-bar" }, btn, newTab));
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

  // アクセス数：HTMLを開く／ダウンロードする／企画まるごとダウンロードしたときに数える（同じ人は30分に1回）
  let memVisitor = null;
  function visitorKey() {
    try {
      let k = localStorage.getItem("kh_visitor");
      if (!k || k.length < 8) {
        k = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + String(Date.now());
        localStorage.setItem("kh_visitor", k);
      }
      return k;
    } catch (e) {
      if (!memVisitor) memVisitor = String(Math.random()).slice(2) + String(Date.now());
      return memVisitor;
    }
  }
  function recordView(projectId) {
    if (!projectId) return;
    Promise.resolve(sb.rpc("record_project_view", { p_project: projectId, p_key: visitorKey() }))
      .then(r => { if (r && r.error) console.warn(r.error); }, () => {});
  }

  // 画像・音声（assets）があれば、HTMLの中のファイル名をデータURIに置き換えて、1つのHTMLファイルとして動くようにする
  function downloadSingleHtml(p, assets) {
    const text = assets && assets.length ? inlineAssets(compose(p, false), assets) : compose(p, false);
    download(safeName(p.title) + ".html", new Blob([text], { type: "text/html;charset=utf-8" }));
  }

  // 画像・音声を、元のファイル名のまま1つのファイルとして保存する
  async function downloadAssetFile(a) {
    let src = a;
    if (!src.b64 && !src.path) {   // 管理欄の一覧には中身も場所もない。サーバーに聞く（見る権限があれば返ってくる）
      const { data, error } = await sb.rpc("get_assets_data", { p_ids: [a.id] });
      if (error) throw error;
      src = (data || [])[0];
      if (!src) throw new Error("ファイルが見つかりません。");
    }
    const [full] = src.b64 ? [src] : await withAssetData([src]);
    download(a.name, new Blob([b64ToBytes(full.b64)], { type: a.mime || "application/octet-stream" }));
  }

  async function downloadPostZip(p, assets) {
    const zip = new JSZip();
    zip.file("index.html", compose(p, true));
    if (p.css) zip.file("style.css", p.css);
    parseJsFiles(p.js).forEach(f => zip.file(f.name, f.code));
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
    const { data: assetRaw } = await sb.rpc("get_project_assets", { p_project: project.id });
    const assetRows = await withAssetData(assetRaw);
    const zip = new JSZip();
    data.forEach((p, i) => {
      const dir = zip.folder(String(i + 1).padStart(2, "0") + "_" + safeName(p.title));
      dir.file("index.html", compose(p, true));
      if (p.css) dir.file("style.css", p.css);
      parseJsFiles(p.js).forEach(f => dir.file(f.name, f.code));
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
    document.body.classList.remove("play-mode");   // 別タブ用の表示（プレビューだけ）を解く
    clearInterval(dmTimer);
    if (cloudHostOff) cloudHostOff();   // 前のページのプレビューと Cloud をつなぐ窓口を閉じる
    if (netGuardOff) netGuardOff();
    if (saveHostOff) saveHostOff();   // ゲームのセーブの窓口（直前の保存だけは、少しの間、受け付ける）
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
      else if (a === "post" && b && c === "play") view = await viewPost(b, token, { play: true });
      else if (a === "post" && b) view = await viewPost(b, token);
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

  // 管理者に認証を要請する（未ログインでも使える）。本名の入力が必要
  function verifyAskBox(username, password) {
    const name = h("input", { type: "text", maxlength: 50, autocomplete: "off", placeholder: "例）山田 太郎", "aria-label": "本名" });
    const ask = h("button", { class: "btn primary", type: "button" }, "管理者に認証を要請する");
    const done = h("p", { class: "muted", hidden: true, style: "margin:.5rem 0 0" },
      "要請しました。管理者が認証すると、ログインできるようになります。認証されたかどうかは、ログイン画面で試してみてください。");
    ask.addEventListener("click", async () => {
      let ok = false;
      await busy(ask, async () => {
        const nm = name.value.trim();
        if (!nm) { name.focus(); throw new Error("本名を入力してください。"); }
        const { error } = await sb.rpc("request_email_verify", { p_username: username, p_name: nm, p_password: password });
        if (error) throw error;
        ok = true;
        ask.textContent = "要請しました";
        name.disabled = true;
        done.hidden = false;
        toast("管理者に認証を要請しました。認証されるまでお待ちください");
      });
      if (ok) ask.disabled = true;   // busy が押せる状態に戻すので、要請できたら、改めて押せなくする
    });
    return h("div", { class: "verify-ask" },
      field("本名（必須）", name, "入力された名前は、管理者にしか見えません（他のユーザーには表示されません）。"),
      h("p", { class: "notice warn-text", style: "margin:.4rem 0 .6rem" }, h("strong", {}, "名前が正しく入力されていない場合、申請は却下される可能性が高いです。")),
      h("div", { class: "actions" }, ask), done);
  }

  function viewLogin() {
    if (session) { setTimeout(() => go("#/"), 0); return h("div"); }
    const u = h("input", { type: "text", autocomplete: "username", required: true, maxlength: 254 });
    const p = h("input", { type: "password", autocomplete: "current-password", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, "ログイン");
    const notConfirmed = h("div", {});
    const form = h("form", { class: "card narrow" },
      h("h1", {}, "ログイン"),
      field("ユーザー名（またはメールアドレス）", u), field("パスワード", p), btn, notConfirmed,
      h("p", { class: "hint-mail" }, "📧 新規登録のあとは、確認メールのリンクを開くまでログインできません。"),
      h("p", { class: "links" }, h("a", { href: "#/forgot" }, "パスワードを忘れた方"), " ・ ", h("a", { href: "#/signup" }, "新規登録")));
    form.addEventListener("submit", e => {
      e.preventDefault();
      busy(btn, async () => {
        notConfirmed.replaceChildren();
        // ユーザー名でログイン：パスワードが合っているときだけ、サーバーが、ログインに使うメールアドレスを返す。
        // メールアドレスが入力されたときは、そのまま使う。
        const typed = u.value.trim();
        let email = typed;
        if (!typed.includes("@")) {
          const { data: em, error: e1 } = await sb.rpc("login_email", { p_username: typed, p_password: p.value });
          if (e1) throw e1;
          if (!em) throw new Error("Invalid login credentials");
          email = em;
        }
        const { error } = await sb.auth.signInWithPassword({ email, password: p.value });
        if (error && /Email not confirmed/i.test(error.message)) {
          // メール未認証：認証メールの再送／管理者への認証の要請
          const username = typed;
          const resend = h("button", { class: "btn", type: "button" }, "確認メールを再送する");
          resend.addEventListener("click", () => busy(resend, async () => {
            const { error: e4 } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: BASE_URL } });
            if (e4) throw e4;
            toast("確認メールを再送しました");
          }));
          notConfirmed.replaceChildren(h("div", { class: "notice" },
            h("strong", {}, "メールアドレスの認証が済んでいません。"),
            h("br"), "届いたメールのリンクを開いてください。",
            h("div", { class: "actions", style: "margin-top:.6rem" }, resend),
            h("div", { class: "verify-alt" },
              h("strong", {}, "メールアドレスで認証できない方は以下："),
              h("p", { class: "muted", style: "margin:.3rem 0 .6rem" }, "メールが届かない・メールを受け取れない場合は、本名を入力して、管理者に認証を要請できます。"),
              verifyAskBox(username, p.value))));
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
            h("div", { class: "verify-alt" },
              h("strong", {}, "メールアドレスで認証できない方は以下："),
              h("p", { class: "muted", style: "margin:.3rem 0 .6rem" }, "メールが届かない・メールを受け取れない場合は、本名を入力して、管理者に認証を要請できます（管理者が確認したあと、ログインできるようになります）。"),
              verifyAskBox(username, p1.value)),
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
  // 管理者：データベースに残っている古い画像・音声ファイルを、Storage へ移す
  function legacyAssetsBox() {
    const box = h("div", { class: "card legacy-box" });
    const msg = h("p", { class: "muted" }, "確認中…");
    const btn = h("button", { class: "btn small", type: "button", hidden: true }, "Storageへ移す");
    box.append(h("h3", {}, "📦 画像・音声ファイルをStorageへ移す"), msg, btn);
    let list = [];
    async function load() {
      const { data, error } = await sb.rpc("admin_legacy_assets");
      if (error) { msg.textContent = "確認できませんでした：" + friendly(error); return; }
      list = data || [];
      const total = list.reduce((n, a) => n + (a.size || 0), 0);
      msg.textContent = list.length
        ? `データベースの中に、まだ ${list.length}個（${fmtSize(total)}）のファイルがあります。Storageへ移すと、データベースの容量（無料枠0.5GB）が空きます。`
        : "移すファイルはありません（すべてStorageに入っています）。";
      btn.hidden = !list.length;
    }
    btn.addEventListener("click", () => {
      if (!confirm(`${list.length}個のファイルを、Storageへ移します。見え方は変わりません。よろしいですか？`)) return;
      busy(btn, async () => {
        let done = 0, failed = null;
        for (const a of [...list]) {
          msg.textContent = `移しています… ${done}/${list.length}（${a.name}）`;
          try {
            const { data: b, error } = await sb.rpc("admin_begin_asset_move", { p_asset: a.id });
            if (error) throw error;
            const blob = new Blob([b64ToBytes(b.b64)], { type: b.mime });
            const up = await sb.storage.from(ASSET_BUCKET).upload(b.path, blob, { contentType: b.mime, upsert: false, cacheControl: "31536000" });
            // 前回の途中で保存だけ済んでいた場合は、そのまま確定に進む（大きさは、確定のときにサーバーが確かめる）
            if (up.error && !/already exists|Duplicate/i.test(up.error.message || "")) throw up.error;
            const fin = await sb.rpc("admin_finish_asset_move", { p_asset: a.id });
            if (fin.error) throw fin.error;
            done++;
          } catch (e) { failed = `「${a.name}」で止まりました：${friendly(e)}`; break; }
        }
        await load();
        if (done) toast(`${done}個のファイルをStorageへ移しました`);
        if (failed) throw new Error(failed);
      });
    });
    load();
    return box;
  }

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
              const { data: theirs } = await sb.from("projects").select("id").eq("owner_id", r.user_id);
              for (const pr of (theirs || [])) await purgeProjectFiles(pr.id);
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
    const cloudAdmin = await cloudAdminBox();
    const ipBox = ipCheckBox();

    return h("section", {},
      h("div", { class: "page-head" }, h("h1", {}, "👤 ユーザー管理"), count),
      legacyAssetsBox(),
      cloudAdmin,
      ipBox,
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
        h("span", {}, `投稿 ${count}件`),
        h("span", {}, `登録数 ${p.favorite_count || 0}件`),
        h("span", {}, `アクセス数 ${p.view_count || 0}回`),
        isAdmin && p.rank_excluded ? h("span", { class: "badge" }, "ランキング除外中（管理者にだけ表示）") : null));
  }

  async function viewHome() {
    const { data, error } = await sb.from("projects")
      .select("id,title,description,allow_others_post,created_at,owner_id,favorite_count,view_count,rank_excluded,owner:profiles!owner_id(username)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    // 投稿数は、投稿の project_id だけを取得して数える（1000件ずつ）
    const counts = {}, lastAct = {};
    for (let from = 0; from < 100000; from += 1000) {
      const r = await sb.from("posts").select("project_id,created_at,updated_at").order("id").range(from, from + 999);
      if (r.error) break;
      (r.data || []).forEach(x => {
        counts[x.project_id] = (counts[x.project_id] || 0) + 1;
        // 更新日時：HTMLの追加・編集のうち、いちばん新しい時刻
        const t = (x.updated_at && x.updated_at > x.created_at) ? x.updated_at : x.created_at;
        if (t && (!lastAct[x.project_id] || t > lastAct[x.project_id])) lastAct[x.project_id] = t;
      });
      if (!r.data || r.data.length < 1000) break;
    }
    // 企画の更新日時＝中のHTMLの最終追加・編集（HTMLがまだない企画は、企画を作った日時）
    data.forEach(p => { p.postCount = counts[p.id] || 0; p.updated_at = (lastAct[p.id] && lastAct[p.id] > p.created_at) ? lastAct[p.id] : p.created_at; });

    const search = h("input", { type: "search", class: "search", placeholder: "企画を検索…" });
    const list = h("div", { class: "grid" });
    // 流行順の順位（スコアの計算はサーバー側。ここには順位だけが届き、スコアは分からない）。取得できなくても、一覧は出る
    const trendRank = {};
    try {
      const tr = await sb.rpc("project_trend_ranks");
      if (!tr.error) (tr.data || []).forEach(r => { trendRank[r.project_id] = r.rank; });
    } catch (e) { /* 流行の情報がなくても、一覧は表示する */ }
    // 並べ替え：流行順／作成順／更新順／アクセス数順（同数ならお気に入り数→作成順）／お気に入り数順（同数ならアクセス数→作成順）
    const sortSel = h("select", { class: "sort-select", "aria-label": "並べ替え" },
      h("option", { value: "trend" }, "流行順"),
      h("option", { value: "new" }, "作成順"),
      h("option", { value: "updated" }, "更新順"),
      h("option", { value: "views" }, "アクセス数順"),
      h("option", { value: "favs" }, "お気に入り数順"));
    sortSel.value = "trend";   // 初期は「流行順」
    const num = v => v || 0;
    const byNew = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
    // ランキング除外の企画は、流行順・アクセス数順・お気に入り数順では、順位をつけず、最後に回す（作成順・更新順は、そのまま）
    const exFirst = (a, b) => (a.rank_excluded ? 1 : 0) - (b.rank_excluded ? 1 : 0);
    const sorters = {
      // 流行順：順位の良い順（直近のアクセスがない企画は最後）→ 同じなら お気に入り数 → 作成が新しい順
      trend: (a, b) => exFirst(a, b) || (trendRank[a.id] || Infinity) - (trendRank[b.id] || Infinity) || num(b.view_count) - num(a.view_count) || num(b.favorite_count) - num(a.favorite_count) || byNew(a, b),
      new: byNew,
      updated: (a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0) || byNew(a, b),
      views: (a, b) => exFirst(a, b) || num(b.view_count) - num(a.view_count) || num(b.favorite_count) - num(a.favorite_count) || byNew(a, b),
      favs: (a, b) => exFirst(a, b) || num(b.favorite_count) - num(a.favorite_count) || num(b.view_count) - num(a.view_count) || byNew(a, b)
    };
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
      items.sort(sorters[sortSel.value] || byNew);
      list.replaceChildren();
      if (!items.length) list.append(h("p", { class: "muted empty" }, onlyMine && !q ? "あなたが企画主の企画はまだありません。" : data.length ? "該当する企画がありません。" : "まだ企画がありません。最初の企画を作ってみましょう！"));
      items.forEach(p => list.append(projectCard(p)));
    }
    search.addEventListener("input", draw);
    sortSel.addEventListener("change", draw);
    draw();

    return h("section", {},
      h("div", { class: "page-head" },
        h("h1", {}, "企画一覧"),
        session ? h("a", { class: "btn primary", href: "#/new-project" }, "＋ 企画を作る") : null),
      h("div", { class: "search-row" }, search, sortSel, mineBtn), list);
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
    const pair = `and(sender_id.eq.${me},recipient_id.eq.${pf.id}),and(sender_id.eq.${pf.id},recipient_id.eq.${me})`;
    let lastAt = null;      // 最後に読んだメッセージの時刻（これより新しいものだけを、自動更新で取る）
    let polls = 0;
    const markReadIfNeeded = async rows => {
      if (rows.some(m => m.recipient_id === me && !m.read_at)) {
        await sb.rpc("mark_dm_read", { p_with: pf.id });
        await refreshDmUnread(); renderNav();
      }
    };
    // 全件を読み直す（開いたとき・自分が送信／編集／削除したとき・約1分に1回）
    async function load() {
      const { data, error } = await sb.from("direct_messages").select(DM_SELECT)
        .or(pair).order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40 || !box.childElementCount;
      if (box.querySelector(".editing")) return;    // 編集中は、自動更新で入力を消さない
      box.replaceChildren(...(data.length ? data.map(m => dmBubble(m, me, load)) : [h("p", { class: "muted" }, "まだメッセージはありません。")]));
      if (data.length) lastAt = data[data.length - 1].created_at;
      if (stick) box.scrollTop = box.scrollHeight;
      await markReadIfNeeded(data);
    }
    // 自動更新：新着だけを取って、末尾に足す（新着がなければ、画面は何も変えない）
    async function loadNew() {
      if (lastAt === null) return load();
      const { data, error } = await sb.from("direct_messages").select(DM_SELECT)
        .or(pair).gt("created_at", lastAt).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      if (!data.length) return;
      if (box.querySelector(".editing")) return;    // 編集中は、あとで取る
      const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      box.querySelector("p.muted")?.remove();       // 「まだメッセージはありません。」を消す
      box.append(...data.map(m => dmBubble(m, me, load)));
      lastAt = data[data.length - 1].created_at;
      if (stick) box.scrollTop = box.scrollHeight;
      await markReadIfNeeded(data);
    }
    await load();
    // ふだんは新着だけ。相手が編集・削除した内容も反映されるよう、6回に1回（約48秒ごと）は全件を読み直す。
    dmTimer = setInterval(() => {
      if (token !== renderToken || document.hidden) return;
      polls++;
      (polls % 6 === 0 ? load() : loadNew()).catch(() => {});
    }, 8000);

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
          if (/cannot send|you blocked this user/i.test(error.message)) { showWarn(friendly(error)); return; }
          throw error;
        }
        lastSent = Date.now();
        ta.value = ""; ta.style.height = "auto"; counter.textContent = ""; counter.classList.remove("over"); warn.classList.add("hidden");
        await load(); box.scrollTop = box.scrollHeight;
      });
    });
    // ブロック・受信拒否（SQL 36 より前は、何も出さない）
    const blockBtn = h("button", { class: "btn small dm-block-btn hidden", type: "button", title: "このユーザーをブロックする" }, "🚫 ブロック");
    const unblockBtn = h("button", { class: "btn small", type: "button", "data-unblock": "1" }, "ブロックを解除する");
    const blockedNote = h("div", { class: "notice dm-blocked hidden" }, "このユーザーをブロックしています。ブロックを解除すると、メッセージを送れます。", " ", unblockBtn);
    const offNote = h("p", { class: "muted dm-off-note hidden" }, "「メッセージを受け取らない」設定がオンです（あなたからは送れます。アカウント設定で変えられます）。");
    const applyBlock = on => { form.classList.toggle("hidden", on); blockedNote.classList.toggle("hidden", !on); blockBtn.classList.toggle("hidden", on); };
    blockBtn.addEventListener("click", () => {
      if (!window.confirm(`@${pf.username} をブロックしますか？\n\nお互いに、メッセージを送れなくなります（ブロックしたことは、相手には伝わりません）。いつでも解除できます。`)) return;
      busy(blockBtn, async () => {
        const { error } = await sb.rpc("block_user", { p_user: pf.id });
        if (error) throw error;
        applyBlock(true); toast("ブロックしました");
        await refreshDmUnread(); renderNav();
      });
    });
    unblockBtn.addEventListener("click", () => busy(unblockBtn, async () => {
      const { error } = await sb.rpc("unblock_user", { p_user: pf.id });
      if (error) throw error;
      applyBlock(false); toast("ブロックを解除しました");
    }));
    (async () => {
      try {
        const { data, error } = await sb.rpc("dm_state", { p_with: pf.id });
        if (error || !data) return;
        if (token !== renderToken) return;
        if (data.i_blocked) applyBlock(true); else blockBtn.classList.remove("hidden");
        offNote.classList.toggle("hidden", !data.i_off);
      } catch (e) { /* SQL未実行：何も出さない */ }
    })();
    // 画面に表示されたあとで、いちばん下（最新のメッセージ）へ移す（表示前は高さが0で、移せない）
    const toBottom = () => { box.scrollTop = box.scrollHeight; };
    requestAnimationFrame(() => { toBottom(); setTimeout(toBottom, 150); });
    return h("div", { class: "dm-app" },
      h("div", { class: "dm-head" },
        h("a", { class: "dm-back", href: "#/messages", "aria-label": "メッセージ一覧へ戻る" }, "←"),
        avatar(pf.username, "sm"), nameTag(pf.username, true), blockBtn),
      box, blockedNote, offNote, form,
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
    const toBottom = () => { box.scrollTop = box.scrollHeight; };
    requestAnimationFrame(() => { toBottom(); setTimeout(toBottom, 150); });
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
    return h("div", {}, form, cloudConnectorCard(), dmSettingsCard(), realNameCard(), emailCard(), passwordCard());
  }

  // アカウント設定：メッセージ（DM）の設定（受け取らない設定・ブロックしている人の一覧）
  function dmSettingsCard() {
    const card = h("div", { class: "card form hidden", id: "dm-settings" });
    (async () => {
      let st;
      try { const r = await sb.rpc("my_dm_settings"); if (r.error || !r.data) return; st = r.data; } catch (e) { return; }   // SQL未実行なら、出さない
      const off = h("input", { type: "checkbox", id: "dm-off" });
      off.checked = !!st.dm_off;
      off.addEventListener("change", async () => {
        off.disabled = true;
        const { error } = await sb.rpc("set_dm_off", { p_off: off.checked });
        off.disabled = false;
        if (error) { off.checked = !off.checked; toast(friendly(error), true); return; }
        toast(off.checked ? "メッセージを受け取らない設定にしました" : "メッセージを受け取る設定にしました");
      });
      const list = h("div", { class: "dm-block-list" });
      const draw = () => {
        list.replaceChildren(...((st.blocks || []).length ? st.blocks.map(b => {
          const un = h("button", { class: "btn small", type: "button", "data-unblock-user": b.username }, "解除");
          un.addEventListener("click", () => busy(un, async () => {
            const { error } = await sb.rpc("unblock_user", { p_user: b.user_id });
            if (error) throw error;
            st.blocks = st.blocks.filter(x => x.user_id !== b.user_id); draw(); toast("ブロックを解除しました");
          }));
          return h("div", { class: "picker-row" }, h("span", {}, "@" + b.username), un);
        }) : [h("p", { class: "muted" }, "ブロックしているユーザーはいません。")]));
      };
      draw();
      card.append(h("h2", {}, "✉ メッセージ（DM）の設定"),
        h("label", { class: "perm" }, off, " メッセージ（DM）を受け取らない"),
        h("p", { class: "muted", style: "margin:.2rem 0 .8rem" }, "オンにすると、だれからもメッセージを受け取りません（あなたから送ることはできます）。"),
        h("h3", {}, "ブロックしているユーザー"),
        h("p", { class: "muted", style: "margin:.2rem 0" }, "ブロックすると、お互いにメッセージを送れなくなります。メッセージの画面の「🚫 ブロック」から、ブロックできます。"),
        list);
      card.classList.remove("hidden");
    })();
    return card;
  }

  // アカウント設定：Cloud コネクタ（許可されたユーザーと管理者にだけ出る）
  function cloudConnectorCard() {
    const card = h("div", { class: "card form hidden" });
    (async () => {
      try { const r = await sb.rpc("cloud_connector_ok"); if (r.error || r.data !== true) return; } catch (e) { return; }   // 許可されていない人・SQL未実行なら、出さない
      card.append(h("h2", {}, "☁ Cloud コネクタ"),
        h("p", { class: "muted" }, "管理者に許可されたため、Cloudコネクタ（JavaScript）を使えます。Cloudが許可されたHTMLの <script> の中に貼って使います。"),
        cloudConnectorBox());
      card.classList.remove("hidden");
    })();
    return card;
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
        h("small", { class: "hint" }, "オフの場合、投稿できるのは企画主だけです。どちらの場合も、投稿されたコードは、ログインした人ならダウンロード・閲覧できます（投稿ごとに、ダウンロードを許可しない設定もできます）。後から変更できます。")));
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
    const { data: collabs } = await sb.from("project_collaborators").select("user_id,can_view_limited,can_edit_settings,can_post,can_cloud,user:profiles!user_id(username)").eq("project_id", id).order("created_at");
    data.collaborators = collabs || [];
    data.myCollab = session ? (data.collaborators.find(c => c.user_id === session.user.id) || null) : null;
    data.isCollab = !!data.myCollab;
    return data;
  }

  // 共同編集者の管理欄（追加・削除は企画主と管理者だけ。共同編集者本人は一覧を見るだけ）
  function collaboratorsBox(project, canManage) {
    const box = h("div", { class: "card" }, h("h2", {}, "👥 共同編集者"),
      h("p", { class: "muted", style: "margin-top:0" },
        "共同編集者に何を許可するかは、人ごとに企画主が決められます（限定公開の投稿を見る／企画の設定（企画名・説明・投稿許可）を変更する／企画へ投稿する／Cloudを管理する（記録の削除・向きの変更・利用の申請。はじめはオフです））。他の人の投稿の編集・削除や、企画の削除はできません。"));
    const list = h("div", {});
    function drawList() {
      list.replaceChildren();
      if (!project.collaborators.length) list.append(h("p", { class: "muted" }, "共同編集者はいません。"));
      project.collaborators.forEach(c => {
        const row = h("div", { class: "picker-row collab-row" }, h("span", { class: "collab-name" }, "@" + (c.user ? c.user.username : "?")));
        const permDefs = [["can_view_limited", "限定公開を見る"], ["can_edit_settings", "企画の設定変更"], ["can_post", "投稿"], ["can_cloud", "Cloudの管理"]];
        const isOn = key => key === "can_cloud" ? c[key] === true : c[key] !== false;   // Cloudの管理は、企画主が、人ごとにオンにしたときだけ
        const perms = h("span", { class: "perms" });
        permDefs.forEach(([key, label]) => {
          if (canManage) {
            const cb = h("input", { type: "checkbox" });
            cb.checked = isOn(key);
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
            perms.append(h("span", { class: "badge " + (isOn(key) ? "open" : "") }, label + (isOn(key) ? "：可" : "：不可")));
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
        await purgeProjectFiles(id);
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
    const [project, postsRes, commentsRes, myViewRes, limitRes, favRes] = await Promise.all([
      fetchProject(id),
      sb.from("posts").select("id,title,created_at,author_id,is_public,allow_download,author:profiles!author_id(username)")
        .eq("project_id", id).order("created_at", { ascending: false }),
      sb.from("comments").select("id,body,created_at,author_id,parent_id,author:profiles!author_id(username)")
        .eq("project_id", id).order("created_at", { ascending: true }),
      // 自分が閲覧を許可されている限定公開の投稿
      session ? sb.from("post_viewers").select("post_id").eq("user_id", session.user.id) : Promise.resolve({ data: [] }),
      // この企画で投稿できるHTMLの数の上限（ファイルがあれば2個、なければ4個。SQL未更新なら null）
      sb.rpc("project_post_limit", { p_project: id }),
      // 自分がお気に入りに登録しているか
      session ? sb.from("project_favorites").select("project_id").eq("project_id", id).eq("user_id", session.user.id).limit(1) : Promise.resolve({ data: [] })
    ]);
    if (!project) return notFound();
    recordView(id);   // 企画のページを開いた＝アクセス（同じ人は30分に1回）
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

    // ダウンロードはログインした人だけ（ログインしていない人には、ログインへのリンクを出す）
    let zipBtn;
    if (session) {
      zipBtn = h("button", { class: "btn", type: "button" }, "⬇ 企画まるごとZIP");
      zipBtn.addEventListener("click", () => busy(zipBtn, () => downloadProjectZip(project, posts.length)));
    } else {
      zipBtn = h("a", { class: "btn", href: "#/login", title: "ログインすると、ダウンロードできます" }, "ログインしてダウンロード");
    }

    let postAction;
    if (canPost(project) && postLimit !== null && posts.length >= postLimit) postAction = h("span", { class: "badge lock", title: "画像・音声のファイルがある企画は2個まで、ない企画は4個までです" }, `HTMLの上限（${postLimit}個）に達しています`);
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
        } else if (visible && !session) {
          // ダウンロードはログインした人だけ
          dlBtn = h("a", { class: "btn small", href: "#/login", title: "ログインすると、ダウンロードできます" }, "ログインしてダウンロード");
        } else if (visible && hasAssets.has(p.id)) {
          // 添付ファイルがある投稿は、ZIPだけ
          dlBtn = h("button", { class: "btn small", type: "button" }, "⬇ ZIPでダウンロード");
          dlBtn.addEventListener("click", () => busy(dlBtn, async () => {
            const [pr, ar] = await Promise.all([sb.rpc("get_post", { p_id: p.id }), sb.rpc("get_post_assets", { p_post: p.id })]);
            if (pr.error) throw pr.error;
            if (!pr.data || !pr.data.can_view) throw new Error("この投稿は限定公開のため、ダウンロードできません。");
            if (!pr.data.can_download) throw new Error("この投稿は、投稿者がダウンロードを許可していません。");
            await downloadPostZip(pr.data, await withAssetData(ar.data));
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

    // お気に入り登録（新しいバージョンが公開されると通知が届く）
    let isFav = !!(favRes && favRes.data && favRes.data.length);
    const favCount = h("span", {}, "");
    const showCounts = () => { favCount.textContent = `登録数 ${project.favorite_count || 0}件`; };
    showCounts();
    let favBtn;
    if (!session) {
      favBtn = h("a", { class: "fav-round", href: "#/login", title: "ログインすると、お気に入りに登録できます", "aria-label": "お気に入り登録（ログインが必要です）" }, "お気に入り登録");
    } else {
      favBtn = h("button", { class: "fav-round", type: "button" });
      const paint = () => {
        favBtn.textContent = isFav ? "お気に入り登録済み" : "お気に入り登録";
        favBtn.classList.toggle("fav-on", isFav);
        favBtn.setAttribute("aria-pressed", String(isFav));
        favBtn.title = isFav ? "お気に入り登録済み（押すと解除）" : "お気に入りに登録";
        favBtn.setAttribute("aria-label", favBtn.title);
      };
      paint();
      favBtn.addEventListener("click", () => busy(favBtn, async () => {
        const { data, error } = await sb.rpc("set_favorite", { p_project: id, p_on: !isFav });
        if (error) throw error;
        isFav = !isFav;
        if (typeof data === "number") project.favorite_count = data;
        paint(); showCounts();
        toast(isFav ? "お気に入りに登録しました。新しいバージョンが公開されると通知が届きます" : "お気に入りを解除しました");
      }));
    }

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

    const viewsSpan = h("span", {}, `アクセス数 ${project.view_count || 0}回`);
    // 管理者が出した警告（みんなに見える）
    const warnSlot = h("div", {});
    // replaceChildren(null) は「null」という文字を入れてしまうので、ないときは、何も渡さない
    const drawWarn = () => warnSlot.replaceChildren(...(project.admin_warning
      ? [h("div", { class: "admin-warning", role: "alert" }, h("strong", {}, "⚠ "), ADMIN_WARNING_TEXT)] : []));
    drawWarn();
    return h("section", {},
      warnSlot,
      h("div", { class: "card" },
        h("div", { class: "page-head" },
          h("div", {},
            h("div", { class: "title-row" }, h("h1", {}, project.title), favBtn),
            h("div", { class: "meta" }, openBadge(project), h("span", {}, "企画主 ", nameTag(project.owner && project.owner.username)),
              project.collaborators.length ? h("span", {}, "共同編集者 ", ...project.collaborators.flatMap((c, i) => [i ? "、" : null, nameTag(c.user && c.user.username)].filter(Boolean))) : null,
              h("span", {}, fmtDate(project.created_at)),
              h("span", {}, `投稿 ${posts.length}件`), favCount,
              viewsSpan)),
          h("div", { class: "actions" }, zipBtn, assetBtn, canEditProject ? h("a", { class: "btn", href: `#/project/${id}/edit` }, "⚙ 設定") : null)),
        project.description ? h("p", { style: "white-space:pre-wrap;margin:0" }, project.description) : null),
      isAdmin ? viewAdjustBox(project, viewsSpan, drawWarn) : null,
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
  const assetIcon = n => (isAudioName(n) ? "🎵" : isTextDataName(n) ? "📄" : "🖼");
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
    const input = h("input", { type: "file", multiple: true, accept: "image/*,audio/*,application/json,text/csv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.ico,.avif,.svg,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.json,.csv" });
    // 📁 フォルダごと選ぶ（中の画像・音声だけを取り出す）
    const dirInput = h("input", { type: "file", webkitdirectory: true, directory: true, multiple: true, class: "hidden", "aria-label": "フォルダを選ぶ", tabindex: "-1" });
    const dirBtn = h("button", { class: "btn", type: "button", title: "フォルダの中の画像・音声を、まとめて選びます" }, "📁 フォルダを選ぶ");
    dirBtn.addEventListener("click", () => dirInput.click());
    const groupSel = h("select", { "aria-label": "入れるグループ" });
    const list = h("div", { class: "asset-list" });
    const upBtn = h("button", { class: "btn primary", type: "button" }, "⬆ ファイルを登録する");
    let checks = null;
    const targetBox = h("div", { class: "upload-targets" });

    function stateOf(it) {
      const dup = ctx.getAssets().some(e => e.name === it.name) || picks.some(p => p !== it && p.name === it.name);
      if (!assetNameOk(it.name)) return { kind: "bad", text: "使えないファイル名か、種類です（画像・音声・JSON・CSVのみ。名前に / \\ : * ? \" < > | は使えません）" };
      if (dup) return { kind: "bad", text: "同じ名前のファイルがあります" };
      if (it.size > ctx.getQuota()) return { kind: "bad", text: `1ファイルは、この企画の容量（${fmtSize(ctx.getQuota())}）までです。大きいファイルは、管理者に容量を広げてもらってください` };
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
            const { error } = await sb.rpc("request_asset_upload", { p_name: it.name, p_size: it.size, p_project: ctx.project.id });
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

    // フォルダの中から、画像・音声だけを取り出して、登録候補に加える（フォルダの中のフォルダも見る）
    function addFolder(files) {
      const skip = { other: 0, dup: 0 };
      let added = 0;
      const seen = new Set();
      [...files].forEach(f => {
        const path = f.webkitRelativePath || f.name;
        const base = f.name;
        if (/(^|\/)__MACOSX\//.test(path) || /^\./.test(base) || !ASSET_EXT.test(base)) { skip.other++; return; }
        if (seen.has(base)) { skip.dup++; return; }   // フォルダ違いの同名は、最初のものだけ
        seen.add(base);
        picks.push({ file: f, name: base, size: f.size, req: null });
        added++;
      });
      const folder = files.length && files[0].webkitRelativePath ? files[0].webkitRelativePath.split("/")[0] : "";
      const notes = [skip.other ? `画像・音声以外の${skip.other}個` : null, skip.dup ? `同じ名前の${skip.dup}個` : null].filter(Boolean);
      if (!files.length) { toast("フォルダの中にファイルがありませんでした", true); return; }
      toast(`フォルダ${folder ? "「" + folder + "」" : ""}から、画像・音声を${added}個選びました` + (notes.length ? `（${notes.join("・")}は除きました）` : ""), !added);
    }

    input.addEventListener("change", () => {
      [...input.files].forEach(f => {
        picks.push({ file: f, name: f.name, size: f.size, req: null });
      });
      input.value = "";
      drawPicks();
    });
    dirInput.addEventListener("change", () => {
      const files = [...dirInput.files];
      dirInput.value = "";
      addFolder(files);
      drawPicks();
    });

    upBtn.addEventListener("click", () => busy(upBtn, async () => {
      const used = ctx.getAssets().reduce((n, a) => n + (a.size || 0), 0), adding = picks.reduce((n, x) => n + x.size, 0);
      if (used + adding > ctx.getQuota()) throw new Error(`この企画の容量の上限（${fmtSize(ctx.getQuota())}）を超えます（いま${fmtSize(used)}、今回${fmtSize(adding)}）。ファイルを減らす・削除するか、「容量を広げる」から管理者に許可を要請してください。`);
      if (ctx.getPostCount() > 2) throw new Error("HTMLが3個以上ある企画には、画像・音声を登録できません（ファイルがある企画は、HTMLを2個までです）。");
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
          // ①予約（サーバーが権限・容量・許可を確かめる）→ ②Storageに保存 → ③確定（保存された実際の大きさを、サーバーが確かめる）
          const reg = await sb.rpc("register_project_asset", {
            p_project: ctx.project.id, p_name: it.name, p_size: it.size,
            p_request: st.kind === "approved" ? st.req.id : null,
            p_group: groupSel.value || null, p_posts: targets
          });
          if (reg.error) throw reg.error;
          const slot = reg.data;
          try {
            const up = await sb.storage.from(ASSET_BUCKET).upload(slot.path, it.file, { contentType: slot.mime, upsert: false, cacheControl: "31536000" });
            if (up.error) throw up.error;
            const fin = await sb.rpc("finalize_project_asset", { p_asset: slot.id });
            if (fin.error) throw fin.error;
          } catch (e2) {
            // 失敗したら、予約を取り消す（許可も元に戻る）。保存済みのファイルがあれば消す
            try {
              const c = await sb.rpc("cancel_project_asset", { p_asset: slot.id });
              if (c.data) await sb.storage.from(ASSET_BUCKET).remove([c.data]);
            } catch (e3) { /* 取り消せなかった予約は、1時間後に自動で片づく */ }
            throw e2;
          }
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
        "png / jpg / gif / webp / svg、mp3 / wav / ogg / m4a、json、csv などを登録できます。「📁 フォルダを選ぶ」で、画像・音声を入れたフォルダをまとめて選ぶこともできます（中の画像・音声だけを選び、フォルダの中のフォルダも見ます。パソコン向けの機能です）。1ファイル500KBまではそのまま登録できます（1企画の合計は、ふだん3MBまで。管理者の許可で最大10MBまで広げられます）。500KBを超えるファイルは、ファイルごとに管理者の許可が必要です（申請した大きさの5％増しまで）。1ファイルの大きさは、この企画の容量（3MBの企画は3MB、5MBの企画は5MB、7MBなら7MB、10MBなら10MB）までです。"),
      h("div", { class: "pick-row" }, input, dirBtn, dirInput),
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

    // まとめて削除：チェックを入れたファイルを選ぶ
    const selected = new Set();
    let rowBoxes = new Map(), groupBoxes = [];
    const master = h("input", { type: "checkbox", "aria-label": "すべてのファイルを選ぶ" });
    const bulkInfo = h("span", { class: "muted" });
    const bulkDel = h("button", { class: "btn small danger", type: "button" }, "選んだファイルを削除");
    const moveSel = h("select", { "aria-label": "移す先のグループ" });
    const moveBtn = h("button", { class: "btn small", type: "button" }, "グループを変更");
    const bulkBar = h("div", { class: "bulk-del hidden" }, h("label", { class: "check" }, master, " すべて選ぶ"), bulkInfo, h("span", { class: "grow" }),
      h("span", { class: "bulk-move" }, moveSel, moveBtn), bulkDel);
    function fillMoveSel() {
      const keep = moveSel.value;
      moveSel.replaceChildren(h("option", { value: "" }, "グループなし"), ...groups.map(g => h("option", { value: g.id }, "📁 " + g.name)));
      moveSel.value = groups.some(g => g.id === keep) ? keep : "";
    }
    moveBtn.addEventListener("click", () => {
      const ids = [...selected].filter(id => assets.some(a => a.id === id));
      if (!ids.length) return;
      const gid = moveSel.value || null;
      const gname = gid ? groups.find(g => g.id === gid).name : "グループなし";
      if (!confirm(`選んだ${ids.length}個のファイルを、「${gname}」へ移します。よろしいですか？`)) return;
      busy(moveBtn, async () => {
        const { error } = await sb.rpc("move_assets_to_group", { p_assets: ids, p_group: gid });
        if (error) throw error;
        toast(`${ids.length}個のファイルを「${gname}」へ移しました`);
        await load();
      });
    });
    function syncBulk() {
      const n = selected.size, total = assets.length;
      bulkBar.classList.toggle("hidden", !total);
      master.checked = total > 0 && n === total;
      master.indeterminate = n > 0 && n < total;
      bulkInfo.textContent = n ? `${n}個を選んでいます` : "削除したいファイルにチェックを入れてください";
      bulkDel.disabled = !n;
      moveBtn.disabled = !n;
      moveSel.disabled = !n;
      bulkDel.textContent = n ? `選んだ${n}個のファイルを削除` : "選んだファイルを削除";
      groupBoxes.forEach(({ cb, items }) => {
        const c = items.filter(a => selected.has(a.id)).length;
        cb.checked = items.length > 0 && c === items.length;
        cb.indeterminate = c > 0 && c < items.length;
      });
      rowBoxes.forEach((cb, id) => { cb.checked = selected.has(id); });
    }
    master.addEventListener("change", () => {
      if (master.checked) assets.forEach(a => selected.add(a.id)); else selected.clear();
      syncBulk();
    });
    bulkDel.addEventListener("click", () => {
      const ids = [...selected].filter(id => assets.some(a => a.id === id));
      if (!ids.length) return;
      const names = ids.map(id => assets.find(a => a.id === id).name);
      if (!confirm(`選んだ${ids.length}個のファイルを削除します。\n\n${names.slice(0, 8).join("\n")}${names.length > 8 ? `\n…ほか${names.length - 8}個` : ""}\n\n使っているHTMLからも外れます。元に戻せません。よろしいですか？`)) return;
      busy(bulkDel, async () => {
        const paths = [];
        let done = 0, failed = null;
        for (const id of ids) {
          const { data: path, error } = await sb.rpc("delete_project_asset", { p_asset: id });
          if (error) { failed = friendly(error); break; }
          done++; selected.delete(id);
          if (path) paths.push(path);
        }
        for (let i = 0; i < paths.length; i += 100) {
          try { await sb.storage.from(ASSET_BUCKET).remove(paths.slice(i, i + 100)); } catch (e) { /* 目録からは消えている */ }
        }
        await load();
        if (failed) throw new Error(`${done}個を削除したところで止まりました：${failed}`);
        toast(`${done}個のファイルを削除しました`);
      });
    });

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
      if (!isAdmin) {
        const q = await sb.from("quota_requests").select("wanted,status").eq("project_id", project.id).eq("status", "pending").limit(1);
        pendingQuota = q.data && q.data[0] ? q.data[0].wanted : null;
      }
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
      getPostCount: () => posts.length, getQuota: () => quotaOf(project), getReqs: () => myReqs, reloadReqs, onChanged: load
    });

    function groupSection(g, items) {
      const sec = h("div", { class: "asset-group" });
      const gcb = h("input", { type: "checkbox", "aria-label": (g ? g.name : "グループなし") + "のファイルをすべて選ぶ" });
      groupBoxes.push({ cb: gcb, items });
      gcb.addEventListener("change", () => { items.forEach(a => { if (gcb.checked) selected.add(a.id); else selected.delete(a.id); }); syncBulk(); });
      const bar = h("div", { class: "asset-group-head" }, items.length ? gcb : null, h("strong", {}, g ? "📁 " + g.name : "📂 グループなし"), h("span", { class: "muted" }, `（${items.length}）`));
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
          const { data: path, error } = await sb.rpc("delete_project_asset", { p_asset: a.id });
          if (error) throw error;
          if (path) { try { await sb.storage.from(ASSET_BUCKET).remove([path]); } catch (e) { /* 目録からは消えている */ } }
          await load();
        });
      });
      const dlf = h("button", { class: "btn small", type: "button", title: "このファイルを、名前そのままで保存します" }, "⬇ 保存");
      dlf.addEventListener("click", () => busy(dlf, () => downloadAssetFile(a)));
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
      const cb = h("input", { type: "checkbox", "aria-label": `${a.name}を選ぶ`, class: "asset-sel" });
      cb.checked = selected.has(a.id);
      rowBoxes.set(a.id, cb);
      cb.addEventListener("change", () => { if (cb.checked) selected.add(a.id); else selected.delete(a.id); syncBulk(); });
      wrap.append(
        h("div", { class: "asset-row" }, cb, h("span", { class: "asset-fname" }, assetIcon(a.name) + " " + a.name), h("span", { class: "muted" }, fmtSize(a.size)), h("span", { class: "grow" }), gs, dlf, del),
        h("details", { class: "targets" }, summary, pc.node));
      return wrap;
    }

    // 容量を広げる：一般は管理者に要請、管理者は直接変更
    let pendingQuota = null;   // 回答待ちの要請（希望の容量）
    function quotaControls(quota) {
      const box = h("div", { class: "quota-ctl" });
      const opts = (isAdmin ? [3, 5, 7, 10] : [5, 7, 10]).map(n => n * 1000000).filter(n => isAdmin ? n !== quota : n > quota);
      if (!opts.length) return null;
      if (!isAdmin && pendingQuota) { box.append(h("span", { class: "badge" }, `⏳ ${fmtSize(pendingQuota)}への拡大を要請中（管理者の許可待ち）`)); return box; }
      const sel = h("select", { "aria-label": "容量" }, ...opts.map(n => h("option", { value: n }, fmtSize(n))));
      const btn = h("button", { class: "btn small", type: "button" }, isAdmin ? "容量を変更" : "容量を広げる（管理者に要請）");
      btn.addEventListener("click", () => busy(btn, async () => {
        const n = parseInt(sel.value, 10);
        const { error } = isAdmin
          ? await sb.rpc("admin_set_asset_quota", { p_project: project.id, p_bytes: n })
          : await sb.rpc("request_asset_quota", { p_project: project.id, p_bytes: n });
        if (error) throw error;
        if (isAdmin) { project.asset_quota = n; toast(`容量を${fmtSize(n)}にしました`); }
        else { pendingQuota = n; toast("管理者に容量の拡大を要請しました。許可されると通知が届きます"); }
        render();
      }));
      box.append(h("span", { class: "muted" }, isAdmin ? "容量（管理者）：" : "容量が足りないとき："), sel, btn);
      return box;
    }

    function render() {
      const limit = assets.length ? 3 : 6;
      const used = assets.reduce((n, a) => n + (a.size || 0), 0);
      const quota = quotaOf(project);
      const pct = Math.min(100, Math.round(used / quota * 100));
      head.replaceChildren(
        h("div", { class: "quota" + (pct >= 90 ? " warn" : "") },
          h("div", {}, `容量：${fmtSize(used)} / ${fmtSize(quota)}（${pct}%）　ファイル：${assets.length}個`),
          h("div", { class: "quota-bar" }, h("div", { class: "quota-fill", style: `width:${pct}%` })),
          quotaControls(quota)),
        h("p", { class: "notice" },
          `HTMLの数の上限：ファイルがある企画は2個まで、ない企画は4個までです（いま${posts.length}個・上限${limit}個）。`,
          posts.length > 2 && !assets.length ? h("strong", {}, " いまはHTMLが3個以上あるので、ファイルを登録するには、HTMLを2個以下にしてください。") : null,
          assets.length && posts.length > 2 ? h("strong", {}, " HTMLが上限を超えているため、新しいHTMLは投稿できません。") : null));
      uploader.refresh();
      listBox.replaceChildren();
      rowBoxes = new Map(); groupBoxes = [];
      fillMoveSel();
      [...selected].forEach(id => { if (!assets.some(a => a.id === id)) selected.delete(id); });
      if (!assets.length && !groups.length) listBox.append(h("p", { class: "muted" }, "まだファイルがありません。"));
      groups.forEach(g => listBox.append(groupSection(g, assets.filter(a => a.group_id === g.id))));
      const loose = assets.filter(a => !a.group_id);
      if (loose.length) listBox.append(groupSection(null, loose));
      syncBulk();
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
      bulkBar, listBox);
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
          (await withAssetData(data)).forEach(a => cache.set(a.id, a));
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
        h("small", { class: "hint" }, "オフにすると、他の人にはダウンロードボタンが出ず、コード（HTML・CSS・JavaScript）も表示されません（プレビューだけ見られます）。作成者・企画主・共同編集者・管理者は、この設定にかかわらずダウンロードできます。投稿したあとも変更できます。")));
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
        h("p", { style: "margin:0 0 .4rem" }, "500KBを超えるコードを投稿するには、管理者の承認が必要です（JavaScriptを複数のファイルにしたときは、全ファイルの合計が500KBを超える場合です）。承認されると、最大2MBのコードを、認められた回数だけ投稿できます。"),
        note, h("div", { class: "actions", style: "margin-top:.4rem" }, send));
    }

    // 書いている途中でも、500KBを超えたら、すぐに要請の欄を出す（管理者は上限が大きいので、出さない）
    let bigShown = false;
    const checkBigLive = () => {
      if (isAdmin) return;
      const over = [html, css, js].some(el => el.value.length > cap());
      if (over && !bigShown) { bigShown = true; showBigNotice(); }
      else if (!over && bigShown) { bigShown = false; bigBox.classList.add("hidden"); }
    };
    [html, css, js].forEach(el => el.addEventListener("input", checkBigLive));

    const previewBox = h("div", { class: "preview-box hidden" });
    const assetsUI = assetSelect(project, post);
    const prevBtn = h("button", { class: "btn", type: "button" }, "▶ プレビュー");
    prevBtn.addEventListener("click", () => busy(prevBtn, async () => {
      const as = await assetsUI.previewAssets();
      previewBox.classList.remove("hidden");
      // 投稿前の確認用：localStorage は使えるが、保存はしない（投稿前のデータで、本番のセーブを汚さないため）
      previewBox.replaceChildren(previewFrame(injectAtTop(previewDoc({ title: title.value, html: html.value, css: css.value, js: js.value }, as), storeShim({}, false, newToken()))));
    }));

    /* ---- 入力方法の切り替え（コード入力 / ファイル添付） ---- */
    const codeFields = h("div", {},
      field("HTML", html, "<body> の中身でも、<html> から始まる完全なHTMLでもOK。CSS や JavaScript をこの中（<style> / <script>）に直接書く場合は、下の欄は空のままで大丈夫です。"),
      field("CSS（任意）", css, "HTMLの中に <style> で書いた場合は空のままでOK"),
      field("JavaScript（任意）", js, "HTMLの中に <script> で書いた場合は空のままでOK。複数のJavaScriptファイルにするときは、ファイルごとの先頭に、区切りの行（例：/* ===== file: game.js ===== */）を書きます。区切りより前の部分は script.js になります。HTMLの中の <script src=\"game.js\"> は、そのファイルの中身がその位置で動き、ほかのファイルは、HTMLの最後に、書いた順に入ります（ZIPでは、別々のファイルになります）。"));

    const fileInput = h("input", { type: "file", accept: ".html,.htm,.css,.js", multiple: true });
    const fileInfo = h("ul", { class: "file-list" });
    const fileBox = h("div", { class: "hidden" },
      field("ファイルを選択", fileInput,
        ".html（.htm）・.css・.js のファイルを選べます（複数選択可。HTML・CSSは1つずつ、JavaScriptは複数（20個まで）。各500KBまで）。HTMLだけでもOKです。JavaScriptは、選んだ順（並べ替えできます）に動きます。HTMLの中の <script src=\"ファイル名.js\"> は、そのファイルの中身がその位置で動きます。選んだ内容は「コード入力」に切り替えて確認・修正できます。"),
      fileInfo);

    // 選んだファイル（HTML・CSSは1つずつ、JavaScriptは複数）。JavaScriptは、並べ替え・外すことができる
    const sel = { html: null, css: null, js: [] };
    let selErrs = [];
    function applySel() {
      html.value = sel.html ? sel.html.text : "";
      css.value = sel.css ? sel.css.text : "";
      js.value = sel.js.length ? joinJsFiles(sel.js) : "";
    }
    function showFileInfo() {
      fileInfo.replaceChildren();
      const row = (label, extra) => fileInfo.append(h("li", { class: "ok" }, "✓ " + label, extra || null));
      if (sel.html) row(`${sel.html.name}（HTML）`);
      if (sel.css) row(`${sel.css.name}（CSS）`);
      sel.js.forEach((f, i) => {
        const mv = (d, t, lbl) => h("button", { class: "btn small", type: "button", title: t, "aria-label": t, disabled: i + d < 0 || i + d >= sel.js.length, onclick: () => { const x = sel.js.splice(i, 1)[0]; sel.js.splice(i + d, 0, x); applySel(); showFileInfo(); } }, lbl);
        const rm = h("button", { class: "btn small", type: "button", title: "このファイルを外す", "aria-label": "このファイルを外す", onclick: () => { sel.js.splice(i, 1); applySel(); showFileInfo(); } }, "外す");
        row(`${f.name}（JavaScript ${i + 1}/${sel.js.length}）`, h("span", { class: "file-move" }, " ", mv(-1, "1つ前へ", "↑"), mv(1, "1つ後ろへ", "↓"), rm));
      });
      selErrs.forEach(t => fileInfo.append(h("li", { class: "ng" }, "× " + t)));
    }

    fileInput.addEventListener("change", async () => {
      const files = [...fileInput.files];
      if (!files.length) { sel.html = sel.css = null; sel.js = []; selErrs = []; applySel(); showFileInfo(); return; }
      const next = { html: null, css: null, js: [] };
      const errs = [];
      let needBig = false;
      for (const f of files) {
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        const kind = ext === "html" || ext === "htm" ? "html" : ext === "css" ? "css" : ext === "js" ? "js" : null;
        if (!kind) { errs.push(`${f.name}：対応していない形式です（.html / .css / .js のみ）`); continue; }
        if (kind !== "js" && next[kind]) { errs.push(`${f.name}：${kind.toUpperCase()} は1つだけ選べます`); continue; }
        if (kind === "js" && next.js.length >= JS_MAX_FILES) { errs.push(`${f.name}：JavaScriptは${JS_MAX_FILES}個までです`); continue; }
        if (kind === "js" && !jsNameOk(f.name)) { errs.push(`${f.name}：JavaScriptのファイル名に使えない文字があります（英数字・_ - . 空白、60文字まで）`); continue; }
        if (kind === "js" && next.js.some(x => x.name.toLowerCase() === f.name.toLowerCase())) { errs.push(`${f.name}：同じ名前のJavaScriptがあります`); continue; }
        if (f.size > BIG_MAX * 4) { errs.push(`${f.name}：大きすぎます（最大2MBまで）`); continue; }
        const text = await f.text();
        if (text.length > BIG_MAX) { errs.push(`${f.name}：大きすぎます（最大2MBまで）`); continue; }
        if (text.length > cap()) { errs.push(`${f.name}：500KBを超えています（管理者の承認が必要です）`); needBig = true; continue; }
        if (text.includes("\u0000")) { errs.push(`${f.name}：テキストファイルではありません`); continue; }
        if (kind === "js") next.js.push({ name: f.name, text }); else next[kind] = { name: f.name, text };
      }
      if (next.html || next.css || next.js.length) {
        sel.html = next.html; sel.css = next.css; sel.js = next.js;
        // JavaScriptの合計（区切り行をふくむ）が上限を超えるときは、先に知らせる
        if (sel.js.length && joinJsFiles(sel.js).length > cap()) { errs.push(`JavaScriptの合計（${sel.js.length}個）が${kb(joinJsFiles(sel.js).length)}で、500KBを超えています（管理者の承認が必要です。下の欄から、管理者に要請できます）`); needBig = true; }
        applySel();
        // タイトルが空、または前回ファイル名から自動で入れたままなら、選択したファイル名（HTML優先）を入れる
        if (!title.value.trim() || titleAuto) {
          const pick = files.find(f => /\.html?$/i.test(f.name)) || files.find(f => /\.(css|js)$/i.test(f.name));
          if (pick) { title.value = pick.name.replace(/\.[^.]+$/, "").slice(0, 80); titleAuto = true; }
        }
      }
      selErrs = errs;
      showFileInfo();
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
        "投稿できるのは HTML / CSS / JavaScript のコードだけです。投稿したコードは、ログインした人なら閲覧・ダウンロードできます（ダウンロードを許可しない設定にすると、コードは表示されず、プレビューだけ見られます）。",
        h("br"),
        isAdmin ? "管理者は、各最大2MBまで投稿できます。"
          : bigQuota > 0 ? `各500KBまで。大容量投稿（各最大2MB）の残り回数：${bigQuota}回`
          : "各500KBまで。超える場合は、管理者に要請できます（承認されると最大2MBまで）。"),
      field("タイトル", title),
      modeTabs, codeFields, fileBox,
      assetsUI.node,
      publicRow, dlRow, limitedBox,
      cloudFormBox(post),
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
        if (parseJsFiles(row.js).length > JS_MAX_FILES) throw new Error(`JavaScriptのファイルは、1つの投稿に${JS_MAX_FILES}個までです（いまは${parseJsFiles(row.js).length}個）。`);
        for (const k of ["html", "css", "js"]) {
          if (row[k].length > BIG_MAX) throw new Error(`${k.toUpperCase()} が大きすぎます（最大2MBまで）。`);
          if (row[k].length > cap()) {
            showBigNotice();
            throw new Error(k === "js" && parseJsFiles(row.js).length > 1
              ? `JavaScriptの合計（${parseJsFiles(row.js).length}個）が500KBを超えています。管理者の承認が必要です（下の「要請」から申請できます）。`
              : `${k.toUpperCase()} が500KBを超えています。管理者の承認が必要です（下の「要請」から申請できます）。`);
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
      return h("div", { class: "error-box" }, `この企画のHTMLは、上限（${lim}個）に達しています。画像・音声のファイルがある企画は2個まで、ない企画は4個までです。`, h("br"), h("a", { href: `#/project/${projectId}` }, "企画に戻る"));
    return postForm(project, null);
  }

  // HTMLを開いたとき、読み込みを始める前の待ち時間（サーバーの負荷を減らすため）：
  // ログインしていない人は4秒、ログインしている人は1秒。待っている間に別のページへ移ったら、読み込みは始めない
  const OPEN_WAIT_ANON = 4, OPEN_WAIT_USER = 1;   // 基本の待ち時間（秒）
  const OPEN_GAP_SECS = 10;                        // 前のHTMLの読み込みを始めてから、次のHTMLの読み込みを始めるまでに、最低あける秒数
  // 同じ人（同じブラウザ）が、続けて何個もHTMLを開かないようにする。最後に読み込みを始めた時刻は、ブラウザに覚えさせる
  let memLastOpen = 0;
  const lastOpenGet = cap => {
    let t = memLastOpen;
    try { t = Math.max(t, Number(localStorage.getItem("kh_last_open")) || 0); } catch (e) { /* メモリだけ */ }
    return Math.min(t, cap);   // 時計を戻されて、記録が未来になっていても、10秒より長くは待たせない
  };
  const lastOpenSet = t => { memLastOpen = t; try { localStorage.setItem("kh_last_open", String(t)); } catch (e) { /* メモリだけ */ } };
  async function waitBeforeOpen(token) {
    const secs = session ? OPEN_WAIT_USER : OPEN_WAIT_ANON;
    // 待っている間は、中身が空っぽの（白い）ページにして、静かに待つ
    if (token !== renderToken) return false;
    app.replaceChildren();
    const startedAt = Date.now();
    const baseEnd = startedAt + secs * 1000;
    // 基本の待ち時間が終わったあと、前のHTMLの読み込み開始から10秒たっていなければ、その分も待つ
    for (;;) {
      const rest = Math.max(baseEnd, lastOpenGet(startedAt) + OPEN_GAP_SECS * 1000) - Date.now();
      if (rest <= 0) break;
      await new Promise(r => setTimeout(r, Math.min(rest, 200)));
      if (token !== renderToken) return false;
    }
    if (token !== renderToken) return false;
    lastOpenSet(Date.now());
    return true;
  }

  // 未ログインの人に見せるHTMLは、インターネット通信ができないようにして実行する（ログインした人は、そのまま）。
  //  ・CSP で、通信（fetch / XMLHttpRequest / WebSocket など）・外部の読み込み・フォーム送信を禁止する
  //  ・CSP で止められない WebRTC は、使おうとした時点で止める
  //  ・通信しようとしたら、親ページ（このサイト）に知らせて、警告を出す
  const NET_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline' data:; img-src data: blob:; media-src data: blob:; font-src data: blob:; worker-src blob:; connect-src data:; frame-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'";
  const NET_GUARD = '<meta http-equiv="Content-Security-Policy" content="' + NET_CSP + '">' +
    "<script>(function(){var s=0;function w(n){if(s)return;s=1;try{parent.postMessage({kh:'net-blocked',what:String(n||'')},'*');}catch(e){}}" +
    "document.addEventListener('securitypolicyviolation',function(e){w(e.violatedDirective||e.effectiveDirective);},true);" +
    "['RTCPeerConnection','webkitRTCPeerConnection','RTCDataChannel'].forEach(function(n){if(!(n in window))return;" +
    "var f=function(){w(n);throw new Error('ログインしていないため、インターネット通信はできません');};" +
    "try{Object.defineProperty(window,n,{value:f,writable:false,configurable:false});}catch(e){}});})();</" + "script>";
  /* ------------------------------------------------------
   * ゲームのセーブ（続きから遊ぶ）
   *   プレビューは、安全のため、サイトとは別の「出どころ」で動く。そのため、投稿コードは localStorage を使えない。
   *   そこで、投稿コードより先に「localStorage の代わり」を入れ、書き込まれた内容を、親ページ（このサイト）が
   *   「この端末のブラウザ」の中に、投稿ごとに保存する。アカウントには結び付けない。
   *   ・保存先は、このブラウザの localStorage（"ch_save:投稿ID"）。サーバーには、送らない
   *   ・sessionStorage は、そのページを開いている間だけ（保存しない）
   * ---------------------------------------------------- */
  const SAVE_PREFIX = "ch_save:";
  const SAVE_MAX_CHARS = 1000000;   // 1つの投稿が保存できる量（キー＋値の文字数の合計）
  const SAVE_MAX_KEYS = 500;
  // ↓ この関数は、プレビューの中（投稿コードの直前）で動く。文字列にして埋め込むので、外の変数は使わない
  function storeShimMain(snap, persist, token, cap) {
    var NAME_MARK = "\u0001ch:" + token + ":";
    function makeStore(init, onChange) {
      var data = Object.create(null), total = 0;
      function add(k, v) { data[k] = v; total += k.length + v.length; }
      Object.keys(init || {}).forEach(function (k) { add(k, String(init[k])); });
      var api = {
        getItem: function (k) { k = String(k); return k in data ? data[k] : null; },
        setItem: function (k, v) {
          if (arguments.length < 2) throw new TypeError("Failed to execute 'setItem' on 'Storage': 2 arguments required, but only " + arguments.length + " present.");
          k = String(k); v = String(v);
          var old = k in data ? k.length + data[k].length : 0;
          if (total - old + k.length + v.length > cap) throw new DOMException("Failed to execute 'setItem' on 'Storage': Setting the value of '" + k + "' exceeded the quota.", "QuotaExceededError");
          total += k.length + v.length - old; data[k] = v; onChange();
        },
        removeItem: function (k) { k = String(k); if (k in data) { total -= k.length + data[k].length; delete data[k]; onChange(); } },
        clear: function () { if (Object.keys(data).length) { data = Object.create(null); total = 0; onChange(); } },
        key: function (i) { var ks = Object.keys(data); i = Number(i); return i >= 0 && i < ks.length ? ks[i] : null; }
      };
      var target = {};
      return {
        proxy: new Proxy(target, {
          get: function (t, p) {
            if (p === "length") return Object.keys(data).length;
            if (p === Symbol.toStringTag) return "Storage";
            if (typeof p === "string") {
              if (Object.prototype.hasOwnProperty.call(api, p)) return api[p];
              return p in data ? data[p] : undefined;
            }
            return undefined;
          },
          set: function (t, p, v) { if (typeof p === "string") api.setItem(p, v); return true; },
          deleteProperty: function (t, p) { if (typeof p === "string") api.removeItem(p); return true; },
          has: function (t, p) { return typeof p === "string" && (p === "length" || p in data || Object.prototype.hasOwnProperty.call(api, p)); },
          ownKeys: function () { return Object.keys(data); },
          getOwnPropertyDescriptor: function (t, p) {
            return typeof p === "string" && p in data ? { value: data[p], writable: true, enumerable: true, configurable: true } : undefined;
          }
        }),
        dump: function () { var o = {}; Object.keys(data).forEach(function (k) { o[k] = data[k]; }); return o; }
      };
    }
    var timer = 0;
    function flush() {
      if (!persist) return;
      timer = 0;
      var d = local.dump();
      try { window.name = NAME_MARK + JSON.stringify(d); } catch (e) {}
      try { parent.postMessage({ kh: "save", t: token, data: d }, "*"); } catch (e) {}
    }
    function changed() { if (persist && !timer) timer = setTimeout(flush, 400); }
    // iframe の中でページが再読み込みされたときは、親が持っている古い内容ではなく、直前の内容から始める
    var start = snap;
    if (persist && typeof window.name === "string" && window.name.indexOf(NAME_MARK) === 0) {
      try { start = JSON.parse(window.name.slice(NAME_MARK.length)); } catch (e) {}
    }
    var local = makeStore(start, changed), session = makeStore(null, function () {});
    try { Object.defineProperty(window, "localStorage", { get: function () { return local.proxy; }, configurable: true }); } catch (e) {}
    try { Object.defineProperty(window, "sessionStorage", { get: function () { return session.proxy; }, configurable: true }); } catch (e) {}
    if (persist) {
      window.addEventListener("pagehide", flush);
      window.addEventListener("beforeunload", flush);
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
    }
  }
  function storeShim(snap, persist, token) {
    const json = JSON.stringify(snap || {}).replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
    return "<script>(" + storeShimMain.toString() + ")(" + json + "," + (persist ? "true" : "false") + "," + JSON.stringify(token) + "," + SAVE_MAX_CHARS + ");</" + "script>";
  }
  // 親から受け取った（または保存してあった）内容が、決められた形・大きさかを確かめる。だめなら null
  function cleanSave(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const out = {};
    let total = 0, n = 0;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v !== "string") return null;
      total += k.length + v.length;
      if (++n > SAVE_MAX_KEYS || total > SAVE_MAX_CHARS) return null;
      out[k] = v;
    }
    return out;
  }
  function readSave(postId) {
    try { return cleanSave(JSON.parse(localStorage.getItem(SAVE_PREFIX + postId) || "null")) || {}; } catch (e) { return {}; }
  }
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");
  // プレビューの中のゲームから「保存して」と来たら、この端末のブラウザ（localStorage）に、投稿ごとに保存する
  let saveHostOff = null;
  function attachSaveHost(postId, token, onChange) {
    if (saveHostOff) saveHostOff();
    const key = SAVE_PREFIX + postId;
    let dead = false;
    const onMsg = ev => {
      const d = ev.data;
      if (dead || !d || d.kh !== "save" || d.t !== token) return;
      const clean = cleanSave(d.data);
      if (!clean) return;
      try {
        if (Object.keys(clean).length) localStorage.setItem(key, JSON.stringify(clean));
        else localStorage.removeItem(key);
      } catch (e) { /* 保存できないときは、あきらめる（遊ぶことには影響しない） */ }
      if (onChange) onChange();
    };
    window.addEventListener("message", onMsg);
    let retire = null;
    const off = () => {
      // ページを離れる直前の保存が、少し遅れて届くことがあるので、しばらくは受け付ける
      if (retire) return;
      retire = setTimeout(() => window.removeEventListener("message", onMsg), 3000);
      if (saveHostOff === off) saveHostOff = null;
    };
    saveHostOff = off;
    return {
      has: () => { try { return localStorage.getItem(key) !== null; } catch (e) { return false; } },
      clear: () => { dead = true; try { localStorage.removeItem(key); } catch (e) {} }
    };
  }
  function injectAtTop(doc, html) {
    // 必ず、文書の先頭（<!DOCTYPE> の直後）に入れる。投稿コードより前に読み込まれるようにするため
    const m = doc.match(/^\s*<!doctype[^>]*>/i);
    return m ? m[0] + html + doc.slice(m[0].length) : html + doc;
  }

  let netGuardOff = null;
  function attachNetGuard(frame, token) {
    if (netGuardOff) netGuardOff();
    let shown = false;
    const onMsg = ev => {
      const d = ev.data;
      if (!d || d.kh !== "net-blocked" || ev.source !== frame.contentWindow || token !== renderToken || shown) return;
      shown = true;
      showNetBlockedDialog();
    };
    window.addEventListener("message", onMsg);
    netGuardOff = () => { window.removeEventListener("message", onMsg); netGuardOff = null; };
  }
  function showNetBlockedDialog() {
    const host = document.fullscreenElement || document.body;   // 全画面のときも見えるように
    const back = h("div", { class: "kh-modal-back", role: "presentation" });
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey, true); };
    const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    const login = h("button", { class: "btn primary", type: "button" }, "ログインする");
    const ok = h("button", { class: "btn", type: "button" }, "閉じる");
    login.addEventListener("click", () => { close(); if (document.fullscreenElement) document.exitFullscreen(); go("#/login"); });
    ok.addEventListener("click", close);
    back.addEventListener("click", e => { if (e.target === back) close(); });
    back.append(h("div", { class: "kh-modal", role: "alertdialog", "aria-modal": "true", "aria-label": "インターネット通信はできません" },
      h("h2", {}, "⚠ インターネット通信はできません"),
      h("p", {}, "このHTMLは、インターネットで通信しようとしました。ログインしていないと、HTMLはインターネットで通信できません（通信対戦などは動きません）。"),
      h("p", {}, "ログインすると、通信を使えるようになります。"),
      h("div", { class: "actions" }, login, ok)));
    host.append(back);
    document.addEventListener("keydown", onKey, true);
    login.focus();
  }

  /* ======================================================
   * Internet Cloud
   *   プレビューの中のHTML（Cloud コネクタ）からのメッセージを受けて、サーバーの関数を呼ぶ。
   *   許可されたHTMLかどうか・ログインしている人のユーザー名の記録は、すべてサーバー側で決まる
   * ==================================================== */
  let cloudHostOff = null;
  const CLOUD_RANKING_WAIT = 2000;                // ランキングの読み込みは、呼ばれてから2秒たってから始める
  const CLOUD_BEST_FRESH = 30 * 60 * 1000;        // ブラウザに覚えた自己ベストを、そのまま使う時間（これを過ぎたら、サーバーで確かめ直す）
  const memBest = new Map();
  function attachCloudHost(frame, postId, token) {
    if (cloudHostOff) cloudHostOff();
    let times = [];
    let removeBlockedUntil = 0;   // 記録の削除がキャンセルされたとき、この時刻まで、削除の依頼を断る
    let rankingP = null;   // 待っている（読み込み中の）ランキング。続けて呼ばれたら、まとめて1回にする
    // 自分のオンライン自己ベストを、ブラウザにも覚えさせる（ユーザーと投稿ごと）
    const bestKey = () => (session ? `kh_best:${session.user.id}:${postId}` : null);
    const bestGet = () => {
      const k = bestKey(); if (!k) return undefined;
      let v = memBest.get(k);
      try { const raw = localStorage.getItem(k); if (raw) v = JSON.parse(raw); } catch (e) { /* メモリだけ */ }
      return v && typeof v === "object" && "score" in v && Date.now() - v.at < CLOUD_BEST_FRESH ? v.score : undefined;
    };
    const bestSet = score => {
      const k = bestKey(); if (!k) return;
      if (score === undefined) { memBest.delete(k); try { localStorage.removeItem(k); } catch (e) { /* ok */ } return; }
      const v = { score: score == null ? null : Number(score), at: Date.now() };
      memBest.set(k, v);
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* メモリだけ */ }
    };
    const reply = (src, id, ok, data, error) => { try { src.postMessage({ kh: "cloud-res", id, ok, data, error }, "*"); } catch (e) { /* 閉じられた */ } };
    const onMsg = async ev => {
      const d = ev.data;
      if (!d || d.kh !== "cloud" || ev.source !== frame.contentWindow || token !== renderToken) return;
      const id = String(d.id == null ? "" : d.id).slice(0, 64);
      const now = Date.now();
      times = times.filter(t => now - t < 2000);
      if (times.length >= 20) return reply(ev.source, id, false, null, "Cloudの呼び出しが多すぎます。少し待ってから、もう一度お試しください。");
      times.push(now);
      try {
        let out;
        const call = async (name, args) => { const r = await sb.rpc(name, args); if (r.error) throw r.error; return r.data; };
        if (d.op === "me") out = session && profile ? { username: profile.username } : null;
        else if (d.op === "info") { const i = await call("cloud_info", { p_post: postId }); out = { used: i.used, limit: i.limit, rows: i.rows, better: i.better }; }
        else if (d.op === "list") {
          // ランキングの読み込み：呼ばれてから2秒待って始める（待っている間に呼ばれたものは、まとめて1回）
          if (!rankingP) {
            rankingP = (async () => {
              try {
                await new Promise(r => setTimeout(r, CLOUD_RANKING_WAIT));
                if (token !== renderToken) throw new Error("cancelled");
                return await call("cloud_list", { p_post: postId });
              } finally { rankingP = null; }
            })();
          }
          out = await rankingP;
          if (session && profile) { const mine = (out || []).find(x => x.username === profile.username); bestSet(mine ? mine.score : null); }   // 自分の分も、ついでに更新
        }
        else if (d.op === "mine") {
          // 自分の自己ベスト：ブラウザに覚えていれば、通信しない
          if (!session) out = null;
          else {
            const c = bestGet();
            if (c !== undefined) out = c;
            else {
              const l = await call("cloud_list", { p_post: postId });
              const mine = (l || []).find(x => profile && x.username === profile.username);
              out = mine ? Number(mine.score) : null;
              if (profile) bestSet(out);   // ユーザー名がまだ読み込まれていないときは、「記録なし」と覚えない
            }
          }
        }
        else if (d.op === "submit") {
          const sc = Number(d.score);
          if (typeof d.score !== "number" || !isFinite(sc)) throw new Error("invalid score");
          // ログインしていない人のスコアは、記録しない（サーバーにも送らない）
          out = session ? await call("cloud_submit", { p_post: postId, p_score: sc }) : { saved: false, best: null, reason: "login" };
          if (session && out && out.best != null) bestSet(out.best);   // 記録できたときも、記録できなかったとき（いまのベスト）も、覚える
        }
        else if (d.op === "remove") {
          // 投稿のプログラムが、利用者の記録を、無断で消せないように、必ず、利用者に確認する（キャンセルされたら、30秒は、確認も出さずに断る）
          if (Date.now() < removeBlockedUntil) throw new Error("記録の削除は、キャンセルされました。しばらくしてから、もう一度お試しください。");
          if (!window.confirm("このページのプログラムが、あなたの記録（この投稿のオンライン記録）を削除しようとしています。\n\n削除しますか？")) {
            removeBlockedUntil = Date.now() + 30000;
            throw new Error("記録の削除は、キャンセルされました。");
          }
          await call("cloud_remove", { p_post: postId }); bestSet(undefined); out = true;
        }
        else throw new Error("unknown op");
        reply(ev.source, id, true, out);
      } catch (e) { reply(ev.source, id, false, null, friendly(e)); }
    };
    window.addEventListener("message", onMsg);
    cloudHostOff = () => { window.removeEventListener("message", onMsg); cloudHostOff = null; };
  }

  // Cloud コネクタ（JavaScript）の表示・コピー。コネクタを許可されたユーザー（と管理者）だけが取得できる
  function copyText(text, ta) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    ta.focus(); ta.select();
    return document.execCommand("copy") ? Promise.resolve() : Promise.reject(new Error("コピーできませんでした。選んで、手動でコピーしてください。"));
  }
  const cloudConnectorBox = () => {
    const det = h("details", { class: "cloud-usage cloud-conn" }, h("summary", {}, "Cloudコネクタ（JavaScript）を表示・コピーする"));
    const body = h("div", {});
    det.append(body);
    let loaded = false;
    det.addEventListener("toggle", async () => {
      if (!det.open || loaded) return;
      loaded = true;
      body.replaceChildren(h("p", { class: "muted" }, "読み込み中…"));
      let data = null, error = null;
      try { ({ data, error } = await sb.rpc("get_cloud_connector")); } catch (e) { error = e; }
      if (error || typeof data !== "string" || !data) {
        loaded = false;
        body.replaceChildren(h("p", { class: "muted" }, "コネクタを取得できませんでした。コネクタを使えるのは、管理者に許可されたユーザーだけです。"));
        return;
      }
      const ta = h("textarea", { class: "codeview", readonly: true, rows: 10 });
      ta.value = data;
      const copy = h("button", { class: "btn small primary", type: "button" }, "📋 コピーする");
      copy.addEventListener("click", () => busy(copy, async () => { await copyText(data, ta); toast("コネクタをコピーしました"); }));
      body.replaceChildren(
        h("p", { class: "muted" }, "このコネクタを、Cloudが許可されたHTMLの <script> の中に貼って使います（コードの関数を変える必要はありません）。使えるのは、コードひろばのプレビューの中だけです。"),
        ta, h("div", { class: "actions" }, copy));
    });
    return det;
  };

  // 投稿ページの「☁ Cloud」の欄：状態・（管理者への）申請・（管理者の）許可・記録の確認と削除
  function cloudBox(postId, firstInfo) {
    const box = h("div", { class: "cloud-box" });
    let info = firstInfo;
    const betterText = b => b === "low" ? "小さいほど良い（タイムなど）" : "大きいほど良い（得点など）";
    async function draw() {
      const i = info;
      if (!i) { box.replaceChildren(); return; }
      if (!i.enabled) {
        if (isAdmin) {
          const on = h("button", { class: "btn small", type: "button" }, "☁ このHTMLにCloudを許可する");
          on.addEventListener("click", () => busy(on, async () => {
            const { error } = await sb.rpc("admin_set_cloud_post", { p_post: postId, p_on: true });
            if (error) throw error;
            toast("Cloudを許可しました"); await reload();
          }));
          box.replaceChildren(h("h3", {}, "☁ Cloud"), h("p", { class: "muted" }, "このHTMLには、まだCloudが許可されていません。"), on);
        } else if (i.requested && i.can_manage) {
          box.replaceChildren(h("h3", {}, "☁ Cloud"), h("p", { class: "muted" }, "Cloudの利用を申請中です。管理人の許可をお待ちください。"));
        } else if (i.can_request) {
          const ask = h("button", { class: "btn small", type: "button" }, "☁ Cloudの利用を申請する");
          ask.addEventListener("click", () => busy(ask, async () => {
            const { error } = await sb.rpc("request_cloud", { p_post: postId });
            if (error) throw error;
            toast("申請しました。管理人の許可をお待ちください"); await reload();
          }));
          box.replaceChildren(h("h3", {}, "☁ Cloud"), h("p", { class: "muted" }, "このHTMLでCloud（ユーザー名つきの自己ベストの記録）を使うには、管理人の許可が必要です。"), ask);
        } else box.replaceChildren();
        return;
      }
      const parts = [h("h3", {}, "☁ Cloud"),
        h("p", { class: "muted" }, `このHTMLは、Cloudを使えます。記録できるのは、1人1件・数字のスコア（自己ベスト）だけです。ログインした人だけが記録され、ユーザー名がいっしょに残ります。いま${i.rows}人が記録しています（最大200人）。`),
        h("p", { class: "muted" }, "スコアの向き：", h("strong", {}, betterText(i.better)))];
      if (i.can_manage) {
        if (i.connector) parts.push(cloudConnectorBox());
        const flip = h("button", { class: "btn small", type: "button", "data-better": i.better === "low" ? "high" : "low" },
          i.better === "low" ? "「大きいほど良い」に変える" : "「小さいほど良い」に変える");
        flip.addEventListener("click", () => busy(flip, async () => {
          const { error } = await sb.rpc("cloud_set_better", { p_post: postId, p_better: i.better === "low" ? "high" : "low" });
          if (error) throw error;
          toast("スコアの向きを変えました（これまでの記録は、そのまま残ります）"); await reload();
        }));
        parts.push(h("div", { class: "actions" }, flip));
        let list = [];
        try { const r = await sb.rpc("cloud_list", { p_post: postId }); if (!r.error) list = r.data || []; } catch (e) { /* 表示だけ */ }
        const clearAll = h("button", { class: "btn small danger", type: "button" }, "記録をすべて消す");
        clearAll.addEventListener("click", () => {
          if (!confirm("このHTMLのCloudの記録を、すべて消します。元に戻せません。よろしいですか？")) return;
          busy(clearAll, async () => {
            const { error } = await sb.rpc("cloud_clear", { p_post: postId });
            if (error) throw error;
            toast("記録を消しました"); await reload();
          });
        });
        const tbody = h("tbody", {});
        if (!list.length) tbody.append(h("tr", {}, h("td", { colspan: 3, class: "muted" }, "記録はまだありません。")));
        list.forEach(r => {
          const del = h("button", { class: "btn small", type: "button", title: "この人の記録を、すべて消します" }, "この人の分を消す");
          del.addEventListener("click", () => {
            if (!confirm(`@${r.username} の記録を、このHTMLからすべて消します。よろしいですか？`)) return;
            busy(del, async () => {
              const { error } = await sb.rpc("cloud_clear", { p_post: postId, p_username: r.username });
              if (error) throw error;
              toast("消しました"); await reload();
            });
          });
          tbody.append(h("tr", {}, h("td", {}, "@" + r.username), h("td", { class: "cloud-val" }, String(r.score)), h("td", {}, del)));
        });
        parts.push(h("div", { class: "table-wrap" }, h("table", { class: "table cloud-table" },
          h("thead", {}, h("tr", {}, h("th", {}, "ユーザー"), h("th", {}, "スコア（良い順）"), h("th", {}, ""))), tbody)),
          h("div", { class: "actions" }, clearAll));
      }
      if (isAdmin) {
        const off = h("button", { class: "btn small", type: "button" }, "Cloudの許可を取り消す");
        off.addEventListener("click", () => {
          if (!confirm("このHTMLのCloudの許可を取り消します（記録は残り、再び許可すると使えます）。よろしいですか？")) return;
          busy(off, async () => {
            const { error } = await sb.rpc("admin_set_cloud_post", { p_post: postId, p_on: false });
            if (error) throw error;
            toast("許可を取り消しました"); await reload();
          });
        });
        parts.push(h("div", { class: "actions" }, off));
      }
      box.replaceChildren(...parts);
    }
    async function reload() {
      const r = await sb.rpc("cloud_info", { p_post: postId });
      if (!r.error && r.data) info = r.data;
      await draw();
    }
    draw();
    return box;
  }

  // 投稿フォーム（メモの上）の「☁ Cloudの利用を申請する」。新規の投稿では、投稿したあとに押せるようになる
  function cloudFormBox(post) {
    const slot = h("div", { class: "cloud-form" });
    (async () => {
      if (!session) return;
      try { const r = await sb.rpc("cloud_connector_ok"); if (r.error || r.data !== true) return; } catch (e) { return; }   // コネクタを許可されていない人・SQL未実行なら、出さない
      if (post) {
        let info = null;
        try { const r = await sb.rpc("cloud_info", { p_post: post.id }); if (!r.error && r.data) info = r.data; } catch (e) { return; }
        if (!info) return;
        if (!info.enabled && !info.can_request && !info.requested && !isAdmin) return;   // 申請も許可もできない人には出さない
        if (info.enabled) slot.replaceChildren(h("div", { class: "cloud-box" }, h("h3", {}, "☁ Cloud"), h("p", { class: "muted" }, "このHTMLは、Cloudを使えます。"), cloudConnectorBox()));
        else slot.replaceChildren(cloudBox(post.id, info), h("div", { class: "cloud-box" }, cloudConnectorBox()));
        return;
      }
      const ask = h("button", { class: "btn small", type: "button", disabled: true }, "☁ Cloudの利用を申請する");
      slot.replaceChildren(h("div", { class: "cloud-box" }, h("h3", {}, "☁ Cloud"), ask,
        h("p", { class: "muted" }, "投稿したあとに、押せるようになります（投稿ページや、この編集画面から申請できます）。"), cloudConnectorBox()));
    })();
    return slot;
  }

  // 管理者ページ：サーバーから見えるアクセス元のIPアドレス（アクセス数の判定に使う。正しく取れているかの確認用）
  function ipCheckBox() {
    const out = h("div", { class: "ip-out muted" });
    const btn = h("button", { class: "btn small", type: "button" }, "サーバーから見えるIPアドレスを確認する");
    btn.addEventListener("click", () => busy(btn, async () => {
      const { data, error } = await sb.rpc("admin_client_ip_check");
      if (error) throw error;
      const d = data || {};
      out.replaceChildren(
        h("div", {}, "判定に使われるIP：", h("strong", {}, d.ip || "取得できませんでした")),
        h("div", {}, "X-Forwarded-For：", d.xff || "（なし）"),
        h("div", { class: "muted" }, d.ip
          ? "ご自分のIPアドレス（「IPアドレス 確認」で検索すると出ます）と一致していれば、正しく取れています。違うときは、ログインしていない人のアクセス数の判定が、正しく行われません。"
          : "IPアドレスが取れていないため、ログインしていない人のアクセス数は、ブラウザの目印で判定されます。"));
    }));
    return h("div", { class: "card ip-check" }, h("h2", {}, "🌐 アクセス数の判定（IPアドレス）"),
      h("p", { class: "muted" }, "ログインしていない人のアクセス数は、アクセス元のIPアドレスで、同じ人を30分に1回だけ数えています（ログインした人は、アカウントで判定します）。"),
      btn, out);
  }

  // 管理者ページ：Cloud の許可（申請・許可済みの投稿）
  const ADMIN_WARNING_TEXT = "Your access count has been blocked due to suspicious activity that artificially inflates it. No longer can this project stay in the rankings for much longer.";

  // 管理者：企画のアクセス数を、プラス・マイナスで変える（変更前に警告・理由は必須・変更の記録が残る）
  function viewAdjustBox(project, viewsSpan, drawWarn) {
    const det = h("details", { class: "card view-adjust" });
    const cur = () => Number(project.view_count) || 0;
    const modeSel = h("select", { class: "search" }, h("option", { value: "delta" }, "増やす・減らす（+ / −）"), h("option", { value: "set" }, "この数にする"));
    const numIn = h("input", { type: "number", class: "search", step: "1", placeholder: "例：-50（50減らす）／ 100（100増やす）", "aria-label": "数" });
    const reasonIn = h("input", { type: "text", class: "search", maxlength: "200", placeholder: "理由（必須・200文字まで。例：同じ人による水増し）", "aria-label": "理由" });
    const trendCb = h("input", { type: "checkbox", class: "trend-cb", checked: true });
    const go1 = h("button", { class: "btn danger", type: "button" }, "アクセス数を変更する");
    const msg = h("p", { class: "muted" });
    const logSlot = h("div", { class: "view-adjust-log" });
    const syncMode = () => { numIn.placeholder = modeSel.value === "set" ? "新しいアクセス数（0以上）" : "例：-50（50減らす）／ 100（100増やす）"; if (modeSel.value === "set") numIn.min = "0"; else numIn.removeAttribute("min"); };
    modeSel.addEventListener("change", syncMode);
    async function loadLog() {
      let r; try { r = await sb.rpc("admin_view_adjustments", { p_project: project.id, p_limit: 10 }); } catch (e) { return; }
      if (r.error) { logSlot.replaceChildren(h("p", { class: "muted" }, "変更の記録を読めません（SQL 30 を実行したか確認してください）。")); return; }
      const rows = r.data || [];
      logSlot.replaceChildren(h("h4", {}, "この企画の、変更の記録（新しい順・10件まで）"),
        rows.length ? h("ul", { class: "cloud-list" }, ...rows.map(x => h("li", {},
          `${fmtDate(x.created_at)}　@${x.admin_name || "（削除されたユーザー）"}　${x.old_count}回 → ${x.new_count}回（${x.new_count - x.old_count >= 0 ? "+" : ""}${x.new_count - x.old_count}）${x.trend_applied ? "・流行順にも反映" : ""}　理由：${x.reason}`)))
          : h("p", { class: "muted" }, "まだ、変更はありません。"));
    }
    go1.addEventListener("click", () => busy(go1, async () => {
      const raw = numIn.value.trim();
      if (raw === "" || !/^-?\d+$/.test(raw)) { toast("数を、整数で入力してください", true); numIn.focus(); return; }
      const n = Number(raw), reason = reasonIn.value.trim();
      if (!reason) { toast("理由を入力してください", true); reasonIn.focus(); return; }
      const isSet = modeSel.value === "set";
      if (isSet && n < 0) { toast("0以上の数を入力してください", true); return; }
      const next = isSet ? n : Math.max(0, cur() + n), diff = next - cur();
      if (diff === 0) { toast("変わる数がありません"); return; }
      const trend = trendCb.checked;
      if (!confirm(`⚠ 【警告】アクセス数を変更します（管理者の操作）\n\n企画：「${project.title}」\nいまのアクセス数：${cur()}回 → 変更後：${next}回（${diff > 0 ? "+" : ""}${diff}）\n${trend ? "流行順に使う、直近の記録にも反映します。" : "流行順の記録は、変えません。"}\n理由：${reason}\n\n・実際のアクセスではない数が表示されるようになります。\n・この変更は、あなたのユーザー名・日時・理由つきで、記録に残ります。\n\n本当に変更しますか？`)) return;
      if (Math.abs(diff) >= 1000 && !confirm(`⚠ 変更の幅が大きいです（${diff > 0 ? "+" : ""}${diff}回）。\n\nもう一度確認します。本当に、${cur()}回 → ${next}回 に変更しますか？`)) return;
      const r = await sb.rpc("admin_adjust_project_views", isSet
        ? { p_project: project.id, p_delta: null, p_set_to: n, p_reason: reason, p_trend: trend }
        : { p_project: project.id, p_delta: n, p_set_to: null, p_reason: reason, p_trend: trend });
      if (r.error) throw r.error;
      project.view_count = r.data.new;
      viewsSpan.textContent = `アクセス数 ${project.view_count}回`;
      msg.textContent = `変更しました：${r.data.old}回 → ${r.data.new}回（${r.data.changed > 0 ? "+" : ""}${r.data.changed}）`;
      numIn.value = ""; reasonIn.value = "";
      toast("アクセス数を変更しました");
      await loadLog();
    }));
    // 警告・カウント停止・ランキング除外（3つは、それぞれ独立）
    const mk = (key, label, hint) => {
      const cb = h("input", { type: "checkbox" }); cb.checked = !!project[key];
      return { key, label, cb, row: h("label", { class: "check" }, cb, h("span", {}, label, h("span", { class: "hint" }, hint))) };
    };
    const mods = [
      mk("admin_warning", "警告を表示する（みんなに見える）", "この企画を開いた画面の上部に、アクセス数の不正に関する警告を出します。"),
      mk("views_blocked", "アクセス数のカウントを停止する", "この企画へのアクセスを、数えません（流行順の記録にも入りません）。"),
      mk("rank_excluded", "ランキングから除外する", "流行順・アクセス数順・お気に入り数順で、順位をつけず、一覧の最後に回します（作成順・更新順はそのまま）。カウント停止とは別に、単独で使えます。")
    ];
    const modBtn = h("button", { class: "btn danger", type: "button" }, "この設定にする");
    modBtn.addEventListener("click", () => busy(modBtn, async () => {
      const ch = mods.filter(m => m.cb.checked !== !!project[m.key]);
      if (!ch.length) { toast("変わる設定がありません"); return; }
      const lines = ch.map(m => `・${m.label}：${m.cb.checked ? "オンにする" : "オフにする"}`).join("\n");
      if (!confirm(`⚠ 【警告】企画「${project.title}」の設定を変更します（管理者の操作）\n\n${lines}\n\n・警告は、この企画を開いた人みんなに見えます。\n・ランキング除外は、企画の順位に、すぐ影響します。\n\n本当に変更しますか？`)) return;
      const args = { p_project: project.id, p_warning: null, p_views_blocked: null, p_rank_excluded: null };
      ch.forEach(m => { args[{ admin_warning: "p_warning", views_blocked: "p_views_blocked", rank_excluded: "p_rank_excluded" }[m.key]] = m.cb.checked; });
      const r = await sb.rpc("admin_set_project_moderation", args);
      if (r.error) throw r.error;
      project.admin_warning = r.data.warning; project.views_blocked = r.data.views_blocked; project.rank_excluded = r.data.rank_excluded;
      mods.forEach(m => { m.cb.checked = !!project[m.key]; });
      drawWarn();
      toast("設定を変更しました");
    }));
    const modBox = h("div", { class: "view-adjust-mod" }, h("h4", {}, "警告・カウント停止・ランキング除外"), ...mods.map(m => m.row), h("div", { class: "actions" }, modBtn));
    let loaded = false;
    det.addEventListener("toggle", () => { if (det.open && !loaded) { loaded = true; loadLog(); } });
    det.append(h("summary", {}, "📈 アクセス数の調整・ランキング設定（管理者）"), modBox,
      h("p", { class: "muted" }, "不正に増やされたアクセス数を直すための機能です。変更すると、実際のアクセスではない数が表示されます。変更の前に確認の警告が出て、変更は理由つきで記録されます。"),
      h("div", { class: "search-row" }, modeSel, numIn),
      h("div", { class: "search-row" }, reasonIn),
      h("label", { class: "check" }, trendCb, " 流行順の記録にも反映する（増やすときは今日に足し、減らすときは今日から古い日へさかのぼって引きます）"),
      h("div", { class: "actions" }, go1), msg, logSlot);
    return det;
  }

  async function cloudAdminBox() {
    let ov;
    try { const r = await sb.rpc("admin_cloud_overview"); if (r.error || !r.data) return null; ov = r.data; } catch (e) { return null; }   // SQL未実行なら出さない
    const box = h("div", { class: "card cloud-admin" });
    async function reload() {
      const r = await sb.rpc("admin_cloud_overview");
      if (r.error) throw r.error;
      ov = r.data; draw();
    }
    const act = (btn, fn, msg) => btn.addEventListener("click", () => busy(btn, async () => { await fn(); toast(msg); await reload(); }));
    // コネクタを許可するユーザーを、ユーザー名で追加する
    const grantName = h("input", { type: "text", placeholder: "ユーザー名", maxlength: 20, autocomplete: "off", "aria-label": "コネクタを許可するユーザー名" });
    const grantBtn = h("button", { class: "btn small primary", type: "button" }, "許可する");
    act(grantBtn, async () => {
      const name = grantName.value.trim().replace(/^@/, "");
      if (!name) throw new Error("ユーザー名を入力してください。");
      const { error } = await sb.rpc("admin_set_cloud_user", { p_username: name, p_on: true });
      if (error) throw error;
      grantName.value = "";
    }, "コネクタの使用を許可しました");
    const userGrant = h("div", { class: "actions", style: "margin:.4rem 0 .8rem" }, grantName, grantBtn);
    function draw() {
      const reqs = ov.requests.length ? ov.requests.map(r => {
        const ok = h("button", { class: "btn small primary", type: "button", "data-ok": r.post_id }, "許可");
        const no = h("button", { class: "btn small", type: "button", "data-no": r.post_id }, "却下");
        act(ok, async () => { const { error } = await sb.rpc("admin_resolve_cloud_request", { p_post: r.post_id, p_ok: true }); if (error) throw error; }, "Cloudを許可しました");
        act(no, async () => { const { error } = await sb.rpc("admin_resolve_cloud_request", { p_post: r.post_id, p_ok: false }); if (error) throw error; }, "却下しました");
        return h("li", {}, "@" + r.username, " →「", h("a", { href: `#/post/${r.post_id}` }, r.title), "」（企画：", r.project_title, "） ", ok, " ", no);
      }) : [h("li", { class: "muted" }, "申請はありません。")];
      const posts = ov.posts.length ? ov.posts.map(p => {
        const off = h("button", { class: "btn small", type: "button", "data-off": p.post_id }, "許可を取り消す");
        act(off, async () => { const { error } = await sb.rpc("admin_set_cloud_post", { p_post: p.post_id, p_on: false }); if (error) throw error; }, "許可を取り消しました");
        return h("li", {}, h("a", { href: `#/post/${p.post_id}` }, p.title), `（企画：${p.project_title}）　${p.rows}人が記録・${p.better === "low" ? "小さいほど良い" : "大きいほど良い"} `, off);
      }) : [h("li", { class: "muted" }, "まだありません。")];
      box.replaceChildren(
        h("h2", {}, "☁ Internet Cloud"),
        h("p", { class: "muted" }, "Cloudを使えるのは、管理者が許可したHTML（投稿）だけです。Cloudに記録できるのは、1つのHTMLにつき、1人1件の数字のスコア（自己ベスト）だけです。コネクタ（JavaScript）は、下で許可したユーザーだけが、自分のHTMLの <script> の中に貼って使えます。許可されたユーザーは、自分の投稿ページ・編集画面から、Cloudの利用を申請できます。管理者は、申請を許可するか、各投稿のページから直接許可できます。"),
        h("h3", {}, `コネクタを使えるユーザー（${(ov.users || []).length}）`),
        h("ul", { class: "cloud-list" }, ...((ov.users || []).length ? ov.users.map(u => {
          const off = h("button", { class: "btn small", type: "button", "data-user-off": u.username }, "許可を取り消す");
          act(off, async () => { const { error } = await sb.rpc("admin_set_cloud_user", { p_username: u.username, p_on: false }); if (error) throw error; }, "許可を取り消しました");
          return h("li", {}, "@" + u.username, " ", off);
        }) : [h("li", { class: "muted" }, "まだいません。（管理者は、許可しなくても使えます）")])),
        userGrant,
        h("h3", {}, `Cloudの利用の申請（${ov.requests.length}）`), h("ul", { class: "cloud-list" }, ...reqs),
        h("h3", {}, `Cloudを許可しているHTML（${ov.posts.length}）`), h("ul", { class: "cloud-list" }, ...posts));
    }
    draw();
    return box;
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

  async function viewPost(id, token, opts = {}) {
    if (token !== undefined && !(await waitBeforeOpen(token))) return h("div", {});   // 待っている間に別のページへ移った（描画されない）
    const post = await fetchPost(id);
    if (!post) return notFound();
    const isAuthor = !!session && (post.author_id === session.user.id || isAdmin);   // 管理者は編集も可
    const isOwner = !!session && (post.project.owner_id === session.user.id || isAdmin);
    if (post.can_view) recordView(post.project.id);   // HTMLを開いた＝アクセス（同じ人は30分に1回）

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

    // Cloud の状態（SQL 未実行などで取れないときは、Cloud の欄を出さない）
    let cloudInfo = null;
    try { const r = await sb.rpc("cloud_info", { p_post: id }); if (!r.error && r.data) cloudInfo = r.data; } catch (e) { /* 出さない */ }

    // 添付ファイル（画像・音声）
    const { data: assetData } = await sb.rpc("get_post_assets", { p_post: id });
    let assets = assetData || [];
    try { assets = await withAssetData(assets); }
    catch (e) { toast("画像・音声を読み込めませんでした：" + friendly(e), true); assets = assets.filter(a => a.b64); }

    const htmlBtn = h("button", { class: "btn", type: "button", title: assets.length ? "画像・音声をHTMLの中に埋め込んで、1つのファイルにします" : "" },
      assets.length ? "⬇ HTML（画像・音声を埋め込んだ1ファイル）" : "⬇ HTML（1ファイル）");
    htmlBtn.addEventListener("click", () => { downloadSingleHtml(post, assets); recordView(post.project.id); });
    const zipBtn = h("button", { class: "btn", type: "button" }, assets.length ? "⬇ ZIPでダウンロード（画像・音声つき）" : "⬇ ZIP（分割）");
    zipBtn.addEventListener("click", () => busy(zipBtn, async () => { await downloadPostZip(post, assets); recordView(post.project.id); }));

    const actions = h("div", { class: "actions" });
    // 添付ファイルがあるときも、1ファイル（埋め込み）とZIP（HTMLと同じ場所にファイルを並べる）の両方を出す
    // ダウンロードはログインした人だけ。許可されていない投稿（投稿者がオフにしている）には、「ダウンロード不可」を出す
    const dlByPolicy = post.is_public === false || post.allow_download !== false || (!!session && post.can_download !== false);
    if (!session && dlByPolicy) actions.append(h("a", { class: "btn", href: "#/login", title: "ログインすると、ダウンロードできます" }, "ログインしてダウンロード"));
    else if (session && post.can_download !== false) actions.append(htmlBtn, zipBtn);
    else actions.append(h("span", { class: "badge", title: "投稿者がダウンロードを許可していません" }, "⬇ ダウンロード不可"));
    // コード（HTML / CSS / JavaScript）の閲覧も、ログインした人で、ダウンロードできる投稿だけ
    const codeOk = !!session && post.can_download !== false;
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
    // プレビューに、投稿のコードより前に入れるもの：未ログインなら通信の禁止だけ。
    // Cloud コネクタは、自動では入れない（許可されたユーザーが、自分のHTMLの <script> の中に貼って使う）
    // ゲームのセーブ用の localStorage の代わり（この端末のブラウザに、投稿ごとに保存。アカウントとは結び付けない）も入れる
    const saveToken = newToken();
    const injected = (session ? "" : NET_GUARD) + storeShim(readSave(id), true, saveToken);
    const baseDoc = previewDoc(post, assets);
    const fullDoc = injectAtTop(baseDoc, injected);
    // 別タブ用（「#/post/ID/play」）：プレビューだけを、画面いっぱいに出す（ボタンは、出さない）
    const previewEl = opts.play
      ? h("div", { class: "preview-wrap play" }, previewFrame(fullDoc))
      : previewWithFullscreen(fullDoc, new URL(`#/post/${id}/play`, location.href).href);
    // 「セーブデータを消す」ボタン（この端末に保存があるときだけ出す）
    const saveBtn = h("button", { class: "btn small preview-clearsave hidden", type: "button", title: "この端末に保存された、このゲームの続きのデータを消す" }, "🗑 セーブデータを消す");
    const saveHost = attachSaveHost(id, saveToken, () => saveBtn.classList.toggle("hidden", !saveHost.has()));
    saveBtn.classList.toggle("hidden", !saveHost.has());
    saveBtn.addEventListener("click", () => {
      if (!confirm("この端末に保存された、このゲームのセーブデータ（続きのデータ）を消します。よろしいですか？\n（ほかの端末や、ほかの人のデータには影響しません）")) return;
      saveHost.clear();
      toast("セーブデータを消しました");
      route();   // 最初の状態から、始め直す
    });
    const bar = previewEl.querySelector(".preview-bar");
    if (bar) bar.append(saveBtn);
    if (!session) attachNetGuard(previewEl.querySelector("iframe"), token);   // 未ログインでは、通信しようとしたら警告を出す
    if (cloudInfo) attachCloudHost(previewEl.querySelector("iframe"), id, token);   // Cloud コネクタからの呼び出しを受ける（許可されていなければ、サーバーが断る）
    const panels = {
      preview: previewEl,
      html: h("pre", { class: "codeview" }, post.html || "（なし）"),
      css: h("pre", { class: "codeview" }, post.css || "（なし）"),
      js: h("pre", { class: "codeview" }, post.js || "（なし）")
    };
    const jsCount = parseJsFiles(post.js).length;
    const labels = codeOk ? { preview: "プレビュー", html: "HTML", css: "CSS", js: jsCount > 1 ? `JavaScript（${jsCount}個）` : "JavaScript" } : { preview: "プレビュー" };
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
    const codeNote = codeOk ? null : h("p", { class: "muted code-note" },
      !session && dlByPolicy ? "🔒 コードの閲覧とダウンロードは、ログインした人だけができます。" : "🔒 投稿者がダウンロードを許可していないため、コードは表示されません（プレビューだけ見られます）。");

    if (opts.play) {
      if (token === renderToken) { document.body.classList.add("play-mode"); document.title = post.title + " - コードひろば"; }
      return h("section", { class: "play" }, previewEl);
    }
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
        codeOk ? tabs : null, body, codeNote,
        cloudInfo ? cloudBox(id, cloudInfo) : null,
        assets.length ? h("div", { class: "assets-box" },
          h("h3", {}, `🖼 このHTMLで使う画像・音声（${assets.length}）`),
          h("p", { class: "muted", style: "margin:.2rem 0 .6rem" }, "企画に登録されたファイルのうち、このHTMLが使うものです。HTMLの中では、ファイル名のまま参照できます（例：", h("code", {}, `<img src="${assets[0].name}">`), "）。ZIPでダウンロードすると、HTMLと同じ場所にこれらのファイルが入ります。"),
          h("div", { class: "asset-grid" }, ...assets.map(a => h("div", { class: "asset-card" },
            isAudioName(a.name)
              ? h("audio", { controls: true, preload: "none", src: dataUri(a.mime, a.b64) })
              : isTextDataName(a.name) ? h("div", { class: "asset-json", "aria-label": isCsvName(a.name) ? "CSVファイル" : "JSONファイル" }, isCsvName(a.name) ? "📄 CSV" : "📄 JSON")
              : h("img", { src: dataUri(a.mime, a.b64), alt: a.name, loading: "lazy" }),
            h("div", { class: "asset-name" }, a.name),
            h("div", { class: "muted" }, fmtSize(a.size) + (a.group ? "・" + a.group : "")),
            session && post.can_download !== false ? (() => {
              const sv = h("button", { class: "btn small asset-save", type: "button", title: "このファイルを、名前そのままで保存します" }, "⬇ ファイルとして保存");
              sv.addEventListener("click", () => busy(sv, () => downloadAssetFile(a)));
              return sv;
            })() : null)))) : null),
      (post.is_public === false && (isAuthor || isOwner)) ? viewersBox(post) : null);
  }

  /* 起動時は onAuthStateChange(INITIAL_SESSION) が最初の描画を行う */
})();
