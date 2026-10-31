# Toko Muse

**A counter device that runs a one-person café.** The owner makes coffee, takes payments and keeps the shop running alone. Toko Muse is a small device on the counter (a ReSpeaker XVF3800 mic array) with a crew of AI agents on Meta's Muse models. Out of the box, the owner sets up their shop just by talking to it: the device builds the menu and stock, then launches the café's online store. From then on it runs the counter hands-free.

Built for the [Meta Global AI Developer Hackathon](https://dev.meta.ai/events/global-hackathon).

## What the crew does

| Agent | Job | Model |
|---|---|---|
| **Setup** | On a new device, asks for the café's name, menu and prices, ingredients, hours, address and suppliers, one question at a time, then writes the store's front page and launches it | Muse Spark (tool calling) |
| **Manager** | Takes every spoken command, hands work to the crew, replies out loud | Muse Spark (tool calling) |
| **Orders** | One queue for counter, website, WhatsApp and delivery-app orders. *"Put us on the delivery apps"* publishes the menu and starts taking their orders; *"accept the delivery order, ten minutes"* accepts and promises a time. Spoken orders like *"two oat lattes for table 4, paid cash"* are rung up. New orders are called out loud | Muse Spark |
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

- `/device` The counter device: hold the orb (or **Space**) to talk. A new device walks you through setup; a live one shows the store's QR code
- `/` Counter: order board, push-to-talk (hold the button or **Space**), approvals, crew activity
- `/stock` Menu, ingredients, display-case camera
- `/money` Takings by payment method, receipts, close of day
- `/promo` Today's special → poster and caption
- `/s/<café-name>` The store the device launched: front page and online ordering (`/order` redirects here)

Data lives in `data/cafe.db` (SQLite, built into Node 22+). A sample café is seeded on first run. To unbox a fresh device, open `/device` → **Device ⋯** → **Reset to a new device**. **Load the sample café** brings the demo data back.

Phones can't reach `localhost`, so to scan the store's QR code from a phone set `NEXT_PUBLIC_STORE_ORIGIN` to a tunnel or LAN address.

Without `STRIPE_SECRET_KEY`, online orders are pay-at-pickup and the Card button is hidden. Stripe payments are confirmed by polling the Checkout Session, so no webhook or Stripe CLI is needed locally. Use test card `4242 4242 4242 4242`.

## Delivery apps

Real delivery networks (Uber Eats, DoorDash, Deliveroo) only open their APIs to approved partners, so the demo uses two made-up apps, **QuickBite** and **Hopper Eats**, and the device says so. Once connected, each one sends an order every `DELIVERY_EVERY_SECONDS` (90 by default) using only what's on the menu right now, already paid in the app. Orders left waiting for two minutes get a spoken reminder. *"Pause the delivery apps"* stops them.

## ReSpeaker XVF3800

Plug the XVF3800 into the Mac or PC over USB. It shows up as a normal mic, and the Counter page picks it automatically (or choose it from the mic menu). The XVF3800 does echo cancellation, beamforming and noise suppression in hardware, so the browser's own processing is turned off. For spoken replies and call-outs, set the system audio output to the XVF3800's speaker jack.

## Demo script (≈3 min)

**Unbox and set up** (start from **Reset to a new device** on `/device`)

1. Tap the screen → Toko greets you and asks the café's name. Hold Space: *"It's called Bean There."*
2. *"We sell oat lattes for five fifty and butter croissants for three seventy-five."* → items appear on the setup checklist. Toko asks what goes into them: *"Oat milk and a double shot. Croissants come from the bakery."*
3. *"We're open weekdays seven to three, at 4 Mill Street."*
4. *"Launch the store."* → the store's front page is written, the QR code appears, and `/s/bean-there` is live.

**Run the shop**

5. *"Put us on the delivery apps."* → QuickBite and Hopper Eats light up on the device, and their orders start arriving and are called out. *"Accept the QuickBite order, ten minutes."*
6. Hold Space: *"Two oat lattes and a butter croissant for table 4, card."* → the order appears and a Stripe QR pops up → pay with the test card → *"Order 2 paid by card."*
7. *"We're out of oat milk."* → Oat Latte disappears from the store and the delivery apps, and an oat milk reorder waits for approval → Approve.
8. `/stock` → **Count the case** → SAM outlines each pastry, and empty trays go sold out.
9. `/money` → snap a supplier invoice → expense logged, stock topped up → **Close the day** → spoken briefing.
10. `/promo` → photo of a croissant → poster and caption, which also shows on the store as today's special.

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, `node:sqlite`, the OpenAI SDK pointed at the Meta Model API (`https://api.meta.ai/v1`), and Stripe.
