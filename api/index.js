// Vercel serverless function: ทุก /api/* ถูก rewrite มาที่ไฟล์นี้ (ดู vercel.json)
// ใช้ Express app ตัวเดียวกับที่รันในเครื่อง (services/api/app.js)
import app from "../services/api/app.js";

export default app;
