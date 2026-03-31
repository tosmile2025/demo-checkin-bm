// ==========================================
// 🏥 MEDICAL TIME ATTENDANCE SYSTEM (SPA)
// ==========================================

let currentUserData = null;
let currentUserId = null;

// กล้อง
let stream;
let currentFacingMode = "user";
let activeCameraMode = null; // 'reg' หรือ 'chk'

// ==========================================
// 🚀 1. SYSTEM INITIALIZATION
// ==========================================
window.onload = async function () {
    startClock();
    await initializeLiff();
};

function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('headerDate').textContent = now.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
        document.getElementById('headerTime').textContent = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    }, 1000);
}

async function initializeLiff() {
    try {
        await liff.init({ liffId: CONFIG.LIFF_ID_CHECKIN }); // ใช้ ID หลัก
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            currentUserId = profile.userId;
            document.getElementById('reg-lineId').value = currentUserId; // เตรียมไว้เผื่อต้องสมัคร
            await checkUserStatus(currentUserId);
        } else {
            liff.login();
        }
    } catch (error) {
        console.error("LIFF Init Error:", error);
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อระบบ LINE ได้", "error");
    }
}

// ตรวจสอบว่าผู้ใช้มีในระบบหรือยัง
async function checkUserStatus(userId) {
    try {
        const response = await fetch(CONFIG.WEB_APP_API, {
            method: "POST",
            body: JSON.stringify({ action: "fetchData", source: "member", userId: userId }),
        });
        const data = await response.json();
        const userRows = data.filter((row) => row[1] === userId);

        if (userRows.length > 0) {
            // ✅ มีผู้ใช้ในระบบ -> ไปหน้าลงเวลา
            userRows.sort((a, b) => new Date(b[6]) - new Date(a[6]));
            currentUserData = userRows[0];
            setupCheckinView();
            switchView('checkinView');
        } else {
            // ❌ ไม่มีผู้ใช้ -> ไปหน้าสมัคร
            setupRegisterView();
            switchView('registerView');
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        Swal.fire("ข้อผิดพลาด", "เชื่อมต่อฐานข้อมูลล้มเหลว กรุณาลองใหม่", "error");
    }
}

function switchView(viewId) {
    document.getElementById('loadingView').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('checkinView').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('loadingView').classList.add('hidden');
        document.getElementById(viewId).classList.remove('hidden');
        document.getElementById(viewId).classList.add('flex');
    }, 300); // รอ Fade out
}

// ==========================================
// 📸 2. CAMERA MANAGEMENT (ใช้สด 100%)
// ==========================================
function startCamera(mode) {
    activeCameraMode = mode;
    const videoEl = document.getElementById(`${mode}-camera-preview`);

    if (stream) { stream.getTracks().forEach(track => track.stop()); }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } })
        .then(function (videoStream) {
            stream = videoStream;
            videoEl.srcObject = videoStream;
            videoEl.style.display = "block";

            // ซ่อนรูปภาพพรีวิวถ้ามี
            const previewEl = document.getElementById(`${mode}-preview`);
            if (previewEl) previewEl.classList.add('hidden');
        })
        .catch(function (error) {
            console.error("Camera Error: ", error);
            Swal.fire("กล้องไม่พร้อม", "กรุณาอนุญาตการเข้าถึงกล้อง", "error");
        });
}

function switchCamera(mode) {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    startCamera(mode);
}

function captureFrame(mode) {
    const video = document.getElementById(`${mode}-camera-preview`);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8); // ลดขนาดเล็กน้อยด้วย JPEG
}

// ==========================================
// 📝 3. REGISTRATION LOGIC
// ==========================================
let capturedRegImage = null;

function setupRegisterView() {
    startCamera('reg');

    const captureBtn = document.getElementById('reg-capture-btn');
    const retakeBtn = document.getElementById('reg-retake-btn');
    const previewImg = document.getElementById('reg-preview');
    const videoEl = document.getElementById('reg-camera-preview');

    captureBtn.onclick = () => {
        capturedRegImage = captureFrame('reg');
        previewImg.src = capturedRegImage;
        previewImg.classList.remove('hidden');
        videoEl.style.display = 'none';

        captureBtn.classList.add('hidden');
        retakeBtn.classList.remove('hidden');
        if (stream) stream.getTracks().forEach(track => track.stop()); // พักกล้อง
    };

    retakeBtn.onclick = () => {
        capturedRegImage = null;
        previewImg.classList.add('hidden');
        captureBtn.classList.remove('hidden');
        retakeBtn.classList.add('hidden');
        startCamera('reg'); // เปิดกล้องใหม่
    };

    document.getElementById('btn-register').onclick = submitRegistration;
}

