
import Groq from "groq-sdk";
import "dotenv/config";
import { readFile } from "node:fs/promises";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemPrompt = await readFile(
  new URL("./system-prompt.md", import.meta.url),
  "utf8"
);

const messages = [
  { role: "system", content: systemPrompt },
];

const rl = readline.createInterface({ input, output });

console.log("ยินดีต้อนรับสู่ Thai Travel AI");
console.log("พิมพ์ exit เพื่อออกจากโปรแกรม");

try {
  while (true) {
    const userInput = (await rl.question("\nคุณ: ")).trim();

    if (userInput.toLowerCase() === "exit") break;
    if (!userInput) continue;

    try {
      const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
          ...messages,
          { role: "user", content: userInput },
        ],
      });

      const answer = response.choices[0]?.message?.content;

      if (!answer) {
        console.log("AI ไม่ส่งข้อความตอบกลับ");
        continue;
      }

      messages.push({ role: "user", content: userInput });
      messages.push({ role: "assistant", content: answer });

      console.log("\nThai Travel AI: " + answer);
    } catch (error) {
      console.error("เกิดข้อผิดพลาด:", error.message);
    }
  }
} finally {
  rl.close();
  console.log("ปิดการสนทนาแล้ว");
}
  