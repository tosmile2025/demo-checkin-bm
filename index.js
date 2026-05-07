// ==========================================
// 📍 INDEX CHECK-IN SYSTEM (ระบบบันทึกการเข้างาน)
// ==========================================

// ==========================================
// 🎨 DYNAMIC THEME SYSTEM (ระบบสีอัจฉริยะ โหลดไว)
// ==========================================
async function loadAndApplyTheme() {
    // 1. ดึงสีจาก Local Storage มาใช้ทันทีก่อน (0 วินาที ระบบไม่ช้า)
    const cachedColor = localStorage.getItem('appThemeColor');
    if (cachedColor) {
        applyTheme(cachedColor);
    }

    // 2. ยิง API แบบ Background เพื่อเช็คว่าแอดมินเปลี่ยนสีใหม่ไหม
    try {
        const res = await fetch(CONFIG.WEB_APP_API, {
            method: 'POST',
            body: JSON.stringify({ action: 'getTheme' })
        });
        const data = await res.json();

        if (data.color && data.color !== cachedColor) {
            // ถ้าสีใหม่ไม่ตรงกับของเดิม ให้บันทึกทับแล้วเปลี่ยนสีหน้าเว็บทันที
            localStorage.setItem('appThemeColor', data.color);
            applyTheme(data.color);
        }
    } catch (error) {
        console.log("เช็คอัปเดตสีล้มเหลว ใช้สีเดิมต่อไป");
    }
}

// ฟังก์ชันเขียน CSS ทับ Tailwind Class หลัก (medical-700)
function applyTheme(hexColor) {
    if (!hexColor || hexColor === '') return;

    let styleTag = document.getElementById('dynamic-theme');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-theme';
        document.head.appendChild(styleTag);
    }

    // บังคับเปลี่ยนสีจุดสำคัญๆ ที่ใช้คลาส medical-700
    styleTag.innerHTML = `
        .bg-medical-700 { background-color: ${hexColor} !important; }
        .text-medical-700 { color: ${hexColor} !important; }
        .border-medical-700 { border-color: ${hexColor} !important; }
        .focus\\:border-medical-500:focus { border-color: ${hexColor} !important; }
        .hover\\:bg-medical-800:hover { filter: brightness(0.9); background-color: ${hexColor} !important; }
        .bg-medical-50 { background-color: ${hexColor}15 !important; } /* ความโปร่งใส 15% */
        .text-medical-600 { color: ${hexColor} !important; }
    `;
}



// ==========================================
// 🚀 INITIALIZE LIFF & DATA FETCH
// ==========================================
window.onload = async function () {
    // บังคับค่า jobInput เป็น 'เข้างาน' 
    document.getElementById("jobInput").value = "เข้างาน";

    // 🌟 1. เพิ่มคำสั่งโหลดตำแหน่งตรงนี้
    await loadRolesToRegistration();

    await initializeLiff();

    // 🚀 เรียกใช้งานทันที
    loadAndApplyTheme();
};

async function initializeLiff() {
    try {
        await liff.init({ liffId: CONFIG.LIFF_ID_CHECKIN });
        if (liff.isLoggedIn()) {
            getUserProfile();
        } else {
            liff.login();
        }
    } catch (error) {
        console.error("Error initializing LIFF:", error);
    }
}

async function getUserProfile() {
    try {
        const profile = await liff.getProfile();
        document.getElementById("userId").value = profile.userId;
        await fetchData(profile.userId);
    } catch (error) {
        console.error("Error getting profile data:", error);
    }
}

