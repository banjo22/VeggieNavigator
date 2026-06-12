import { createClient } from "@supabase/supabase-js";

let client;

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase ist nicht konfiguriert. Setze SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (key.includes("HIER_") || !key.startsWith("eyJ")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ist noch kein echter Service-Role-Key. Kopiere den langen service_role Key aus Supabase Project Settings -> API.");
  }

  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return client;
}
