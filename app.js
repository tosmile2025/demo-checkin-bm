// ==========================================
// 🏥 MEDICAL TIME ATTENDANCE SYSTEM (SPA)
// ==========================================

let TARGET_LOCATIONS = [{
    id: 'default',
    name: 'จุดเริ่มต้น',
    lat: CONFIG.TARGET_LATITUDE,
    lng: CONFIG.TARGET_LONGITUDE,
    range: CONFIG.ALLOWED_RANGE_METERS
}];

let currentUserData = null;
let currentUserId = null;

let stream;
let currentFacingMode = "user";
let activeCameraMode = null;
let isMirrored = true; // 🌟 เพิ่มตัวแปรเช็คสถานะการ Mirror (ค่าเริ่มต้นเปิดใช้)

let watchId = null;
let cachedLocation = null;

let leafletMap = null;
let userMarker = null;

// ==========================================
// 🚀 1. SYSTEM INITIALIZATION
// ==========================================

function updateLoading(percent, mainText, subText) {
    const progressEl = document.getElementById('loadingProgress');
    const mainTextEl = document.getElementById('loadingText');
    const subTextEl = document.getElementById('loadingSubText');

    if (progressEl) progressEl.style.width = `${percent}%`;
    if (mainTextEl && mainText) mainTextEl.textContent = mainText;
    if (subTextEl && subText) subTextEl.textContent = subText;
}

function showLoadingError(message) {
    document.getElementById('loadingContent').classList.add('hidden');
    const errorBox = document.getElementById('loadingError');
    errorBox.classList.remove('hidden');
    errorBox.classList.add('flex');
    document.getElementById('loadingErrorText').textContent = message;
}

window.onload = async function () {
    startClock();

    try {
        updateLoading(15, 'เชื่อมต่อเซิร์ฟเวอร์...', 'กำลังเตรียมข้อมูลระบบ');
        const mapPromise = fetchMapSettings().catch(e => console.warn(e));
        const liffPromise = initializeLiffCore();

        await Promise.all([mapPromise, liffPromise]);

    } catch (error) {
        console.error("Initialization Error:", error);
        showLoadingError(error.message || "การเชื่อมต่อเครือข่ายล้มเหลว กรุณาลองใหม่");
    }
};

function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('headerDate').textContent = now.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
        document.getElementById('headerTime').textContent = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    }, 1000);
}

async function fetchMapSettings() {
    updateLoading(30, 'ตรวจสอบพิกัด...', 'ดาวน์โหลดตำแหน่งพื้นที่');
    const res = await fetch(CONFIG.WEB_APP_API, {
        method: 'POST',
        body: JSON.stringify({ action: 'getSettings' })
    });
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
        TARGET_LOCATIONS = data;
    } else if (data && data.lat) {
        TARGET_LOCATIONS = [{ id: 'old', name: 'จุดหลัก', lat: parseFloat(data.lat), lng: parseFloat(data.lng), range: parseInt(data.range) }];
    }
}

async function initializeLiffCore() {
    updateLoading(45, 'เชื่อมต่อ LINE...', 'ตรวจสอบการเข้าสู่ระบบ');
    await liff.init({ liffId: CONFIG.LIFF_ID_CHECKIN });

    if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        currentUserId = profile.userId;
        document.getElementById('reg-lineId').value = currentUserId;

        updateLoading(65, 'ตรวจสอบประวัติ...', 'ค้นหาข้อมูลในฐานข้อมูล');
        await checkUserStatus(currentUserId);
    } else {
        liff.login();
    }
}

async function checkUserStatus(userId) {
    const response = await fetch(CONFIG.WEB_APP_API, {
        method: "POST",
        body: JSON.stringify({ action: "fetchData", source: "member", userId: userId }),
    });

    if (!response.ok) throw new Error("ไม่สามารถติดต่อฐานข้อมูลได้ (API Error)");

    const data = await response.json();
    const userRows = data.filter((row) => row[1] === userId);

    updateLoading(90, 'จัดเตรียมหน้าจอ...', 'โหลดข้อมูลเสร็จสิ้น');

    if (userRows.length > 0) {
        userRows.sort((a, b) => new Date(b[6]) - new Date(a[6]));
        currentUserData = userRows[0];

        updateLoading(100, 'เสร็จสิ้น!', 'เข้าสู่ระบบลงเวลา');

        switchView('checkinView');
        setTimeout(() => { setupCheckinView(); }, 600);
    } else {
        updateLoading(100, 'เสร็จสิ้น!', 'เข้าสู่หน้าลงทะเบียน');

        switchView('registerView');
        setTimeout(() => { setupRegisterView(); }, 600);
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
    }, 400);
}

