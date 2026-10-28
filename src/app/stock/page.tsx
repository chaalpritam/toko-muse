"use client";

import { useEffect, useRef, useState } from "react";
import { OwnerShell } from "@/components/OwnerShell";
import { api, useCafeState } from "@/lib/client/state";
import { money, timeOf } from "@/lib/format";
import type { Box } from "@/lib/muse";

export default function StockPage() {
  const { state, refresh } = useCafeState();
  return (
    <OwnerShell state={state}>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <CaseCamera onCounted={refresh} />
        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Menu</h2>
          <p className="mb-3 text-sm text-muted">Sold-out items disappear from the online order page straight away.</p>
          <ul className="divide-y divide-line">
            {state?.menu.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1">
                  {m.name}
                  <span className="ml-2 text-xs text-muted">{m.category}</span>
                </span>
                {m.in_case === 1 && m.case_count !== null && (
                  <span className="text-xs text-muted" title={`Counted ${timeOf(m.case_counted_at!)}`}>
                    {m.case_count} in case
                  </span>
                )}
                <span className="w-16 text-right tabular-nums">{money(m.price_cents)}</span>
                <button
                  className={`pill w-20 justify-center ${m.available ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}
                  onClick={() => api("/api/menu", { id: m.id, available: !m.available }, "PATCH").then(refresh)}
                >
                  {m.available ? "On menu" : "Sold out"}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-1 font-semibold">Ingredients</h2>
          <p className="mb-3 text-sm text-muted">
            Orders use ingredients by recipe. At or below par, the Stock agent drafts a reorder for your OK.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 font-medium">Item</th>
                  <th className="font-medium">Level</th>
                  <th className="font-medium">On hand</th>
                  <th className="font-medium">Par</th>
                  <th className="font-medium">Supplier</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {state?.stock.map((s) => {
                  const pct = Math.min(100, (s.qty / Math.max(s.par * 3, 1)) * 100);
                  const low = s.qty <= s.par;
                  return (
                    <tr key={s.id}>
                      <td className="py-2 capitalize">{s.name}</td>
                      <td className="w-40 pr-4">
                        <div className="h-1.5 rounded-full bg-line">
                          <div
                            className={`h-1.5 rounded-full ${low ? "bg-warn" : "bg-ok"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className={`tabular-nums ${low ? "font-semibold text-warn" : ""}`}>
                        {+s.qty.toFixed(2)} {s.unit}
                      </td>
                      <td className="tabular-nums text-muted">
                        {s.par} {s.unit}
                      </td>
                      <td className="text-muted">{s.supplier_name}</td>
                      <td className="text-right">
                        <button className="btn" onClick={() => api("/api/stock", { id: s.id, qty: s.reorder_qty }).then(refresh)}>
                          + {s.reorder_qty} {s.unit} received
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </OwnerShell>
  );
}

const COLORS = ["#b4532a", "#2f7a4f", "#2c5d8a", "#8a2f63", "#a86b00"];

function CaseCamera({ onCounted }: { onCounted: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState("");
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [results, setResults] = useState<{ name: string; count: number; boxes: Box[] }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      .getUserMedia({ video: camId ? { deviceId: { exact: camId } } : { width: 1280, height: 720 } })
      .then(async (s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        setCams((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"));
      })
      .catch((e) => setError(e.message));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [on, camId]);

  const count = async () => {
    const v = video.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const image = canvas.toDataURL("image/jpeg", 0.85);
    setShot(image);
    setBusy(true);
    setError("");
    try {
      const data = await api<{ results: { name: string; count: number; boxes: Box[] }[] }>("/api/vision/case", { image });
      setResults(data.results);
      onCounted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-semibold">Display case</h2>
        {cams.length > 1 && (
          <select className="ml-auto rounded-md border border-line bg-surface px-2 py-1 text-xs" value={camId} onChange={(e) => setCamId(e.target.value)}>
            {cams.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || "Camera"}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="mb-3 text-sm text-muted">
        Point a camera at the pastry case. The Case Watcher counts each item with SAM 3.1, updates stock and marks empty trays sold out.
      </p>
      <div className="relative overflow-hidden rounded-lg bg-black/80">
        {shot && results.length > 0 && <Annotated src={shot} results={results} />}
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className={`aspect-video w-full object-cover ${on && !(shot && results.length) ? "" : "hidden"}`}
        />
        {!on && <div className="flex aspect-video items-center justify-center text-sm text-white/70">Camera off</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!on ? (
          <button className="btn btn-primary" onClick={() => setOn(true)}>
            Start camera
          </button>
        ) : shot && results.length ? (
          <button className="btn" onClick={() => { setShot(null); setResults([]); }}>
            Back to live view
          </button>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={count}>
            {busy ? "Counting…" : "Count the case"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {results.map((r, i) => (
            <li key={r.name} className="pill gap-1.5 bg-line">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {r.count} {r.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Annotated({ src, results }: { src: string; results: { name: string; boxes: Box[] }[] }) {
  return (
    <div className="relative">
      <img src={src} alt="Display case snapshot" className="w-full" />
      {results.flatMap((r, i) =>
        r.boxes.map((b, j) => (
          <div
            key={`${i}-${j}`}
            className="absolute rounded border-2"
            style={{
              borderColor: COLORS[i % COLORS.length],
              left: `${(b.x1 / b.w) * 100}%`,
              top: `${(b.y1 / b.h) * 100}%`,
              width: `${((b.x2 - b.x1) / b.w) * 100}%`,
              height: `${((b.y2 - b.y1) / b.h) * 100}%`,
            }}
          />
        )),
      )}
    </div>
  );
}