// ==========================================
// 📡 FETCH ROLES (ดึงข้อมูลตำแหน่งจาก Google Sheet)
// ==========================================
async function loadRolesToRegistration() {
    try {
        const res = await fetch(CONFIG.WEB_APP_API, {
            method: 'POST',
            body: JSON.stringify({ action: 'getRoles' })
        });
        const roles = await res.json();

        const deptSelect = document.getElementById('reg-dept');

        // 🌟 ป้องกัน Error ถ้าหน้าเว็บนี้ไม่มีกล่อง reg-dept ให้ข้ามการทำงานไปเลย
        if (!deptSelect) return;

        // เคลียร์ค่าและตั้งค่าเริ่มต้น
        deptSelect.innerHTML = '<option value="" disabled selected>-- เลือกตำแหน่ง / ชั้นปี --</option>';

        // วนลูปเอาข้อมูลตำแหน่งมาสร้างเป็นตัวเลือก
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.name;
            option.textContent = role.name;
            deptSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading roles:", error);
    }
}

async function fetchData(userId) {
    showLoading(true);
    try {
        const response = await fetch(CONFIG.WEB_APP_API, {
            method: "POST",
            body: JSON.stringify({ action: "fetchData", source: "member", userId: userId }),
        });
        const data = await response.json();

        const userRows = data.filter((row) => row[1] === userId);
        if (userRows.length > 0) {
            userRows.sort((a, b) => new Date(b[6]) - new Date(a[6]));
            displayData(userRows[0]);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    } finally {
        showLoading(false);
    }
}

function displayData(row) {
    document.getElementById("columnAData").value = row[1] || "";
    document.getElementById("columnBData").value = row[2] || "";
    document.getElementById("columnCData").value = row[3] || "";
    document.getElementById("columnDData").value = row[4] || "";
}

function showLoading(isLoading) {
    const overlay = document.getElementById("loadingOverlay");
    if (isLoading) {
        overlay.classList.remove("hidden");
        overlay.classList.add("flex");
    } else {
        overlay.classList.remove("flex");
        overlay.classList.add("hidden");
    }
}

// ==========================================
// 📸 CAMERA SYSTEM (ระบบกล้องถ่ายรูป)
// ==========================================
const previewImage = document.getElementById("preview");
const video = document.getElementById("camera-preview");

document.addEventListener("DOMContentLoaded", function () {
    const startCameraBtn = document.getElementById("start-camera-btn");
    const captureBtn = document.getElementById("capture-btn");
    const switchCameraBtn = document.getElementById("switch-camera-btn");

    let stream;
    let currentFacingMode = "user"; // เริ่มที่กล้องหน้า

    function startCamera() {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } })
            .then(function (videoStream) {
                stream = videoStream;
                video.srcObject = videoStream;
                captureBtn.disabled = false;
                switchCameraBtn.disabled = false;
                video.style.display = "block";
                previewImage.style.display = "none";
            })
            .catch(function (error) {
                console.error("Error accessing the camera: ", error);
                Swal.fire("ข้อผิดพลาด", "ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาต", "error");
            });
    }

    function capturePhoto() {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        previewImage.src = canvas.toDataURL("image/png");
        previewImage.style.display = "block";
        video.style.display = "none";
    }

    function switchCamera() {
        if (stream) { stream.getTracks().forEach((track) => track.stop()); }
        currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
        startCamera();
    }

    startCameraBtn.addEventListener("click", startCamera);
    captureBtn.addEventListener("click", capturePhoto);
    switchCameraBtn.addEventListener("click", switchCamera);
});

function checkPictureAndNextStep() {
    const capturedImage = previewImage.src;
    if (!capturedImage || capturedImage.includes("No-Image-Placeholder")) {
        Swal.fire({ title: "แจ้งเตือน!", text: "กรุณาถ่ายรูปก่อนที่จะไปยังขั้นตอนถัดไป", icon: "warning" });
    } else {
        nextStep();
    }
}

