import "server-only";
import { hasSupabase, supabasePublic } from "@/lib/supabase/server";

// Google reviews (§5.17).
// Primary: Business Profile API → synced into google_reviews (owner OAuth).
// Fallback: Places API (max 5 reviews, must NOT be stored) → fetched live and
// cached only in Next's fetch cache for a short time, with Google attribution.

export type GoogleBlock = {
  rating: number | null;
  total: number | null;
  reviews: { id: string; author: string; photo?: string | null; rating: number; text: string; time: string; reply?: string | null }[];
  source: "business_profile" | "places" | "none";
  url: string;
};

export async function getGoogleReviews(): Promise<GoogleBlock> {
  const placeId = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID;
  const url = placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : "https://www.google.com/maps";

  if (hasSupabase) {
    const { data } = await supabasePublic().from("google_reviews").select("*").order("time", { ascending: false }).limit(6);
    if (data && data.length > 0) {
      const all = await supabasePublic().from("google_reviews").select("rating");
      const ratings = (all.data ?? []).map((r) => r.rating as number);
      return {
        rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null, total: ratings.length, source: "business_profile", url,
        reviews: data.map((r) => ({ id: r.google_review_id, author: r.author, photo: r.author_photo, rating: r.rating, text: r.text, time: r.time, reply: r.reply })),
      };
    }
  }

  if (placeId && process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: { "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY, "X-Goog-FieldMask": "rating,userRatingCount,reviews" },
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const j = await res.json();
        return {
          rating: j.rating ?? null, total: j.userRatingCount ?? null, source: "places", url,
          reviews: (j.reviews ?? []).map((r: { name: string; rating: number; text?: { text: string }; publishTime: string; authorAttribution?: { displayName: string; photoUri?: string } }) => ({
            id: r.name, author: r.authorAttribution?.displayName ?? "Google user", photo: r.authorAttribution?.photoUri, rating: r.rating, text: r.text?.text ?? "", time: r.publishTime,
          })),
        };
      }
    } catch { /* fall through */ }
  }
  return { rating: null, total: null, reviews: [], source: "none", url };
}

/** Business Profile API: refresh OAuth token and sync reviews (cron). */
export async function syncBusinessProfileReviews(): Promise<number> {
  const { GOOGLE_BUSINESS_CLIENT_ID: id, GOOGLE_BUSINESS_CLIENT_SECRET: secret, GOOGLE_BUSINESS_REFRESH_TOKEN: refresh,
    GOOGLE_BUSINESS_ACCOUNT_ID: account, GOOGLE_BUSINESS_LOCATION_ID: location } = process.env;
  if (!id || !secret || !refresh || !account || !location) return 0;
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
  }).then((r) => r.json());
  const res = await fetch(`https://mybusiness.googleapis.com/v4/accounts/${account}/locations/${location}/reviews?pageSize=50`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!res.ok) throw new Error(`gbp_reviews_failed ${res.status}`);
  const j = await res.json();
  const stars: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const rows = (j.reviews ?? []).map((r: { reviewId: string; reviewer: { displayName: string; profilePhotoUrl?: string }; starRating: string; comment?: string; createTime: string; reviewReply?: { comment: string; updateTime: string } }) => ({
    google_review_id: r.reviewId, author: r.reviewer.displayName, author_photo: r.reviewer.profilePhotoUrl, rating: stars[r.starRating] ?? null,
    text: r.comment ?? "", time: r.createTime, reply: r.reviewReply?.comment ?? null, reply_at: r.reviewReply?.updateTime ?? null, synced_at: new Date().toISOString(),
  }));
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  if (rows.length) await supabaseAdmin().from("google_reviews").upsert(rows, { onConflict: "google_review_id" });
  return rows.length;
}

export async function replyToGoogleReview(reviewId: string, comment: string) {
  const { GOOGLE_BUSINESS_CLIENT_ID: id, GOOGLE_BUSINESS_CLIENT_SECRET: secret, GOOGLE_BUSINESS_REFRESH_TOKEN: refresh,
    GOOGLE_BUSINESS_ACCOUNT_ID: account, GOOGLE_BUSINESS_LOCATION_ID: location } = process.env;
  if (!id || !secret || !refresh) throw new Error("Google Business Profile is not connected");
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
  }).then((r) => r.json());
  const res = await fetch(`https://mybusiness.googleapis.com/v4/accounts/${account}/locations/${location}/reviews/${reviewId}/reply`, {
    method: "PUT", headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error(`gbp_reply_failed ${res.status}`);
}
