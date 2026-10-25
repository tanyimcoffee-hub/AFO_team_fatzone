// เริ่ม API server ในเครื่อง (npm start) ตัว app อยู่ใน app.js
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Backend Server is running on http://localhost:${PORT}`);
});
