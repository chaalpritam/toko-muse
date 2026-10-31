const STYLES: Record<string, string> = {
  Owner: "bg-line text-foreground",
  Setup: "bg-[#e3eee9] text-[#2d6a55] dark:bg-[#1b2f28] dark:text-[#93d1b8]",
  Manager: "bg-[#e6e1f5] text-[#4b3a8c] dark:bg-[#2b2442] dark:text-[#c3b6f2]",
  Orders: "bg-accent-soft text-accent",
  Payments: "bg-ok-soft text-ok",
  Stock: "bg-warn-soft text-warn",
  Suppliers: "bg-[#dfeaf5] text-[#2c5d8a] dark:bg-[#1c2c3b] dark:text-[#9cc4ea]",
  Books: "bg-[#efe6da] text-[#6d5131] dark:bg-[#33281c] dark:text-[#d9bf98]",
  "Case Watcher": "bg-[#f3e1ec] text-[#8a2f63] dark:bg-[#3a1e2f] dark:text-[#eaa6cd]",
  Promoter: "bg-[#fde7e3] text-[#a33a2a] dark:bg-[#3d1f1a] dark:text-[#f2a596]",
};

export function AgentTag({ agent }: { agent: string }) {
  return (
    <span className={`pill h-5 shrink-0 whitespace-nowrap ${STYLES[agent] ?? "bg-line"}`}>{agent}</span>
  );
}
