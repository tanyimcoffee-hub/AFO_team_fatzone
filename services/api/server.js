import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// GROQ_API_KEY ถูกโหลดใน travel-ai.js จาก ai-engine/.env แล้ว
// ไฟล์นี้ใช้ dotenv เฉพาะตัวแปรของ server เอง เช่น PORT (อ่านจาก .env ในโฟลเดอร์ที่รัน)
dotenv.config();

import { generateTravelResponse } from '../../ai-engine/travel-ai.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ฟังก์ชันโหลดข้อมูลสถานที่จากไฟล์ places_bkk_cnx.json
// __dirname = API/services/api  ->  ../../thai-travel-ai/places_bkk_cnx.json
const loadPlacesData = () => {
    try {
        const filePath = path.resolve(__dirname, '../../thai-travel-ai/places_bkk_cnx.json');
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(rawData);
        }
        console.warn("ไม่พบไฟล์สถานที่ที่:", filePath);
        return [];
    } catch (error) {
        console.error("ไม่สามารถโหลดไฟล์สถานที่ได้:", error);
        return [];
    }
};

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'AI Travel Planner API is running!' });
});

app.post('/api/plan', async (req, res) => {
    try {
        const { origin, destination, days, budgetTHB, interests } = req.body;

        if (!origin || !destination) {
            return res.status(400).json({ success: false, error: 'กรุณาระบุจุดเริ่มต้นและจุดหมายปลายทาง' });
        }

        const availablePlaces = loadPlacesData();
        const userMessage = `อยากเที่ยวจาก ${origin} ไป ${destination} เป็นเวลา ${days} วัน งบประมาณ ${budgetTHB} บาท ความสนใจ: ${interests ? interests.join(', ') : 'ทั่วไป'}`;

        const aiResponse = await generateTravelResponse({
            message: userMessage,
            history: [],
            places: availablePlaces,
        });

        res.json({
            success: true,
            message: "สร้างแผนเที่ยวด้วย AI และข้อมูลจริงสำเร็จ",
            data: aiResponse
        });

    } catch (error) {
        console.error("AI Engine API Error:", error);
        res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในการประมวลผลของ AI Engine" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server is running on http://localhost:${PORT}`);
});