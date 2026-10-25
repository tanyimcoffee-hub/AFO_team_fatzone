/**
 * คำนวณเส้นทางถนนจริงด้วย OSRM (Open Source Routing Machine) ซึ่งใช้ข้อมูลถนนจาก OpenStreetMap
 * ค่าเริ่มต้นใช้เซิร์ฟเวอร์สาธิตสาธารณะ router.project-osrm.org (ฟรี ไม่ต้องใช้ key แต่ไม่รับประกันความพร้อมใช้งาน)
 * เปลี่ยนเป็นเซิร์ฟเวอร์ของตัวเองได้ด้วยตัวแปร OSRM_URL
 */

export const DEFAULT_OSRM_URL = "https://router.project-osrm.org";
export const ROUTE_ATTRIBUTION = "เส้นทางโดย OSRM · ข้อมูลถนน © OpenStreetMap contributors";
export const MAX_ROUTE_POINTS = 25;
const MAX_GEOMETRY_POINTS = 4000;

export class RouteError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function isValidPoint(point) {
  return (
    point &&
    typeof point.lat === "number" && Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90 &&
    typeof point.lon === "number" && Number.isFinite(point.lon) && point.lon >= -180 && point.lon <= 180
  );
}

// ลดจำนวนจุดของเส้นทางเมื่อยาวมาก (เก็บจุดแรกและจุดสุดท้ายไว้เสมอ)
export function thinGeometry(coords, maxPoints = MAX_GEOMETRY_POINTS) {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const thinned = coords.filter((_, index) => index % step === 0);
  if (thinned[thinned.length - 1] !== coords[coords.length - 1]) thinned.push(coords[coords.length - 1]);
  return thinned;
}

export function createRouter({ baseUrl = DEFAULT_OSRM_URL, fetchImpl = fetch, timeoutMs = 15000, cacheSize = 200 } = {}) {
  const cache = new Map();
  const base = baseUrl.replace(/\/+$/, "");

  async function route(points) {
    const key = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
    if (cache.has(key)) {
      const hit = cache.get(key);
      cache.delete(key);
      cache.set(key, hit); // ย้ายไปท้ายสุด (ใช้ล่าสุด)
      return hit;
    }

    const url = `${base}/route/v1/driving/${key}?overview=full&geometries=geojson&steps=false`;
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "AFO_team_fatzone-thai-travel-ai/1.0" } });
    } catch {
      throw new RouteError("เชื่อมต่อบริการคำนวณเส้นทางไม่ได้", 502);
    }

    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.code !== "Ok" || !Array.isArray(body.routes) || !body.routes.length) {
      // NoRoute / NoSegment = หาเส้นทางถนนระหว่างจุดไม่ได้ (เช่น จุดอยู่บนเกาะ)
      if (body && typeof body.code === "string" && body.code.startsWith("No")) {
        throw new RouteError("หาเส้นทางถนนระหว่างจุดเหล่านี้ไม่ได้", 422);
      }
      throw new RouteError("บริการคำนวณเส้นทางตอบกลับผิดพลาด", 502);
    }

    const best = body.routes[0];
    const result = {
      distanceKm: Math.round(best.distance / 100) / 10,
      durationMin: Math.round(best.duration / 60),
      legs: (best.legs || []).map((leg) => ({
        distanceKm: Math.round(leg.distance / 100) / 10,
        durationMin: Math.round(leg.duration / 60),
      })),
      // แปลงจาก [lon, lat] ของ GeoJSON เป็น [lat, lon] ที่ Leaflet ใช้
      geometry: thinGeometry(best.geometry.coordinates).map(([lon, lat]) => [Number(lat.toFixed(5)), Number(lon.toFixed(5))]),
      provider: "osrm",
      attribution: ROUTE_ATTRIBUTION,
    };

    cache.set(key, result);
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
    return result;
  }

  return { route };
}
