
import "dotenv/config";
import { generateTravelResponse } from "./travel-ai.js";

const places = [
  {
    id: "place_001",
    name: "วัดพระธาตุดอยสุเทพ",
    province: "เชียงใหม่",
    type: "attraction",
  },
  {
    id: "place_002",
    name: "อุทยานแห่งชาติดอยอินทนนท์",
    province: "เชียงใหม่",
    type: "attraction",
  },
];

try {
  const result = await generateTravelResponse({
    message:
      "ช่วยจัดทริปเที่ยวเดียวจากกรุงเทพฯ ไปเชียงใหม่ 3 วัน " +
      "ขับรถส่วนตัว 2 คน งบ 10000 บาท ชอบธรรมชาติ " +
      "ยังไม่กำหนดวันที่แน่นอน ขอแผนเบื้องต้น",
    history: [],
    places: [],
  });

  console.log("\n=== ROAD TRIP WITH PLACES ===");
  console.log(JSON.stringify(result, null, 2));

  const stopNames = result.itinerary.flatMap(
    (day) => day.stops.map((stop) => stop.name)
  );

  const allowedNames = places.map((place) => place.name);

  const unknownNames = stopNames.filter(
    (name) => !allowedNames.includes(name)
  );

  console.log("\n=== ตรวจสอบผลลัพธ์ ===");
  console.log("สถานะ:", result.status);
  console.log("จำนวนวัน:", result.itinerary.length);
  console.log("สถานที่ที่ AI เลือก:", stopNames);
  console.log("สถานที่นอกรายการ:", unknownNames);

  console.log(
    unknownNames.length === 0
      ? "PASS: ไม่มีชื่อสถานที่นอกรายการ"
      : "FAIL: AI ใช้สถานที่นอกเหนือจากข้อมูลที่ให้"
  );
} catch (error) {
  console.error("เกิดข้อผิดพลาด:", error.message);
}
