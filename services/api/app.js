import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPlaceStore, PLACE_TYPES, OSM_ATTRIBUTION } from './places-store.js';
import { createRouter, isValidPoint, MAX_ROUTE_POINTS, RouteError } from './routing.js';

// Express app ของ API (ไม่ได้สั่ง listen ในไฟล์นี้)
// - รันในเครื่อง: server.js import app นี้แล้ว listen ที่ PORT
// - Vercel: api/index.js ที่ root ของ repo export app นี้เป็น serverless function

// GROQ_API_KEY ถูกโหลดใน travel-ai.js จาก ai-engine/.env แล้ว (บน Vercel ใช้ Environment Variables แทน)
// ไฟล์นี้ใช้ dotenv เฉพาะตัวแปรของ server เอง เช่น OSRM_URL (อ่านจาก .env ในโฟลเดอร์ที่รัน)
dotenv.config();

const app = express();

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

const TRIP_TYPES = ['one_way', 'round_trip'];
const TRIP_TYPE_TEXT = { one_way: 'เที่ยวเดียว (ไม่ขับกลับ)', round_trip: 'ไป-กลับ' };
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_CONTENT = 8000;

const isValidHistory = (history) =>
    Array.isArray(history) &&
    history.length <= MAX_HISTORY_ITEMS &&
    history.every((item) =>
        item &&
        ['user', 'assistant'].includes(item.role) &&
        typeof item.content === 'string' &&
        item.content.length <= MAX_HISTORY_CONTENT);

const attributionFor = (places) =>
    places.some((place) => place.source === 'osm') ? OSM_ATTRIBUTION : null;

// เส้นทางถนนจริงผ่าน OSRM (ตั้ง OSRM_URL เพื่อใช้เซิร์ฟเวอร์อื่น)
const router = createRouter({ baseUrl: process.env.OSRM_URL || undefined });

