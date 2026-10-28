import OpenAI from "openai";

// Meta Model API: OpenAI-compatible Chat Completions plus Meta-specific endpoints.
const BASE_URL = process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1";
export const MODELS = {
  spark: process.env.MUSE_SPARK_MODEL ?? "muse-spark-1.3",
  image: process.env.MUSE_IMAGE_MODEL ?? "muse-image-1.0",
  sam: process.env.SAM_MODEL ?? "sam-3.1",
  asr: process.env.ASR_MODEL ?? "muse-voice-transcribe-1.0",
};

function apiKey() {
  const key = process.env.MODEL_API_KEY;
  if (!key) throw new Error("MODEL_API_KEY is not set (add it to .env.local)");
  return key;
}

let client: OpenAI | undefined;
export function muse() {
  client ??= new OpenAI({ baseURL: BASE_URL, apiKey: apiKey() });
  return client;
}

// ---------- text + vision ----------

export async function askJson<T>(prompt: string, imageDataUrl?: string): Promise<T> {
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: prompt }];
  if (imageDataUrl) content.push({ type: "image_url", image_url: { url: imageDataUrl } });
  const res = await muse().chat.completions.create({
    model: MODELS.spark,
    messages: [
      { role: "system", content: "Reply with a single JSON object and nothing else." },
      { role: "user", content },
    ],
  });
  return parseJson<T>(res.choices[0]?.message?.content ?? "");
}

export async function askText(system: string, prompt: string): Promise<string> {
  const res = await muse().chat.completions.create({
    model: MODELS.spark,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
  return (res.choices[0]?.message?.content ?? "").trim();
}

function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

// ---------- speech to text ----------

export async function transcribe(wav: Blob, keywords: string[] = []): Promise<string> {
  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          mode: "ENDPOINTING",
          model: MODELS.asr,
          audioEncoding: "WAV",
          keywords: keywords.slice(0, 100),
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append("audio", wav, "speech.wav");
  const res = await fetch(`${BASE_URL}/asr/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { transcript?: string };
  return (body.transcript ?? "").trim();
}

// ---------- SAM 3.1 segmentation ----------

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  c?: number;
}

// SAM answers in special-token text: one <|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..[;c=..]|> per match.
export function parseBoxes(text: string): Box[] {
  const boxes: Box[] = [];
  for (const m of text.matchAll(/<\|box;([^|]*)\|>/g)) {
    const kv = Object.fromEntries(
      m[1].split(";").map((p) => {
        const [k, v] = p.split("=");
        return [k, Number(v)];
      }),
    );
    boxes.push({ x1: kv.x1, y1: kv.y1, x2: kv.x2, y2: kv.y2, w: kv.w, h: kv.h, c: kv.c });
  }
  return boxes;
}

export async function segment(imageDataUrl: string, prompt: string, minConfidence = 0.4): Promise<Box[]> {
  const stream = await muse().responses.create({
    model: MODELS.sam,
    stream: true,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageDataUrl, detail: "auto" },
        ],
      },
    ],
  });
  let text = "";
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") text += event.delta;
  }
  return parseBoxes(text).filter((b) => b.c === undefined || Number.isNaN(b.c) || b.c >= minConfidence);
}

// ---------- Muse Image ----------

export async function editImage(prompt: string, imageDataUrl: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.image,
      prompt,
      images: [{ image_url: imageDataUrl }],
      n: 1,
      output_format: "jpeg",
    }),
  });
  if (!res.ok) throw new Error(`Muse Image failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
  const img = body.data[0];
  if (img?.b64_json) return `data:image/jpeg;base64,${img.b64_json}`;
  if (img?.url) return img.url;
  throw new Error("Muse Image returned no image");
}
