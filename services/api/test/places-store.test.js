import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadPlaceStore, normalizeProvinceText } from "../places-store.js";

const PROVINCES = [
  { code: "TH-10", nameTh: "กรุงเทพมหานคร", nameEn: "Bangkok" },
  { code: "TH-19", nameTh: "สระบุรี", nameEn: "Saraburi" },
  { code: "TH-50", nameTh: "เชียงใหม่", nameEn: "Chiang Mai" },
  { code: "TH-60", nameTh: "นครสวรรค์", nameEn: "Nakhon Sawan" },
  { code: "TH-77", nameTh: "ประจวบคีรีขันธ์", nameEn: "Prachuap Khiri Khan" },
  { code: "TH-83", nameTh: "ภูเก็ต", nameEn: "Phuket" },
];

const osmPlace = (id, code, name, type, lat, lon, extra = {}) => ({
  id, name, province: PROVINCES.find((p) => p.code === code).nameTh, provinceCode: code,
  type, lat, lon, source: "osm", verified: false, ...extra,
});

async function makeFixture({ team = [], legacy = [] } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "places-"));
  const osmDir = path.join(dir, "places/osm");
  await mkdir(osmDir, { recursive: true });
  await writeFile(path.join(osmDir, "provinces.json"), JSON.stringify({ provinces: PROVINCES }));

  // พิกัดคร่าว ๆ: กรุงเทพ (13.75,100.5) สระบุรี (14.5,100.9) นครสวรรค์ (15.7,100.1) เชียงใหม่ (18.8,98.98) ภูเก็ต (7.9,98.4)
  const osm = {
    "TH-10": [
      osmPlace("osm-node-1", "TH-10", "วัดพระแก้ว", "attraction", 13.75, 100.49),
      osmPlace("osm-node-2", "TH-10", "ปั๊มทดสอบ", "fuel", 13.76, 100.5, { brand: "PTT" }),
      osmPlace("osm-node-2b", "TH-10", "7-Eleven", "fuel", 13.76, 100.51, { brand: "7-Eleven" }),
      osmPlace("osm-node-2c", "TH-10", "7-Eleven", "fuel", 13.77, 100.51, { brand: "7-Eleven" }),
      osmPlace("osm-node-2d", "TH-10", "7-Eleven", "fuel", 13.78, 100.51, { brand: "7-Eleven" }),
    ],
    "TH-19": [osmPlace("osm-node-3", "TH-19", "ปั๊มสระบุรี", "fuel", 14.5, 100.9)],
    "TH-60": [osmPlace("osm-node-4", "TH-60", "ปั๊มนครสวรรค์", "fuel", 15.7, 100.1)],
    "TH-50": [
      osmPlace("osm-node-5", "TH-50", "ดอยสุเทพ", "attraction", 18.8, 98.92),
      osmPlace("osm-node-6", "TH-50", "ร้านข้าวซอย", "restaurant", 18.79, 98.99),
      ...Array.from({ length: 20 }, (_, i) => osmPlace(`osm-node-c${i}`, "TH-50", `คาเฟ่ ${i}`, "cafe", 18.78, 98.98)),
      osmPlace("osm-way-7", "TH-50", "โรงแรมทดสอบ", "hotel", 18.79, 98.97, { nameEn: "Test Hotel" }),
    ],
    "TH-83": [osmPlace("osm-node-8", "TH-83", "หาดป่าตอง", "attraction", 7.9, 98.3)],
    // หัวหินอยู่เหนือสุดของจังหวัด ส่วนจุดพักรถเขาโพธิ์อยู่ห่างลงไปทางใต้ราว 170 กม.
    "TH-77": [
      osmPlace("osm-node-h1", "TH-77", "Hua Hin Beach Hotel", "hotel", 12.57, 99.96),
      osmPlace("osm-node-h2", "TH-77", "โรงแรมหัวหินวิว", "hotel", 12.56, 99.95),
      osmPlace("osm-node-h3", "TH-77", "หัวหินคาเฟ่", "cafe", 12.58, 99.96),
      osmPlace("osm-node-h4", "TH-77", "Khaopho Service Area", "rest_stop", 10.99, 99.35),
    ],
  };
  for (const [code, places] of Object.entries(osm)) {
    await writeFile(path.join(osmDir, `${code}.json`), JSON.stringify(places));
  }

  if (team.length) {
    await mkdir(path.join(dir, "places/team"), { recursive: true });
    await writeFile(path.join(dir, "places/team/team.json"), JSON.stringify(team));
  }
  const legacyFile = path.join(dir, "places_bkk_cnx.json");
  await writeFile(legacyFile, JSON.stringify(legacy));

  return loadPlaceStore({ dataDir: path.join(dir, "places"), legacyFiles: [legacyFile] });
}

