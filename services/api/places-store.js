/**
 * คลังข้อมูลสถานที่ของ API
 *
 * แหล่งข้อมูล (ลำดับความสำคัญจากสูงไปต่ำ):
 *   1. ข้อมูลทีม: data/places/team/*.json และ places_bkk_cnx.json ที่ root (ไฟล์เดิมของทีม)
 *   2. ข้อมูลเริ่มต้นจาก OpenStreetMap: data/places/osm/<ISO>.json
 * ถ้า id ซ้ำ หรือชื่อ + จังหวัด + ประเภทซ้ำ จะใช้ข้อมูลทีมแทนข้อมูล OSM
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const PLACE_TYPES = ["attraction", "restaurant", "cafe", "hotel", "fuel", "rest_stop"];

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";

const PROVINCE_ALIASES = {
  "TH-10": ["กรุงเทพ", "กรุงเทพฯ", "กทม", "กทม.", "bangkok", "krungthep"],
  "TH-14": ["อยุธยา", "ayutthaya"],
};

// จำนวนสถานที่สูงสุดต่อประเภทที่ส่งให้ AI ต่อจังหวัดต้นทาง/ปลายทาง
const PLAN_CAPS = { attraction: 8, restaurant: 5, cafe: 3, hotel: 4, fuel: 3, rest_stop: 2 };
// จังหวัดที่อยู่ระหว่างทาง (ประมาณจากเส้นตรง) ส่งเฉพาะประเภทที่ใช้แวะพัก
const CORRIDOR_CAPS = { fuel: 2, rest_stop: 1, restaurant: 1, attraction: 1 };
const MAX_CORRIDOR_PROVINCES = 3;
const CORRIDOR_WIDTH_KM = 60;

// ปั๊มน้ำมันแบรนด์หลัก ใช้จัดลำดับก่อน เพราะข้อมูล OSM บางแถวใช้ชื่อร้านสะดวกซื้อในปั๊ม
const FUEL_BRAND_PATTERN = /ptt|ปตท|bangchak|บางจาก|shell|เชลล์|caltex|คาลเท็กซ์|esso|เอสโซ่|\bpt\b|พีที|susco|ซัสโก้|cosmo|คอสโม่/iu;

const INTEREST_BOOSTS = {
  คาเฟ่: { cafe: 3 },
  อาหาร: { restaurant: 3 },
  ธรรมชาติ: { attraction: 2 },
  วัฒนธรรม: { attraction: 2 },
  ภูเขา: { attraction: 2 },
  ทะเล: { attraction: 2 },
};

export function normalizeProvinceText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/^จังหวัด|^จ\.\s*/u, "")
    .replace(/\s+province$/u, "")
    .replace(/[\s.\-_]/gu, "")
    .trim();
}

function normalizeName(text) {
  return String(text || "").toLowerCase().replace(/\s+/gu, "");
}

// แฮชแบบคงที่ เพื่อให้คำขอเดิมได้ชุดสถานที่เดิม แต่คำขอต่างกันได้ชุดที่หลากหลาย
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
}

