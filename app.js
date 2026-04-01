// ==========================================
// 🏥 MEDICAL TIME ATTENDANCE SYSTEM (SPA)
// ==========================================

// ระบบพิกัดเป้าหมาย (ดึงค่าเริ่มต้นจาก config.js มาเตรียมไว้ก่อน)
let TARGET_MAP_SETTINGS = {
    lat: CONFIG.TARGET_LATITUDE,
    lng: CONFIG.TARGET_LONGITUDE,
    range: CONFIG.ALLOWED_RANGE_METERS
};

let currentUserData = null;
let currentUserId = null;

// กล้อง
let stream;
let currentFacingMode = "user";
let activeCameraMode = null;

// ระบบพิกัด (GPS แบบ Pre-fetch)
let watchId = null;
let cachedLocation = null;

// ระบบแผนที่ Leaflet
let leafletMap = null;
let userMarker = null;

// ==========================================
// 🚀 1. SYSTEM INITIALIZATION
// ==========================================
window.onload = async function () {
    startClock();
    await fetchMapSettings(); // ⚡ ดึงพิกัดจาก Google Sheet
    await initializeLiff();
};

function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('headerDate').textContent = now.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
        document.getElementById('headerTime').textContent = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    }, 1000);
}

// ⚡ ฟังก์ชันโหลดข้อมูลพิกัดจาก Google Sheet
async function fetchMapSettings() {
    try {
        const res = await fetch(CONFIG.WEB_APP_API, {
            method: 'POST',
            body: JSON.stringify({ action: 'getSettings' })
        });
        const data = await res.json();
        if (data && data.lat) {
            TARGET_MAP_SETTINGS.lat = parseFloat(data.lat);
            TARGET_MAP_SETTINGS.lng = parseFloat(data.lng);
            TARGET_MAP_SETTINGS.range = parseInt(data.range);
        }
    } catch (e) {
        console.warn("ไม่สามารถโหลดตั้งค่าหมุดได้ จะใช้ค่าเริ่มต้นจาก config.js แทน", e);
    }
}

async function initializeLiff() {
    try {
        await liff.init({ liffId: CONFIG.LIFF_ID_CHECKIN });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            currentUserId = profile.userId;
            document.getElementById('reg-lineId').value = currentUserId;
            await checkUserStatus(currentUserId);
        } else {
            liff.login();
        }
    } catch (error) {
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อระบบ LINE ได้", "error");
    }
}

async function checkUserStatus(userId) {
    try {
        const response = await fetch(CONFIG.WEB_APP_API, {
            method: "POST",
            body: JSON.stringify({ action: "fetchData", source: "member", userId: userId }),
        });
        const data = await response.json();
        const userRows = data.filter((row) => row[1] === userId);

        if (userRows.length > 0) {
            userRows.sort((a, b) => new Date(b[6]) - new Date(a[6]));
            currentUserData = userRows[0];
            setupCheckinView();
            switchView('checkinView');
        } else {
            setupRegisterView();
            switchView('registerView');
        }
    } catch (error) {
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
    }, 300);
}

// ==========================================
// 📸 2. CAMERA & IMAGE OPTIMIZATION
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
            const previewEl = document.getElementById(`${mode}-preview`);
            if (previewEl) previewEl.classList.add('hidden');
        })
        .catch(function () {
            Swal.fire("กล้องไม่พร้อม", "กรุณาอนุญาตการเข้าถึงกล้อง", "error");
        });
}

function switchCamera(mode) {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    startCamera(mode);
}

// ⚡ บีบอัดรูปให้เล็กลงเพื่อความเร็วสูงสุด
function captureOptimizedFrame(mode) {
    const video = document.getElementById(`${mode}-camera-preview`);
    const canvas = document.createElement("canvas");

    const MAX_WIDTH = 600; // ย่อขนาดความกว้างภาพ
    const scale = MAX_WIDTH / video.videoWidth;
    canvas.width = MAX_WIDTH;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // บีบอัดเป็น JPEG 70% (เร็วขึ้น 10 เท่าเมื่อเทียบกับ PNG ปกติ)
    return canvas.toDataURL("image/jpeg", 0.7);
}

// ==========================================
// 📝 3. REGISTRATION
// ==========================================
let capturedRegImage = null;

