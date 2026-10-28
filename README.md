# Toko Muse

**A voice-first back office for cafés run by one person.** The owner makes coffee, takes payments and keeps the shop running alone. Toko Muse gives them a crew of AI agents on Meta's Muse models, driven hands-free through a ReSpeaker XVF3800 mic array on the counter.

Built for the [Meta Global AI Developer Hackathon](https://dev.meta.ai/events/global-hackathon).

## What the crew does

| Agent | Job | Model |
|---|---|---|
| **Manager** | Takes every spoken command, hands work to the crew, replies out loud | Muse Spark (tool calling) |
| **Orders** | One queue for online orders and counter orders. Spoken orders like *"two oat lattes for table 4, paid cash"* are rung up. New orders are called out loud | Muse Spark |
| **Payments** | Stripe Checkout for online orders, a Stripe QR on the counter screen for cards, cash logged by voice. Refunds wait for the owner's OK | Stripe |
| **Stock** | Recipes use up ingredients. *"We're out of oat milk"* marks every drink that uses it sold out online. At or below par, it drafts a reorder | Muse Spark |
| **Case Watcher** | A camera on the pastry case counts each item. Counts become stock levels, and empty trays are marked sold out | SAM 3.1 |
| **Suppliers** | Drafts reorder messages to the right supplier for the owner to approve | Muse Spark |
| **Books** | A photo of an invoice becomes an expense, and delivered ingredients restock automatically. Close of day gives a spoken briefing | Muse Spark (vision) |
| **Promoter** | A phone photo of today's special: SAM finds the dish, Muse Image makes a poster, Muse Spark writes the caption | SAM 3.1, Muse Image, Muse Spark |

Speech-to-text uses **Muse Voice Transcribe**, biased toward menu and ingredient names. Anything that spends money or messages someone outside the café stops at **Needs your OK**.

## Run it

```bash
cp .env.example .env.local   # add MODEL_API_KEY and STRIPE_SECRET_KEY (test mode)
npm install
npm run dev                  # http://localhost:3000
```

- `/` Counter: order board, push-to-talk (hold the button or **Space**), approvals, crew activity
- `/stock` Menu, ingredients, display-case camera
- `/money` Takings by payment method, receipts, close of day
- `/promo` Today's special → poster and caption
- `/order` The café's public online order page

Data lives in `data/cafe.db` (SQLite, built into Node 22+). A sample café is seeded on first run. Delete the file to start over.

Without `STRIPE_SECRET_KEY`, online orders are pay-at-pickup and the Card button is hidden. Stripe payments are confirmed by polling the Checkout Session, so no webhook or Stripe CLI is needed locally. Use test card `4242 4242 4242 4242`.

## ReSpeaker XVF3800

Plug the XVF3800 into the Mac or PC over USB. It shows up as a normal mic, and the Counter page picks it automatically (or choose it from the mic menu). The XVF3800 does echo cancellation, beamforming and noise suppression in hardware, so the browser's own processing is turned off. For spoken replies and call-outs, set the system audio output to the XVF3800's speaker jack.

## Demo script (≈2 min)

1. **Simulate online order** → the crew calls it out.
2. Hold Space: *"Two oat lattes and a butter croissant for table 4, card."* → the order appears and a Stripe QR pops up → pay with the test card → *"Order 2 paid by card."*
3. *"We're out of oat milk."* → Oat Latte disappears from `/order`, and an oat milk reorder waits for approval → Approve.
4. `/stock` → **Count the case** → SAM outlines each pastry, and empty trays go sold out.
5. `/money` → snap a supplier invoice → expense logged, stock topped up → **Close the day** → spoken briefing.
6. `/promo` → photo of a croissant → poster and caption.

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, `node:sqlite`, the OpenAI SDK pointed at the Meta Model API (`https://api.meta.ai/v1`), and Stripe.
