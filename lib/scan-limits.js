import { createHash } from "node:crypto";
import { getSupabase } from "./supabase.js";

const GUEST_DAILY_LIMIT = 3;
const USER_DAILY_LIMIT = 5;

export async function consumeScanQuota(req) {
  const subject = await getQuotaSubject(req);
  const limit = subject.type === "user" ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const usageDate = berlinDateKey();

  const supabase = getSupabase();
  const { data: existing, error: readError } = await supabase
    .from("daily_scan_usage")
    .select("used_count")
    .eq("usage_date", usageDate)
    .eq("subject_type", subject.type)
    .eq("subject_id", subject.id)
    .maybeSingle();

  if (readError) throw quotaStorageError(readError);

  const used = Number(existing?.used_count || 0);
  if (used >= limit) {
    const error = new Error(`Tageslimit erreicht. ${subject.type === "user" ? "Eingeloggte Nutzer" : "Nicht eingeloggte Nutzer"} haben ${limit} KI-Scans pro Tag.`);
    error.status = 429;
    error.quota = { limit, used, remaining: 0, usageDate, subjectType: subject.type };
    throw error;
  }

  const nextUsed = used + 1;
  const { error: writeError } = await supabase
    .from("daily_scan_usage")
    .upsert({
      usage_date: usageDate,
      subject_type: subject.type,
      subject_id: subject.id,
      used_count: nextUsed,
      updated_at: new Date().toISOString()
    }, { onConflict: "usage_date,subject_type,subject_id" });

  if (writeError) throw quotaStorageError(writeError);

  return {
    limit,
    used: nextUsed,
    remaining: Math.max(0, limit - nextUsed),
    usageDate,
    subjectType: subject.type
  };
}

async function getQuotaSubject(req) {
  const token = getBearerToken(req);
  if (token) {
    const { data, error } = await getSupabase().auth.getUser(token);
    if (!error && data?.user?.id) return { type: "user", id: data.user.id };
  }

  const ip = firstHeaderValue(req.headers["x-forwarded-for"])
    || firstHeaderValue(req.headers["x-real-ip"])
    || req.socket?.remoteAddress
    || "unknown-ip";
  const userAgent = firstHeaderValue(req.headers["user-agent"]) || "unknown-agent";
  return {
    type: "guest",
    id: createHash("sha256").update(`${ip}|${userAgent}`).digest("hex")
  };
}

function getBearerToken(req) {
  const authorization = firstHeaderValue(req.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "").split(",")[0].trim();
}

function berlinDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function quotaStorageError(error) {
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return new Error("Scan-Limit-Tabelle fehlt. Fuehre supabase/scan-limits.sql im Supabase SQL Editor aus.");
  }
  return error;
}
