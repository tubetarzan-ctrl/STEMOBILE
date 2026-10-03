import { MessageCircle } from "lucide-react";
import { getBusiness } from "@/lib/data/store";
import { whatsappLink } from "@/lib/utils";

export async function WhatsAppBubble() {
  const biz = await getBusiness();
  return (
    <a
      href={whatsappLink(biz.whatsapp, "Hi StarTech! I need help with my phone.")}
      target="_blank"
      rel="noopener"
      aria-label="Chat with StarTech on WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full shadow-2xl transition-transform hover:scale-105"
      style={{ background: "#25D366", color: "#062A14" }}
    >
      <MessageCircle className="size-6" />
    </a>
  );
}
