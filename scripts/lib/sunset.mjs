// sunset.mjs: when the sunset trip leaves, for any date.
//
// The rule, set by the owner on 4 Oct 2026: the sunset trip leaves 1 h 15
// before that day's sunset in Funchal, rounded DOWN to the quarter hour.
// Checks: 4 Oct 2026 18:30, 25 Oct 2026 17:00, 15 Dec 2026 16:45,
// 15 Jun 2027 20:00 (scripts/checks/policy.test.mjs runs them).
//
// The sunset is the NOAA solar calculator (the spreadsheet method, sun's
// upper edge with refraction, 90.833 degrees) for Marina do Funchal,
// lat 32.65 N, lon 16.9083 W, shown in Atlantic/Madeira time. The booking
// server (GET /v1/sunset, /v1/availability) uses the same rule; the browser
// copies of this function live in booking.js and tide.js.
const LAT = 32.65, LON = -16.9083, RAD = Math.PI / 180;
export const LEAD_MINUTES = 75;

// minutes after 00:00 UTC of that date
function sunsetUtcMinutes(y, m, d) {
  let t = 720;
  for (let i = 0; i < 3; i++) {
    const jd = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5 + t / 1440;
    const T = (jd - 2451545) / 36525;
    const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
      Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
    const omega = 125.04 - 1934.136 * T;
    const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
    const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) / RAD;
    const yv = Math.tan((eps / 2) * RAD) ** 2;
    const eqTime = (4 / RAD) * (yv * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) +
      4 * e * yv * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * yv * yv * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
    const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl * RAD)) -
      Math.tan(LAT * RAD) * Math.tan(decl * RAD)) / RAD;
    t = 720 - 4 * LON - eqTime + 4 * ha;
  }
  return t;
}

const FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Atlantic/Madeira", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const hm = (ms) => FMT.format(new Date(ms));
const parse = (date) => date.split("-").map(Number);

// "YYYY-MM-DD" -> sunset "HH:MM", Funchal time
export function sunsetFunchal(date) {
  const [y, m, d] = parse(date);
  return hm(Date.UTC(y, m - 1, d) + sunsetUtcMinutes(y, m, d) * 60000);
}

// "YYYY-MM-DD" -> sunset trip departure "HH:MM", Funchal time
export function sunsetDeparture(date) {
  const [y, m, d] = parse(date);
  const ms = Date.UTC(y, m - 1, d) + (sunsetUtcMinutes(y, m, d) - LEAD_MINUTES) * 60000;
  const [h, min] = hm(ms).split(":").map(Number);
  const q = h * 60 + Math.floor(min / 15) * 15;
  return String(Math.floor(q / 60)).padStart(2, "0") + ":" + String(q % 60).padStart(2, "0");
}

// [{month: 1..12, from: "HH:MM", to: "HH:MM"}]: earliest and latest departure of each month
export function departureRanges(year) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const deps = [];
    for (let d = 1; d <= days; d++) deps.push(sunsetDeparture(`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`));
    deps.sort();
    out.push({ month: m, from: deps[0], to: deps[deps.length - 1] });
  }
  return out;
}
