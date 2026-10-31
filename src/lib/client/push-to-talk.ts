"use client";

import { useEffect, useRef, useState } from "react";
import { Recorder } from "./recorder";
import { api } from "./state";
import type { AgentTurn } from "@/lib/agent";

export type Turn = { you: string; reply?: string; actions?: AgentTurn["actions"]; error?: string };
export type Phase = "idle" | "listening" | "thinking";

// Hold-to-talk on the counter mic (the XVF3800 when it's plugged in), plus a typed fallback.
// Hold Space anywhere outside a text box to talk.
export function usePushToTalk(onTurn: (turn: Turn) => void) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const recorder = useRef<Recorder | null>(null);

  // Prefer the ReSpeaker XVF3800 when it's plugged in.
  const applyDevices = (list: MediaDeviceInfo[]) => {
    const all = list.filter((d) => d.kind === "audioinput");
    setDevices(all);
    const xvf = all.find((d) => /xvf|respeaker|array/i.test(d.label));
    setDeviceId((cur) => cur || xvf?.deviceId || "");
  };
  const loadDevices = () => navigator.mediaDevices.enumerateDevices().then(applyDevices);
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(applyDevices);
  }, []);

  const start = async () => {
    if (phase !== "idle") return;
    window.speechSynthesis?.cancel();
    try {
      recorder.current = new Recorder();
      await recorder.current.start(deviceId || undefined);
      setPhase("listening");
      if (!devices.some((d) => d.label)) void loadDevices();
    } catch (err) {
      onTurn({ you: "(mic)", error: (err as Error).message });
    }
  };

  const stop = async () => {
    if (phase !== "listening" || !recorder.current) return;
    setPhase("thinking");
    const wav = await recorder.current.stop();
    try {
      const res = await fetch("/api/voice", { method: "POST", body: wav, headers: { "Content-Type": "audio/wav" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.transcript) onTurn({ you: data.transcript, reply: data.reply, actions: data.actions });
    } catch (err) {
      onTurn({ you: "(voice)", error: (err as Error).message });
    } finally {
      setPhase("idle");
    }
  };

  const sendText = async (text: string) => {
    const t = text.trim();
    if (!t || phase !== "idle") return;
    setPhase("thinking");
    try {
      const turn = await api<AgentTurn>("/api/agent", { text: t });
      onTurn({ you: t, ...turn });
    } catch (err) {
      onTurn({ you: t, error: (err as Error).message });
    } finally {
      setPhase("idle");
    }
  };

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => (e.target as HTMLElement)?.closest("input, textarea, select");
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isTyping(e)) {
        e.preventDefault();
        void start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e)) {
        e.preventDefault();
        void stop();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  return { devices, deviceId, setDeviceId, loadDevices, phase, start, stop, sendText };
}
