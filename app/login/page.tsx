import Link from "next/link";
import { Logo } from "@/components/store/Logo";
import { LoginForms } from "./LoginForms";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <Link href="/" className="flex justify-center"><Logo /></Link>
        <LoginForms next={safeNext} configured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)} />
      </div>
    </div>
  );
}
