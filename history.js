// ==========================================
// 🕒 HISTORY SYSTEM (ระบบประวัติการลงเวลา)
// ==========================================

const itemsPerPage = 10;
let currentPage = 1;
let historyData = []; // เก็บข้อมูลที่กรองแล้วทั้งหมด

// ==========================================
// 🚀 INITIALIZE LIFF
// ==========================================
window.onload = function () {
    initializeLiff();
};

async function initializeLiff() {
    try {
        await liff.init({ liffId: CONFIG.LIFF_ID_HISTORY });
        if (liff.isLoggedIn()) {
            getUserProfile();
        } else {
            liff.login();
        }
    } catch (error) {
        console.error("LIFF Init Error:", error);
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อระบบ LINE ได้", "error");
    }
}

async function getUserProfile() {
    try {
        const profile = await liff.getProfile();
        document.getElementById('userId').value = profile.userId;
        fetchData(profile.userId);
    } catch (error) {
        console.error('Error getting profile data:', error);
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลโปรไฟล์ได้", "error");
    }
}

// ==========================================
// 📡 FETCH DATA (ดึงข้อมูล)
// ==========================================
async function fetchData(userId) {
    const tableBody = document.getElementById('data-table');

    try {
        // ใช้ GET request ปกติ เพราะ Router ใน Backend ที่เราทำไว้ ค่าเริ่มต้นคือส่งข้อมูลลงเวลา (Check-in) กลับมา
        const response = await fetch(CONFIG.WEB_APP_API);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        // กรองเอาเฉพาะข้อมูลของ User คนปัจจุบัน (คอลัมน์ Index 11 คือ UserID)
        // และเอาแถวที่ 0 (Header) ออกไป (ถ้ามี)
        historyData = data.filter((row, index) => index > 0 && row[11] === userId);

        if (historyData.length > 0) {
            // ดึงชื่อและรหัสพนักงานจากรายการล่าสุด (อยู่ท้ายสุดของ Array)
            const lastRow = historyData[historyData.length - 1];
            document.getElementById('name-info').textContent = lastRow[2] || "ไม่ระบุชื่อ";
            document.getElementById('employee-id-info').textContent = "รหัส: " + (lastRow[3] || "-");

            // นำข้อมูลมากลับด้าน (ล่าสุดขึ้นก่อน) แล้วสร้างตาราง
            historyData.reverse();
            buildTable();
        } else {
            document.getElementById('name-info').textContent = "ยังไม่มีประวัติ";
            document.getElementById('employee-id-info').textContent = "-";
            tableBody.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-slate-500">ไม่พบประวัติการลงเวลาของคุณ</td></tr>';
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        tableBody.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-rose-500">เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>';
    }
}

// ==========================================
// 🛠️ RENDER TABLE (แสดงตาราง)
// ==========================================
function buildTable() {
    const table = document.getElementById('data-table');
    table.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = historyData.slice(startIndex, endIndex);

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';

        // --- 1. จัดการข้อมูล ---
        const job = row[4];         // เข้างาน / ออกงาน
        const status = row[12];     // สาย / ตรงเวลา / ล่วงเวลา
        const minutes = row[13];    // นาที
        const note = row[5] || "-"; // หมายเหตุ
        const dateStr = row[6];     // วันที่ 
        const timeStr = row[7];     // เวลา

        // สร้างข้อความสถานะ
        let statusText = job;
        if (status && status !== "ปกติ" && status !== "ตรงเวลา") {
            statusText = `${job} (${status} ${minutes ? minutes + ' นาที' : ''})`;
        }

        // --- 2. จัดการสี (Tailwind JIT Safe Classes) ---
        let badgeStyle = "border-slate-300 text-slate-600";
        let dotStyle = "bg-slate-400";

        if (job === 'เข้างาน') {
            if (status === 'สาย') {
                badgeStyle = "border-amber-400 text-amber-600 bg-amber-50";
                dotStyle = "bg-amber-500";
            } else {
                badgeStyle = "border-emerald-200 text-emerald-600 bg-emerald-50";
                dotStyle = "bg-emerald-500";
            }
        } else if (job === 'ออกงาน') {
            badgeStyle = "border-rose-200 text-rose-600 bg-rose-50";
            dotStyle = "bg-rose-500";
        }

        // --- 3. สร้าง HTML ---
        // เซลล์สถานะ
        const tdStatus = document.createElement('td');
        tdStatus.className = 'py-3 px-4 text-center whitespace-nowrap';
        tdStatus.innerHTML = `
            <div class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeStyle}">
                <span class="w-1.5 h-1.5 rounded-full ${dotStyle} mr-1.5"></span>
                ${statusText}
            </div>
        `;

        // เซลล์วันที่/เวลา
        const tdDateTime = document.createElement('td');
        tdDateTime.className = 'py-3 px-4 whitespace-nowrap';
        tdDateTime.innerHTML = `
            <div class="font-medium text-slate-800">${dateStr}</div>
            <div class="text-[11px] text-slate-500 font-bold">${timeStr} น.</div>
        `;

        // เซลล์หมายเหตุ
        const tdNote = document.createElement('td');
        tdNote.className = 'py-3 px-4 min-w-[120px] text-xs text-slate-600';
        tdNote.textContent = note;

        tr.appendChild(tdStatus);
        tr.appendChild(tdDateTime);
        tr.appendChild(tdNote);
        table.appendChild(tr);
    });

    updatePaginationControls();
}

// ==========================================
// 📄 PAGINATION (การแบ่งหน้า)
// ==========================================
function updatePaginationControls() {
    const totalPages = Math.ceil(historyData.length / itemsPerPage);
    const paginationContainer = document.getElementById('pagination-controls');
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = 'h-8 w-8 rounded-lg flex items-center justify-center text-sm font-semibold transition-colors focus:outline-none';

        if (i === currentPage) {
            btn.classList.add('bg-slate-800', 'text-white', 'shadow-sm');
        } else {
            btn.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200', 'hover:bg-slate-100');
        }

        btn.addEventListener('click', () => {
            currentPage = i;
            buildTable(); // ไม่ต้อง Fetch ใหม่แล้ว แค่สร้างตารางใหม่จากข้อมูลเดิมที่โหลดมาแล้ว
            window.scrollTo({ top: 0, behavior: 'smooth' }); // เลื่อนกลับขึ้นบนสุดเมื่อเปลี่ยนหน้า
        });

        paginationContainer.appendChild(btn);
    }
}