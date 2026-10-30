-- ============================================================
-- コードひろば  データベース設定（Supabase の SQL Editor に貼り付けて実行）
-- ============================================================

-- ---------- テーブル ----------

-- ユーザー情報（メールアドレスは auth.users 側にだけ保存され、ここには置かない）
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- 企画
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  allow_others_post boolean not null default false,   -- 企画主以外の投稿を許可するか
  created_at timestamptz not null default now()
);
create index projects_created_idx on public.projects (created_at desc);

-- 投稿（HTML / CSS / JavaScript のコードのみ）
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  html text not null default '' check (char_length(html) <= 2000000),
  css  text not null default '' check (char_length(css)  <= 2000000),
  js   text not null default '' check (char_length(js)   <= 2000000),
  memo text not null default '' check (char_length(memo) <= 2000),   -- 投稿者のメモ（改善した点など）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint not_empty check (char_length(html) + char_length(css) + char_length(js) > 0)
);
create index posts_project_idx on public.posts (project_id, created_at desc);

-- 企画へのコメント（改善点・感想など）
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  parent_id uuid references public.comments(id) on delete cascade,   -- 返信先のコメント（NULL = 企画への直接コメント）
  created_at timestamptz not null default now()
);
create index comments_parent_idx on public.comments (parent_id);
create index comments_project_idx on public.comments (project_id, created_at);

-- ---------- 新規登録時に profiles を自動作成 ----------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ユーザー名まわりの関数 ----------

-- ユーザー名が使えるか（新規登録時の重複チェック）
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

-- ユーザー名 → メールアドレス（「ユーザー名でログイン」を実現するため）
create function public.email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(p_username)
  limit 1;
$$;

revoke all on function public.username_available(text) from public;
revoke all on function public.email_for_username(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- ---------- 管理者 ----------
-- 管理者は、すべての企画・投稿・コメントを編集・削除できる。登録は SQL Editor から（README 参照）。
create table public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.admins enable row level security;   -- ポリシーなし = API からは誰も触れない
revoke all on public.admins from anon, authenticated;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;

-- 閲覧・ダウンロードは誰でも（未ログインでも）OK
create policy "profiles_select" on public.profiles for select using (true);
create policy "projects_select" on public.projects for select using (true);
create policy "posts_select"    on public.posts    for select using (true);
create policy "comments_select" on public.comments for select using (true);

-- 企画：作成は本人、編集・削除は企画主（または管理者）
create policy "projects_insert" on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy "projects_update" on public.projects for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "projects_delete" on public.projects for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- 投稿：企画主、または「他の人の投稿を許可」している企画なら誰でも（要ログイン）
create policy "posts_insert" on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.projects pr
      where pr.id = project_id
        and (pr.owner_id = auth.uid() or pr.allow_others_post)
    )
  );

-- 投稿の編集は投稿者本人（または管理者）のみ（投稿先の企画や投稿者は変更不可）
create policy "posts_update" on public.posts for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
revoke update on public.posts from authenticated;
grant update (title, html, css, js, memo, updated_at) on public.posts to authenticated;

-- 投稿の削除は投稿者本人、企画主、または管理者
create policy "posts_delete" on public.posts for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.projects pr
      where pr.id = project_id and pr.owner_id = auth.uid()
    )
  );

-- コメント：ログイン済みなら誰でも書ける。削除はコメントした本人、企画主、または管理者
create policy "comments_insert" on public.comments for insert to authenticated
  with check (author_id = auth.uid());
create policy "comments_delete" on public.comments for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.projects pr
      where pr.id = project_id and pr.owner_id = auth.uid()
    )
  );

-- ---------- 管理者の指定（任意） ----------
-- 先にそのユーザー名のアカウントを新規登録してから、次の文を SQL Editor で実行する。
-- insert into public.admins (user_id)
-- select id from public.profiles where lower(username) = lower('管理者にするユーザー名');

