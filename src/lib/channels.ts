// Where an order came from. Safe to import in the browser.
export type Channel = "counter" | "online" | "whatsapp" | "delivery";

export const CHANNELS: Channel[] = ["counter", "online", "whatsapp", "delivery"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  counter: "Counter",
  online: "Website",
  whatsapp: "WhatsApp",
  delivery: "Delivery",
};

// "Website", "WhatsApp", or the delivery app's own name.
export function sourceOf(o: { channel: Channel; source: string }) {
  return o.source || CHANNEL_LABEL[o.channel];
}
