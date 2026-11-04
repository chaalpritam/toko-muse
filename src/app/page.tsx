import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { getShop } from "@/lib/shop";
import { Icon } from "@/components/Icon";
import { Shift } from "@/components/landing/Shift";
import counterShot from "../../public/landing/counter.webp";
import deviceShot from "../../public/landing/device.webp";
import storeShot from "../../public/landing/store.webp";

export const metadata: Metadata = {
  title: "Toko Muse: a counter device that runs a one-person café",
  description:
    "Set up your café by talking to it, then keep talking. A crew of agents on Meta's Muse models takes orders from every channel, watches stock and does the books.",
};

const CREW = [
  { agent: "Setup", job: "Asks for the name, menu, prices, hours and address, then writes the store and launches it", model: "Muse Spark" },
  { agent: "Manager", job: "Hears every spoken command, hands the work to the crew and answers out loud", model: "Muse Spark" },
  { agent: "Orders", job: "One queue for the counter, website, WhatsApp and delivery apps; calls new orders out loud", model: "Muse Spark" },
  { agent: "Payments", job: "Stripe Checkout online, a Stripe QR on the counter for cards, cash logged by voice", model: "Stripe" },
  { agent: "Stock", job: "Recipes use up ingredients; “we’re out of oat milk” sells out every drink that needs it", model: "Muse Spark" },
  { agent: "Case Watcher", job: "A camera on the pastry case counts each item and marks empty trays sold out", model: "SAM 3.1" },
  { agent: "Suppliers", job: "Drafts reorders to the right supplier for you to approve", model: "Muse Spark" },
  { agent: "Books", job: "A photo of an invoice becomes an expense; close of day is a spoken briefing", model: "Muse Spark vision" },
  { agent: "Promoter", job: "A photo of today’s special becomes a poster and a caption", model: "SAM 3.1 · Muse Image" },
];

const OWNER_KEEPS = ["Pulling every shot", "Talking to customers", "Saying OK to anything that spends money"];
const CREW_TAKES = [
  "Orders from the website, WhatsApp and delivery apps",
  "Card payments, cash and refunds",
  "Counting stock and the pastry case",
  "Reordering from suppliers",
  "Invoices and the end-of-day numbers",
  "Today’s special, posted",
];