// ระยะจากจุด p ถึงเส้นตรง a-b และตำแหน่งบนเส้น (0 = a, 1 = b)
function projectOnSegment(p, a, b) {
  const ab = { x: b.lon - a.lon, y: b.lat - a.lat };
  const lengthSq = ab.x * ab.x + ab.y * ab.y;
  if (!lengthSq) return { t: 0, km: distanceKm(p, a) };
  const t = ((p.lon - a.lon) * ab.x + (p.lat - a.lat) * ab.y) / lengthSq;
  const point = { lat: a.lat + ab.y * t, lon: a.lon + ab.x * t };
  return { t, km: distanceKm(p, point) };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function isValidTeamPlace(place) {
  return (
    place &&
    typeof place.id === "string" && place.id.trim() &&
    typeof place.name === "string" && place.name.trim() &&
    typeof place.province === "string" && place.province.trim() &&
    PLACE_TYPES.includes(place.type)
  );
}

export class PlaceStore {
  constructor() {
    this.provinces = [];
    this.byProvince = new Map();
    this.unassigned = [];
    this.sources = [];
    this.centroids = new Map();
  }

  addProvince(province) {
    const entry = { code: province.code, nameTh: province.nameTh, nameEn: province.nameEn || null };
    this.provinces.push(entry);
    this.byProvince.set(entry.code, []);
    return entry;
  }

  findProvince(text) {
    const needle = normalizeProvinceText(text);
    if (!needle) return null;

    for (const province of this.provinces) {
      const names = [province.nameTh, province.nameEn, ...(PROVINCE_ALIASES[province.code] || [])].map(normalizeProvinceText);
      if (names.includes(needle)) return province;
    }

    // ข้อความยาวที่มีชื่อจังหวัดอยู่ข้างใน เช่น "อำเภอเมืองเชียงใหม่"
    let best = null;
    let bestLength = 0;
    for (const province of this.provinces) {
      for (const name of [province.nameTh, province.nameEn].map(normalizeProvinceText)) {
        if (name && name.length > bestLength && needle.includes(name)) {
          best = province;
          bestLength = name.length;
        }
      }
    }
    return best;
  }

  /** เพิ่มสถานที่ ถ้า source เป็น team จะทับข้อมูล OSM ที่ซ้ำกัน */
  addPlaces(places) {
    this.centroids.clear();
    for (const place of places) {
      const province = place.provinceCode
        ? this.provinces.find((p) => p.code === place.provinceCode)
        : this.findProvince(place.province);
      if (!province) {
        this.unassigned.push(place);
        continue;
      }
      const record = { ...place, province: province.nameTh, provinceCode: province.code };
      const list = this.byProvince.get(province.code);

      if (record.source === "team") {
        const key = `${normalizeName(record.name)}|${record.type}`;
        for (let i = list.length - 1; i >= 0; i--) {
          const other = list[i];
          if (other.source !== "team" && (other.id === record.id || `${normalizeName(other.name)}|${other.type}` === key)) {
            list.splice(i, 1);
          }
        }
      } else if (list.some((other) => other.id === record.id)) {
        continue;
      }
      list.push(record);
    }
  }

  provinceSummary() {
    return this.provinces.map((province) => {
      const counts = Object.fromEntries(PLACE_TYPES.map((type) => [type, 0]));
      let team = 0;
      for (const place of this.byProvince.get(province.code)) {
        counts[place.type] += 1;
        if (place.source === "team") team += 1;
      }
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      return { ...province, total, team, counts };
    });
  }

  query({ provinceCode = null, type = null, q = "", limit = 50, offset = 0 } = {}) {
    let items = provinceCode
      ? this.byProvince.get(provinceCode) || []
      : [...this.byProvince.values()].flat();
    if (type) items = items.filter((place) => place.type === type);
    const needle = normalizeName(q);
    if (needle) {
      items = items.filter((place) => normalizeName(place.name).includes(needle) || normalizeName(place.nameEn).includes(needle));
    }
    return { total: items.length, items: items.slice(offset, offset + limit) };
  }

  // จุดกึ่งกลางโดยประมาณของจังหวัด คำนวณจากพิกัดสถานที่ในจังหวัด
  centroid(provinceCode) {
    if (this.centroids.has(provinceCode)) return this.centroids.get(provinceCode);
    const places = this.byProvince.get(provinceCode) || [];
    const located = places.filter((p) => typeof p.lat === "number" && typeof p.lon === "number");
    const center = located.length
      ? {
          lat: located.reduce((sum, p) => sum + p.lat, 0) / located.length,
          lon: located.reduce((sum, p) => sum + p.lon, 0) / located.length,
        }
      : null;
    this.centroids.set(provinceCode, center);
    return center;
  }

  corridorProvinces(fromCode, toCode) {
    const a = this.centroid(fromCode);
    const b = this.centroid(toCode);
    if (!a || !b || fromCode === toCode) return [];
    return this.provinces
      .filter((p) => p.code !== fromCode && p.code !== toCode)
      .map((p) => ({ province: p, center: this.centroid(p.code) }))
      .filter((item) => item.center)
      .map((item) => ({ ...item, ...projectOnSegment(item.center, a, b) }))
      .filter((item) => item.t > 0.05 && item.t < 0.95 && item.km <= CORRIDOR_WIDTH_KM)
      .sort((x, y) => x.t - y.t)
      .filter((_, index, list) => {
        // กระจายจังหวัดระหว่างทางให้ห่างกันพอสมควร
        if (list.length <= MAX_CORRIDOR_PROVINCES) return true;
        const step = list.length / MAX_CORRIDOR_PROVINCES;
        return Array.from({ length: MAX_CORRIDOR_PROVINCES }, (_, i) => Math.floor((i + 0.5) * step)).includes(index);
      })
      .map((item) => item.province);
  }

  pick(provinceCode, caps, seed) {
    const places = this.byProvince.get(provinceCode) || [];
    const picked = [];
    for (const [type, cap] of Object.entries(caps)) {
      if (cap <= 0) continue;
      const candidates = places
        .filter((place) => place.type === type)
        .map((place) => ({
          place,
          score:
            (place.source === "team" ? 1000 : 0) +
            (type === "fuel" && FUEL_BRAND_PATTERN.test(`${place.brand || ""} ${place.name}`) ? 5 : 0) +
            (place.brand ? 2 : 0) +
            (place.nameEn ? 1 : 0),
          tie: hash(`${seed}|${place.id}`),
        }))
        .sort((x, y) => y.score - x.score || x.tie - y.tie)
        .slice(0, cap);
      picked.push(...candidates.map((c) => c.place));
    }
    return picked;
  }

  /** เลือกสถานที่สำหรับส่งให้ AI ตามต้นทาง ปลายทาง และความสนใจ */
  selectForPlan({ origin, destination, interests = [] }) {
    const from = this.findProvince(origin);
    const to = this.findProvince(destination);
    const seed = `${origin}|${destination}|${interests.join(",")}`;

    const caps = { ...PLAN_CAPS };
    for (const interest of interests) {
      for (const [type, extra] of Object.entries(INTEREST_BOOSTS[interest] || {})) caps[type] += extra;
    }

    const endpoints = [...new Map([from, to].filter(Boolean).map((p) => [p.code, p])).values()];
    const corridor = from && to ? this.corridorProvinces(from.code, to.code) : [];

    const places = [
      ...endpoints.flatMap((p) => this.pick(p.code, caps, seed)),
      ...corridor.flatMap((p) => this.pick(p.code, CORRIDOR_CAPS, seed)),
    ];

    return {
      origin: from,
      destination: to,
      corridor,
      places: places.map(({ id, name, province, type }) => ({ id, name, province, type })),
      hasOsm: places.some((p) => p.source === "osm"),
    };
  }
}

export async function loadPlaceStore({ dataDir, legacyFiles = [] }) {
  const store = new PlaceStore();
  const osmDir = path.join(dataDir, "osm");
  const teamDir = path.join(dataDir, "team");

  // รายชื่อจังหวัดมาจากไฟล์ index ของ OSM
  const indexPath = path.join(osmDir, "provinces.json");
  if (!existsSync(indexPath)) {
    throw new Error(`ไม่พบ ${indexPath} ให้รัน npm run fetch:osm ใน services/api ก่อน`);
  }
  const index = await readJson(indexPath);
  for (const province of index.provinces) store.addProvince(province);

  let osmCount = 0;
  for (const province of index.provinces) {
    const file = path.join(osmDir, `${province.code}.json`);
    if (!existsSync(file)) continue;
    const places = await readJson(file);
    store.addPlaces(places.filter((p) => PLACE_TYPES.includes(p.type)));
    osmCount += places.length;
  }
  if (osmCount) store.sources.push({ name: "osm", count: osmCount, attribution: OSM_ATTRIBUTION });

  const teamFiles = [...legacyFiles];
  if (existsSync(teamDir)) {
    for (const name of (await readdir(teamDir)).sort()) {
      if (name.endsWith(".json")) teamFiles.push(path.join(teamDir, name));
    }
  }

  let teamCount = 0;
  for (const file of teamFiles) {
    if (!existsSync(file)) continue;
    const data = await readJson(file);
    if (!Array.isArray(data)) {
      console.warn(`ข้ามไฟล์ ${file}: ต้องเป็น Array`);
      continue;
    }
    const valid = [];
    for (const place of data) {
      if (isValidTeamPlace(place)) {
        valid.push({ ...place, source: "team", verified: place.verified === true });
      } else {
        console.warn(`ข้ามสถานที่ที่ไม่ตรง schema ใน ${path.basename(file)}:`, place && place.id);
      }
    }
    store.addPlaces(valid);
    teamCount += valid.length;
  }
  if (teamCount) store.sources.push({ name: "team", count: teamCount });
  if (store.unassigned.length) {
    console.warn(`มี ${store.unassigned.length} สถานที่ที่จับคู่จังหวัดไม่ได้ จึงไม่ถูกโหลด`);
  }

  return store;
}