// body: { points: [{ lat, lon }, ...] } ตามลำดับการขับรถ (2–25 จุด)
app.post('/api/route', async (req, res) => {
    const { points } = req.body || {};
    if (!Array.isArray(points) || points.length < 2 || points.length > MAX_ROUTE_POINTS || !points.every(isValidPoint)) {
        return res.status(400).json({ success: false, error: `points ต้องเป็น Array ของ { lat, lon } จำนวน 2–${MAX_ROUTE_POINTS} จุด` });
    }
    try {
        const route = await router.route(points.map(({ lat, lon }) => ({ lat, lon })));
        res.json({ success: true, data: route });
    } catch (error) {
        if (error instanceof RouteError) {
            return res.status(error.status).json({ success: false, error: error.message });
        }
        console.error('Route Error:', error);
        res.status(500).json({ success: false, error: 'คำนวณเส้นทางไม่สำเร็จ' });
    }
});

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
        const { origin, destination, days, budgetTHB, interests, tripType, travelers, message, history } = req.body;

        if (!origin || !destination) {
            return res.status(400).json({ success: false, error: 'กรุณาระบุจุดเริ่มต้นและจุดหมายปลายทาง' });
        }
        // ฟิลด์เสริม (ไม่บังคับ): tripType, travelers, message และ history สำหรับคุยต่อกับ AI
        if (tripType !== undefined && !TRIP_TYPES.includes(tripType)) {
            return res.status(400).json({ success: false, error: 'tripType ต้องเป็น one_way หรือ round_trip' });
        }
        if (travelers !== undefined && (!Number.isInteger(travelers) || travelers < 1 || travelers > 50)) {
            return res.status(400).json({ success: false, error: 'travelers ต้องเป็นจำนวนเต็ม 1–50' });
        }
        if (message !== undefined && (typeof message !== 'string' || message.trim().length > MAX_MESSAGE_LENGTH)) {
            return res.status(400).json({ success: false, error: `message ต้องเป็นข้อความไม่เกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร` });
        }
        if (history !== undefined && !isValidHistory(history)) {
            return res.status(400).json({ success: false, error: `history ต้องเป็น Array ไม่เกิน ${MAX_HISTORY_ITEMS} รายการ ของ { role: user|assistant, content }` });
        }

        const interestList = Array.isArray(interests) ? interests.map(String) : [];
        const selection = placeStore.selectForPlan({ origin, destination, interests: interestList });
        const details = [
            `อยากเที่ยวจาก ${origin} ไป ${destination} เป็นเวลา ${days} วัน`,
            'เดินทางด้วยรถยนต์ส่วนตัวแบบ Road Trip',
            tripType ? `แบบ${TRIP_TYPE_TEXT[tripType]}` : null,
            travelers ? `ผู้เดินทาง ${travelers} คน` : null,
            `งบประมาณ ${budgetTHB} บาท`,
            `ความสนใจ: ${interestList.length ? interestList.join(', ') : 'ทั่วไป'}`,
            // ฟอร์มส่งข้อมูลครบแล้ว บอก AI ให้จัดแผนเลยแทนการถามซ้ำ
            tripType && Number.isInteger(days)
                ? `ข้อมูลครบแล้ว ช่วยจัดแผนเลย โดย itinerary ต้องมี ${days} รายการ (day 1 ถึง day ${days}) ห้ามขาดวันใด`
                : null,
        ].filter(Boolean).join(' ');
        const userMessage = message && message.trim()
            ? `${message.trim()}\n\n(ข้อมูลทริปปัจจุบัน: ${details})`
            : details;

        const { generateTravelResponse } = await getTravelAi();
        const request = { message: userMessage, history: history ?? [], places: selection.places };
        let aiResponse;
        try {
            aiResponse = await generateTravelResponse(request);
        } catch (error) {
            // ไม่ลองซ้ำทันที เพราะโควตาต่อนาทีของ Groq มักเต็มจากคำขอแรก
            // error ที่ไม่มี status มาจากตัวตรวจ JSON ของ ai-engine (เช่น จำนวนวันไม่ครบ)
            if (error?.status || error?.error) throw error;
            throw Object.assign(new Error(error?.message), { aiInvalid: true });
        }

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
                originPoint: placeStore.areaPoint(selection.originArea),
                destinationPoint: placeStore.areaPoint(selection.destinationArea),
                corridorProvinces: selection.corridor.map((p) => p.nameTh),
                attribution: selection.hasOsm ? OSM_ATTRIBUTION : null,
            },
        });

    } catch (error) {
        console.error("AI Engine API Error:", error?.status ?? '', error?.error?.error?.code ?? '', error?.message ?? error);
        // Groq แผนฟรีจำกัด token ต่อนาที: แจ้งให้รอแทนข้อความ error ทั่วไป
        if (error?.status === 429) {
            return res.status(503).json({ success: false, error: 'AI ใช้โควตาต่อนาทีเต็มแล้ว กรุณารอประมาณ 1 นาทีแล้วลองใหม่' });
        }
        if (error?.error?.error?.code === 'json_validate_failed') {
            return res.status(502).json({ success: false, error: 'AI ตอบกลับไม่ครบ (อาจเพราะโควตาต่อนาทีใกล้เต็ม) กรุณารอสักครู่แล้วลองใหม่' });
        }
        if (String(error?.message).includes('GROQ_API_KEY')) {
            // ลืมตั้ง GROQ_API_KEY (เช่น ใน Vercel Environment Variables)
            return res.status(503).json({ success: false, error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GROQ_API_KEY จึงยังใช้ AI ไม่ได้' });
        }
        if (error?.aiInvalid) {
            // AI ส่งแผนที่ไม่ผ่านตัวตรวจของ ai-engine
            return res.status(502).json({ success: false, error: 'AI จัดแผนไม่ครบ กรุณารอประมาณ 1 นาทีแล้วลองใหม่' });
        }
        res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการประมวลผลของ AI Engine" });
    }
});

export default app;
