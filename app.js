// ตั้งค่า API: window.TRAVEL_API_BASE_URL (ก่อนโหลด app.js) หรือแนบ ?api=http://host:port ใน URL
const API_BASE_URL = (
  new URLSearchParams(window.location.search).get("api") ||
  window.TRAVEL_API_BASE_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");
// AI ใช้เวลาตอบนานกว่า API ทั่วไป
const REQUEST_TIMEOUT_MS = window.TRAVEL_API_TIMEOUT_MS || 60000;
const MAX_DAYS = 30;
const MAX_CHAT_ITEMS = 30;
const MAX_MAP_STOPS = 6;
const DEFAULT_ORIGIN = "กรุงเทพมหานคร";

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

// 77 จังหวัด แบ่งตาม 6 ภูมิภาค
const REGIONS = {
  north: {
    label: "ภาคเหนือ",
    provinces: ["เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน", "น่าน", "พะเยา", "แพร่", "อุตรดิตถ์"],
  },
  northeast: {
    label: "ภาคตะวันออกเฉียงเหนือ",
    provinces: ["กาฬสินธุ์", "ขอนแก่น", "ชัยภูมิ", "นครพนม", "นครราชสีมา", "บึงกาฬ", "บุรีรัมย์", "มหาสารคาม", "มุกดาหาร", "ยโสธร", "ร้อยเอ็ด", "เลย", "ศรีสะเกษ", "สกลนคร", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อุดรธานี", "อุบลราชธานี", "อำนาจเจริญ"],
  },
  central: {
    label: "ภาคกลาง",
    provinces: ["กรุงเทพมหานคร", "กำแพงเพชร", "ชัยนาท", "นครนายก", "นครปฐม", "นครสวรรค์", "นนทบุรี", "ปทุมธานี", "พระนครศรีอยุธยา", "พิจิตร", "พิษณุโลก", "เพชรบูรณ์", "ลพบุรี", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สระบุรี", "อ่างทอง", "อุทัยธานี"],
  },
  east: {
    label: "ภาคตะวันออก",
    provinces: ["จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ตราด", "ปราจีนบุรี", "ระยอง", "สระแก้ว"],
  },
  west: {
    label: "ภาคตะวันตก",
    provinces: ["กาญจนบุรี", "ตาก", "ประจวบคีรีขันธ์", "เพชรบุรี", "ราชบุรี"],
  },
  south: {
    label: "ภาคใต้",
    provinces: ["กระบี่", "ชุมพร", "ตรัง", "นครศรีธรรมราช", "นราธิวาส", "ปัตตานี", "พังงา", "พัทลุง", "ภูเก็ต", "ยะลา", "ระนอง", "สงขลา", "สตูล", "สุราษฎร์ธานี"],
  },
};

// แผนสำเร็จรูป: กดแล้วกรอกฟอร์มให้ ผู้ใช้แก้ไขได้ก่อนส่ง
const TRIP_TEMPLATES = [
  { destination: "จันทบุรี", days: 2, budgetTHB: 5000, interest: "อาหาร" },
  { destination: "เชียงใหม่", days: 3, budgetTHB: 9000, interest: "คาเฟ่" },
  { destination: "เชียงราย", days: 4, budgetTHB: 12000, interest: "ภูเขา" },
  { destination: "น่าน", days: 4, budgetTHB: 11000, interest: "วัฒนธรรม" },
  { destination: "พระนครศรีอยุธยา", days: 1, budgetTHB: 2000, interest: "วัฒนธรรม" },
  { destination: "กาญจนบุรี", days: 2, budgetTHB: 5000, interest: "ธรรมชาติ" },
  { destination: "นครราชสีมา", days: 2, budgetTHB: 5000, interest: "ธรรมชาติ" },
  { destination: "ระยอง", days: 2, budgetTHB: 5000, interest: "ทะเล" },
  { destination: "ประจวบคีรีขันธ์", days: 3, budgetTHB: 8000, interest: "ทะเล" },
  { destination: "ภูเก็ต", days: 4, budgetTHB: 15000, interest: "ทะเล" },
  { destination: "กระบี่", days: 3, budgetTHB: 12000, interest: "ทะเล" },
  { destination: "สุโขทัย", days: 2, budgetTHB: 6000, interest: "วัฒนธรรม" },
  { destination: "แม่ฮ่องสอน", days: 5, budgetTHB: 15000, interest: "ภูเขา" },
  { destination: "ขอนแก่น", days: 3, budgetTHB: 7000, interest: "อาหาร" },
];

const DEMO_MAP_STOPS = ["ปั๊มน้ำมัน", "ร้านอาหาร", "แลนด์มาร์ก", "ปั๊มน้ำมัน"];

const form = document.getElementById("plan-form");
const submitButton = document.getElementById("submit-button");
const submitLabel = submitButton.querySelector(".btn-label");
const formErrorsElement = document.getElementById("form-errors");
const statusElement = document.getElementById("request-status");
const chatLog = document.getElementById("chat-log");
const placesStatusElement = document.getElementById("places-status");
const placesListElement = document.getElementById("places-list");
const routePath = document.getElementById("route-path");
const routePins = document.getElementById("route-pins");
const routeCar = document.getElementById("route-car");
const routeCaption = document.getElementById("route-caption");

const SVG_NS = "http://www.w3.org/2000/svg";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let activeRequest = null;
let typingBubble = null;

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

// ---------- แชต ----------

function addBubble(kind, extraClass = "") {
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble-${kind}${extraClass ? ` ${extraClass}` : ""}`;
  chatLog.append(bubble);
  while (chatLog.children.length > MAX_CHAT_ITEMS) chatLog.firstElementChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

function showTyping() {
  hideTyping();
  typingBubble = addBubble("ai", "bubble-typing");
  typingBubble.setAttribute("aria-hidden", "true");
  typingBubble.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
}

function hideTyping() {
  if (typingBubble) typingBubble.remove();
  typingBubble = null;
}

function describeRequest(payload) {
  const interests = payload.interests.length ? ` ชอบ${payload.interests.join(", ")}` : "";
  return `อยากเที่ยวจาก ${payload.origin} ไป ${payload.destination} ${payload.days} วัน งบ ${formatTHB(payload.budgetTHB)}${interests}`;
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

function renderItinerary(parent, itinerary, idPrefix) {
  const list = document.createElement("ol");
  list.className = "days";
  list.setAttribute("aria-label", "แผนเที่ยวรายวัน");

  for (const day of itinerary) {
    const item = document.createElement("li");
    item.className = "result-day";
    const headingId = `${idPrefix}-day-${day.day}`;
    item.setAttribute("aria-labelledby", headingId);

    const title = typeof day.title === "string" && day.title.trim() ? ` · ${day.title}` : "";
    appendTextElement(item, "h4", `วันที่ ${day.day}${title}`).id = headingId;

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

let planCount = 0;

function renderPlan(result, payload) {
  const plan = result.data;
  planCount += 1;
  const bubble = addBubble("ai", "wide");

  const heading = appendTextElement(
    bubble,
    "h3",
    plan.status === "ready" ? "แผนการเดินทางรายวัน" : "AI ต้องการข้อมูลเพิ่มเติม"
  );
  heading.tabIndex = -1;

  if (plan.reply) appendTextElement(bubble, "p", plan.reply);

  renderTripSummary(bubble, plan.trip, payload);

  if (plan.status === "ready" && plan.itinerary.length) {
    renderItinerary(bubble, plan.itinerary, `plan-${planCount}`);
  } else if (plan.status === "ready") {
    appendTextElement(bubble, "p", "AI ยังไม่ได้ส่งแผนรายวันกลับมา", "empty");
  }

  updateRouteMap(payload, plan);
  heading.focus();
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
  submitLabel.textContent = isLoading ? "AI กำลังวางแผน…" : "สร้างแผนเที่ยว";
  chatLog.setAttribute("aria-busy", String(isLoading));
}

// ---------- แผนภาพเส้นทาง ----------

function shortLabel(text, max = 16) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function drawPin(point, label, isEnd, side) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("transform", `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);

  const head = document.createElementNS(SVG_NS, "circle");
  head.setAttribute("cy", "-18");
  head.setAttribute("r", isEnd ? "10" : "8");
  head.setAttribute("fill", "#c62828");
  const tail = document.createElementNS(SVG_NS, "path");
  tail.setAttribute("d", isEnd ? "M-9 -14 L0 0 L9 -14 Z" : "M-7 -14 L0 0 L7 -14 Z");
  tail.setAttribute("fill", "#c62828");
  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cy", "-18");
  dot.setAttribute("r", "3.5");
  dot.setAttribute("fill", "#fff");

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("class", isEnd ? "pin-label end" : "pin-label");
  text.setAttribute("x", side < 0 ? "-14" : "14");
  text.setAttribute("y", "-14");
  text.setAttribute("text-anchor", side < 0 ? "end" : "start");
  text.textContent = shortLabel(label);

  group.append(head, tail, dot, text);
  routePins.append(group);
}

function drawRoute(originLabel, destinationLabel, stopLabels) {
  routePins.replaceChildren();
  const length = routePath.getTotalLength();
  const pointAt = (ratio) => routePath.getPointAtLength(length * ratio);

  stopLabels.forEach((label, index) => {
    const ratio = (index + 1) / (stopLabels.length + 1);
    drawPin(pointAt(ratio), label, false, index % 2 === 0 ? 1 : -1);
  });
  drawPin(pointAt(1), destinationLabel, true, 1);
  drawPin(pointAt(0.02), originLabel, true, -1);
}

function updateRouteMap(payload, plan) {
  const stops = plan.status === "ready"
    ? plan.itinerary.flatMap((day) => day.stops.map((stop) => stop.name).filter(Boolean)).slice(0, MAX_MAP_STOPS)
    : [];
  drawRoute(payload.origin, payload.destination, stops);
  routeCaption.textContent = stops.length
    ? "แผนภาพจุดแวะตามลำดับในแผน ไม่ใช่ตำแหน่งหรือระยะทางจริง"
    : "ยังไม่มีจุดแวะที่ยืนยันได้ แสดงเฉพาะต้นทางและปลายทาง ไม่ใช่ตำแหน่งจริง";
}

function initRouteCar() {
  if (prefersReducedMotion) {
    const start = routePath.getPointAtLength(0);
    routeCar.setAttribute("transform", `translate(${start.x} ${start.y}) rotate(-90)`);
    return;
  }
  const motion = document.createElementNS(SVG_NS, "animateMotion");
  motion.setAttribute("dur", "9s");
  motion.setAttribute("repeatCount", "indefinite");
  motion.setAttribute("rotate", "auto");
  const mpath = document.createElementNS(SVG_NS, "mpath");
  mpath.setAttribute("href", "#route-path");
  motion.append(mpath);
  routeCar.append(motion);
}

// ---------- จังหวัด แผนสำเร็จรูป และการ์ด ----------

function scrollToPlanner(focusTarget) {
  document.getElementById("planner").scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  focusTarget.focus({ preventScroll: true });
}

function renderProvinceOptions() {
  const datalist = document.getElementById("province-options");
  for (const region of Object.values(REGIONS)) {
    for (const province of region.provinces) {
      const option = document.createElement("option");
      option.value = province;
      datalist.append(option);
    }
  }
}

function showRegion(regionKey) {
  const region = REGIONS[regionKey];
  document.getElementById("province-heading").textContent = `${region.label} (${region.provinces.length} จังหวัด)`;
  for (const button of document.querySelectorAll(".region")) {
    button.setAttribute("aria-pressed", String(button.dataset.region === regionKey));
  }

  const list = document.getElementById("province-list");
  list.replaceChildren();
  for (const province of region.provinces) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "province-btn";
    button.textContent = province;
    button.addEventListener("click", () => {
      form.destination.value = province;
      if (form.origin.value.trim() === province) form.origin.value = "";
      setStatus(`ตั้งจุดหมายเป็น ${province} แล้ว กรอกข้อมูลที่เหลือแล้วกดสร้างแผนเที่ยว`);
      scrollToPlanner(form.origin.value.trim() ? form.days : form.origin);
    });
    item.append(button);
    list.append(item);
  }
}

function applyTemplate(template) {
  clearFormErrors();
  const origin = form.origin.value.trim();
  form.origin.value = origin && origin !== template.destination ? origin : DEFAULT_ORIGIN;
  form.destination.value = template.destination;
  form.days.value = String(template.days);
  form.budgetTHB.value = String(template.budgetTHB);
  for (const checkbox of form.querySelectorAll('input[name="interests"]')) {
    checkbox.checked = checkbox.value === template.interest;
  }
  form.interestOther.value = "";
  setStatus(`ใส่แผน ${template.destination} ${template.days} วันในฟอร์มแล้ว แก้ไขได้ก่อนกดสร้างแผนเที่ยว`);
  scrollToPlanner(submitButton);
}

function renderTemplates() {
  const list = document.getElementById("template-list");
  for (const template of TRIP_TEMPLATES) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "template-btn";
    appendTextElement(button, "strong", template.destination);
    button.append(` ${template.days} วัน · ${template.interest}`);
    button.setAttribute("aria-label", `ใช้แผน ${template.destination} ${template.days} วัน สาย${template.interest}`);
    button.addEventListener("click", () => applyTemplate(template));
    item.append(button);
    list.append(item);
  }
}