export default async function Landing() {
  await connection();
  const shop = getShop();
  const store = shop.stage === "live" && shop.slug ? `/s/${shop.slug}` : null;
  const video = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;

  return (
    <div className="theme-light min-h-screen">
      <header className="mx-auto flex max-w-[1240px] items-center gap-6 px-5 py-5 sm:px-8">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
          Toko Muse
        </Link>
        <nav className="ml-auto hidden items-center gap-7 text-sm text-muted md:flex" aria-label="Sections">
          <a href="#why" className="hover:text-foreground">Why we built it</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#crew" className="hover:text-foreground">The crew</a>
          <a href="#try" className="hover:text-foreground">Try it</a>
        </nav>
        <Link href="/device" className="btn ml-auto md:ml-0">
          Try the device
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-[1240px] px-5 pb-24 pt-8 sm:px-8 lg:pt-14">
          <Shift />
        </section>

        <section id="why" className="scroll-mt-8 border-t border-line">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
            <div>
              <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">One person, too many jobs.</h2>
              <div className="mt-6 max-w-[62ch] space-y-4 text-lg leading-relaxed text-muted">
                <p>
                  A one-person café is a whole business run from behind a counter. The owner pulls every shot and
                  takes every payment, and in between they’re meant to answer WhatsApp, watch the delivery tablets,
                  count what’s left in the case, reorder milk, file invoices and post today’s special.
                </p>
                <p>
                  Their hands are full, so most of that waits until after closing, or doesn’t happen. Another app
                  on a phone doesn’t help someone holding a milk jug.
                </p>
                <p className="text-foreground">
                  So we built a device they can talk to. It sits on the counter, listens, and hands the admin to a
                  crew of agents, so the owner can stay where the café needs them.
                </p>
              </div>
            </div>
            <div className="grid content-start gap-8 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <h3 className="text-sm font-medium text-muted">The owner keeps</h3>
                <ul className="mt-3 space-y-2.5">
                  {OWNER_KEEPS.map((j) => (
                    <li key={j} className="font-display text-xl">
                      {j}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted">Toko’s crew takes</h3>
                <ul className="mt-3 space-y-2">
                  {CREW_TAKES.map((j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <Icon name="check" size={16} className="mt-1 text-accent" />
                      {j}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-8 border-t border-line bg-sunken">
          <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8">
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Out of the box, by voice.</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted">
              There’s no setup form. The owner unboxes the device and talks to it.
            </p>
            <div className="mt-14 flex flex-col gap-20">
              <Step
                n={1}
                title="Tell Toko about your café"
                body="Tap the screen and Toko asks, one question at a time: the café’s name, what you sell and for how much, what goes into each drink, your hours and address. The menu and stock build up as you answer."
                say="We sell oat lattes for five fifty and butter croissants for three seventy-five."
                shot={deviceShot}
                alt="The Toko device screen: the orb, and a panel showing the live store's QR code, today's takings and orders waiting."
              />
              <Step
                n={2}
                title="Your store goes live"
                body="Say “launch the store” and Setup writes the café’s front page and online menu. A QR code appears on the device for customers to scan. Sold-out items drop off the menu by themselves."
                say="Launch the store."
                shot={storeShot}
                alt="The café's store page, written by the Setup agent: name, tagline, hours, and the order-ahead menu."
                flip
              />
              <Step
                n={3}
                title="Run the counter hands-free"
                body="Every order lands in one queue: the counter, the website, WhatsApp and delivery apps. New ones are called out loud. Accept, ring up, sell out and reorder by voice. Anything that spends money or messages someone outside the café waits for your OK."
                say="Accept the WhatsApp order, five minutes."
                shot={counterShot}
                alt="The back-office Counter: orders from the website, WhatsApp and QuickBite moving through New, Making and Ready, beside the crew's activity log."
              />
            </div>
          </div>
        </section>

        <section id="crew" className="scroll-mt-8 border-t border-line">
          <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">The crew</h2>
              <p className="max-w-md text-muted">
                Nine agents, one job each. Speech-to-text is Muse Voice Transcribe, tuned to your menu’s words.
              </p>
            </div>
            <dl className="mt-10 border-t border-line">
              {CREW.map((c) => (
                <div
                  key={c.agent}
                  className="grid gap-1 border-b border-line py-4 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6"
                >
                  <dt className="font-display text-xl font-semibold">{c.agent}</dt>
                  <dd className="text-muted">{c.job}</dd>
                  <dd className="text-sm text-accent sm:text-right">{c.model}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 flex items-start gap-3 text-lg">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-warn" aria-hidden />
              <span>
                <span className="font-medium">Needs your OK.</span>{" "}
                <span className="text-muted">
                  Refunds, supplier orders and any message to someone outside the café stop and wait for the owner.
                </span>
              </span>
            </p>
          </div>
        </section>

        <section className="border-t border-line bg-sunken">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Built on Meta’s models</h2>
              <ul className="mt-6 space-y-4">
                <Model name="Muse Spark" use="Every agent’s reasoning and tool calls, and reading invoice photos" />
                <Model name="Muse Voice Transcribe" use="Hearing the owner, biased toward menu and ingredient names" />
                <Model name="SAM 3.1" use="Counting the pastry case and finding the dish in a photo" />
                <Model name="Muse Image" use="Turning that photo into today’s poster" />
              </ul>
            </div>
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">And the rest</h2>
              <ul className="mt-6 space-y-4">
                <Model name="ReSpeaker XVF3800" use="The counter mic: echo cancellation and beamforming in hardware" />
                <Model name="Stripe" use="Checkout for the store and a QR for cards at the counter (test mode)" />
                <Model name="WhatsApp Business" use="Customers order by message (simulated without keys)" />
                <Model
                  name="QuickBite, Hopper Eats"
                  use="Made-up delivery apps: real networks only open their APIs to approved partners"
                />
              </ul>
            </div>
          </div>
        </section>

        <section id="try" className="scroll-mt-8 border-t border-line">
          <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8">
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Try it</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted">
              Hold the orb or the Space bar on the device and talk. A sample café is loaded; to start from an empty
              box, open <span className="text-foreground">Device ⋯ → Reset to a new device</span>.
            </p>
            {video && (
              <a href={video} target="_blank" rel="noreferrer" className="btn mt-8 px-5 py-3 text-base">
                Watch the demo video <Icon name="external" size={15} />
              </a>
            )}
            <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              <TryLink href="/device" title="The device" body="Set up a café by voice, or run the counter hands-free." />
              <TryLink href="/counter" title="The back office" body="The order board, approvals, stock, money and promo." />
              {store && <TryLink href={store} title="The store" body={`${shop.name}’s page and online ordering, as a customer sees it.`} external />}
              <TryLink href="/whatsapp" title="A customer’s phone" body="Order from the café on (simulated) WhatsApp." external />
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 text-sm text-muted sm:px-8">
          <span className="font-display text-lg text-foreground">Toko Muse</span>
          <span>Built for the Meta Global AI Developer Hackathon, 2026.</span>
          <Link href="/device" className="ml-auto text-accent hover:underline">
            Try the device
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  say,
  shot,
  alt,
  flip,
}: {
  n: number;
  title: string;
  body: string;
  say: string;
  shot: Parameters<typeof Image>[0]["src"];
  alt: string;
  flip?: boolean;
}) {
  return (
    <article className="grid items-center gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-sm text-muted">Step {n}</p>
        <h3 className="mt-1 font-display text-3xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-4 leading-relaxed text-muted">{body}</p>
        <p className="mt-5 border-l border-line pl-4 font-display text-xl leading-snug">
          <span className="text-accent">“</span>
          {say}
          <span className="text-accent">”</span>
        </p>
      </div>
      <Image
        src={shot}
        alt={alt}
        sizes="(min-width: 1024px) 720px, 100vw"
        className="max-h-[560px] w-full rounded-xl border border-line object-cover object-top shadow-[0_24px_48px_-16px_rgb(60_40_20/0.28)]"
      />
    </article>
  );
}

function Model({ name, use }: { name: string; use: string }) {
  return (
    <li>
      <span className="font-medium">{name}</span>
      <span className="block text-muted">{use}</span>
    </li>
  );
}

function TryLink({ href, title, body, external }: { href: string; title: string; body: string; external?: boolean }) {
  return (
    <li className="bg-background">
      <a
        href={href}
        target={external ? "_blank" : undefined}
        className="group flex h-full items-start justify-between gap-4 p-6 transition-colors hover:bg-surface"
      >
        <span>
          <span className="font-display text-xl font-semibold">{title}</span>
          <span className="mt-1 block text-muted">{body}</span>
        </span>
        <Icon
          name={external ? "external" : "arrow"}
          size={16}
          className="mt-1.5 text-muted transition-colors group-hover:text-accent"
        />
      </a>
    </li>
  );
}
