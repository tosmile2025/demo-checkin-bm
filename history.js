// ==========================================
// 🕒 HISTORY SYSTEM (ระบบประวัติการลงเวลา)
// ==========================================

const itemsPerPage = 15;
let currentPage = 1;
let historyData = [];
let currentUserId = null;

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
            const profile = await liff.getProfile();
            currentUserId = profile.userId;
            document.getElementById('userId').value = currentUserId;
            await loadUserDataAndHistory();
        } else {
            liff.login();
        }
    } catch (error) {
        console.error("LIFF Init Error:", error);
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อระบบ LINE ได้", "error");
    }
}

// ==========================================
// 📡 FETCH DATA (ดึงข้อมูลนิสิต + ประวัติ)
// ==========================================
async function loadUserDataAndHistory() {
    const tableBody = document.getElementById('data-table');
    tableBody.innerHTML = `<tr><td colspan="3" class="py-10 text-center text-slate-400"><div class="animate-spin rounded-full h-8 w-8 border-2 border-medical-200 border-t-medical-600 mx-auto mb-3"></div>กำลังโหลด...</td></tr>`;

    try {
        // 1. ยิง API ดึงข้อมูลส่วนตัว (จากชีต สมาชิก)
        const memberPromise = fetch(CONFIG.WEB_APP_API, {
            method: 'POST',
            body: JSON.stringify({ action: 'fetchData', source: 'member', userId: currentUserId })
        }).then(res => res.json());

        // 2. ยิง API ดึงประวัติการลงเวลา (จากชีต ลงเวลา)
        const historyPromise = fetch(CONFIG.WEB_APP_API, {
            method: 'POST',
            body: JSON.stringify({ action: 'fetchData', userId: currentUserId })
        }).then(res => res.json());

        // รอให้โหลดเสร็จทั้งคู่
        const [memberData, allHistoryData] = await Promise.all([memberPromise, historyPromise]);

        // 🖼️ อัปเดตข้อมูลส่วนตัวด้านบน
        const myProfile = memberData.find(row => row[1] === currentUserId);
        if (myProfile) {
            document.getElementById('profile-img').src = myProfile[5] || 'https://via.placeholder.com/80';
            document.getElementById('profile-name').textContent = myProfile[2] || 'ไม่ระบุชื่อ';
            document.getElementById('profile-id').textContent = `รหัส: ${myProfile[3] || '-'} | ${myProfile[4] || ''}`;
        } else {
            document.getElementById('profile-name').textContent = 'ไม่พบประวัติลงทะเบียน';
            document.getElementById('profile-id').textContent = '-';
        }

        // 📋 จัดการข้อมูลประวัติ
        // กรองเอาเฉพาะข้อมูลของ User คนปัจจุบัน (คอลัมน์ Index 11) และตัด Header
        historyData = allHistoryData.filter((row, index) => index > 0 && row[11] === currentUserId);

        if (historyData.length > 0) {
            historyData.reverse(); // ล่าสุดขึ้นก่อน
            buildTable();
        } else {
            tableBody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-slate-400">ยังไม่มีประวัติการลงเวลา</td></tr>';
            document.getElementById('pagination-controls').innerHTML = '';
            document.getElementById('rowsInfo').textContent = 'หน้า 1/1';
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        tableBody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-rose-500"><i class="fas fa-exclamation-circle text-2xl mb-2 block"></i>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
}

// ==========================================
// 📅 DATE FORMATTER (แปลงวันที่เป็นภาษาไทย)
// ==========================================
// แปลงจาก "31/03/2026", "08:30" ให้เป็น -> "31 มี.ค. 2569 08:30 น."
function formatThaiDateTime(dateStr, timeStr) {
    if (!dateStr) return "-";

    const parts = dateStr.split('/'); // คาดหวัง DD/MM/YYYY
    if (parts.length !== 3) return `${dateStr} ${timeStr || ''}`; // ถ้าฟอร์แมตผิด ให้คืนค่าเดิม

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Array เริ่มที่ 0
    let year = parseInt(parts[2], 10);

    // แปลง ค.ศ. เป็น พ.ศ. (ถ้าข้อมูลมาเป็น ค.ศ.)
    if (year < 2500) year += 543;

    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const timeFormatted = timeStr ? `${timeStr} น.` : '';

    return `${day} ${thaiMonths[month]} ${year} <span class="text-medical-600 ml-1">${timeFormatted}</span>`;
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

        // --- 1. จัดการข้อมูล (อิงตาม Index ของ Sheet ลงเวลา) ---
        const job = row[4];         // เข้างาน / ออกงาน
        const status = row[12];     // สาย / ตรงเวลา / ออกก่อนเวลา
        const minutes = row[13];    // นาทีที่สายหรือออกก่อน
        const note = row[5] || "-"; // หมายเหตุ
        const dateStr = row[6];     // วันที่ 
        const timeStr = row[7];     // เวลา

        // สร้างข้อความสถานะย่อย
        let statusSubText = "";
        if (status && status !== "ปกติ" && status !== "ตรงเวลา") {
            statusSubText = `<div class="text-[9px] mt-0.5 opacity-80">${status} ${minutes ? minutes + ' นาที' : ''}</div>`;
        }

        // --- 2. จัดการสี (Tailwind JIT Safe Classes) ---
        let badgeStyle = "border-slate-200 text-slate-600 bg-slate-50";
        let dotStyle = "bg-slate-400";

        if (job === 'เข้างาน') {
            if (status === 'สาย') {
                badgeStyle = "border-amber-200 text-amber-700 bg-amber-50";
                dotStyle = "bg-amber-500";
            } else {
                badgeStyle = "border-medical-200 text-medical-700 bg-medical-50";
                dotStyle = "bg-medical-500";
            }
        } else if (job === 'ออกงาน') {
            if (status === 'ออกก่อนเวลา') {
                badgeStyle = "border-orange-200 text-orange-700 bg-orange-50";
                dotStyle = "bg-orange-500";
            } else {
                badgeStyle = "border-rose-200 text-rose-700 bg-rose-50";
                dotStyle = "bg-rose-500";
            }
        } else if (job === 'ระหว่างวัน') {
            badgeStyle = "border-blue-200 text-blue-700 bg-blue-50";
            dotStyle = "bg-blue-500";
        }

        // --- 3. สร้าง HTML ---
        // เซลล์ 1: สถานะ
        const tdStatus = document.createElement('td');
        tdStatus.className = 'py-3 px-3 text-center align-top';
        tdStatus.innerHTML = `
            <div class="inline-flex flex-col items-center justify-center px-2 py-1.5 rounded-lg border ${badgeStyle} min-w-[70px]">
                <div class="flex items-center text-[11px] font-bold">
                    <span class="w-1.5 h-1.5 rounded-full ${dotStyle} mr-1.5"></span> ${job}
                </div>
                ${statusSubText}
            </div>
        `;

        // เซลล์ 2: วันที่/เวลา (ใช้ Format ภาษาไทย)
        const tdDateTime = document.createElement('td');
        tdDateTime.className = 'py-3 px-3 align-top';
        tdDateTime.innerHTML = `<div class="text-xs font-medium text-slate-700 leading-relaxed">${formatThaiDateTime(dateStr, timeStr)}</div>`;

        // เซลล์ 3: หมายเหตุ
        const tdNote = document.createElement('td');
        tdNote.className = 'py-3 px-3 align-top text-xs text-slate-500 max-w-[100px] truncate';
        tdNote.innerHTML = note !== "-" ? `<span class="bg-slate-100 px-2 py-1 rounded text-[10px] text-slate-600 truncate block">${note}</span>` : "-";

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

    document.getElementById('rowsInfo').textContent = `หน้า ${currentPage}/${totalPages}`;

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = 'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors focus:outline-none';

        if (i === currentPage) {
            btn.classList.add('bg-medical-700', 'text-white', 'shadow-sm');
        } else {
            btn.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200', 'hover:bg-medical-50', 'hover:text-medical-700');
        }

        btn.addEventListener('click', () => {
            currentPage = i;
            buildTable();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        paginationContainer.appendChild(btn);
    }
}