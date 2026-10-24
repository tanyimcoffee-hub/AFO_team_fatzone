/**
 * ดึงข้อมูลสถานที่เริ่มต้นจาก OpenStreetMap (Overpass API) แยกไฟล์ตามจังหวัด
 *
 * ใช้งาน (จากโฟลเดอร์ services/api):
 *   npm run fetch:osm                 ดึงจังหวัดที่ยังไม่มีข้อมูล (หยุดกลางทางแล้วรันซ้ำเพื่อดึงต่อได้)
 *   npm run fetch:osm -- --force      ดึงใหม่ทุกจังหวัด
 *   npm run fetch:osm -- TH-50 TH-10  ดึงเฉพาะจังหวัดที่ระบุ (รหัส ISO 3166-2)
 *
 * ผลลัพธ์: data/places/osm/<ISO>.json และ data/places/osm/provinces.json
 * ข้อมูล © OpenStreetMap contributors, สัญญาอนุญาต ODbL 1.0
 * ทุกรายการตั้ง verified: false เพราะยังไม่ได้ตรวจสอบกับแหล่งอื่น
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../data/places/osm");
const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const USER_AGENT = "AFO_team_fatzone-thai-travel-ai/1.0 (student project; starter place data)";
const DELAY_MS = Number(process.env.OVERPASS_DELAY_MS || 3000);

// แปลงแท็ก OSM เป็นประเภทสถานที่ของระบบ
const TYPE_RULES = [
  { key: "amenity", values: ["fuel"], type: "fuel" },
  { key: "amenity", values: ["restaurant"], type: "restaurant" },
  { key: "amenity", values: ["cafe"], type: "cafe" },
  { key: "tourism", values: ["hotel", "motel", "guest_house", "hostel"], type: "hotel" },
  { key: "tourism", values: ["attraction", "viewpoint", "museum", "theme_park", "zoo", "aquarium"], type: "attraction" },
  { key: "highway", values: ["rest_area", "services"], type: "rest_stop" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function overpass(query, attempt = 1) {
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body: new URLSearchParams({ data: query }),
  });
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    const wait = DELAY_MS * 2 ** attempt;
    console.warn(`  Overpass HTTP ${response.status}, ลองใหม่ใน ${wait / 1000}s`);
    await sleep(wait);
    return overpass(query, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`Overpass HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
}

async function fetchProvinces() {
  const query = `[out:json][timeout:120];
rel["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^TH-"];
out tags;`;
  const result = await overpass(query);
  return result.elements
    .map((el) => ({
      code: el.tags["ISO3166-2"],
      nameTh: (el.tags["name:th"] || el.tags.name || "").replace(/^จังหวัด/, "").trim(),
      nameEn: (el.tags["name:en"] || "").replace(/\s+Province$/i, "").trim() || null,
    }))
    .filter((p) => p.code && p.nameTh)
    .sort((a, b) => a.code.localeCompare(b.code));
}

function placeQuery(code) {
  const selectors = TYPE_RULES.map(
    (rule) => `nwr["${rule.key}"~"^(${rule.values.join("|")})$"]["name"](area.a);`
  ).join("\n  ");
  return `[out:json][timeout:300];
area["ISO3166-2"="${code}"]["admin_level"="4"]->.a;
(
  ${selectors}
);
out tags center;`;
}

function toPlace(el, province) {
  const tags = el.tags || {};
  const rule = TYPE_RULES.find((r) => r.values.includes(tags[r.key]));
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const name = (tags["name:th"] || tags.name || "").trim();
  if (!rule || !name || typeof lat !== "number" || typeof lon !== "number") return null;

  const place = {
    id: `osm-${el.type}-${el.id}`,
    name,
    province: province.nameTh,
    provinceCode: province.code,
    type: rule.type,
    category: tags[rule.key],
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    source: "osm",
    verified: false,
  };
  if (tags["name:en"] && tags["name:en"] !== name) place.nameEn = tags["name:en"];
  if (tags.brand) place.brand = tags.brand;
  return place;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = new Set(args.filter((arg) => !arg.startsWith("--")));

  console.log("กำลังดึงรายชื่อจังหวัดจาก OSM…");
  const provinces = await fetchProvinces();
  console.log(`พบ ${provinces.length} จังหวัด`);

  const indexPath = path.join(OUT_DIR, "provinces.json");
  let index = { provinces: [] };
  try {
    index = JSON.parse(await readFile(indexPath, "utf8"));
  } catch {
    // ยังไม่มีไฟล์ index
  }
  const indexByCode = new Map(index.provinces.map((p) => [p.code, p]));
  for (const province of provinces) {
    indexByCode.set(province.code, { total: 0, counts: {}, fetchedAt: null, ...indexByCode.get(province.code), ...province });
  }

  // บันทึก index หลังดึงแต่ละจังหวัด เพื่อให้หยุดกลางทางแล้วรันต่อได้
  const saveIndex = async () => {
    const output = {
      source: "OpenStreetMap via Overpass API",
      attribution: "© OpenStreetMap contributors",
      license: "ODbL-1.0",
      licenseUrl: "https://www.openstreetmap.org/copyright",
      note: "ข้อมูลเริ่มต้น ยังไม่ได้ตรวจสอบ (verified: false)",
      provinces: [...indexByCode.values()].sort((a, b) => a.code.localeCompare(b.code)),
    };
    await writeFile(indexPath, JSON.stringify(output, null, 2) + "\n");
  };
  await saveIndex();

  // ไม่ระบุจังหวัด: ดึงเฉพาะจังหวัดที่ยังไม่มีไฟล์ (ใส่ --force เพื่อดึงใหม่ทั้งหมด)
  const isFetched = (p) => indexByCode.get(p.code).fetchedAt && existsSync(path.join(OUT_DIR, `${p.code}.json`));
  const targets = only.size
    ? provinces.filter((p) => only.has(p.code))
    : provinces.filter((p) => force || !isFetched(p));
  const failed = [];

  for (const [i, province] of targets.entries()) {
    if (i > 0) await sleep(DELAY_MS);
    console.log(`[${i + 1}/${targets.length}] ${province.code} ${province.nameTh}`);
    let result;
    try {
      result = await overpass(placeQuery(province.code));
    } catch (error) {
      console.error(`  ข้าม ${province.code}: ${error.message}`);
      failed.push(province.code);
      continue;
    }

    const seen = new Set();
    const places = [];
    for (const el of result.elements) {
      const place = toPlace(el, province);
      if (place && !seen.has(place.id)) {
        seen.add(place.id);
        places.push(place);
      }
    }
    places.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, "th"));

    await writeFile(path.join(OUT_DIR, `${province.code}.json`), JSON.stringify(places) + "\n");

    const counts = {};
    for (const place of places) counts[place.type] = (counts[place.type] || 0) + 1;
    indexByCode.set(province.code, { ...province, total: places.length, counts, fetchedAt: new Date().toISOString() });
    await saveIndex();
    console.log(`  ${places.length} สถานที่`, counts);
  }

  console.log(`บันทึกแล้วที่ ${OUT_DIR}`);
  if (failed.length) {
    console.warn(`ดึงไม่สำเร็จ ${failed.length} จังหวัด: ${failed.join(" ")} รันคำสั่งเดิมอีกครั้งเพื่อดึงต่อ`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
