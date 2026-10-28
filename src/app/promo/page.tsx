"use client";

import { useEffect, useState } from "react";
import { OwnerShell } from "@/components/OwnerShell";
import { api, fileToDataUrl, shrinkImage, useCafeState } from "@/lib/client/state";
import { money } from "@/lib/format";
import type { Box } from "@/lib/muse";

interface Promo {
  id: number;
  dish: string;
  caption: string;
  image: string;
}

// Crop to SAM's box for the dish, with some breathing room, so the poster is about the food not the counter.
async function cropTo(dataUrl: string, b: Box, pad = 0.12) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const sx = img.width / b.w;
  const sy = img.height / b.h;
  const bw = (b.x2 - b.x1) * sx;
  const bh = (b.y2 - b.y1) * sy;
  const x = Math.max(0, b.x1 * sx - bw * pad);
  const y = Math.max(0, b.y1 * sy - bh * pad);
  const w = Math.min(img.width - x, bw * (1 + pad * 2));
  const h = Math.min(img.height - y, bh * (1 + pad * 2));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export default function PromoPage() {
  const { state } = useCafeState(10000);
  const [dish, setDish] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [cutout, setCutout] = useState<string | null>(null);
  const [step, setStep] = useState<"" | "finding" | "designing">("");
  const [result, setResult] = useState<{ image: string; caption: string } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Promo[]>([]);

  const loadHistory = () => fetch("/api/promo").then((r) => r.json()).then(setHistory);
  useEffect(() => {
    void loadHistory();
  }, []);

  const menuItem = state?.menu.find((m) => m.name === dish);

  const make = async () => {
    if (!photo || !dish) return;
    setError("");
    setResult(null);
    try {
      setStep("finding");
      const { boxes } = await api<{ boxes: Box[] }>("/api/vision/segment", { image: photo, prompt: dish.toLowerCase() });
      const best = boxes.sort((a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1))[0];
      const crop = best ? await cropTo(photo, best) : photo;
      setCutout(crop);
      setStep("designing");
      const data = await api<{ image: string; caption: string }>("/api/promo", {
        image: crop,
        dish,
        price: menuItem ? money(menuItem.price_cents) : undefined,
        note,
      });
      setResult(data);
      void loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStep("");
    }
  };

  return (
    <OwnerShell state={state}>
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <section className="card flex flex-col gap-3 p-4">
          <div>
            <h2 className="font-semibold">Today’s special, in one photo</h2>
            <p className="text-sm text-muted">
              SAM 3.1 finds the dish in your photo, Muse Image turns it into a poster, Muse Spark writes the caption.
            </p>
          </div>
          <label className="text-sm">
            Dish
            <input
              list="menu-items"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5"
              placeholder="e.g. Almond Croissant"
              value={dish}
              onChange={(e) => setDish(e.target.value)}
            />
            <datalist id="menu-items">
              {state?.menu.map((m) => <option key={m.id} value={m.name} />)}
            </datalist>
          </label>
          <label className="text-sm">
            Anything to mention <span className="text-muted">(optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5"
              placeholder="fresh out of the oven, only till 11am"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="btn cursor-pointer self-start">
            📷 {photo ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setPhoto(await shrinkImage(await fileToDataUrl(f), 1600));
                setCutout(null);
                setResult(null);
              }}
            />
          </label>
          {photo && <img src={cutout ?? photo} alt="Dish photo" className="max-h-60 rounded-lg object-contain" />}
          <button className="btn btn-primary" disabled={!photo || !dish || step !== ""} onClick={make}>
            {step === "finding" ? "Finding the dish…" : step === "designing" ? "Designing the poster…" : "Make the post"}
          </button>
          {error && <p className="text-sm text-accent">{error}</p>}
        </section>
        <section className="flex flex-col gap-5">
          {result && <PromoCard promo={{ id: 0, dish, ...result }} large />}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Recent posts</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {history.map((p) => (
                <PromoCard key={p.id} promo={p} />
              ))}
              {history.length === 0 && <p className="text-sm text-muted">No posts yet.</p>}
            </div>
          </div>
        </section>
      </div>
    </OwnerShell>
  );
}

function PromoCard({ promo, large }: { promo: Promo; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className={`card overflow-hidden ${large ? "max-w-xl" : ""}`}>
      <img src={promo.image} alt={`Poster for ${promo.dish}`} className="w-full" />
      <div className="p-3">
        <p className="whitespace-pre-line text-sm">{promo.caption}</p>
        <div className="mt-2 flex gap-2">
          <a className="btn" href={promo.image} download={`${promo.dish}.jpg`}>
            Download
          </a>
          <button
            className="btn"
            onClick={() => {
              void navigator.clipboard.writeText(promo.caption);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy caption"}
          </button>
        </div>
      </div>
    </article>
  );
}
