import "server-only";
import { cookies } from "next/headers";

export async function getActiveDevice(): Promise<{ id: string; name: string } | null> {
  const raw = (await cookies()).get("st_device")?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return typeof v?.id === "string" && typeof v?.name === "string" ? v : null;
  } catch {
    return null;
  }
}
