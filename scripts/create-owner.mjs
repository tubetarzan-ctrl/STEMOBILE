// Creates (or promotes) a staff login.
//   npm run owner:create -- owner@startech.pk 'strong-password' "Owner Name" [role]
// role defaults to super_admin. Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// in the environment or .env.local.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const [email, password, fullName = "Owner", role = "super_admin"] = process.argv.slice(2);
if (!email || !password) {
  console.error("usage: npm run owner:create -- <email> <password> [full name] [role]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

let userId;
const { data: created, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
if (error) {
  if (!/already/i.test(error.message)) { console.error(error.message); process.exit(1); }
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  userId = list.users.find((u) => u.email === email)?.id;
} else userId = created.user.id;

const { error: pe } = await sb.from("profiles").upsert({ id: userId, full_name: fullName, email, role_key: role, is_staff: true, is_active: true });
if (pe) { console.error(pe.message); process.exit(1); }
console.log(`✓ ${email} is now ${role}. Sign in at /login (Staff tab).`);