function setupRegisterView() {
    startCamera('reg');
    const captureBtn = document.getElementById('reg-capture-btn');
    const retakeBtn = document.getElementById('reg-retake-btn');
    const previewImg = document.getElementById('reg-preview');
    const videoEl = document.getElementById('reg-camera-preview');

    captureBtn.onclick = () => {
        capturedRegImage = captureOptimizedFrame('reg');
        previewImg.src = capturedRegImage;
        previewImg.classList.remove('hidden');
        videoEl.style.display = 'none';

        captureBtn.classList.add('hidden');
        retakeBtn.classList.remove('hidden');
        if (stream) stream.getTracks().forEach(track => track.stop());
    };

    retakeBtn.onclick = () => {
        capturedRegImage = null;
        previewImg.classList.add('hidden');
        captureBtn.classList.remove('hidden');
        retakeBtn.classList.add('hidden');
        startCamera('reg');
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
        .then(() => {
            Swal.fire({ title: "สำเร็จ!", text: "ลงทะเบียนเรียบร้อยแล้ว", icon: "success", confirmButtonColor: "#0f766e" })
                .then(() => {
                    // currentUserData index: 0:id, 1:lineId, 2:name, 3:empId, 4:dept, 5:imgUrl
                    currentUserData = ["", currentUserId, name, empId, dept, capturedRegImage];
                    setupCheckinView();
                    switchView('checkinView');
                });
        }).catch(() => Swal.fire("ข้อผิดพลาด", "ไม่สามารถส่งข้อมูลได้", "error"));
}

// ==========================================
// 📍 4. FAST GPS & CHECK-IN LOGIC
// ==========================================
function setupCheckinView() {
    document.getElementById('chk-name').textContent = currentUserData[2];
    document.getElementById('chk-details').textContent = `รหัส: ${currentUserData[3]} | ${currentUserData[4]}`;

    // เอารูปที่เคยลงทะเบียนมาแสดง
    if (currentUserData[5] && currentUserData[5].startsWith('http')) {
        document.getElementById('chk-profile-img').src = currentUserData[5];
    }

    startCamera('chk');
    startBackgroundGPS(); // ⚡ เริ่มจับ GPS ทันทีที่เปิดหน้า

    document.getElementById('btn-checkin').onclick = processOneClickCheckin;
}

// ⚡ พื้นหลัง GPS (Pre-fetching)
function startBackgroundGPS() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (pos) => { cachedLocation = pos.coords; },
            (err) => { console.warn("GPS Pre-fetch failed", err); },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function executeCheckin(lat, lng) {
    // ⚡ เปลี่ยนมาใช้ TARGET_MAP_SETTINGS
    const distance = calculateDistance(lat, lng, TARGET_MAP_SETTINGS.lat, TARGET_MAP_SETTINGS.lng);

    if (distance > TARGET_MAP_SETTINGS.range) {
        return Swal.fire({ icon: "error", title: "อยู่นอกพื้นที่!", text: `คุณอยู่ห่างจากเป้าหมาย ${distance.toFixed(0)} เมตร`, confirmButtonColor: "#0f766e" });
    }

    const capturedImageBase64 = captureOptimizedFrame('chk').split(",")[1];
    const jobType = document.querySelector('input[name="job-type"]:checked').value;
    const note = document.getElementById('chk-note').value;

    let addressName = "ตรวจสอบพิกัดสำเร็จ";
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => { if (data.display_name) addressName = data.display_name; }).catch(() => { });

    const now = new Date();
    const payload = {
        base64: capturedImageBase64,
        name: currentUserData[2],
        role: currentUserData[3],
        job: jobType,
        note: note,
        today: `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        lat: lat,
        long: lng,
        address: addressName,
        user: currentUserId
    };

    fetch(CONFIG.WEB_APP_API, { method: "POST", body: JSON.stringify(payload) })
        .then(() => {
            Swal.fire("สำเร็จ!", "บันทึกเวลาเรียบร้อยแล้ว", "success").then(() => sendFlexMessage(payload));
        })
        .catch(() => Swal.fire("ข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลได้", "error"));
}

function processOneClickCheckin() {
    Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // ⚡ ใช้ GPS ที่แอบจับไว้แล้ว ถ้ามี!
    if (cachedLocation) {
        executeCheckin(cachedLocation.latitude, cachedLocation.longitude);
    } else {
        if (!navigator.geolocation) return Swal.fire("ไม่รองรับ", "อุปกรณ์ของคุณไม่รองรับ GPS", "error");
        navigator.geolocation.getCurrentPosition(
            (pos) => { executeCheckin(pos.coords.latitude, pos.coords.longitude); },
            (err) => { Swal.fire("เกิดข้อผิดพลาด", "กรุณาเปิด GPS (Location)", "error"); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

// ==========================================
// 🗺️ 5. MAP MODAL (LEAFLET)
// ==========================================
function openMapModal() {
    document.getElementById('mapModal').classList.remove('hidden');

    setTimeout(() => {
        document.getElementById('mapModal').classList.remove('opacity-0');
        document.getElementById('mapModalContent').classList.remove('translate-y-full');
    }, 10);

    Swal.fire({ title: 'กำลังค้นหาพิกัด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            Swal.close();
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;

            // ⚡ เปลี่ยนมาใช้ TARGET_MAP_SETTINGS
            const dist = calculateDistance(userLat, userLng, TARGET_MAP_SETTINGS.lat, TARGET_MAP_SETTINGS.lng);

            let distText = dist <= TARGET_MAP_SETTINGS.range
                ? `<span class="text-emerald-600">อยู่ในระยะ (${dist.toFixed(0)} ม.)</span>`
                : `<span class="text-rose-600">อยู่นอกระยะ (${dist.toFixed(0)} ม.)</span>`;
            document.getElementById('mapDistanceText').innerHTML = `ระยะห่างจากจุดเป้าหมาย: ${distText}`;

            initOrUpdateMap(userLat, userLng);
        },
        (err) => {
            Swal.fire("ข้อผิดพลาด", "กรุณาเปิด GPS", "error");
        }, { enableHighAccuracy: true }
    );
}

function initOrUpdateMap(userLat, userLng) {
    if (!leafletMap) {
        // ⚡ เปลี่ยนมาใช้ TARGET_MAP_SETTINGS
        leafletMap = L.map('map').setView([TARGET_MAP_SETTINGS.lat, TARGET_MAP_SETTINGS.lng], 18);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(leafletMap);

        L.circle([TARGET_MAP_SETTINGS.lat, TARGET_MAP_SETTINGS.lng], {
            color: '#e11d48',
            fillColor: '#f43f5e',
            fillOpacity: 0.2,
            radius: TARGET_MAP_SETTINGS.range
        }).addTo(leafletMap);

        L.marker([TARGET_MAP_SETTINGS.lat, TARGET_MAP_SETTINGS.lng]).addTo(leafletMap)
            .bindPopup("<b>จุดลงเวลา</b><br>กรุณาเดินมาที่รัศมีวงกลม").openPopup();
    }

    const customIcon = L.divIcon({ className: 'pulsing-dot', iconSize: [14, 14], iconAnchor: [7, 7] });

    if (userMarker) leafletMap.removeLayer(userMarker);
    userMarker = L.marker([userLat, userLng], { icon: customIcon }).addTo(leafletMap).bindPopup("ตำแหน่งของคุณ");

    // ⚡ เปลี่ยนมาใช้ TARGET_MAP_SETTINGS
    const bounds = L.latLngBounds([[TARGET_MAP_SETTINGS.lat, TARGET_MAP_SETTINGS.lng], [userLat, userLng]]);
    leafletMap.fitBounds(bounds, { padding: [30, 30] });

    setTimeout(() => leafletMap.invalidateSize(), 300);
}

function closeMapModal() {
    document.getElementById('mapModal').classList.add('opacity-0');
    document.getElementById('mapModalContent').classList.add('translate-y-full');
    setTimeout(() => document.getElementById('mapModal').classList.add('hidden'), 300);
}

// ==========================================
// 💬 6. LINE FLEX MESSAGE
// ==========================================
async function sendFlexMessage(data) {
    const jobColor = data.job === 'เข้าเวร' ? '#0f766e' : data.job === 'ออกเวร' ? '#e11d48' : '#d97706';

    // แปลงวันที่ปัจจุบันให้เป็นรูปแบบ "31 มี.ค. 2569"
    const now = new Date();
    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const displayThaiDate = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

    const flexMsg = {
        type: "flex", altText: `บันทึก${data.job}`,
        contents: {
            type: "bubble",
            body: {
                type: "box", layout: "vertical", spacing: "md",
                contents: [
                    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บันทึกเวลาปฏิบัติงาน", weight: "bold", size: "md", color: "#1e293b" }, { type: "text", text: data.job, weight: "bold", size: "md", color: jobColor, align: "end" }] },
                    { type: "separator" },
                    // 🌟 รหัสนิสิต และ ชื่อ-นามสกุล รวมอยู่ในบรรทัดเดียวกัน
                    {
                        type: "box", layout: "vertical", spacing: "sm", contents: [
                            {
                                type: "box", layout: "baseline", contents: [
                                    { type: "text", text: "ผู้บันทึก", weight: "bold", size: "sm", color: "#64748b", flex: 2 },
                                    { type: "text", text: `${data.role} ${data.name}`, size: "sm", align: "end", color: "#0f172a", flex: 5, weight: "bold", wrap: true }
                                ]
                            }
                        ]
                    },
                    { type: "separator" },
                    // วันที่และเวลา
                    {
                        type: "box", layout: "vertical", contents: [
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "วันที่", weight: "bold", color: "#64748b", flex: 2 }, { type: "text", text: displayThaiDate, weight: "bold", align: "end", color: "#0f172a", flex: 5 }] },
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "เวลา", weight: "bold", color: "#64748b", flex: 2 }, { type: "text", text: data.time + " น.", weight: "bold", size: "xl", color: jobColor, align: "end", flex: 5 }] }
                        ]
                    },
                    { type: "separator" },
                    // สถานที่
                    {
                        type: "box", layout: "vertical", spacing: "xs", contents: [
                            { type: "text", text: "สถานที่", weight: "bold", size: "xs", color: "#64748b" },
                            { type: "text", text: data.address || "ตรวจสอบพิกัดสำเร็จ", wrap: true, size: "xs", color: "#475569" }
                        ]
                    }
                ]
            }
        }
    };
    try { await liff.sendMessages([flexMsg]); } catch (e) { console.error(e); }
    liff.closeWindow();
}