// ==========================================
// 📸 2. CAMERA & IMAGE OPTIMIZATION (ระบบกล้อง & Mirror)
// ==========================================
function startCamera(mode) {
    activeCameraMode = mode;
    const videoEl = document.getElementById(`${mode}-camera-preview`);
    if (stream) { stream.getTracks().forEach(track => track.stop()); }

    // ค่าเริ่มต้น: กล้องหน้าให้กลับซ้ายขวา (Mirror) กล้องหลังไม่กลับ
    isMirrored = (currentFacingMode === "user");
    applyMirrorEffect(mode);

    navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } })
        .then(function (videoStream) {
            stream = videoStream;
            videoEl.srcObject = videoStream;
            videoEl.style.display = "block";
            const previewEl = document.getElementById(`${mode}-preview`);
            if (previewEl) previewEl.classList.add('hidden');
        })
        .catch(function (err) {
            console.error("Camera Error:", err);
            videoEl.outerHTML = `<div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-200 text-slate-500 p-4 text-center border-2 border-dashed border-slate-300"><i class="fas fa-camera-slash text-4xl mb-2 text-rose-400"></i><p class="text-sm font-bold text-slate-700">ไม่สามารถเปิดกล้องได้</p><p class="text-xs mt-1">กรุณาตรวจสอบการอนุญาต<br>การเข้าถึงกล้องในการตั้งค่าแอป LINE</p></div>`;
            Swal.fire({ icon: "warning", title: "เข้าถึงกล้องไม่ได้", text: "กรุณาอนุญาตให้ LINE เข้าถึงกล้องเพื่อถ่ายรูป", confirmButtonColor: "#0f766e" });
        });
}

function switchCamera(mode) {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    startCamera(mode);
}

// 🌟 ฟังก์ชันกดสลับ Mirror
function toggleMirror(mode) {
    isMirrored = !isMirrored;
    applyMirrorEffect(mode);
}

// 🌟 ฟังก์ชันอัปเดต CSS ทันทีเมื่อ Mirror เปลี่ยน
function applyMirrorEffect(mode) {
    const videoEl = document.getElementById(`${mode}-camera-preview`);
    const previewEl = document.getElementById(`${mode}-preview`);
    const transformStyle = isMirrored ? "scaleX(-1)" : "scaleX(1)";

    if (videoEl) videoEl.style.transform = transformStyle;
    if (previewEl) previewEl.style.transform = transformStyle;
}

function captureOptimizedFrame(mode) {
    const video = document.getElementById(`${mode}-camera-preview`);
    if (!video || !video.videoWidth) {
        throw new Error("ไม่มีภาพจากกล้อง");
    }
    const canvas = document.createElement("canvas");

    const MAX_WIDTH = 600;
    const scale = MAX_WIDTH / video.videoWidth;
    canvas.width = MAX_WIDTH;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext("2d");

    // 🌟 พลิกภาพก่อนวาดลง Canvas ถ้าผู้ใช้เปิดโหมด Mirror ไว้
    if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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
        try {
            capturedRegImage = captureOptimizedFrame('reg');
            previewImg.src = capturedRegImage;
            previewImg.classList.remove('hidden');
            if (videoEl) videoEl.style.display = 'none';

            captureBtn.classList.add('hidden');
            retakeBtn.classList.remove('hidden');
            if (stream) stream.getTracks().forEach(track => track.stop());
        } catch (e) {
            Swal.fire("ข้อผิดพลาด", "ไม่สามารถถ่ายภาพได้", "error");
        }
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
                    currentUserData = ["", currentUserId, name, empId, dept, capturedRegImage];
                    switchView('checkinView');
                    setTimeout(() => { setupCheckinView(); }, 500);
                });
        }).catch(() => Swal.fire("ข้อผิดพลาด", "ไม่สามารถส่งข้อมูลได้", "error"));
}

