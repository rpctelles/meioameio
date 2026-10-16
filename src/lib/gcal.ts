/** Builds a Google Calendar "create event" link for an all-day reminder on `date` (YYYY-MM-DD). */
export function googleCalendarLink(opts: { title: string; date: string; details?: string }) {
  const start = opts.date.replaceAll("-", "");
  const d = new Date(opts.date + "T12:00:00");
  d.setDate(d.getDate() + 1);
  const end = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${start}/${end}`,
    details: opts.details ?? "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
