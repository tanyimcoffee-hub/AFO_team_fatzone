const API_BASE_URL = window.TRAVEL_API_BASE_URL || "http://localhost:3000";

const form = document.getElementById("plan-form");
const submitButton = document.getElementById("submit-button");
const statusElement = document.getElementById("request-status");
const resultElement = document.getElementById("plan-result");
const placesStatusElement = document.getElementById("places-status");
const placesListElement = document.getElementById("places-list");

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

function renderPlan(data) {
  resultElement.replaceChildren();
  resultElement.classList.remove("hidden");

  appendTextElement(resultElement, "h2", "ผลตอบกลับจาก API");
  appendTextElement(
    resultElement,
    "p",
    "ข้อมูลจำลองจาก API ปัจจุบัน — ยังไม่ใช่แผนที่สร้างโดย AI และไม่ได้ตรวจสอบสถานที่หรือเส้นทางจริง.",
    "notice"
  );

  const plan = data.data;
  appendTextElement(
    resultElement,
    "p",
    `ทริป: ${plan.origin} → ${plan.destination}`
  );
  appendTextElement(
    resultElement,
    "p",
    `${plan.days} วัน · งบประมาณ ${Number(plan.budgetTHB).toLocaleString("th-TH")} บาท`
  );

  if (!Array.isArray(plan.stops)) {
    appendTextElement(resultElement, "p", "API ส่งรูปแบบรายการจุดแวะไม่ถูกต้อง", "status error");
    return;
  }

  for (const stop of plan.stops) {
    const section = document.createElement("section");
    section.className = "result-day";
    appendTextElement(section, "h3", `รายการตัวอย่าง · วันที่ ${stop.day ?? "ไม่ระบุ"}`);
    if (typeof stop.location === "string") appendTextElement(section, "p", stop.location);
    if (typeof stop.description === "string") {
      appendTextElement(section, "p", stop.description, "muted");
    }
    resultElement.append(section);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const payload = {
    origin: String(formData.get("origin")).trim(),
    destination: String(formData.get("destination")).trim(),
    days: Number(formData.get("days")),
    budgetTHB: Number(formData.get("budgetTHB")),
    interests: formData.getAll("interests").map(String),
  };

  submitButton.disabled = true;
  resultElement.replaceChildren();
  resultElement.classList.add("hidden");
  setStatus("กำลังติดต่อ API วางแผน…");

  try {
    const response = await fetch(`${API_BASE_URL}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    if (!result.success || !result.data || typeof result.data !== "object") {
      throw new Error("API ไม่ได้ส่งผลลัพธ์แผนในรูปแบบที่คาดไว้");
    }

    setStatus("ได้รับคำตอบแล้ว โปรดทราบว่าข้อมูลนี้เป็นผลจำลองจาก API");
    renderPlan(result);
  } catch (error) {
    setStatus(
      `เรียก API ไม่สำเร็จ: ${error.message}. ตรวจสอบว่า services/api กำลังทำงานและเปิด CORS ไว้`,
      true
    );
  } finally {
    submitButton.disabled = false;
  }
});

loadPlaces();
