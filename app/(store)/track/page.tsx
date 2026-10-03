import { PackageSearch } from "lucide-react";
import { TrackFinder } from "./TrackFinder";

export const metadata = { title: "Track your order or repair" };

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-14 text-center sm:py-20">
      <PackageSearch className="mx-auto size-10 text-accent" />
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">Track your order or repair</h1>
      <p className="mt-3 text-ink-2">No account needed — enter your number and the mobile you used. You&apos;ll see all your orders and repairs.</p>
      <div className="mt-8"><TrackFinder /></div>
    </div>
  );
}