function initCarousel() {
  const track = document.getElementById("feature-track");
  for (const button of document.querySelectorAll(".carousel-btn")) {
    button.addEventListener("click", () => {
      const card = track.querySelector(".feature-card");
      const step = card ? card.getBoundingClientRect().width + 16 : track.clientWidth;
      track.scrollBy({ left: step * Number(button.dataset.dir), behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }
}

// ---------- ส่งฟอร์ม ----------

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
  appendTextElement(addBubble("user"), "p", describeRequest(payload));
  showTyping();
  setStatus("AI กำลังสร้างแผนเที่ยว อาจใช้เวลาสักครู่…");

  try {
    const result = await requestPlan(payload);
    hideTyping();
    setStatus(
      result.data.status === "ready"
        ? `สร้างแผนเที่ยว ${payload.origin} → ${payload.destination} เรียบร้อย`
        : "AI ตอบกลับแล้ว แต่ยังต้องการข้อมูลเพิ่มเติม"
    );
    renderPlan(result, payload);
  } catch (error) {
    if (error && error.name === "AbortError") return; // ถูกแทนที่ด้วยคำขอใหม่
    hideTyping();
    appendTextElement(addBubble("error"), "p", `เรียก API ไม่สำเร็จ: ${error.message}`);
    setStatus(`เรียก API ไม่สำเร็จ: ${error.message}`, true);
  } finally {
    setLoading(false);
  }
});

for (const button of document.querySelectorAll(".region")) {
  button.addEventListener("click", () => showRegion(button.dataset.region));
}

renderProvinceOptions();
renderTemplates();
showRegion("north");
initCarousel();
drawRoute("ต้นทาง", "ปลายทาง", DEMO_MAP_STOPS);
initRouteCar();
loadPlaces();
