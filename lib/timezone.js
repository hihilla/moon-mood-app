// The astrology API wants a numeric UTC offset (e.g. 5.5, -4), not an IANA
// zone name — and it needs to be the offset that was in effect on the
// specific birth date (DST rules and zone boundaries change over time).
// Intl's shortOffset formatter resolves this correctly for any historical
// date as long as the runtime has full ICU data, which Vercel's Node
// runtime does by default.
export function getUtcOffsetHours(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const parts = dtf.formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours + minutes / 60);
}
