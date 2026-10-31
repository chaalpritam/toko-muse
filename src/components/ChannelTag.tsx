import { sourceOf, type Channel } from "@/lib/channels";

const STYLES: Record<Channel, string> = {
  counter: "bg-line",
  online: "bg-accent-soft text-accent",
  whatsapp: "bg-ok-soft text-ok",
  delivery: "bg-[#e6e1f5] text-[#4b3a8c] dark:bg-[#2b2442] dark:text-[#c3b6f2]",
};

export function ChannelTag({ order }: { order: { channel: Channel; source: string } }) {
  return <span className={`pill shrink-0 whitespace-nowrap ${STYLES[order.channel]}`}>{sourceOf(order)}</span>;
}
