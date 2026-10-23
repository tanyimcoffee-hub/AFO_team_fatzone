import { validateItineraryPlaces } from "./place-validator.js";
import { validateTravelResponse } from "./response-validator.js";
import Groq from "groq-sdk";
import "dotenv/config";
import { readFile } from "node:fs/promises";



const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemPrompt = await readFile(
  new URL("./system-prompt.md", import.meta.url),
  "utf8"
);

const jsonInstructions = `
ตอบกลับเป็น JSON object เท่านั้น ไม่ต้องใส่ Markdown
ใช้โครงสร้างดังนี้:
{
  "reply": "ข้อความตอบผู้ใช้เป็นภาษาไทย",
  "status": "need_more_info หรือ ready",
  
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

กฎ:
- ใช้ข้อมูลจากประวัติสนทนาร่วมกับข้อความล่าสุด
- หากไม่ทราบข้อมูล ให้ใช้ null ห้ามเดา
- budget เป็นจำนวนเงินบาททั้งหมดของทริป
- days และ travelers เป็นจำนวนเต็ม
- interests เป็น Array ของข้อความ
- status ต้องเป็น need_more_info หรือ ready เท่านั้น
- หากข้อมูลยังไม่พอ ให้ถามเพิ่มทีละข้อ
- เมื่อมีข้อมูลเพียงพอ ให้ใช้ status ready
- หาก status เป็น need_more_info ให้ itinerary เป็น []
- หาก status เป็น ready และทราบจำนวนวัน ให้สร้าง itinerary ตามจำนวนวันที่ผู้ใช้ระบุ
- itinerary ต้องเป็น Array ของแผนเที่ยวรายวัน
- แต่ละวันต้องมีโครงสร้างดังนี้:
  {
    "day": 1,
    "title": "ชื่อแผนเที่ยวประจำวัน",
    "stops": [
      {
        "placeId": "รหัสสถานที่จาก places",
        "name": "ชื่อสถานที่",
        "type": "attraction",
        "description": "เหตุผลที่แนะนำสถานที่นี้",
        "verified": false
      }
    ],
    "notes": "ข้อควรระวังหรือข้อมูลที่ต้องตรวจสอบ"
  }
- day ต้องเรียงตั้งแต่ 1 ถึงจำนวนวันของทริป
- type ของสถานที่ใช้ attraction, restaurant, cafe หรือ rest_stop
- ห้ามสร้างชื่อสถานที่สมมติขึ้นมา
- หากไม่มีข้อมูลยืนยันสถานที่ ให้กำหนด verified เป็น false
- อย่าระบุระยะทาง เวลาเดินทาง ราคา หรือเวลาเปิดปิดที่ไม่ได้ตรวจสอบ
- จัดแผนให้เหมาะกับการเดินทางแบบ Road Trip โดยคำนึงถึงการพักขับรถ
- แผนที่สร้างโดยไม่มีเครื่องมือข้อมูลสถานที่และเส้นทางจริงเป็นเพียงแผนเบื้องต้น
- ห้ามอ้างว่าได้ตรวจสอบเส้นทางหรือสถานที่แล้วหากยังไม่ได้ใช้เครื่องมือจริง
- ห้ามใส่ข้อความนอก JSON

กฎความน่าเชื่อถือของสถานที่:
- ห้ามสร้างชื่อร้านอาหาร คาเฟ่ โรงแรม หรือสถานที่ท่องเที่ยวขึ้นเอง
- หากไม่มั่นใจว่าชื่อสถานที่มีอยู่จริง ห้ามใส่ชื่อนั้นใน stops
- สามารถแนะนำกิจกรรมหรือย่านที่ควรสำรวจใน notes แทนได้
- หากไม่มีสถานที่ที่มั่นใจให้แนะนำ ให้ stops เป็น []
- ห้ามใช้ชื่อสมมติ เช่น "คาเฟ่ A", "ร้านอาหารท้องถิ่นชื่อดัง" หรือ "จุดพักรถชื่อดัง" เป็นชื่อสถานที่
- verified ต้องเป็น false เสมอ จนกว่าจะมีข้อมูลยืนยันจากเครื่องมือภายนอก
- verified: false ไม่ได้หมายความว่าสถานที่ไม่มีอยู่จริง แต่หมายถึงยังไม่ได้ตรวจสอบ
- อย่าอ้างว่าสถานที่เปิดให้บริการอยู่ในปัจจุบัน หากไม่มีข้อมูลยืนยัน
- อย่าอ้างว่าจุดแวะอยู่บนเส้นทางที่เหมาะสมที่สุด หากยังไม่ได้ตรวจสอบเส้นทาง

- trip.tripType ต้องเป็น "one_way", "round_trip" หรือ null เท่านั้น
- หากผู้ใช้ระบุว่าไป-กลับ ให้ใช้ "round_trip"
- หากผู้ใช้ระบุว่าเที่ยวเดียว ให้ใช้ "one_way"
- หากผู้ใช้ยังไม่ระบุประเภทการเดินทาง ให้ใช้ null และถามเพิ่มเติมก่อนจัดแผนรายวัน
- หาก trip.tripType เป็น null ให้ status เป็น "need_more_info" และ itinerary เป็น []

กฎการใช้ placeId:
- ทุกสถานที่ใน stops ต้องมี placeId
- placeId ต้องตรงกับ id ของสถานที่ใน places ที่ระบบส่งมาเท่านั้น
- name ต้องตรงกับชื่อสถานที่ใน places ที่มี id เดียวกัน
- ห้ามสร้าง placeId ขึ้นเอง
- ห้ามใช้สถานที่ที่ไม่มีอยู่ใน places
- หาก places เป็น [] ให้ stops เป็น [] ทุกวัน
- หากไม่มีสถานที่ที่เหมาะสมกับแผน ให้ stops เป็น []
- การมี placeId ไม่ได้แปลว่าสถานที่ผ่านการตรวจสอบข้อมูลจริงแล้ว

`;


