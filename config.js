// Supabase の「Project Settings → API」にある値を貼り付けてください。
// anon key は公開されても問題ない設計です（データはRLSで保護されます）。
// 注意：service_role key は絶対にここへ書かないでください。

// Vercel のときは /supabase 経由（中継）、それ以外（GitHub Pages など）は Supabase に直接つなぐ
const SUPABASE_DIRECT = "https://kxcsakyluveoucsoykti.supabase.co";
const USE_PROXY = /\.vercel\.app$/.test(location.hostname);

window.APP_CONFIG = {
  SUPABASE_URL: USE_PROXY ? location.origin + "/supabase" : SUPABASE_DIRECT,
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Y3Nha3lsdXZlb3Vjc295a3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MTg0NzgsImV4cCI6MjEwODE5NDQ3OH0.mezbGd6fs4PhKIf4Dd0a4_y3lneZbl2-pOu1-RP8Myk"
};