test("normalizeProvinceText ตัดคำนำหน้าและช่องว่าง", () => {
  assert.equal(normalizeProvinceText("จังหวัดเชียงใหม่"), "เชียงใหม่");
  assert.equal(normalizeProvinceText("จ. เชียงใหม่"), "เชียงใหม่");
  assert.equal(normalizeProvinceText("Chiang Mai Province"), "chiangmai");
});

test("findProvince รองรับชื่อไทย อังกฤษ ชื่อย่อ และข้อความที่มีชื่อจังหวัด", async () => {
  const store = await makeFixture();
  assert.equal(store.findProvince("เชียงใหม่").code, "TH-50");
  assert.equal(store.findProvince("chiang mai").code, "TH-50");
  assert.equal(store.findProvince("กรุงเทพฯ").code, "TH-10");
  assert.equal(store.findProvince("กทม.").code, "TH-10");
  assert.equal(store.findProvince("อำเภอเมืองเชียงใหม่").code, "TH-50");
  assert.equal(store.findProvince("ปารีส"), null);
  // แหล่งท่องเที่ยวที่ไม่ใช่ชื่อจังหวัด
  assert.equal(store.findProvince("เกาะภูเก็ต").code, "TH-83");
  assert.equal(store.findProvince("Hua Hin").code, "TH-77");
  assert.equal(store.findProvince("อำเภอหัวหิน").code, "TH-77");
  assert.equal(store.findProvince(""), null);
});

test("ข้อมูลทีมทับข้อมูล OSM ที่ id ซ้ำ หรือชื่อและประเภทซ้ำ", async () => {
  const store = await makeFixture({
    team: [
      { id: "osm-node-5", name: "วัดพระธาตุดอยสุเทพ", province: "เชียงใหม่", type: "attraction", verified: true },
      { id: "team-002", name: "ร้านข้าวซอย", province: "เชียงใหม่", type: "restaurant" },
    ],
  });
  const attractions = store.query({ provinceCode: "TH-50", type: "attraction" }).items;
  assert.equal(attractions.length, 1);
  assert.equal(attractions[0].name, "วัดพระธาตุดอยสุเทพ");
  assert.equal(attractions[0].source, "team");
  assert.equal(attractions[0].verified, true);

  const restaurants = store.query({ provinceCode: "TH-50", type: "restaurant" }).items;
  assert.deepEqual(restaurants.map((p) => p.id), ["team-002"]);
});

test("ข้ามข้อมูลทีมที่ไม่ตรง schema หรือหาจังหวัดไม่เจอ", async () => {
  const store = await makeFixture({
    legacy: [
      { id: "bad-type", name: "x", province: "เชียงใหม่", type: "spa" },
      { id: "no-name", province: "เชียงใหม่", type: "cafe" },
      { id: "unknown-prov", name: "ร้าน", province: "ปารีส", type: "cafe" },
      { id: "ok", name: "คาเฟ่ทีม", province: "จังหวัดภูเก็ต", type: "cafe" },
    ],
  });
  assert.equal(store.query({ q: "คาเฟ่ทีม" }).items[0].provinceCode, "TH-83");
  assert.equal(store.query({ q: "x" }).total, 0);
  assert.equal(store.unassigned.length, 1);
  assert.deepEqual(store.sources.map((s) => s.name), ["osm", "team"]);
});

test("query กรองตามประเภท คำค้น และแบ่งหน้า", async () => {
  const store = await makeFixture();
  assert.equal(store.query({ provinceCode: "TH-50", type: "cafe" }).total, 20);
  const page = store.query({ provinceCode: "TH-50", type: "cafe", limit: 5, offset: 18 });
  assert.equal(page.items.length, 2);
  assert.equal(store.query({ q: "test hotel" }).items[0].id, "osm-way-7");
  assert.equal(store.query({ type: "fuel" }).total, 6);
  // ปั๊มแบรนด์น้ำมันขึ้นก่อนแถว 7-Eleven
  assert.equal(store.query({ provinceCode: "TH-10", type: "fuel" }).items[0].id, "osm-node-2");
});

test("provinceSummary นับสถานที่ทุกประเภท", async () => {
  const store = await makeFixture();
  const cm = store.provinceSummary().find((p) => p.code === "TH-50");
  assert.equal(cm.total, 23);
  assert.equal(cm.counts.cafe, 20);
  assert.equal(cm.counts.fuel, 0);
});