export async function generateTravelResponse({
  message,
  history = [],
  places = [],
}) {
  if (typeof message !== "string" || !message.trim()) {
    throw new Error("กรุณาระบุข้อความสำหรับ AI");
  }

  if (!Array.isArray(history)) {
    throw new Error("history ต้องเป็น Array");
  }

  
if (!Array.isArray(places)) {
  throw new Error("places ต้องเป็น Array");
}

const validPlaces = places.filter(
  (place) =>
    place &&
    typeof place.id === "string" &&
    typeof place.name === "string" &&
    typeof place.province === "string" &&
    typeof place.type === "string"
);

const placesContext = `
ข้อมูลสถานที่ที่ระบบส่งมาให้:
${JSON.stringify(validPlaces, null, 2)}

กฎการใช้สถานที่:
- ใช้เฉพาะสถานที่ในรายการนี้เมื่อสร้าง stops
- ห้ามสร้างชื่อสถานที่ใหม่ขึ้นเอง
- หากไม่มีสถานที่ที่เหมาะสม ให้ stops เป็น []
- ห้ามถือว่าข้อมูลนี้ผ่านการตรวจสอบแล้วโดยอัตโนมัติ
- หากไม่มีหลักฐานยืนยัน ให้ verified เป็น false
`;
  
const validHistory = history.filter(
  (item) =>
    item &&
    ["user", "assistant"].includes(item.role) &&
    typeof item.content === "string"
);

    const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [
      {
        role: "system",
        
content:
  systemPrompt +
  "\n" +
  jsonInstructions +
  "\n" +
  placesContext,

      },
      ...validHistory,
      { role: "user", content: message.trim() },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("AI ไม่ส่งข้อมูลกลับมา");
  }

  let result;

  try {
    result = JSON.parse(content);
  } catch {
    throw new Error("AI ส่ง JSON ไม่ถูกต้อง");
  }

    
  // ตรวจสอบโครงสร้าง JSON
  validateTravelResponse(result);


  // ตรวจสอบสถานที่ก่อนส่งข้อมูลให้ Backend
  result.itinerary = validateItineraryPlaces(
    result.itinerary,
    validPlaces
  );


  return result;

}
