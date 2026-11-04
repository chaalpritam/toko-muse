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
        <h1 className="font-display text-4xl font-semibold tracking-tight">{shop.name}</h1>
        <p className="text-muted">Opening soon.</p>
      </main>
    );

  const special = db().prepare("SELECT dish, caption, image FROM promos ORDER BY id DESC LIMIT 1").get() as
    | { dish: string; caption: string; image: string }
    | undefined;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-12 sm:pt-16">
      <header className="mb-10">
        <h1 className="font-display text-5xl font-semibold tracking-tight text-balance sm:text-6xl">{shop.name}</h1>
        {shop.tagline && <p className="mt-3 font-display text-xl text-muted text-pretty">{shop.tagline}</p>}
        {(shop.hours || shop.address) && (
          <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {shop.hours && <span className="font-medium">{shop.hours}</span>}
            {shop.hours && shop.address && (
              <span className="text-muted" aria-hidden>
                ·
              </span>
            )}
            {shop.address && <span className="text-muted">{shop.address}</span>}
          </p>
        )}
        {shop.about && <p className="mt-5 max-w-prose leading-relaxed">{shop.about}</p>}
      </header>
      {special && (
        <section className="card mb-10 overflow-hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <img src={special.image} alt={`Today's special: ${special.dish}`} className="aspect-square w-full object-cover" />
          <div className="flex flex-col justify-center p-5 sm:p-6">
            <h2 className="font-display text-2xl font-semibold leading-tight">
              Today’s special: <span className="text-accent">{special.dish}</span>
            </h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">{special.caption}</p>
          </div>
        </section>
      )}
      <h2 className="font-display text-3xl font-semibold tracking-tight">Order ahead</h2>
      <p className="mb-8 mt-1 text-muted">Skip the queue, we’ll call your name.</p>
      <StoreMenu cafe={shop.name} />
    </main>
  );
}
