// Edge Function "admin-users" — gestão de usuários pelo master.
// Ações: create | set_active | set_password | rename
// Cópia da função do app Treino; publicar com verify_jwt = false (a própria função confere o token e o papel master).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_KEY"))!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Quem está chamando?
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u?.user) return json({ error: "Sessão inválida. Entre novamente." }, 401);
    const { data: me } = await admin.from("profiles").select("role,active").eq("id", u.user.id).single();
    if (!me || me.role !== "master" || !me.active) return json({ error: "Apenas o master pode fazer isso." }, 403);

    const b = await req.json().catch(() => ({}));
    const id = String(b.user_id || "");

    switch (b.action) {
      case "create": {
        const email = String(b.email || "").trim().toLowerCase();
        const password = String(b.password || "");
        const name = String(b.name || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
        if (password.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
        if (!name) return json({ error: "Informe o nome." }, 400);
        const { data, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { name },
        });
        if (error) return json({ error: error.message.includes("already") ? "Já existe um usuário com este e-mail." : error.message }, 400);
        await admin.from("profiles").update({ name }).eq("id", data.user!.id);
        return json({ id: data.user!.id });
      }
      case "set_active": {
        if (!id) return json({ error: "Usuário não informado." }, 400);
        if (id === u.user.id) return json({ error: "Você não pode desativar a si mesmo." }, 400);
        const active = !!b.active;
        const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").update({ active }).eq("id", id);
        return json({ ok: true });
      }
      case "set_password": {
        const password = String(b.password || "");
        if (!id) return json({ error: "Usuário não informado." }, 400);
        if (password.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case "rename": {
        const name = String(b.name || "").trim();
        if (!id || !name) return json({ error: "Dados incompletos." }, 400);
        await admin.from("profiles").update({ name }).eq("id", id);
        return json({ ok: true });
      }
      default:
        return json({ error: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
