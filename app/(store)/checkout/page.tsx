import { getBankAccount } from "@/lib/data/bank";
import CheckoutClient from "./CheckoutClient";

export const metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return <CheckoutClient bank={getBankAccount()} />;
}
