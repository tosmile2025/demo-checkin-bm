// ==========================================
// 📍 INDEX & CHECK-IN SYSTEM (ศูนย์แพทย์ พุทธชินราช)
// ==========================================

// ตัวแปรส่วนกลาง
let currentUser = { id: "", name: "", role: "" };
let currentLocation = { lat: 0, lng: 0, address: "" };
let currentStream = null;
let currentFacingMode = "user";
let isMirrored = true;
let mapInstance = null;
let markerInstance = null;
let capturedRegImage = ""; // เก็บรูปตอนลงทะเบียน

// ==========================================
// 🎨 1. DYNAMIC THEME SYSTEM (ระบบสีโหลด 0 วินาที)
// ==========================================
loadAndApplyTheme();

function loadAndApplyTheme() {
    const cachedColor = localStorage.getItem('appThemeColor');
    if (cachedColor) applyTheme(cachedColor);

    fetch(CONFIG.WEB_APP_API, {
        method: 'POST',
        body: JSON.stringify({ action: 'getTheme' })
    })
        .then(res => res.json())
        .then(data => {
            if (data.color && data.color !== cachedColor) {
                localStorage.setItem('appThemeColor', data.color);
                applyTheme(data.color);
            }
        })
        .catch(error => console.log("Theme Fetch Error"));
}