// ==========================================
// 📍 LOCATION SYSTEM (ระบบพิกัดและระยะห่าง)
// ==========================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // รัศมีโลก
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getLocation() {
    if (navigator.geolocation) {
        Swal.fire({ title: 'กำลังค้นหาพิกัด...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        navigator.geolocation.getCurrentPosition(displayLocation, showError, { enableHighAccuracy: true });
    } else {
        Swal.fire("ไม่รองรับ", "บราวเซอร์ของคุณไม่รองรับ Geolocation", "error");
    }
}

function showError(error) {
    Swal.close();
    let message = "เกิดข้อผิดพลาดที่ไม่รู้จัก";
    if (error.code === error.PERMISSION_DENIED) message = "คุณปฏิเสธการเข้าถึงตำแหน่ง";
    else if (error.code === error.POSITION_UNAVAILABLE) message = "ไม่สามารถค้นหาตำแหน่งได้";
    else if (error.code === error.TIMEOUT) message = "หมดเวลาในการค้นหาตำแหน่ง";
    Swal.fire("เกิดข้อผิดพลาด", message, "error");
}

function displayLocation(position) {
    Swal.close();
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    document.getElementById("latitude").innerText = latitude.toFixed(6);
    document.getElementById("longitude").innerText = longitude.toFixed(6);
    document.getElementById("latitudeInput").value = latitude;
    document.getElementById("longitudeInput").value = longitude;

    const submitButton = document.getElementById("submitButton");

    // ดึงพิกัดเป้าหมายจากไฟล์ Config.js
    const distance = calculateDistance(latitude, longitude, CONFIG.TARGET_LATITUDE, CONFIG.TARGET_LONGITUDE);

    if (distance > CONFIG.ALLOWED_RANGE_METERS) {
        Swal.fire({ icon: "error", title: "อยู่นอกพื้นที่!", text: `ระยะห่างจากเป้าหมาย: ${distance.toFixed(0)} เมตร (อนุญาต ${CONFIG.ALLOWED_RANGE_METERS}ม.)` });
        submitButton.disabled = true;
        submitButton.className = "w-2/3 py-4 rounded-2xl bg-slate-300 text-slate-500 font-bold cursor-not-allowed";
    } else {
        Swal.fire({ icon: "success", title: "อยู่ในพื้นที่!", text: `ระยะห่าง: ${distance.toFixed(0)} เมตร`, timer: 2000, showConfirmButton: false });
        submitButton.disabled = false;
        submitButton.className = "w-2/3 py-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-md transition-colors";
    }

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
        .then((res) => res.json())
        .then((data) => {
            const addr = data.display_name || "ไม่สามารถดึงข้อมูลที่อยู่ได้";
            document.getElementById("fullAddress").innerText = addr;
            document.getElementById("fullAddressInput").value = addr;
        });

    document.getElementById("mapIframe").src = `https://maps.google.com/maps?q=${latitude},${longitude}&hl=th&z=15&output=embed`;
}

// ==========================================
// ⏰ TIME & DATE SYSTEM
// ==========================================
function updateDateTime() {
    const now = new Date();
    document.getElementById("date").textContent = now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    document.getElementById("time").textContent = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
}
setInterval(updateDateTime, 1000);
updateDateTime();

function getCurrentTimeInBangkok() {
    const bangkokTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    return `${String(bangkokTime.getHours()).padStart(2, "0")}:${String(bangkokTime.getMinutes()).padStart(2, "0")}`;
}
document.getElementById("currentTime").value = getCurrentTimeInBangkok();

function getFormattedDate() {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
}
document.getElementById("todayInput").value = getFormattedDate();

// ==========================================
// 🔄 STEP CONTROLLER (เปลี่ยนหน้า)
// ==========================================
let currentStep = 1;
function nextStep() {
    if (currentStep < 3) {
        document.getElementById(`step${currentStep}`).classList.add("hidden");
        document.getElementById(`step${currentStep}`).classList.remove("flex-1", "flex", "flex-col");
        currentStep++;
        document.getElementById(`step${currentStep}`).classList.remove("hidden");
        if (currentStep === 3) document.getElementById(`step${currentStep}`).classList.add("flex-1", "flex", "flex-col");
    }
}

function prevStep() {
    if (currentStep > 1) {
        document.getElementById(`step${currentStep}`).classList.add("hidden");
        document.getElementById(`step${currentStep}`).classList.remove("flex-1", "flex", "flex-col");
        currentStep--;
        document.getElementById(`step${currentStep}`).classList.remove("hidden");
    }
}

// ==========================================
// 💾 SUBMIT & FLEX MESSAGE (บันทึกข้อมูล)
// ==========================================
function submitForm() {
    const colB = document.getElementById("columnBData").value;
    const colC = document.getElementById("columnCData").value;
    const jobInput = document.getElementById("jobInput").value;
    const latInput = document.getElementById("latitudeInput").value;
    const lonInput = document.getElementById("longitudeInput").value;

    if (!colB || !colC || !jobInput || !latInput || !lonInput) {
        Swal.fire("แจ้งเตือน!", "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", "warning");
        return;
    }

    Swal.fire({
        title: "ยืนยันการบันทึกเวลา",
        text: "คุณตรวจสอบรูปภาพและพิกัดถูกต้องแล้วใช่หรือไม่?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "บันทึกเลย",
        cancelButtonText: "ยกเลิก"
    }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById("submitButton").disabled = true;
            Swal.fire({ title: "กำลังบันทึกข้อมูล", text: "กรุณารอสักครู่...", allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

            let obj = {
                base64: previewImage.src.split("base64,")[1],
                name: colB,
                role: colC,
                job: jobInput,
                note: document.getElementById("noteInput").value,
                today: document.getElementById("todayInput").value,
                time: document.getElementById("currentTime").value,
                lat: latInput,
                long: lonInput,
                address: document.getElementById("fullAddressInput").value,
                user: document.getElementById("userId").value,
            };

            fetch(CONFIG.WEB_APP_API, { method: "POST", body: JSON.stringify(obj) })
                .then((res) => res.text())
                .then((data) => {
                    Swal.fire("สำเร็จ!", "บันทึกเวลาของคุณเรียบร้อย", "success").then(() => { sendFlexMessage(); });
                })
                .catch((error) => {
                    Swal.fire("Error!", "การส่งข้อมูลล้มเหลว กรุณาลองใหม่", "error");
                    document.getElementById("submitButton").disabled = false;
                });
        }
    });
}

async function sendFlexMessage() {
    const jobValue = document.getElementById("jobInput").value;
    const colB = document.getElementById("columnBData").value;
    const colC = document.getElementById("columnCData").value;
    const todayStr = document.getElementById("todayInput").value;
    const timeStr = document.getElementById("currentTime").value;
    const addr = document.getElementById("fullAddressInput").value;

    const flexMessage = {
        type: "flex",
        altText: "จดบันทึกเวลางาน",
        contents: {
            type: "bubble",
            body: {
                type: "box", layout: "vertical", spacing: "md",
                contents: [
                    {
                        type: "box", layout: "horizontal",
                        contents: [
                            { type: "text", text: "บันทึกเวลาปฎิบัติงาน", weight: "bold", size: "md" },
                            { type: "text", text: jobValue, weight: "bold", size: "md", color: "#0D9608", align: "end" }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical", spacing: "sm",
                        contents: [
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "ชื่อ นสพ.", weight: "bold", size: "sm" }, { type: "text", text: colB, size: "sm", align: "end" }] },
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "รหัส", weight: "bold", size: "sm" }, { type: "text", text: colC, size: "sm", align: "end" }] }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "วันที่", weight: "bold" }, { type: "text", text: todayStr, weight: "bold", align: "end" }] },
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "เวลา", weight: "bold" }, { type: "text", text: timeStr, weight: "bold", size: "xl", color: "#EF2F14", align: "end" }] }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical", spacing: "xs",
                        contents: [{ type: "text", text: "สถานที่", weight: "bold", size: "sm" }, { type: "text", text: addr || "ดึงพิกัดสำเร็จ", wrap: true, size: "xs", color: "#666666" }]
                    }
                ]
            }
        }
    };
    await liff.sendMessages([flexMessage]);
    liff.closeWindow();
}