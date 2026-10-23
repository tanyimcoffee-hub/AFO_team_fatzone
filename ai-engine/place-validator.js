
export function validateItineraryPlaces(itinerary, places) {
  if (!Array.isArray(itinerary)) {
    throw new Error("itinerary ต้องเป็น Array");
  }

  if (!Array.isArray(places)) {
    throw new Error("places ต้องเป็น Array");
  }

  const placeMap = new Map(
    places
      .filter(
        (place) =>
          place &&
          typeof place.id === "string" &&
          typeof place.name === "string" &&
          typeof place.type === "string"
      )
      .map((place) => [place.id, place])
  );

  return itinerary.map((day) => {
    if (!day || !Array.isArray(day.stops)) {
      throw new Error("โครงสร้าง stops ไม่ถูกต้อง");
    }

    const checkedStops = [];

    for (const stop of day.stops) {
      if (!stop || typeof stop.placeId !== "string") {
        continue;
      }

      const matchedPlace = placeMap.get(stop.placeId);

      // ไม่พบรหัสสถานที่ใน places ให้ตัดออก
      if (!matchedPlace) {
        continue;
      }

      checkedStops.push({
        placeId: matchedPlace.id,
        name: matchedPlace.name,
        type: matchedPlace.type,
        description:
          typeof stop.description === "string"
            ? stop.description
            : "",
        verified: false,
      });
    }

    return {
      ...day,
      stops: checkedStops,
    };
  });
}
