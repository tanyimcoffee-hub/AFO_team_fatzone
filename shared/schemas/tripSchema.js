/**
 * โครงสร้างข้อมูลกลางสำหรับแผนท่องเที่ยว (Trip Schema)
 * ใช้ร่วมกันระหว่าง AI Engineer, Travel Data Engineer และ Backend
 */

const sampleTripSchema = {
    origin: "string (จุดเริ่มต้น)",
    destination: "string (จุดหมายปลายทาง)",
    days: "number (จำนวนวัน)",
    budgetTHB: "number (งบประมาณรวมเป็นบาท)",
    travelMode: "string (เช่น road_trip)",
    interests: "array of strings (ความสนใจ เช่น ธรรมชาติ, คาเฟ่, วัฒนธรรม)",
    stops: [
        {
            day: "number (วันที่เดินทาง)",
            location: "string (ชื่อสถานที่)",
            description: "string (รายละเอียดกิจกรรม/จุดแวะพัก)"
        }
    ]
};

module.exports = { sampleTripSchema };