---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

# Landing page (/)

Scope: the public landing page at `/`. Visitor mode: Persuade. The owner's Counter moves to `/counter`.

Audience: Meta Global AI Developer Hackathon judges first; a café owner should still follow it. Job: understand what Toko Muse is, why it was built and how it uses Meta's Muse models, then try the demo.
Action: Try the device (`/device`); secondary Open the counter (`/counter`); further links to the store and the WhatsApp phone.
Proof: real screenshots of the running demo (sample café), links into the live demo, demo video slot via `NEXT_PUBLIC_DEMO_VIDEO_URL` (hidden until set). No invented users, numbers or quotes. Simulated delivery apps and WhatsApp are labelled as simulated.
Why: one person, too many jobs (from README/PRODUCT.md). No personal story.

## Direction contract

THESIS: The page is the device mid-shift. It refuses the headline-plus-feature-cards template: the owner's spoken lines and the crew's resolved actions *are* the explanation.
OWN-WORLD: The café's light palette, pinned by the user ("remove the darkness from the landing page"): cream ground #f7f3ec, surfaces #fffdf9, sunken bands #efe8dd, ink #2a1f17, muted #6f5f51, one terracotta accent #b4532a, defined once in :root for the whole app, with no dark scheme. The device orb stays the page's only light source and object; the whole app, the device and its screenshots included, is light by the user's instruction. Spoken words set in Fraunces; everything the crew does set in Geist as small action chips tagged by agent.
STORY: Visitors hear the owner say three things and watch the crew act, so they understand one device runs the café by voice. Then the why (one person, too many jobs), the crew roster with models, one queue for every channel, proof screenshots, how it's built, and a closing invitation to try the device.
FIRST VIEWPORT: Orb left at ~400px with the caption "This is Toko. Talk to it on the device" under it (adapted from "Hold to talk" for product truth: the landing orb links to /device and has no mic). Right: headline "Run your café by talking to the counter.", one-line lede, three exchanges (spoken line in Fraunces 24px, chips beneath), Try the device (ember) and Open the counter. Nav: Toko Muse wordmark, section links.
FORM: "Say it out loud", position 2 of 7 on the ranked list. seed:04c934ad0d85145b. Signature interaction: the exchanges play in sequence on load: the orb pulses while a line types in, then its chips resolve one by one; reduced motion shows them all at once. Motion grammar: the device's orb states (listening → thinking → speaking), 150–250 ms exponential ease-out.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
