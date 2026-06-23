import { createHash } from "node:crypto";
import { getSupabase } from "./supabase.js";

const GUEST_DAILY_LIMIT = 3;
const USER_DAILY_LIMIT = 5;

export async function getScanQuotaStatus(req) {
  const subject = await getQuotaSubject(req);
  const premium = subject.type === "user" ? await getPremiumStatus(subject.id) : freePremiumStatus();
  const limit = premium.isPremium ? null : subject.type === "user" ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const usageDate = berlinDateKey();
  if (premium.isPremium) return quotaResult({ limit, used: 0, usageDate, subjectType: subject.type, premium });

  const { data, error } = await getSupabase()
    .from("daily_scan_usage")
    .select("used_count")
    .eq("usage_date", usageDate)
    .eq("subject_type", subject.type)
    .eq("subject_id", subject.id)
    .maybeSingle();

  if (error) throw quotaStorageError(error);

  const used = Number(data?.used_count || 0);
  return quotaResult({ limit, used, usageDate, subjectType: subject.type, premium });
}

export async function consumeScanQuota(req) {
  const subject = await getQuotaSubject(req);
  const premium = subject.type === "user" ? await getPremiumStatus(subject.id) : freePremiumStatus();
  const limit = premium.isPremium ? null : subject.type === "user" ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const usageDate = berlinDateKey();
  if (premium.isPremium) return quotaResult({ limit, used: 0, usageDate, subjectType: subject.type, premium });

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
    error.quota = quotaResult({ limit, used, usageDate, subjectType: subject.type, premium });
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

  return quotaResult({ limit, used: nextUsed, usageDate, subjectType: subject.type, premium });
}

async function getPremiumStatus(userId) {
  try {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("premium_status,premium_plan,premium_until")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    const status = String(data?.premium_status || "free");
    const plan = String(data?.premium_plan || "free");
    const premiumUntil = data?.premium_until || null;
    const isPremium = ["active", "trialing"].includes(status) && (!premiumUntil || new Date(premiumUntil).getTime() > Date.now());
    return { isPremium, status, plan, premiumUntil };
  } catch (error) {
    if (error?.code === "42703" || error?.code === "PGRST204") return freePremiumStatus();
    throw error;
  }
}

function freePremiumStatus() {
  return { isPremium: false, status: "free", plan: "free", premiumUntil: null };
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

function quotaResult({ limit, used, usageDate, subjectType, premium = freePremiumStatus() }) {
  return {
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    usageDate,
    subjectType,
    premium: Boolean(premium.isPremium),
    premiumStatus: premium.status,
    premiumPlan: premium.plan,
    premiumUntil: premium.premiumUntil
  };
}

function quotaStorageError(error) {
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return new Error("Scan-Limit-Tabelle fehlt. Führe supabase/scan-limits.sql im Supabase SQL Editor aus.");
  }
  return error;
}
