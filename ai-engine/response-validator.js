
export function validateTravelResponse(result) {
  if (
    !result ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    typeof result.reply !== "string" ||
    !["need_more_info", "ready"].includes(result.status) ||
    !result.trip ||
    typeof result.trip !== "object" ||
    Array.isArray(result.trip) ||
    !Array.isArray(result.trip.interests) ||
    !Array.isArray(result.itinerary)
  ) {
    throw new Error("โครงสร้าง JSON จาก AI ไม่ถูกต้อง");
  }

  const allowedTripTypes = ["one_way", "round_trip", null];

  if (!allowedTripTypes.includes(result.trip.tripType)) {
    throw new Error("tripType ไม่ถูกต้อง");
  }

  if (
    result.trip.days !== null &&
    (!Number.isInteger(result.trip.days) || result.trip.days <= 0)
  ) {
    throw new Error("จำนวนวันเดินทางไม่ถูกต้อง");
  }

  if (
    result.status === "need_more_info" &&
    result.itinerary.length !== 0
  ) {
    throw new Error("ยังขาดข้อมูล แต่ AI ส่งแผนเที่ยวมา");
  }

  if (result.status === "ready") {
    if (
      result.trip.tripType === null ||
      !Number.isInteger(result.trip.days) ||
      result.itinerary.length !== result.trip.days
    ) {
      throw new Error("จำนวนวันหรือประเภททริปไม่ถูกต้อง");
    }
  }

  result.itinerary.forEach((day, index) => {
    if (
      !day ||
      typeof day !== "object" ||
      Array.isArray(day) ||
      day.day !== index + 1 ||
      typeof day.title !== "string" ||
      !Array.isArray(day.stops)
    ) {
      throw new Error(
        `โครงสร้างแผนวันที่ ${index + 1} ไม่ถูกต้อง`
      );
    }
  });

  return result;
}
