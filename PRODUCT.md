# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the café owner who runs the shop alone.** They make the coffee, take payments and keep the shop going by themselves, with their hands busy behind the counter. They talk to a counter device (a ReSpeaker XVF3800 mic array) and glance at its screen and the back office.
- **Evaluators: Meta Global AI Developer Hackathon judges.** They need to understand what Toko Muse is, how it uses Meta's Muse models, and how to try the demo, within minutes.
- **The café's customers** only see what the device launches for them: the store page, WhatsApp replies and delivery-app listings.

## Product Purpose

A one-person café has too many jobs for one person: the counter, online orders, WhatsApp, delivery apps, stock, suppliers, the books and promotion. Toko Muse is a counter device with a crew of AI agents that takes over the admin, so the owner can stay at the counter. Out of the box the owner sets up the shop just by talking to it: menu, stock, hours, address. The device then launches the café's online store and runs the counter hands-free.

Success: the owner never has to leave the counter to run the business, and anything that spends money or messages someone outside the café waits for their OK.

## Positioning

Voice-first and device-first: the owner sets up and runs the shop by talking to one device on the counter, instead of another app on a phone. One queue holds counter, website, WhatsApp and delivery-app orders. Every agent runs on Meta's models (Muse Spark, Muse Image, Muse Voice Transcribe, SAM 3.1), and nothing that spends money or messages outsiders happens without the owner's OK.

## Operating Context

- Behind a café counter: noisy, hands busy, the owner glances at screens rather than reading them.
- Surfaces: `/device` (the counter device), the owner back office (Counter, Stock, Money, Promo), `/s/<slug>` (the store the device launched), `/whatsapp` (simulated customer phone).
- Built for the Meta Global AI Developer Hackathon; submissions due 2026-11-04 21:00 ET.

## Capabilities and Constraints

- Agents: Setup, Manager, Orders, Payments, Stock, Case Watcher, Suppliers, Books, Promoter (see README table for jobs and models).
- Payments go through Stripe in test mode. Online orders fall back to pay-at-pickup without a Stripe key.
- The delivery apps (QuickBite, Hopper Eats) are simulated, because real networks need partner approval. WhatsApp is simulated unless WhatsApp Business keys are set. This must be stated wherever it's shown.
- Stack: Next.js 16, React 19, Tailwind 4, node:sqlite, the OpenAI SDK pointed at the Meta Model API, Stripe.

## Brand Commitments

- Name: **Toko Muse**. On the device the assistant calls itself **Toko**.
- Voice: plain, warm, short sentences in the owner's language ("Needs your OK", "Close the day"), never hype.

## Evidence on Hand

- The running demo with a seeded sample café ("Muse Café"), which can be screenshotted.
- README demo script (`README.md`).
- No customers, testimonials, usage numbers or benchmarks exist. Do not invent any.
- The demo video is not ready yet. Set `NEXT_PUBLIC_DEMO_VIDEO_URL` when it is.

## Product Principles

1. The owner stays at the counter: every feature should save them a trip to a screen.
2. Voice first, screen second: anything the owner does can be said out loud.
3. Money and outside messages always stop for the owner's OK.
4. Say plainly what's real and what's simulated.
