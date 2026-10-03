import { ReviewForm } from "./ReviewForm";

export const metadata = { title: "Write a review", robots: { index: false } };

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<{ product?: string; r?: string }> }) {
  const sp = await searchParams;
  const placeId = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID;
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="font-display text-4xl font-semibold">How did we do?</h1>
      <p className="mt-2 text-ink-2">Your review helps other Karachi phone owners pick a shop they can trust. Photos and a short video are welcome.</p>
      <ReviewForm productId={sp.product} requestToken={sp.r} googleUrl={placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : null} />
    </div>
  );
}
