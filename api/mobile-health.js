import { getAuthenticatedUser } from "../lib/request-auth.js";
export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "GET required" });
  let authenticated = false;
  try {
    authenticated = Boolean(await getAuthenticatedUser(req));
  } catch {}
  return res
    .status(200)
    .json({
      ok: true,
      services: {
        openai: Boolean(process.env.OPENAI_API_KEY),
        supabase: Boolean(
          process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
        ),
      },
      authenticated,
      timestamp: new Date().toISOString(),
    });
}
