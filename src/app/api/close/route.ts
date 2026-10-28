import { askText } from "@/lib/muse";
import { daySummary, log } from "@/lib/store";

const CURRENCY = (process.env.NEXT_PUBLIC_CURRENCY ?? "usd").toUpperCase();

// End of day: the Books agent turns today's numbers into a short spoken briefing for the owner.
export async function POST() {
  const summary = daySummary();
  try {
    const briefing = await askText(
      "You are the Books agent for a one-person café. Write the owner's end-of-day briefing: 4-6 short sentences, plain spoken English, no lists or markdown. Cover takings by payment method, anything unpaid, expenses, best sellers, and what to order or prep for tomorrow.",
      `Currency ${CURRENCY}; all *_cents fields are cents.\n${JSON.stringify(summary)}`,
    );
    log("Books", briefing);
    return Response.json({ summary, briefing });
  } catch (err) {
    return Response.json({ summary, error: (err as Error).message }, { status: 502 });
  }
}
