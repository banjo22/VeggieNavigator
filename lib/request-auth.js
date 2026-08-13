import { getSupabase } from "./supabase.js";
export async function getAuthenticatedUser(req, { required = false } = {}) {
  const header = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : String(req.headers.authorization || "");
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    if (required) throw httpError(401, "Anmeldung erforderlich.");
    return null;
  }
  const { data, error } = await getSupabase().auth.getUser(token);
  if (error || !data?.user)
    throw httpError(401, "Sitzung abgelaufen. Bitte erneut anmelden.");
  return data.user;
}
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