// ==========================================
// 📍 4. FAST GPS & CHECK-IN LOGIC
// ==========================================
function setupCheckinView() {
    document.getElementById('chk-name').textContent = currentUserData[2];
    document.getElementById('chk-details').textContent = `รหัส: ${currentUserData[3]} | ${currentUserData[4]}`;

    if (currentUserData[5] && currentUserData[5].startsWith('http')) {
        document.getElementById('chk-profile-img').src = currentUserData[5];
    }

    startCamera('chk');
    startBackgroundGPS();

    document.getElementById('btn-checkin').onclick = processOneClickCheckin;
}

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
    let inRange = false;
    let nearestDistance = Infinity;
    let targetLocationName = "ไม่ทราบสถานที่";

    for (const loc of TARGET_LOCATIONS) {
        const distance = calculateDistance(lat, lng, loc.lat, loc.lng);
        if (distance < nearestDistance) nearestDistance = distance;

        if (distance <= loc.range) {
            inRange = true;
            targetLocationName = loc.name;
            break;
        }
    }

    if (!inRange) {
        return Swal.fire({ icon: "error", title: "อยู่นอกพื้นที่!", text: `คุณอยู่ห่างจากจุดลงเวลาที่ใกล้ที่สุด ${nearestDistance.toFixed(0)} เมตร`, confirmButtonColor: "#0f766e" });
    }

    try {
        const capturedImageBase64 = captureOptimizedFrame('chk').split(",")[1];
        const jobType = document.querySelector('input[name="job-type"]:checked').value;
        const note = document.getElementById('chk-note').value;

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
            address: targetLocationName,
            user: currentUserId
        };

        fetch(CONFIG.WEB_APP_API, { method: "POST", body: JSON.stringify(payload) })
            .then(() => {
                Swal.fire("สำเร็จ!", "บันทึกเวลาเรียบร้อยแล้ว", "success").then(() => sendFlexMessage(payload));
            })
            .catch(() => Swal.fire("ข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลได้", "error"));
    } catch (e) {
        Swal.fire("ข้อผิดพลาด", "กรุณาถ่ายภาพก่อนลงเวลา (ไม่พบกล้อง)", "warning");
    }
}

function processOneClickCheckin() {
    Swal.fire({ title: 'กำลังตรวจสอบพิกัด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    if (cachedLocation) {
        executeCheckin(cachedLocation.latitude, cachedLocation.longitude);
    } else {
        if (!navigator.geolocation) return Swal.fire("ไม่รองรับ", "อุปกรณ์ของคุณไม่รองรับ GPS", "error");
        navigator.geolocation.getCurrentPosition(
            (pos) => { executeCheckin(pos.coords.latitude, pos.coords.longitude); },
            (err) => { Swal.fire("เกิดข้อผิดพลาด", "กรุณาเปิด GPS (Location) เพื่อลงเวลา", "error"); },
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

            let nearestDistance = Infinity;
            let nearestRange = 30;

            for (const loc of TARGET_LOCATIONS) {
                const dist = calculateDistance(userLat, userLng, loc.lat, loc.lng);
                if (dist < nearestDistance) {
                    nearestDistance = dist;
                    nearestRange = loc.range;
                }
            }

            let distText = nearestDistance <= nearestRange
                ? `<span class="text-emerald-600">อยู่ในระยะ (${nearestDistance.toFixed(0)} ม.)</span>`
                : `<span class="text-rose-600">อยู่นอกระยะ (${nearestDistance.toFixed(0)} ม.)</span>`;
            document.getElementById('mapDistanceText').innerHTML = `ระยะห่างจากจุดใกล้สุด: ${distText}`;

            initOrUpdateMap(userLat, userLng);
        },
        (err) => {
            Swal.fire("ข้อผิดพลาด", "กรุณาเปิด GPS และอนุญาตการเข้าถึง", "error");
        }, { enableHighAccuracy: true }
    );
}

function initOrUpdateMap(userLat, userLng) {
    if (!leafletMap) {
        leafletMap = L.map('map').setView([TARGET_LOCATIONS[0].lat, TARGET_LOCATIONS[0].lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(leafletMap);

        TARGET_LOCATIONS.forEach(loc => {
            L.circle([loc.lat, loc.lng], {
                color: '#0f766e',
                fillColor: '#14b8a6',
                fillOpacity: 0.2,
                radius: loc.range
            }).addTo(leafletMap);

            L.marker([loc.lat, loc.lng]).addTo(leafletMap)
                .bindPopup(`<b>${loc.name}</b>`);
        });
    }

    const customIcon = L.divIcon({ className: 'pulsing-dot', iconSize: [14, 14], iconAnchor: [7, 7] });

    if (userMarker) leafletMap.removeLayer(userMarker);
    userMarker = L.marker([userLat, userLng], { icon: customIcon }).addTo(leafletMap).bindPopup("ตำแหน่งของคุณ");

    const bounds = L.latLngBounds([[TARGET_LOCATIONS[0].lat, TARGET_LOCATIONS[0].lng], [userLat, userLng]]);
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
                    {
                        type: "box", layout: "vertical", contents: [
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "วันที่", weight: "bold", color: "#64748b", flex: 2 }, { type: "text", text: displayThaiDate, weight: "bold", align: "end", color: "#0f172a", flex: 5 }] },
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "เวลา", weight: "bold", color: "#64748b", flex: 2 }, { type: "text", text: data.time + " น.", weight: "bold", size: "xl", color: jobColor, align: "end", flex: 5 }] }
                        ]
                    },
                    { type: "separator" },
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