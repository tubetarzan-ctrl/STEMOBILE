import { Splash } from "@/components/brand/Splash";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { WhatsAppBubble } from "@/components/store/WhatsAppBubble";
import { ChatWidget } from "@/components/chat/ChatWidget";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Splash />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-primary">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <WhatsAppBubble />
      <ChatWidget />
    </>
  );
}