test("selectForPlan ส่งเฉพาะ id ชื่อ จังหวัด ประเภท จำกัดจำนวน และรวมจังหวัดระหว่างทาง", async () => {
  const store = await makeFixture();
  const selection = store.selectForPlan({ origin: "กรุงเทพฯ", destination: "เชียงใหม่", interests: [] });

  assert.equal(selection.origin.code, "TH-10");
  assert.equal(selection.destination.code, "TH-50");
  assert.ok(selection.places.every((p) => Object.keys(p).sort().join() === "id,name,province,type"));
  assert.equal(selection.places.filter((p) => p.type === "cafe").length, 2);
  // ปั๊มแบรนด์น้ำมันต้องมาก่อนแถวที่ชื่อร้านสะดวกซื้อ
  const bangkokFuel = selection.places.filter((p) => p.type === "fuel" && p.province === "กรุงเทพมหานคร");
  assert.equal(bangkokFuel.length, 2);
  assert.equal(bangkokFuel[0].id, "osm-node-2");
  // นครสวรรค์อยู่ใกล้เส้นตรงกรุงเทพ–เชียงใหม่ ภูเก็ตไม่อยู่
  assert.ok(selection.corridor.some((p) => p.code === "TH-60"));
  assert.ok(!selection.corridor.some((p) => p.code === "TH-83"));
  assert.equal(selection.hasOsm, true);

  const again = store.selectForPlan({ origin: "กรุงเทพฯ", destination: "เชียงใหม่", interests: [] });
  assert.deepEqual(again.places, selection.places);
});

test("selectForPlan เพิ่มจำนวนคาเฟ่เมื่อสนใจคาเฟ่", async () => {
  const store = await makeFixture();
  const selection = store.selectForPlan({ origin: "กรุงเทพฯ", destination: "เชียงใหม่", interests: ["คาเฟ่"] });
  assert.equal(selection.places.filter((p) => p.type === "cafe").length, 4);
});

test("selectForPlan ไม่พังเมื่อหาจังหวัดไม่เจอ", async () => {
  const store = await makeFixture();
  const selection = store.selectForPlan({ origin: "ปารีส", destination: "ลอนดอน" });
  assert.equal(selection.places.length, 0);
  assert.equal(selection.origin, null);
});

test("locateItinerary เติมพิกัดจาก placeId และไม่แตะจุดที่ไม่รู้จัก", async () => {
  const store = await makeFixture();
  const itinerary = [
    { day: 1, title: "วันแรก", stops: [{ placeId: "osm-node-5", name: "ดอยสุเทพ" }, { placeId: "unknown", name: "x" }] },
    { day: 2, title: "วันสอง", stops: [] },
  ];
  const located = store.locateItinerary(itinerary);
  assert.equal(located[0].stops[0].lat, 18.8);
  assert.equal(located[0].stops[0].lon, 98.92);
  assert.equal(located[0].stops[1].lat, undefined);
  assert.equal(located[0].title, "วันแรก");
  assert.equal(itinerary[0].stops[0].lat, undefined);
  assert.equal(store.locateItinerary(null), null);
});

test("provincePoint คืนจุดกึ่งกลางจังหวัด", async () => {
  const store = await makeFixture();
  const point = store.provincePoint(store.findProvince("ภูเก็ต"));
  assert.deepEqual(point, { name: "ภูเก็ต", lat: 7.9, lon: 98.3 });
  assert.equal(store.provincePoint(null), null);
});

test("ปลายทางเป็นแหล่งท่องเที่ยว: ใช้จุดของแหล่งนั้นและเฉพาะสถานที่ใกล้ ๆ", async () => {
  const store = await makeFixture();
  const selection = store.selectForPlan({ origin: "กรุงเทพฯ", destination: "หัวหิน" });
  assert.equal(selection.destination.code, "TH-77");
  assert.ok(Math.abs(selection.destinationArea.focus.lat - 12.57) < 0.02);
  assert.ok(!selection.places.some((p) => p.id === "osm-node-h4"), "ไม่ควรเลือกจุดพักรถที่ห่างจากหัวหิน 170 กม.");
  assert.ok(selection.places.some((p) => p.id === "osm-node-h3"));

  const point = store.areaPoint(selection.destinationArea);
  assert.equal(point.name, "หัวหิน");
  assert.ok(Math.abs(point.lat - 12.57) < 0.02);

  // พิมพ์ชื่อจังหวัดตรง ๆ: ไม่จำกัดรัศมี และใช้จุดกลางจังหวัด
  const whole = store.selectForPlan({ origin: "กรุงเทพฯ", destination: "ประจวบคีรีขันธ์" });
  assert.equal(whole.destinationArea.focus, null);
  assert.ok(whole.places.some((p) => p.id === "osm-node-h4"));
  assert.equal(store.areaPoint(whole.destinationArea).name, "ประจวบคีรีขันธ์");
});

test("loadPlaceStore แจ้งเมื่อยังไม่มีไฟล์ provinces.json", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "places-empty-"));
  await assert.rejects(loadPlaceStore({ dataDir: dir }), /fetch:osm/);
});
