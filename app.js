// ตั้งค่า API: window.TRAVEL_API_BASE_URL (ก่อนโหลด app.js) หรือแนบ ?api=http://host:port ใน URL
const API_BASE_URL = (
  new URLSearchParams(window.location.search).get("api") ||
  window.TRAVEL_API_BASE_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");
// AI ใช้เวลาตอบนานกว่า API ทั่วไป
const REQUEST_TIMEOUT_MS = window.TRAVEL_API_TIMEOUT_MS || 60000;
const MAX_DAYS = 30;

const STOP_TYPE_LABELS = {
  attraction: "สถานที่ท่องเที่ยว",
  restaurant: "ร้านอาหาร",
  cafe: "คาเฟ่",
  rest_stop: "จุดพักรถ",
};

const TRIP_TYPE_LABELS = {
  one_way: "เที่ยวเดียว",
  round_trip: "ไป-กลับ",
};

const form = document.getElementById("plan-form");
const submitButton = document.getElementById("submit-button");
const submitLabel = submitButton.querySelector(".btn-label");
const formErrorsElement = document.getElementById("form-errors");
const statusElement = document.getElementById("request-status");
const resultElement = document.getElementById("plan-result");
const placesStatusElement = document.getElementById("places-status");
const placesListElement = document.getElementById("places-list");

let activeRequest = null;

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function appendTextElement(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function validatePlaces(places) {
  if (!Array.isArray(places)) {
    throw new Error("รูปแบบไฟล์สถานที่ต้องเป็น Array");
  }

  const ids = new Set();
  for (const place of places) {
    if (
      !place ||
      typeof place.id !== "string" ||
      !place.id.trim() ||
      typeof place.name !== "string" ||
      !place.name.trim() ||
      typeof place.province !== "string" ||
      !place.province.trim() ||
      typeof place.type !== "string" ||
      !place.type.trim()
    ) {
      throw new Error("พบรายการสถานที่ที่ไม่ตรง schema {id, name, province, type}");
    }
    if (ids.has(place.id)) {
      throw new Error(`พบรหัสสถานที่ซ้ำ: ${place.id}`);
    }
    ids.add(place.id);
  }
  return places;
}

async function loadPlaces() {
  try {
    const response = await fetch("./places_bkk_cnx.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const places = validatePlaces(await response.json());

    if (!places.length) {
      placesStatusElement.textContent =
        "ยังไม่มีข้อมูลสถานที่ที่ยืนยันแหล่งที่มา จึงไม่แสดงชื่อหรือพิกัดที่คาดเดาขึ้น";
      return;
    }

    placesStatusElement.classList.add("hidden");
    for (const place of places) {
      const item = document.createElement("li");
      item.textContent = `${place.name} · ${place.province} · ${place.type}`;
      placesListElement.append(item);
    }
  } catch (error) {
    placesStatusElement.textContent = `โหลดรายการสถานที่ไม่สำเร็จ: ${error.message}`;
    placesStatusElement.classList.add("error");
  }
}

// ---------- ตรวจสอบข้อมูลในฟอร์ม ----------

const VALIDATED_FIELDS = ["origin", "destination", "days", "budget"];

function readForm() {
  const formData = new FormData(form);
  const other = String(formData.get("interestOther") || "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const interests = [...new Set([...formData.getAll("interests").map(String), ...other])];

  return {
    origin: String(formData.get("origin") || "").trim(),
    destination: String(formData.get("destination") || "").trim(),
    daysRaw: String(formData.get("days") || "").trim(),
    budgetRaw: String(formData.get("budgetTHB") || "").trim(),
    interests,
  };
}

function validateForm(values) {
  const errors = [];
  if (!values.origin) errors.push({ id: "origin", message: "กรุณาระบุจุดเริ่มต้น" });
  if (!values.destination) errors.push({ id: "destination", message: "กรุณาระบุจุดหมายปลายทาง" });
  if (values.origin && values.destination && values.origin === values.destination) {
    errors.push({ id: "destination", message: "จุดหมายปลายทางต้องไม่ซ้ำกับจุดเริ่มต้น" });
  }

  const days = Number(values.daysRaw);
  if (!values.daysRaw || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    errors.push({ id: "days", message: `จำนวนวันต้องเป็นจำนวนเต็มระหว่าง 1–${MAX_DAYS}` });
  }

  const budget = Number(values.budgetRaw);
  if (!values.budgetRaw || !Number.isFinite(budget) || budget <= 0) {
    errors.push({ id: "budget", message: "งบประมาณต้องเป็นตัวเลขมากกว่า 0 บาท" });
  }

  return { errors, days, budget };
}

function clearFormErrors() {
  for (const id of VALIDATED_FIELDS) {
    document.getElementById(id).removeAttribute("aria-invalid");
    const errorElement = document.getElementById(`${id}-error`);
    errorElement.textContent = "";
    errorElement.classList.add("hidden");
  }
  formErrorsElement.replaceChildren();
  formErrorsElement.classList.add("hidden");
}

function showFormErrors(errors) {
  const shown = new Set();
  const list = document.createElement("ul");

  for (const error of errors) {
    if (!shown.has(error.id)) {
      document.getElementById(error.id).setAttribute("aria-invalid", "true");
      const errorElement = document.getElementById(`${error.id}-error`);
      errorElement.textContent = error.message;
      errorElement.classList.remove("hidden");
      shown.add(error.id);
    }

    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${error.id}`;
    link.textContent = error.message;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      document.getElementById(error.id).focus();
    });
    item.append(link);
    list.append(item);
  }

  formErrorsElement.replaceChildren();
  appendTextElement(formErrorsElement, "strong", `กรุณาแก้ไขข้อมูล ${errors.length} รายการ`);
  formErrorsElement.append(list);
  formErrorsElement.classList.remove("hidden");
  formErrorsElement.focus();
}

// ---------- เรียก API ----------

// ตรวจโครงสร้างตาม ai-engine/response-validator.js
function isValidAiResponse(data) {
  return (
    !!data &&
    typeof data === "object" &&
    typeof data.reply === "string" &&
    ["need_more_info", "ready"].includes(data.status) &&
    !!data.trip &&
    typeof data.trip === "object" &&
    Array.isArray(data.itinerary) &&
    data.itinerary.every((day) => day && Number.isInteger(day.day) && Array.isArray(day.stops))
  );
}

async function requestPlan(payload) {
  if (activeRequest) activeRequest.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const timer = setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.reason === "timeout") {
        throw new Error("AI ใช้เวลาตอบนานเกินไป กรุณาลองใหม่อีกครั้ง");
      }
      if (controller.signal.aborted) throw error;
      throw new Error(
        `ไม่สามารถเชื่อมต่อ ${API_BASE_URL} ได้ ตรวจสอบว่า services/api กำลังทำงานและเปิด CORS ไว้`
      );
    }

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(
        result && typeof result.error === "string" ? result.error : `เซิร์ฟเวอร์ตอบกลับ HTTP ${response.status}`
      );
    }
    if (!result || result.success !== true || !isValidAiResponse(result.data)) {
      throw new Error("API ไม่ได้ส่งผลลัพธ์แผนในรูปแบบที่คาดไว้");
    }
    return result;
  } finally {
    clearTimeout(timer);
    if (activeRequest === controller) activeRequest = null;
  }
}

// ---------- แสดงผล ----------

function formatTHB(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? `${number.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`
    : "-";
}

function renderTripSummary(parent, trip, payload) {
  const origin = trip.origin || payload.origin;
  const destination = trip.destination || payload.destination;
  const days = trip.days || payload.days;
  const interests = Array.isArray(trip.interests) && trip.interests.length ? trip.interests : payload.interests;

  const rows = [
    ["เส้นทาง", `${origin} → ${destination}`],
    ["ระยะเวลา", `${days} วัน`],
    ["งบประมาณ", formatTHB(trip.budget ?? payload.budgetTHB)],
    ["ประเภททริป", TRIP_TYPE_LABELS[trip.tripType] || "ยังไม่ระบุ"],
    ["ความสนใจ", interests.length ? interests.join(", ") : "-"],
  ];
  if (Number.isInteger(trip.travelers)) rows.push(["ผู้เดินทาง", `${trip.travelers} คน`]);

  const list = document.createElement("dl");
  list.className = "trip-summary";
  for (const [label, value] of rows) {
    const wrapper = document.createElement("div");
    appendTextElement(wrapper, "dt", label);
    appendTextElement(wrapper, "dd", value);
    list.append(wrapper);
  }
  parent.append(list);
}

function renderItinerary(parent, itinerary) {
  const list = document.createElement("ol");
  list.className = "days";
  list.setAttribute("aria-label", "แผนเที่ยวรายวัน");

  for (const day of itinerary) {
    const item = document.createElement("li");
    item.className = "result-day";
    const headingId = `day-${day.day}`;
    item.setAttribute("aria-labelledby", headingId);

    const title = typeof day.title === "string" && day.title.trim() ? ` · ${day.title}` : "";
    appendTextElement(item, "h3", `วันที่ ${day.day}${title}`).id = headingId;

    if (!day.stops.length) {
      appendTextElement(item, "p", "ยังไม่มีสถานที่ที่ยืนยันได้สำหรับวันนี้", "muted");
    } else {
      const stops = document.createElement("ul");
      for (const stop of day.stops) {
        const stopItem = document.createElement("li");
        appendTextElement(stopItem, "span", stop.name || "ไม่ระบุชื่อ", "stop-name");
        if (STOP_TYPE_LABELS[stop.type]) appendTextElement(stopItem, "span", ` (${STOP_TYPE_LABELS[stop.type]})`, "muted");
        if (stop.verified !== true) appendTextElement(stopItem, "span", "ยังไม่ได้ตรวจสอบ", "badge");
        if (stop.description) appendTextElement(stopItem, "p", stop.description, "muted");
        stops.append(stopItem);
      }
      item.append(stops);
    }

    if (typeof day.notes === "string" && day.notes.trim()) {
      appendTextElement(item, "p", `หมายเหตุ: ${day.notes}`, "muted");
    }
    list.append(item);
  }
  parent.append(list);
}

function renderPlan(result, payload) {
  const plan = result.data;
  resultElement.replaceChildren();
  resultElement.classList.remove("hidden");

  const heading = appendTextElement(
    resultElement,
    "h2",
    plan.status === "ready" ? "แผนการเดินทางรายวัน" : "AI ต้องการข้อมูลเพิ่มเติม"
  );
  heading.id = "result-heading";
  heading.tabIndex = -1;

  if (plan.reply) appendTextElement(resultElement, "p", plan.reply, "ai-reply");

  renderTripSummary(resultElement, plan.trip, payload);

  if (plan.status === "ready" && plan.itinerary.length) {
    renderItinerary(resultElement, plan.itinerary);
  } else if (plan.status === "ready") {
    appendTextElement(resultElement, "p", "AI ยังไม่ได้ส่งแผนรายวันกลับมา", "empty");
  }

  heading.focus();
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
  submitLabel.textContent = isLoading ? "AI กำลังวางแผน…" : "สร้างแผนเที่ยว";
  resultElement.setAttribute("aria-busy", String(isLoading));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormErrors();

  const values = readForm();
  const { errors, days, budget } = validateForm(values);
  if (errors.length) {
    showFormErrors(errors);
    return;
  }

  const payload = {
    origin: values.origin,
    destination: values.destination,
    days,
    budgetTHB: budget,
    interests: values.interests,
  };

  setLoading(true);
  resultElement.replaceChildren();
  resultElement.classList.add("hidden");
  setStatus("AI กำลังสร้างแผนเที่ยว อาจใช้เวลาสักครู่…");

  try {
    const result = await requestPlan(payload);
    setStatus(
      result.data.status === "ready"
        ? `สร้างแผนเที่ยว ${payload.origin} → ${payload.destination} เรียบร้อย`
        : "AI ตอบกลับแล้ว แต่ยังต้องการข้อมูลเพิ่มเติม"
    );
    renderPlan(result, payload);
  } catch (error) {
    if (error && error.name === "AbortError") return; // ถูกแทนที่ด้วยคำขอใหม่
    setStatus(`เรียก API ไม่สำเร็จ: ${error.message}`, true);
  } finally {
    setLoading(false);
  }
});

loadPlaces();
