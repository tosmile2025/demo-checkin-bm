// ==========================================
// 🕒 ADMIN TIME SETTINGS (หน้าตั้งค่าเวลา)
// ==========================================

let timeSettings = [];

// 🔒 ตรวจสอบการ Login
function checkAdminAuth(callback) {
    if (sessionStorage.getItem('adminAuth') === 'true') {
        if (callback) callback();
        return;
    }
    Swal.fire({
        title: '🔒 เข้าสู่ระบบผู้ดูแล',
        input: 'password',
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: 'เข้าสู่ระบบ',
        confirmButtonColor: '#0f766e',
        showLoaderOnConfirm: true,
        preConfirm: async (password) => {
            try {
                const res = await fetch(CONFIG.WEB_APP_API, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'verifyPassword', password: password })
                });
                const result = await res.json();
                if (!result.success) { Swal.showValidationMessage('รหัสผ่านไม่ถูกต้อง!'); return false; }
                return true;
            } catch (e) {
                Swal.showValidationMessage('การเชื่อมต่อล้มเหลว');
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            sessionStorage.setItem('adminAuth', 'true');
            if (callback) callback();
        }
    });
}

// 🚀 เริ่มต้นทำงาน
document.addEventListener("DOMContentLoaded", () => {
    checkAdminAuth(fetchTimeSettings);
});

// 📡 โหลดข้อมูลจาก Google Sheet
async function fetchTimeSettings() {
    try {
        const res = await fetch(CONFIG.WEB_APP_API, {
            method: "POST",
            body: JSON.stringify({ action: "getTimeSettings" })
        });
        timeSettings = await res.json();

        // ถ้าไม่มีข้อมูลเลย ให้ใช้ค่าเริ่มต้น
        if (!Array.isArray(timeSettings) || timeSettings.length === 0) {
            timeSettings = [
                { job: 'ราว ward', time: '08:30' },
                { job: 'เข้าเวร', time: '08:30' },
                { job: 'ออกเวร', time: '16:30' }
            ];
        }
        renderTimeList();
    } catch (e) {
        console.error(e);
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลตั้งค่าเวลาได้ (โปรดตรวจสอบการ Deploy New Version)", "error");
    }
}

// 🖥️ แสดงผลรายการ
function renderTimeList() {
    const listEl = document.getElementById('timeList');
    listEl.innerHTML = '';

    timeSettings.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = "flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 items-end sm:items-center";
        row.innerHTML = `
            <div class="w-full sm:flex-1">
                <label class="block text-[11px] font-bold text-slate-500 mb-1 pl-1">ชื่อหมวด (เช่น เข้าเวร, ออกเวร)</label>
                <input type="text" value="${item.job}" oninput="updateData(${index}, 'job', this.value)" class="w-full bg-white border border-slate-300 p-2.5 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-medical-500 shadow-sm" placeholder="ระบุชื่อหมวด">
            </div>
            <div class="w-full sm:w-48">
                <label class="block text-[11px] font-bold text-slate-500 mb-1 pl-1">เวลา (ที่เริ่มนับว่าสาย/ล่วงเวลา)</label>
                <input type="time" value="${item.time}" oninput="updateData(${index}, 'time', this.value)" class="w-full bg-white border border-slate-300 p-2.5 rounded-xl text-sm font-bold text-medical-700 outline-none focus:border-medical-500 shadow-sm">
            </div>
            <button onclick="removeTimeRow(${index})" class="w-full sm:w-auto mt-2 sm:mt-0 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 px-4 py-2.5 rounded-xl text-sm font-bold transition shadow-sm h-full flex items-center justify-center">
                <i class="fas fa-trash-alt sm:mr-0 mr-2"></i><span class="sm:hidden">ลบหมวดนี้</span>
            </button>
        `;
        listEl.appendChild(row);
    });
}

function updateData(index, key, value) {
    timeSettings[index][key] = value;
}

function addTimeRow() {
    timeSettings.push({ job: '', time: '08:00' });
    renderTimeList();
}

function removeTimeRow(index) {
    if (timeSettings.length <= 1) {
        Swal.fire("แจ้งเตือน", "ต้องมีอย่างน้อย 1 หมวด", "warning");
        return;
    }
    timeSettings.splice(index, 1);
    renderTimeList();
}

// 💾 บันทึกข้อมูลกลับไปที่ Google Sheet
async function saveAllSettings() {
    // เช็คช่องว่าง
    for (let i = 0; i < timeSettings.length; i++) {
        if (!timeSettings[i].job.trim() || !timeSettings[i].time.trim()) {
            Swal.fire("ข้อมูลไม่ครบ", "กรุณากรอกชื่อหมวดและเวลาให้ครบทุกช่อง", "warning");
            return;
        }
    }

    const btn = document.getElementById('saveBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> กำลังบันทึก...';
    btn.disabled = true;

    try {
        await fetch(CONFIG.WEB_APP_API, {
            method: "POST",
            body: JSON.stringify({ action: "saveTimeSettings", times: timeSettings })
        });
        Swal.fire({ title: "สำเร็จ!", text: "บันทึกการตั้งค่าเวลาเรียบร้อยแล้ว", icon: "success", timer: 2000, showConfirmButton: false });
    } catch (error) {
        Swal.fire("ข้อผิดพลาด", "บันทึกข้อมูลล้มเหลว", "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> บันทึกการตั้งค่า';
        btn.disabled = false;
    }
}