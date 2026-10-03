import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getStaff, can } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limit";

// Public media goes browser → UploadThing directly; we only store URLs/keys.
// Private files (payment proofs, repair photos, CNIC) use private Supabase buckets instead.
const f = createUploadthing();

async function staffWith(perm: string) {
  const staff = await getStaff();
  if (!can(staff, perm)) throw new UploadThingError("Not allowed");
  return { userId: staff!.id };
}

export const uploadRouter = {
  /** Customer review photos (≤6) and one video (≤60s, ≤100 MB before compression). */
  reviewMedia: f({ image: { maxFileSize: "4MB", maxFileCount: 6 }, video: { maxFileSize: "128MB", maxFileCount: 1 } })
    .middleware(async () => {
      if (!(await rateLimit("review-upload", 12, 10 * 60_000))) throw new UploadThingError("Too many uploads");
      return {};
    })
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl, key: file.key })),

  /** CMS images (hero, sections, stories, portfolio, blog). */
  cmsImage: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } })
    .middleware(() => staffWith("media.upload"))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl, key: file.key })),

  /** Hero video ≤ 6 MB / 30 s; reels ≤ 60 s. Length is checked client-side before upload. */
  heroVideo: f({ video: { maxFileSize: "8MB", maxFileCount: 1 }, image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(() => staffWith("content.publish"))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl, key: file.key })),
  reel: f({ video: { maxFileSize: "64MB", maxFileCount: 1 }, image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(() => staffWith("media.upload"))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl, key: file.key })),

  /** Product photos (Inventory). */
  productImage: f({ image: { maxFileSize: "8MB", maxFileCount: 8 } })
    .middleware(() => staffWith("inventory.edit"))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl, key: file.key })),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
