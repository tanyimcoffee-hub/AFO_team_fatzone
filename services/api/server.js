const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// เปิดใช้งาน CORS และรองรับ JSON
app.use(cors());
app.use(express.json());

// 1. Endpoint สำหรับเช็คว่าเซิร์ฟเวอร์ทำงานอยู่ไหม
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'AI Travel Planner API is running!' });
});

// 2. Endpoint จำลองสำหรับวางแผนเที่ยว (Mock Plan API)
app.post('/api/plan', (req, res) => {
    const { origin, destination, days, budgetTHB, interests } = req.body;

    if (!origin || !destination) {
        return res.status(400).json({ error: 'กรุณาระบุจุดเริ่มต้นและจุดหมายปลายทาง' });
    }

    const mockPlan = {
        origin: origin,
        destination: destination,
        days: days || 3,
        budgetTHB: budgetTHB || 5000,
        travelMode: "road_trip",
        interests: interests || ["ธรรมชาติ"],
        stops: [
            {
                day: 1,
                location: "จุดแวะที่ 1: ร้านกาแฟชมวิว",
                description: "แวะพักดื่มกาแฟระหว่างเดินทางออกจาก " + origin
            },
            {
                day: 1,
                location: "จุดแวะที่ 2: แลนด์มาร์คสำคัญ",
                description: "เที่ยวชมสถานที่ท่องเที่ยวเด่นก่อนถึง " + destination
            }
        ]
    };

    res.json({
        success: true,
        message: "สร้างแผนเที่ยวสำเร็จ (ข้อมูลจำลอง)",
        data: mockPlan
    });
});

// เริ่มเปิดเซิร์ฟเวอร์
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});