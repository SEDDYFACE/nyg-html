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
  html text not null default '' check (char_length(html) <= 200000),
  css  text not null default '' check (char_length(css)  <= 200000),
  js   text not null default '' check (char_length(js)   <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint not_empty check (char_length(html) + char_length(css) + char_length(js) > 0)
);
create index posts_project_idx on public.posts (project_id, created_at desc);

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

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.posts    enable row level security;

-- 閲覧・ダウンロードは誰でも（未ログインでも）OK
create policy "profiles_select" on public.profiles for select using (true);
create policy "projects_select" on public.projects for select using (true);
create policy "posts_select"    on public.posts    for select using (true);

-- 企画：作成・編集・削除は企画主のみ
create policy "projects_insert" on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy "projects_update" on public.projects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "projects_delete" on public.projects for delete to authenticated
  using (owner_id = auth.uid());

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

-- 投稿の編集は投稿者本人のみ（投稿先の企画や投稿者は変更不可）
create policy "posts_update" on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
revoke update on public.posts from authenticated;
grant update (title, html, css, js, updated_at) on public.posts to authenticated;

-- 投稿の削除は投稿者本人、または企画主
create policy "posts_delete" on public.posts for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.projects pr
      where pr.id = project_id and pr.owner_id = auth.uid()
    )
  );
