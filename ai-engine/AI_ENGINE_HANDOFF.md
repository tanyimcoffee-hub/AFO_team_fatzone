# Thai Travel AI — AI Engine Handoff

## 1. Overview

AI Engine สำหรับ Thai Travel AI ทำหน้าที่สนทนากับผู้ใช้และสร้างแผน Road Trip ในประเทศไทย โดยใช้ Groq API

ระบบนี้เป็นโมดูล JavaScript สำหรับให้ Backend เรียกใช้งาน ไม่จำเป็นต้องรัน Chatbot ผ่าน Terminal ในการใช้งานจริง

## 2. Technology

- Node.js (ES Modules)
- Groq SDK
- Model: `openai/gpt-oss-20b`
- dotenv
- JSON response

## 3. Main Files

| File | Description |
|---|---|
| `travel-ai.js` | AI Engine หลัก |
| `system-prompt.md` | กฎและพฤติกรรมของ AI |
| `place-validator.js` | ตรวจสอบสถานที่ในแผน |
| `response-validator.js` | ตรวจสอบโครงสร้าง JSON |
| `test-travel-ai.js` | Integration test |
| `test-place-validator.js` | Place validation test |
| `test-response-validator.js` | JSON validation test |

## 4. Installation

เปิด Terminal ในโฟลเดอร์ `ai-engine`

```bash
npm install
```

สร้างไฟล์ `.env` ภายใน `ai-engine` และกำหนด:

```env
GROQ_API_KEY=YOUR_API_KEY
```

ห้าม Commit ไฟล์ `.env` หรือเผยแพร่ API Key

## 5. Backend Integration

เรียกใช้ฟังก์ชันจาก `travel-ai.js`

```javascript
import { generateTravelResponse } from "./travel-ai.js";

const result = await generateTravelResponse({
  message: "อยากเที่ยวเชียงใหม่ 3 วัน",
  history: [],
  places: [],
});

console.log(result);
```

`history` ใช้เก็บบทสนทนาก่อนหน้า ส่วน `places` เป็นรายการสถานที่ที่ Backend ส่งให้ AI เลือกใช้

Backend ควรเก็บ API Key ไว้ฝั่ง Server เท่านั้น ห้ามเรียก Groq API โดยตรงจาก Browser

## 6. Response Structure

ผลลัพธ์เป็น JavaScript Object ที่มีโครงสร้างหลักดังนี้:

```json
{
  "reply": "ข้อความตอบผู้ใช้",
  "status": "need_more_info",
  "trip": {
    "origin": null,
    "destination": null,
    "days": null,
    "travelers": null,
    "budget": null,
    "interests": [],
    "tripType": null
  },
  "itinerary": []
}
```

ค่าของ `status` ได้แก่ `need_more_info` และ `ready`

ค่าของ `tripType` ได้แก่ `one_way`, `round_trip` และ `null`

เมื่อ `status` เป็น `ready` ระบบจะส่งแผนเที่ยวรายวันผ่าน `itinerary`

## 7. Place Data

Backend สามารถส่งรายการสถานที่ผ่าน `places` โดยแต่ละรายการต้องมีอย่างน้อย:

```json
{
  "id": "place_001",
  "name": "วัดพระธาตุดอยสุเทพ",
  "province": "เชียงใหม่",
  "type": "attraction"
}
```

สถานที่ที่ AI เลือกจะเชื่อมกับข้อมูลผ่าน `placeId` และถูกตรวจสอบโดย Place Validator

หากไม่มีข้อมูลสถานที่ (`places: []`) ระบบจะไม่ส่งสถานที่ที่ไม่ได้รับอนุญาตใน `stops`

## 8. Testing

ทดสอบ Validator โดยไม่เรียก Groq API:

```bash
npm test
```

ทดสอบการทำงานร่วมกับ Groq API:

```bash
npm run test:integration
```

Integration test ต้องมี `GROQ_API_KEY` ที่ใช้งานได้ และมีการใช้โควตา API

## 9. Important Limitations

- ระบบยังไม่ยืนยันระยะทางและเวลาเดินทางจากบริการแผนที่จริง
- ราคา เวลาเปิดปิด และสถานะการจองยังไม่ได้รับการตรวจสอบแบบเรียลไทม์
- `verified: false` หมายถึงข้อมูลสถานที่ยังไม่ได้รับการยืนยัน
- Backend ควรตรวจสอบข้อมูลเส้นทางและสถานที่ก่อนแสดงผลจริง
- AI อาจสร้างแผนที่ไม่สมเหตุสมผล จึงควรมีการตรวจสอบเพิ่มเติมก่อนใช้งานจริง

## 10. Handoff Status

- Groq API integration: Tested
- Structured JSON: Tested
- Response Validator: Tested
- Place Validator: Tested
- Road Trip Planner: Tested with sample scenarios
- Web application integration: Pending Backend team
- Real map and route verification: Pending integration
