// // ประกาศค่า URL ที่ใช้เชื่อมต่อกับ Web App
//     const WEB_APP_MEMBER_URL = 'https://script.google.com/macros/s/AKfycbwR5z1QhMd3588Hn5pW7kF55p0pUp4AG2ZmbzVDHTOhNBOFjjPuWdKIny8G8_rT0rodmA/exec';
//     const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxu9h0ZJLm0h__BEahkGehV5nahKBs-aED6V4hYQnw-XxBmoUEuxIyZ4YHr_CRXEm53/exec';
// //LIFF_ID
//     const LIFF_ID = '2007747842-OGeyrGkv'; // LIFF ID Checkin
//     const LIFF_HISTORY = '2007747842-p0YX1oBn'; // LIFF ID history
//     const LIFF_REGISTER = '2007747842-oJr1GXK2'; // LIFF ID register

// ==========================================
// ⚙️ CONFIGURATION (การตั้งค่าสภาพแวดล้อม)
// ==========================================

const CONFIG = {
    // 🌐 URL ของ Google Apps Script (ตัวใหม่ที่รวมโค้ดแล้ว)
    // สามารถใช้ลิงก์เดียวกันได้เลย เพราะระบบ Backend แยกส่วนให้แล้ว
    WEB_APP_API: "https://script.google.com/macros/s/AKfycbzUwMzks27DNUDGYQRwdnGeUWb7fvjBW1knwBp3sDQtdq1i3jQ60zmWkGFsZPh-ZDk_SA/exec",

    // 📱 LIFF IDs
    LIFF_ID_CHECKIN: "2008088008-48JzVeeQ",
    LIFF_ID_HISTORY: "2008088008-jWGqwvvn",
    LIFF_ID_REGISTER: "2008088008-RGaXeww4",

    // 📍 การตั้งค่าพิกัดสถานที่ (ละติจูด, ลองจิจูด)
    TARGET_LATITUDE: 16.807157,
    TARGET_LONGITUDE: 100.263852,

    // 📏 ระยะห่างที่อนุญาตให้เช็คอินได้ (หน่วยเป็นเมตร)
    ALLOWED_RANGE_METERS: 30
};