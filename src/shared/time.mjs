export function businessDate(timezone, instant = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant).map(part => [part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function localMidnightUtc(date, timezone) {
  const [year,month,day] = date.split("-").map(Number), target = Date.UTC(year,month-1,day);
  let candidate = target;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i=0;i<3;i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(part => [part.type,part.value]));
    const represented = Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
    candidate += target - represented;
  }
  return new Date(candidate).toISOString();
}
