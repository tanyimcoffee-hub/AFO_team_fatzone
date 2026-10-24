import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPlaceStore, PLACE_TYPES, OSM_ATTRIBUTION } from './places-store.js';

// GROQ_API_KEY ถูกโหลดใน travel-ai.js จาก ai-engine/.env แล้ว
// ไฟล์นี้ใช้ dotenv เฉพาะตัวแปรของ server เอง เช่น PORT (อ่านจาก .env ในโฟลเดอร์ที่รัน)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __dirname = services/api  ->  root ของ repo อยู่ที่ ../..
const REPO_ROOT = path.resolve(__dirname, '../..');

// โหลดข้อมูลสถานที่ครั้งเดียวตอนเริ่ม server
// data/places/osm = ข้อมูลเริ่มต้นจาก OpenStreetMap, data/places/team + places_bkk_cnx.json = ข้อมูลทีม
const placeStore = await loadPlaceStore({
    dataDir: path.join(REPO_ROOT, 'data/places'),
    legacyFiles: [path.join(REPO_ROOT, 'places_bkk_cnx.json')],
});
console.log('โหลดข้อมูลสถานที่:', placeStore.sources.map((s) => `${s.name}=${s.count}`).join(', ') || 'ไม่มี');

// โหลด AI engine เมื่อมีคำขอวางแผนครั้งแรก เพื่อให้ /api/places ใช้งานได้แม้ยังไม่ได้ตั้ง GROQ_API_KEY
let travelAiModule = null;
const getTravelAi = async () => {
    travelAiModule ??= await import('../../ai-engine/travel-ai.js');
    return travelAiModule;
};

const attributionFor = (places) =>
    places.some((place) => place.source === 'osm') ? OSM_ATTRIBUTION : null;

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'AI Travel Planner API is running!' });
});

// รายชื่อจังหวัดพร้อมจำนวนสถานที่แต่ละประเภท
app.get('/api/places/provinces', (req, res) => {
    res.json({
        success: true,
        data: placeStore.provinceSummary(),
        types: PLACE_TYPES,
        sources: placeStore.sources,
        attribution: OSM_ATTRIBUTION,
    });
});

// ค้นหาสถานที่ ?province=เชียงใหม่&type=fuel&q=ปตท&limit=50&offset=0
app.get('/api/places', (req, res) => {
    const { province, type, q } = req.query;
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);

    if (type !== undefined && !PLACE_TYPES.includes(type)) {
        return res.status(400).json({ success: false, error: `type ต้องเป็นหนึ่งใน ${PLACE_TYPES.join(', ')}` });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        return res.status(400).json({ success: false, error: 'limit ต้องเป็นจำนวนเต็ม 1–200' });
    }
    if (!Number.isInteger(offset) || offset < 0) {
        return res.status(400).json({ success: false, error: 'offset ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' });
    }

    let matchedProvince = null;
    if (province !== undefined) {
        matchedProvince = placeStore.findProvince(province);
        if (!matchedProvince) {
            return res.status(404).json({ success: false, error: `ไม่พบจังหวัด "${province}"` });
        }
    }

    const result = placeStore.query({
        provinceCode: matchedProvince?.code ?? null,
        type: type ?? null,
        q: typeof q === 'string' ? q : '',
        limit,
        offset,
    });

    res.json({
        success: true,
        data: { province: matchedProvince, total: result.total, limit, offset, items: result.items },
        attribution: attributionFor(result.items),
    });
});

app.post('/api/plan', async (req, res) => {
    try {
        const { origin, destination, days, budgetTHB, interests } = req.body;

        if (!origin || !destination) {
            return res.status(400).json({ success: false, error: 'กรุณาระบุจุดเริ่มต้นและจุดหมายปลายทาง' });
        }

        const interestList = Array.isArray(interests) ? interests.map(String) : [];
        const selection = placeStore.selectForPlan({ origin, destination, interests: interestList });
        const userMessage = `อยากเที่ยวจาก ${origin} ไป ${destination} เป็นเวลา ${days} วัน งบประมาณ ${budgetTHB} บาท ความสนใจ: ${interestList.length ? interestList.join(', ') : 'ทั่วไป'}`;

        const { generateTravelResponse } = await getTravelAi();
        const aiResponse = await generateTravelResponse({
            message: userMessage,
            history: [],
            places: selection.places,
        });

        // เติมพิกัดให้จุดแวะ เพื่อให้หน้าเว็บวาดแผนที่ได้
        aiResponse.itinerary = placeStore.locateItinerary(aiResponse.itinerary);

        res.json({
            success: true,
            message: "สร้างแผนเที่ยวด้วย AI และข้อมูลสถานที่สำเร็จ",
            data: aiResponse,
            meta: {
                placesProvided: selection.places.length,
                originProvince: selection.origin?.nameTh ?? null,
                destinationProvince: selection.destination?.nameTh ?? null,
                originPoint: placeStore.provincePoint(selection.origin),
                destinationPoint: placeStore.provincePoint(selection.destination),
                corridorProvinces: selection.corridor.map((p) => p.nameTh),
                attribution: selection.hasOsm ? OSM_ATTRIBUTION : null,
            },
        });

    } catch (error) {
        console.error("AI Engine API Error:", error);
        res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการประมวลผลของ AI Engine" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server is running on http://localhost:${PORT}`);
});
