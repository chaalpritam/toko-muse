"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { money } from "@/lib/format";

function Success() {
  const sessionId = useSearchParams().get("session_id");
  const [order, setOrder] = useState<{ shop: string; number: number; payment_status: string; total_cents: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (r) => (r.ok ? setOrder(await r.json()) : setError((await r.json()).error)))
      .catch((e) => setError(e.message));
  }, [sessionId]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-sm text-muted">{order?.shop}</p>
      {order ? (
        <>
          <h1 className="text-2xl font-semibold">
            {order.payment_status === "paid" ? `Paid — order #${order.number} is in` : `Order #${order.number}`}
          </h1>
          <p className="text-muted">
            {money(order.total_cents)} · we’ll call your name when it’s ready.
          </p>
        </>
      ) : (
        <p className="text-muted">{error || "Confirming your payment…"}</p>
      )}
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <Success />
    </Suspense>
  );
}
