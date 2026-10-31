import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getShop } from "@/lib/shop";

// Old links, table QR codes and Stripe's cancel button land here; send them to the store.
export default async function OrderPage() {
  await connection();
  const { slug, stage } = getShop();
  if (!slug || stage !== "live") notFound();
  redirect(`/s/${slug}`);
}
