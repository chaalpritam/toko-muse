const currency = (process.env.NEXT_PUBLIC_CURRENCY ?? "usd").toUpperCase();
const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency });

export function money(cents: number) {
  return formatter.format(cents / 100);
}

export function timeOf(sqliteUtc: string) {
  return new Date(sqliteUtc.replace(" ", "T") + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