function applyTheme(hexColor) {
    if (!hexColor || hexColor === '') return;
    let styleTag = document.getElementById('dynamic-theme');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-theme';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
        .bg-medical-700 { background-color: ${hexColor} !important; }
        .text-medical-700 { color: ${hexColor} !important; }
        .border-medical-700 { border-color: ${hexColor} !important; }
        .from-medical-600 { --tw-gradient-from: ${hexColor} !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
        .to-medical-700 { --tw-gradient-to: ${hexColor} !important; }
        .text-medical-600 { color: ${hexColor} !important; }
        .bg-medical-50 { background-color: ${hexColor}15 !important; }
        input[type="radio"]:checked + label {
            background-color: ${hexColor} !important;
            color: white !important;
            border-color: ${hexColor} !important;
            box-shadow: 0 4px 6px -1px ${hexColor}40 !important;
        }
    `;
}

// ==========================================
// 🚀 2. INITIALIZE & LIFF
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadRolesToRegistration();
    initializeLiff();
    getLocation(); // เริ่มหาพิกัดทันที
    setInterval(updateDateTime, 1000);
    updateDateTime();
});

async function initializeLiff() {
    try {
        await liff.init({ liffId: CONFIG.LIFF_ID_CHECKIN });
        if (liff.isLoggedIn()) {
            await getUserProfile();
        } else {
            liff.login();
        }
    } catch (error) {
        showErrorState("ไม่สามารถเริ่มระบบ LINE ได้");
    }
}

async function getUserProfile() {
    try {
        const profile = await liff.getProfile();
        currentUser.id = profile.userId;
        const lineIdInput = document.getElementById("reg-lineId");
        if (lineIdInput) lineIdInput.value = profile.userId;
        await checkUserRegistration(profile.userId);
    } catch (error) {
        showErrorState("ไม่สามารถดึงข้อมูลโปรไฟล์ได้");
    }
}

// ==========================================
// 📡 3. ROUTING & DATA FETCH
// ==========================================
async function loadRolesToRegistration() {
    try {
        const res = await fetch(CONFIG.WEB_APP_API, {
            method: 'POST',
            body: JSON.stringify({ action: 'getRoles' })
        });
        const roles = await res.json();
        const deptSelect = document.getElementById('reg-dept');
        if (!deptSelect) return;

        deptSelect.innerHTML = '<option value="" disabled selected>-- เลือกตำแหน่ง / ชั้นปี --</option>';
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.name;
            option.textContent = role.name;
            deptSelect.appendChild(option);
        });
    } catch (error) { console.error("Error loading roles"); }
}

async function checkUserRegistration(userId) {
    try {
        const response = await fetch(CONFIG.WEB_APP_API, {
            method: "POST",
            body: JSON.stringify({ action: "fetchData", source: "member" })
        });
        const data = await response.json();
        const userRows = data.filter((row) => row[1] === userId);

        const loadingView = document.getElementById("loadingView");
        loadingView.classList.add("opacity-0", "pointer-events-none");

        setTimeout(() => {
            loadingView.classList.add("hidden");
            if (userRows.length > 0) {
                // เคยลงทะเบียนแล้ว -> ไปหน้า Check-in
                userRows.sort((a, b) => new Date(b[6]) - new Date(a[6]));
                setupCheckinView(userRows[0]);
                document.getElementById("checkinView").classList.remove("hidden");
                startCamera('chk');
            } else {
                // ยังไม่ลงทะเบียน -> ไปหน้า Register
                document.getElementById("registerView").classList.remove("hidden");
                startCamera('reg');
            }
        }, 500);
    } catch (error) {
        showErrorState("ไม่สามารถดึงข้อมูลจากฐานข้อมูลได้");
    }
}

function setupCheckinView(row) {
    currentUser.name = row[2] || "ไม่ระบุชื่อ";
    currentUser.role = row[4] || "ไม่ระบุตำแหน่ง";
    const profileImg = row[5] || "https://via.placeholder.com/100";

    document.getElementById("chk-name").textContent = currentUser.name;
    document.getElementById("chk-details").textContent = currentUser.role;

    const imgEl = document.getElementById("chk-profile-img");
    if (imgEl && profileImg.startsWith("http")) imgEl.src = profileImg;
}

function showErrorState(msg) {
    document.getElementById("loadingError").classList.remove("hidden");
    document.getElementById("loadingContent").classList.add("hidden");
    document.getElementById("loadingErrorText").textContent = msg;
}

// ==========================================
// 📸 4. CAMERA SYSTEM
// ==========================================
function startCamera(prefix) {
    const video = document.getElementById(`${prefix}-camera-preview`);
    if (!video) return;

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } })
        .then(stream => {
            currentStream = stream;
            video.srcObject = stream;
            video.style.transform = (currentFacingMode === 'user' && isMirrored) ? 'scaleX(-1)' : 'scaleX(1)';
        })
        .catch(error => {
            Swal.fire("ข้อผิดพลาด", "ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง", "error");
        });
}

function switchCamera(prefix) {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    isMirrored = currentFacingMode === "user"; // กล้องหน้าควรกลับซ้ายขวา
    startCamera(prefix);
}

function toggleMirror(prefix) {
    isMirrored = !isMirrored;
    const video = document.getElementById(`${prefix}-camera-preview`);
    if (video) video.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
}

// ฟังก์ชันดึงภาพจากวิดีโอ (แปลงเป็น Base64)
function captureVideoFrame(prefix) {
    const video = document.getElementById(`${prefix}-camera-preview`);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    // ถ้าภาพกลับซ้ายขวา ให้กลับภาพใน Canvas ด้วยก่อนส่ง
    if (video.style.transform.includes('scaleX(-1)')) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}

// การจัดการกล้องหน้าลงทะเบียน
const regCaptureBtn = document.getElementById('reg-capture-btn');
const regRetakeBtn = document.getElementById('reg-retake-btn');
if (regCaptureBtn) {
    regCaptureBtn.addEventListener('click', () => {
        const video = document.getElementById('reg-camera-preview');
        const img = document.getElementById('reg-preview');
        capturedRegImage = captureVideoFrame('reg');
        img.src = "data:image/jpeg;base64," + capturedRegImage;
        img.style.transform = video.style.transform;

        video.classList.add('hidden');
        img.classList.remove('hidden');
        document.getElementById('reg-camera-guide').classList.add('hidden');
        regCaptureBtn.classList.add('hidden');
        regRetakeBtn.classList.remove('hidden');
    });
}
if (regRetakeBtn) {
    regRetakeBtn.addEventListener('click', () => {
        capturedRegImage = "";
        document.getElementById('reg-camera-preview').classList.remove('hidden');
        document.getElementById('reg-preview').classList.add('hidden');
        document.getElementById('reg-camera-guide').classList.remove('hidden');
        regCaptureBtn.classList.remove('hidden');
        regRetakeBtn.classList.add('hidden');
    });
}

// ==========================================
// 📍 5. LOCATION & LEAFLET MAP
// ==========================================
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLocation.lat = position.coords.latitude;
                currentLocation.lng = position.coords.longitude;
                checkDistance();
                fetchAddress(currentLocation.lat, currentLocation.lng);
                initMap(currentLocation.lat, currentLocation.lng);
            },
            (error) => { console.warn("Location error:", error); },
            { enableHighAccuracy: true }
        );
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkDistance() {
    const distance = calculateDistance(currentLocation.lat, currentLocation.lng, CONFIG.TARGET_LATITUDE, CONFIG.TARGET_LONGITUDE);
    const distText = document.getElementById("mapDistanceText");
    const btnCheckin = document.getElementById("btn-checkin");

    if (distance > CONFIG.ALLOWED_RANGE_METERS) {
        if (distText) distText.innerHTML = `<span class="text-rose-500 font-bold"><i class="fas fa-exclamation-circle"></i> ห่างเป้าหมาย ${distance.toFixed(0)}ม. (อนุญาต ${CONFIG.ALLOWED_RANGE_METERS}ม.)</span>`;
        if (btnCheckin) {
            btnCheckin.disabled = true;
            btnCheckin.className = "w-full bg-slate-300 text-slate-500 font-bold text-lg py-4 rounded-2xl cursor-not-allowed flex items-center justify-center";
        }
    } else {
        if (distText) distText.innerHTML = `<span class="text-emerald-500 font-bold"><i class="fas fa-check-circle"></i> อยู่ในพื้นที่ (${distance.toFixed(0)} ม.)</span>`;
        if (btnCheckin) {
            btnCheckin.disabled = false;
            btnCheckin.className = "w-full bg-gradient-to-r from-medical-600 to-medical-700 text-white font-bold text-lg py-4 rounded-2xl shadow-[0_8px_20px_rgba(20,184,166,0.3)] hover:shadow-[0_8px_25px_rgba(20,184,166,0.4)] transition transform hover:-translate-y-0.5 flex items-center justify-center";
            // เรียก Theme มาอัปเดตปุ่มอีกรอบ
            applyTheme(localStorage.getItem('appThemeColor'));
        }
    }
}

function fetchAddress(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => { currentLocation.address = data.display_name || "ไม่สามารถระบุตำแหน่งได้"; });
}

function initMap(lat, lng) {
    if (!document.getElementById('map')) return;
    if (!mapInstance) {
        mapInstance = L.map('map').setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
        markerInstance = L.marker([lat, lng]).addTo(mapInstance);
    } else {
        mapInstance.setView([lat, lng], 16);
        markerInstance.setLatLng([lat, lng]);
    }
}

function openMapModal() {
    const modal = document.getElementById('mapModal');
    const content = document.getElementById('mapModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('translate-y-full');
        if (mapInstance) mapInstance.invalidateSize(); // แก้บัค Leaflet โหลดไม่เต็มจอ
    }, 10);
}

function closeMapModal() {
    const modal = document.getElementById('mapModal');
    const content = document.getElementById('mapModalContent');
    modal.classList.add('opacity-0');
    content.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// ==========================================
// ⏱️ 6. TIME FORMATTING
// ==========================================
function updateDateTime() {
    const now = new Date();
    const timeEl = document.getElementById("headerTime");
    const dateEl = document.getElementById("headerDate");
    if (timeEl) timeEl.textContent = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
    if (dateEl) dateEl.textContent = now.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

// ==========================================
// 💾 7. SUBMIT REGISTRATION
// ==========================================
const btnRegister = document.getElementById('btn-register');
if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
        const name = document.getElementById('reg-name').value;
        const empId = document.getElementById('reg-empId').value;
        const dept = document.getElementById('reg-dept').value;

        if (!name || !empId || !dept || !capturedRegImage) {
            Swal.fire("ข้อมูลไม่ครบ", "กรุณากรอกข้อมูลและถ่ายรูปให้ครบถ้วน", "warning");
            return;
        }

        Swal.fire({ title: "กำลังบันทึก...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const payload = {
            userlineId: currentUser.id,
            nameId: name,
            keynumberId: empId,
            keynumber2Id: dept,
            base64: capturedRegImage
        };

        try {
            await fetch(CONFIG.WEB_APP_API, { method: "POST", body: JSON.stringify(payload) });
            Swal.fire({ icon: "success", title: "สำเร็จ", text: "ลงทะเบียนเรียบร้อยแล้ว", timer: 1500, showConfirmButton: false });
            setTimeout(() => { window.location.reload(); }, 1500); // รีโหลดเพื่อเข้าหน้า Check-in
        } catch (error) {
            Swal.fire("ข้อผิดพลาด", "ลงทะเบียนล้มเหลว", "error");
        }
    });
}

// ==========================================
// 💾 8. SUBMIT CHECK-IN & LINE FLEX
// ==========================================
const btnCheckin = document.getElementById('btn-checkin');
if (btnCheckin) {
    btnCheckin.addEventListener('click', () => {
        if (currentLocation.lat === 0) {
            Swal.fire("รอสักครู่", "กำลังค้นหาพิกัดของคุณ...", "warning");
            return;
        }

        Swal.fire({
            title: "ยืนยันการบันทึกเวลา",
            text: "ระบบจะบันทึกพิกัดและรูปภาพ ณ เวลานี้",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "บันทึกเวลา",
            cancelButtonText: "ยกเลิก",
            confirmButtonColor: localStorage.getItem('appThemeColor') || "#0f766e"
        }).then(async (result) => {
            if (result.isConfirmed) {
                btnCheckin.disabled = true;
                Swal.fire({ title: "กำลังบันทึกข้อมูล", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                // ถ่ายรูปจากวิดีโอ ณ วินาทีที่กดปุ่ม
                const checkinBase64 = captureVideoFrame('chk');
                const selectedJob = document.querySelector('input[name="job-type"]:checked').value;
                const noteValue = document.getElementById('chk-note').value;

                const now = new Date();
                const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
                const todayStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

                let obj = {
                    base64: checkinBase64,
                    user: currentUser.id,
                    name: currentUser.name,
                    role: currentUser.role,
                    job: selectedJob,
                    note: noteValue,
                    lat: currentLocation.lat,
                    long: currentLocation.lng,
                    address: currentLocation.address,
                    today: todayStr,
                    time: timeStr
                };

                try {
                    await fetch(CONFIG.WEB_APP_API, { method: "POST", body: JSON.stringify(obj) });
                    Swal.fire("สำเร็จ!", "บันทึกเวลาของคุณเรียบร้อย", "success").then(() => {
                        sendFlexMessage(obj);
                    });
                } catch (error) {
                    Swal.fire("Error!", "การส่งข้อมูลล้มเหลว กรุณาลองใหม่", "error");
                    btnCheckin.disabled = false;
                }
            }
        });
    });
}

async function sendFlexMessage(data) {
    const themeColor = localStorage.getItem('appThemeColor') || "#0f766e";
    const flexMessage = {
        type: "flex",
        altText: "บันทึกเวลาสำเร็จ: " + data.job,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box", layout: "vertical", spacing: "md",
                contents: [
                    {
                        type: "box", layout: "horizontal", contents: [
                            { type: "text", text: "บันทึกเวลาปฎิบัติงาน", weight: "bold", size: "md", color: themeColor },
                            { type: "text", text: data.job, weight: "bold", size: "md", color: "#0D9608", align: "end" }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical", spacing: "sm", contents: [
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "ชื่อ", weight: "bold", size: "sm" }, { type: "text", text: data.name, size: "sm", align: "end", wrap: true }] },
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "ตำแหน่ง", weight: "bold", size: "sm" }, { type: "text", text: data.role, size: "sm", align: "end", color: "#666666" }] }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical", contents: [
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "วันที่", weight: "bold" }, { type: "text", text: data.today, weight: "bold", align: "end" }] },
                            { type: "box", layout: "baseline", contents: [{ type: "text", text: "เวลา", weight: "bold" }, { type: "text", text: data.time, weight: "bold", size: "xl", color: themeColor, align: "end" }] }
                        ]
                    },
                    { type: "separator" },
                    {
                        type: "box", layout: "vertical", spacing: "xs", contents: [
                            { type: "text", text: "สถานที่", weight: "bold", size: "sm" },
                            { type: "text", text: data.address, wrap: true, size: "xs", color: "#666666" }
                        ]
                    }
                ]
            }
        }
    };
    try {
        await liff.sendMessages([flexMessage]);
        liff.closeWindow();
    } catch (err) { console.error("Send Flex Error", err); liff.closeWindow(); }
}