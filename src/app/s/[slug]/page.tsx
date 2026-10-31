import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { getShop } from "@/lib/shop";
import { StoreMenu } from "@/components/StoreMenu";

// The store the device launched: the café's front page and online ordering in one.
async function shopFor(slug: string) {
  await connection();
  const shop = getShop();
  return shop.slug && shop.slug === slug ? shop : null;
}

export async function generateMetadata(props: PageProps<"/s/[slug]">): Promise<Metadata> {
  const shop = await shopFor((await props.params).slug);
  return shop ? { title: shop.name, description: shop.tagline || `Order ahead from ${shop.name}.` } : {};
}

export default async function Store(props: PageProps<"/s/[slug]">) {
  const shop = await shopFor((await props.params).slug);
  if (!shop) notFound();

  if (shop.stage !== "live")
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-3xl font-semibold">{shop.name}</h1>
        <p className="text-muted">Opening soon.</p>
      </main>
    );

  const special = db().prepare("SELECT dish, caption, image FROM promos ORDER BY id DESC LIMIT 1").get() as
    | { dish: string; caption: string; image: string }
    | undefined;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-10">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">{shop.name}</h1>
        {shop.tagline && <p className="mt-2 text-lg text-muted">{shop.tagline}</p>}
        {(shop.hours || shop.address) && (
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {shop.hours && <span>{shop.hours}</span>}
            {shop.address && <span className="text-muted">{shop.address}</span>}
          </p>
        )}
        {shop.about && <p className="mt-4 max-w-prose">{shop.about}</p>}
      </header>
      {special && (
        <section className="card mb-8 overflow-hidden">
          <img src={special.image} alt={`Today's special: ${special.dish}`} className="aspect-square w-full object-cover" />
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">Today’s special</p>
            <p className="mt-1">{special.caption}</p>
          </div>
        </section>
      )}
      <h2 className="mb-1 text-xl font-semibold">Order ahead</h2>
      <p className="mb-6 text-muted">Skip the queue, we’ll call your name.</p>
      <StoreMenu cafe={shop.name} />
    </main>
  );
}