function submitRegistration() {
    const name = document.getElementById('reg-name').value.trim();
    const empId = document.getElementById('reg-empId').value.trim();
    const dept = document.getElementById('reg-dept').value.trim();

    if (!name || !empId || !dept) return Swal.fire("ข้อมูลไม่ครบ", "กรุณากรอกฟิลด์ที่มีดอกจันให้ครบ", "warning");
    if (!capturedRegImage) return Swal.fire("ข้อมูลไม่ครบ", "กรุณาถ่ายรูปโปรไฟล์จากกล้อง", "warning");

    Swal.fire({ title: 'กำลังลงทะเบียน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const obj = {
        base64: capturedRegImage.split(",")[1],
        nameId: name,
        keynumberId: empId,
        keynumber2Id: dept,
        userlineId: currentUserId
    };

    fetch(CONFIG.WEB_APP_API, { method: "POST", body: JSON.stringify(obj) })
        .then(res => res.text())
        .then(() => {
            Swal.fire({
                title: "สำเร็จ!", text: "ลงทะเบียนเรียบร้อยแล้ว", icon: "success", confirmButtonColor: "#0f766e"
            }).then(() => {
                // อัปเดตข้อมูลและไปหน้าลงเวลา
                currentUserData = ["", currentUserId, name, empId, dept];
                setupCheckinView();
                switchView('checkinView');
            });
        })
        .catch(err => {
            console.error(err);
            Swal.fire("ข้อผิดพลาด", "ไม่สามารถส่งข้อมูลได้", "error");
        });
}

// ==========================================
// 📍 4. CHECK-IN LOGIC (1-CLICK UX)
// ==========================================
function setupCheckinView() {
    document.getElementById('chk-name').textContent = currentUserData[2];
    document.getElementById('chk-details').textContent = `รหัส: ${currentUserData[3]} | ${currentUserData[4]}`;
    startCamera('chk');

    document.getElementById('btn-checkin').onclick = processOneClickCheckin;
}

// คำนวณระยะทาง
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function processOneClickCheckin() {
    // 1. ถ่ายรูปทันทีโดยผู้ใช้ไม่ต้องกดปุ่มถ่ายแยก
    const capturedImageBase64 = captureFrame('chk').split(",")[1];
    const jobType = document.querySelector('input[name="job-type"]:checked').value;
    const note = document.getElementById('chk-note').value;

    Swal.fire({ title: 'กำลังดึงพิกัดและบันทึก...', html: 'กรุณารอสักครู่', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // 2. ดึงพิกัด GPS
    if (!navigator.geolocation) return Swal.fire("ไม่รองรับ", "อุปกรณ์ของคุณไม่รองรับ GPS", "error");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // 3. ตรวจสอบระยะห่าง
            const distance = calculateDistance(lat, lng, CONFIG.TARGET_LATITUDE, CONFIG.TARGET_LONGITUDE);
            if (distance > CONFIG.ALLOWED_RANGE_METERS) {
                return Swal.fire({ icon: "error", title: "อยู่นอกพื้นที่!", text: `คุณอยู่ห่างจากเป้าหมาย ${distance.toFixed(0)} เมตร`, confirmButtonColor: "#0f766e" });
            }

            // 4. ดึงชื่อสถานที่ (Reverse Geocoding)
            let addressName = "ตรวจสอบพิกัดสำเร็จ";
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                const geoData = await geoRes.json();
                if (geoData.display_name) addressName = geoData.display_name;
            } catch (e) { console.warn("Reverse Geocoding failed", e); }

            // 5. ส่งข้อมูลไปยัง Backend
            const now = new Date();
            const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            const payload = {
                base64: capturedImageBase64,
                name: currentUserData[2],
                role: currentUserData[3],
                job: jobType,
                note: note,
                today: dateStr,
                time: timeStr,
                lat: lat,
                long: lng,
                address: addressName,
                user: currentUserId
            };

            fetch(CONFIG.WEB_APP_API, { method: "POST", body: JSON.stringify(payload) })
                .then(res => res.text())
                .then(() => {
                    Swal.fire("สำเร็จ!", "บันทึกเวลาเรียบร้อยแล้ว", "success").then(() => {
                        sendFlexMessage(payload);
                    });
                })
                .catch(err => {
                    console.error(err);
                    Swal.fire("ข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลได้", "error");
                });
        },
        (error) => {
            let msg = "เปิด GPS ไม่ได้";
            if (error.code === 1) msg = "กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้ง (Location)";
            Swal.fire("เกิดข้อผิดพลาด", msg, "error");
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ==========================================
// 💬 5. LINE FLEX MESSAGE
// ==========================================
async function sendFlexMessage(data) {
    const jobColor = data.job === 'เข้างาน' ? '#0f766e' : data.job === 'ออกงาน' ? '#e11d48' : '#d97706';

    const flexMsg = {
        type: "flex", altText: `บันทึก${data.job}`,
        contents: {
            type: "bubble",
            body: {
                type: "box", layout: "vertical", spacing: "md",
                contents: [
                    {
                        type: "box", layout: "horizontal", contents: [
                            { type: "text", text: "บันทึกเวลาปฏิบัติงาน", weight: "bold", size: "md", color: "#1e293b" },
                            { type: "text", text: data.job, weight: "bold", size: "md", color: jobColor, align: "end" }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical", spacing: "sm", contents: [
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "ชื่อ", weight: "bold", size: "sm", color: "#64748b" }, { type: "text", text: data.name, size: "sm", align: "end", color: "#0f172a" }] },
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "รหัส", weight: "bold", size: "sm", color: "#64748b" }, { type: "text", text: data.role, size: "sm", align: "end", color: "#0f172a" }] }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical", contents: [
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "วันที่", weight: "bold", color: "#64748b" }, { type: "text", text: data.today, weight: "bold", align: "end", color: "#0f172a" }] },
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "เวลา", weight: "bold", color: "#64748b" }, { type: "text", text: data.time, weight: "bold", size: "xl", color: jobColor, align: "end" }] }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical", spacing: "xs", contents: [
                            { type: "text", text: "สถานที่ (GPS)", weight: "bold", size: "xs", color: "#64748b" },
                            { type: "text", text: data.address, wrap: true, size: "xs", color: "#475569" }
                        ]
                    }
                ]
            }
        }
    };

    try {
        await liff.sendMessages([flexMsg]);
    } catch (e) { console.error(e); }
    liff.closeWindow();
}