-- ---------- 通知（コメント・返信があったときにベルに表示） ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,      -- 通知を受け取る人
  actor_id uuid not null references public.profiles(id) on delete cascade,     -- コメント・返信した人
  type text not null check (type in ('comment', 'reply')),                      -- comment=企画へのコメント / reply=自分のコメントへの返信
  project_id uuid not null references public.projects(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;   -- 既読にするだけ

drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_select" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid());
-- 通知の作成は、下のトリガーだけが行う（ユーザーが直接作ることはできない）

-- ---------- コメントが書かれたら通知を作る ----------
create or replace function public.handle_new_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_author uuid;
  parent_project uuid;
  proj_owner uuid;
begin
  if new.parent_id is not null then
    select author_id, project_id into parent_author, parent_project
    from public.comments where id = new.parent_id;
    -- 別の企画のコメントへの返信は不可
    if parent_project is distinct from new.project_id then
      raise exception 'invalid parent comment';
    end if;
    -- 自分のコメントに返信されたら通知（自分自身への返信は除く）
    if parent_author <> new.author_id then
      insert into public.notifications (user_id, actor_id, type, project_id, comment_id)
      values (parent_author, new.author_id, 'reply', new.project_id, new.id);
    end if;
  end if;

  -- 自分の企画にコメントされたら通知（自分自身・返信通知と重複する人は除く）
  select owner_id into proj_owner from public.projects where id = new.project_id;
  if proj_owner <> new.author_id and proj_owner is distinct from parent_author then
    insert into public.notifications (user_id, actor_id, type, project_id, comment_id)
    values (proj_owner, new.author_id, 'comment', new.project_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created
  after insert on public.comments
  for each row execute function public.handle_new_comment();

-- ---------- 大容量投稿（500KB超〜最大2MB。管理者の承認制） ----------
-- 一般ユーザーは通常 500,000 文字まで。管理者が認めた回数だけ、最大 2,000,000 文字まで投稿できる。
-- ---------- 大容量投稿の「要請」 ----------
create table public.big_upload_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,     -- 要請した人
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  granted int not null default 0,                                              -- 認めた回数
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
-- 未回答の要請は、1人1件まで
create unique index big_upload_requests_pending_idx
  on public.big_upload_requests (user_id) where status = 'pending';

alter table public.big_upload_requests enable row level security;
revoke all on public.big_upload_requests from anon, authenticated;
grant select on public.big_upload_requests to authenticated;
drop policy if exists "big_requests_select" on public.big_upload_requests;
create policy "big_requests_select" on public.big_upload_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- 作成・承認は、下の関数だけが行う

-- ---------- 大容量投稿の「残り回数」 ----------
create table public.upload_quota (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  remaining int not null default 0 check (remaining >= 0)
);
alter table public.upload_quota enable row level security;
revoke all on public.upload_quota from anon, authenticated;
grant select on public.upload_quota to authenticated;
drop policy if exists "upload_quota_select" on public.upload_quota;
create policy "upload_quota_select" on public.upload_quota for select to authenticated
  using (user_id = auth.uid());

-- ---------- 通知の種類を増やす ----------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'reply', 'upload_request', 'upload_approved', 'upload_rejected'));
alter table public.notifications alter column project_id drop not null;
alter table public.notifications alter column comment_id drop not null;
alter table public.notifications
  add column if not exists request_id uuid references public.big_upload_requests(id) on delete cascade;

-- ---------- 要請を送る（一般ユーザー → 管理者全員に通知） ----------
create or replace function public.request_big_upload(p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'login required'; end if;
  if exists (select 1 from public.big_upload_requests where user_id = uid and status = 'pending') then
    raise exception 'already pending';
  end if;
  insert into public.big_upload_requests (user_id, note)
  values (uid, left(coalesce(p_note, ''), 500))
  returning id into rid;
  insert into public.notifications (user_id, actor_id, type, request_id)
  select a.user_id, uid, 'upload_request', rid from public.admins a where a.user_id <> uid;
end;
$$;

-- ---------- 要請に回答する（管理者のみ） ----------
create or replace function public.decide_big_upload(p_request uuid, p_count int, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.big_upload_requests;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into r from public.big_upload_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if r.status <> 'pending' then raise exception 'already decided'; end if;

  if p_approve then
    if p_count is null or p_count < 1 or p_count > 100 then raise exception 'invalid count'; end if;
    update public.big_upload_requests
      set status = 'approved', granted = p_count, decided_by = auth.uid(), decided_at = now()
      where id = p_request;
    insert into public.upload_quota as q (user_id, remaining) values (r.user_id, p_count)
      on conflict (user_id) do update set remaining = q.remaining + p_count;
    insert into public.notifications (user_id, actor_id, type, request_id)
      values (r.user_id, auth.uid(), 'upload_approved', p_request);
  else
    update public.big_upload_requests
      set status = 'rejected', decided_by = auth.uid(), decided_at = now()
      where id = p_request;
    insert into public.notifications (user_id, actor_id, type, request_id)
      values (r.user_id, auth.uid(), 'upload_rejected', p_request);
  end if;
end;
$$;

revoke all on function public.request_big_upload(text) from public;
revoke all on function public.decide_big_upload(uuid, int, boolean) from public;
grant execute on function public.request_big_upload(text) to authenticated;
grant execute on function public.decide_big_upload(uuid, int, boolean) to authenticated;

-- ---------- 投稿サイズのチェック（一般ユーザーは 500,000 文字まで。承認済みなら回数を1つ消費） ----------
create or replace function public.enforce_post_size()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remain int;
begin
  -- 500,000 文字以下ならそのまま
  if greatest(char_length(new.html), char_length(new.css), char_length(new.js)) <= 500000 then
    return new;
  end if;
  -- 管理者、および SQL Editor からの操作は制限なし
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  -- すでに大容量だった投稿の編集は、回数を消費しない
  if tg_op = 'UPDATE' then
    if greatest(char_length(old.html), char_length(old.css), char_length(old.js)) > 500000 then
      return new;
    end if;
  end if;
  -- 承認された回数を1つ消費
  update public.upload_quota set remaining = remaining - 1
    where user_id = auth.uid() and remaining > 0
    returning remaining into remain;
  if not found then
    raise exception 'file too large: admin approval required over 500000 characters';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_size_guard on public.posts;
create trigger posts_size_guard
  before insert or update on public.posts
  for each row execute function public.enforce_post_size();
