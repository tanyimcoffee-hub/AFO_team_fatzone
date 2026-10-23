
import { validateItineraryPlaces } from "./place-validator.js";

const places = [
  {
    id: "place_001",
    name: "วัดพระธาตุดอยสุเทพ",
    province: "เชียงใหม่",
    type: "attraction",
  },
];

const itinerary = [
  {
    day: 1,
    title: "เที่ยวเชียงใหม่",
    stops: [
      {
        placeId: "place_001",
        name: "ชื่อที่ AI ส่งมาผิด",
        type: "cafe",
        description: "ชมวิวเชียงใหม่",
        verified: true,
      },
      {
        placeId: "place_999",
        name: "คาเฟ่สมมติ",
        type: "cafe",
        description: "สถานที่ที่ไม่มีในรายการ",
        verified: true,
      },
    ],
  },
];

const result = validateItineraryPlaces(itinerary, places);

console.log("\n=== ผลการตรวจสอบสถานที่ ===");
console.log(JSON.stringify(result, null, 2));

const stops = result[0].stops;

const passed =
  stops.length === 1 &&
  stops[0].placeId === "place_001" &&
  stops[0].name === "วัดพระธาตุดอยสุเทพ" &&
  stops[0].type === "attraction" &&
  stops[0].verified === false;

console.log(
  passed
    ? "\nPASS: กรองรหัสปลอมและแก้ชื่อสถานที่สำเร็จ"
    : "\nFAIL: ผลการตรวจสอบไม่ถูกต้อง"
);