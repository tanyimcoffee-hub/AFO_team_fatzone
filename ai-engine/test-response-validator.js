
import { validateTravelResponse } from "./response-validator.js";

const validResponse = {
  reply: "จัดแผนเที่ยวเรียบร้อยแล้ว",
  status: "ready",
  trip: {
    origin: "กรุงเทพฯ",
    destination: "เชียงใหม่",
    days: 3,
    travelers: 2,
    budget: 10000,
    interests: ["ธรรมชาติ"],
    tripType: "round_trip",
  },
  itinerary: [
    { day: 1, title: "เดินทางไปเชียงใหม่", stops: [] },
    { day: 2, title: "เที่ยวเชียงใหม่", stops: [] },
    { day: 3, title: "เดินทางกลับ", stops: [] },
  ],
};

function runTest(name, data, shouldPass) {
  try {
    validateTravelResponse(data);

    if (shouldPass) {
      console.log(`PASS: ${name}`);
    } else {
      console.log(`FAIL: ${name} ไม่ควรผ่าน`);
      process.exitCode = 1;
    }
  } catch (error) {
    if (shouldPass) {
      console.log(`FAIL: ${name} - ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`PASS: ${name} (ตรวจพบข้อมูลผิด)`);
    }
  }
}

// 1. JSON ถูกต้อง
runTest("JSON ถูกต้อง", validResponse, true);

// 2. tripType ไม่ถูกต้อง
runTest(
  "tripType ผิด",
  {
    ...validResponse,
    trip: { ...validResponse.trip, tripType: "flying" },
  },
  false
);

// 3. จำนวนวันไม่ตรงกับ itinerary
runTest(
  "จำนวนวันไม่ตรง",
  {
    ...validResponse,
    itinerary: validResponse.itinerary.slice(0, 2),
  },
  false
);

// 4. โครงสร้าง stops ผิด
runTest(
  "stops ไม่ใช่ Array",
  {
    ...validResponse,
    itinerary: [
      { day: 1, title: "วันแรก", stops: null },
      ...validResponse.itinerary.slice(1),
    ],
  },
  false
);
