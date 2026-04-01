// ==========================================
// 📱 MOBILE ADMIN DASHBOARD SYSTEM
// ==========================================

const DEFAULT_AVATAR = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/No-Image-Placeholder.svg/330px-No-Image-Placeholder.svg.png";
let fullData = [];
let membersData = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    fetchDataAndDisplay();
    document.getElementById('searchInput').addEventListener('input', renderCards);
});

// ==========================================
// 📡 FETCH DATA
// ==========================================
async function fetchDataAndDisplay() {
    const listEl = document.getElementById('dataList');
    listEl.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400"><div class="animate-spin rounded-full h-8 w-8 border-4 border-medical-200 border-t-medical-600 mb-3"></div><p class="text-sm font-bold">กำลังโหลดข้อมูล...</p></div>`;

    try {
        const [checkinRes, memberRes] = await Promise.all([
            fetch(CONFIG.WEB_APP_API, { method: 'POST', body: JSON.stringify({ action: 'fetchData' }) }),
            fetch(CONFIG.WEB_APP_API, { method: 'POST', body: JSON.stringify({ action: 'fetchData', source: 'member' }) })
        ]);

        const rawData = await checkinRes.json();
        const rawMembers = await memberRes.json();

        if (!Array.isArray(rawData) || rawData.length <= 1) {
            listEl.innerHTML = '<div class="text-center text-slate-400 mt-10"><i class="fas fa-box-open text-4xl mb-2 block"></i>ไม่พบประวัติ</div>';
            return;
        }

        // สลับข้อมูลให้ล่าสุดขึ้นก่อนเสมอ และเก็บข้อมูลสมาชิกลงตัวแปร
        fullData = rawData.slice(1).reverse();
        membersData = Array.isArray(rawMembers) ? rawMembers.slice(1) : [];

        renderCards();
    } catch (error) {
        console.error("Error fetching data:", error);
        listEl.innerHTML = `<div class="text-center text-rose-500 mt-10 font-bold"><i class="fas fa-exclamation-circle text-4xl mb-2 block"></i>โหลดข้อมูลล้มเหลว</div>`;
    }
}

// ==========================================
// 📅 DATE FORMATTER (แปลง ISO -> ไทย แบบฉลาด)
// ==========================================
function formatThai(dateStr, timeStr) {
    try {
        let day, month, year;
        const safeDateStr = String(dateStr).trim();
        const safeTimeStr = String(timeStr).trim();

        if (safeDateStr.includes("T")) {
            const d = new Date(safeDateStr);
            day = d.getDate(); month = d.getMonth(); year = d.getFullYear();
        } else if (safeDateStr.includes("/")) {
            const parts = safeDateStr.split('/');
            if (parts.length === 3) {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                year = parseInt(parts[2], 10);
            } else {
                return { d: safeDateStr, t: safeTimeStr };
            }
        } else {
            return { d: safeDateStr, t: safeTimeStr };
        }

        let tFmt = "-";
        if (safeTimeStr.includes("T")) {
            const t = new Date(safeTimeStr);
            tFmt = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} น.`;
        } else if (safeTimeStr && safeTimeStr !== "undefined" && safeTimeStr !== "-") {
            tFmt = safeTimeStr.replace(" น.", "").trim() + " น.";
        }

        if (year < 2500) year += 543;
        const mTh = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

        return { d: `${day} ${mTh[month]} ${year}`, t: tFmt };
    } catch (e) {
        return { d: String(dateStr), t: String(timeStr) };
    }
}

// ==========================================
// 🔍 FILTERS & RENDER CARDS
// ==========================================
function setFilter(type, btnElement) {
    currentFilter = type;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = "tab-btn px-4 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 whitespace-nowrap";
    });
    btnElement.className = "tab-btn px-4 py-1.5 rounded-full text-xs font-bold bg-medical-600 text-white whitespace-nowrap shadow-sm";
    renderCards();
}

function renderCards() {
    const listEl = document.getElementById('dataList');
    listEl.innerHTML = '';
    const searchVal = document.getElementById('searchInput').value.toLowerCase();

    let count = 0;
    fullData.forEach((item) => {
        const name = String(item[2] || '').toLowerCase();
        const empId = String(item[3] || '').toLowerCase();
        const status = item[4] || '';
        const statusDetail = item[12] || 'ปกติ';

        // 1. กรองการค้นหา
        if (searchVal && !name.includes(searchVal) && !empId.includes(searchVal)) return;

        // 2. กรองแท็บสถานะ
        if (currentFilter !== 'all') {
            if (currentFilter === 'late') {
                if (statusDetail !== 'สาย' && statusDetail !== 'ออกก่อนเวลา') return;
            } else if (status !== currentFilter) return;
        }

        count++;

        // 3. หา Profile นิสิตจากข้อมูลสมาชิก
        const userId = item[11];
        const member = membersData.find(m => m[1] === userId);

        let profileImg = DEFAULT_AVATAR;
        if (member && member[5] && String(member[5]).startsWith("http")) profileImg = member[5];

        item._memberData = member; // แนบไว้ใช้ตอนกดดูใน Modal
        item._profileImg = profileImg;

        let checkinImg = item[1];
        if (!checkinImg || !String(checkinImg).startsWith("http")) checkinImg = DEFAULT_AVATAR;

        const f = formatThai(item[6], item[7]);
        const minutes = item[13] || '';

        // จัดป้ายสถานะ (ซ้ายล่าง)
        let badgeClass = "bg-slate-100 text-slate-600";
        if (status === 'เข้างาน') badgeClass = "bg-medical-50 text-medical-600 border border-medical-100";
        if (status === 'ออกงาน') badgeClass = "bg-rose-50 text-rose-600 border border-rose-100";
        if (status === 'ระหว่างวัน') badgeClass = "bg-amber-50 text-amber-600 border border-amber-100";

        // จัดป้ายความล่าช้า (ขวา)
        let lateHtml = '';
        if (statusDetail === 'สาย') {
            lateHtml = `<span class="bg-rose-50 text-rose-600 text-[10px] font-bold px-1.5 py-0.5 rounded ml-2">+${minutes} น.</span>`;
        } else if (statusDetail === 'ออกก่อนเวลา') {
            lateHtml = `<span class="bg-orange-50 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded ml-2">-${minutes} น.</span>`;
        }

        // สร้าง HTML Card
        const card = document.createElement('div');
        card.className = "bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-3 flex items-center gap-3 active:bg-slate-50 transition cursor-pointer";
        card.onclick = () => openModal(item);

        card.innerHTML = `
            <div class="relative flex-shrink-0">
                <img src="${checkinImg}" class="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-sm">
                <img src="${profileImg}" class="w-5 h-5 rounded-full object-cover border-2 border-white absolute -bottom-1 -right-1 shadow-sm">
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <h3 class="font-bold text-sm text-slate-800 truncate pr-2">${item[2]}</h3>
                    <div class="text-[11px] font-bold text-medical-600 flex-shrink-0">${f.t}</div>
                </div>
                <div class="text-[10px] text-slate-500 font-medium mt-0.5">รหัส: ${item[3]}</div>
                <div class="flex items-center mt-1.5">
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold ${badgeClass}">${status}</span>
                    ${lateHtml}
                </div>
            </div>
        `;
        listEl.appendChild(card);
    });

    if (count === 0) {
        listEl.innerHTML = '<div class="text-center text-slate-400 mt-10"><i class="fas fa-search text-3xl mb-2 block"></i>ไม่พบข้อมูลที่ค้นหา</div>';
    }
}

// ==========================================
// 🖼️ BOTTOM SHEET MODAL (ดูรายละเอียด)
// ==========================================
function openModal(item) {
    const f = formatThai(item[6], item[7]);

    // จัดการรูปภาพ
    document.getElementById('m-checkinImg').src = item[1] && String(item[1]).startsWith("http") ? item[1] : DEFAULT_AVATAR;
    document.getElementById('m-profileImg').src = item._profileImg;

    // ข้อมูลนิสิต
    document.getElementById('m-name').textContent = item[2] || '-';
    document.getElementById('m-id').textContent = `รหัส: ${item[3] || '-'} | ปี ${item._memberData ? item._memberData[4] : '-'}`;

    // สถานะ (เปลี่ยนสีตามประเภท)
    const status = item[4] || '-';
    const statusEl = document.getElementById('m-status');
    statusEl.textContent = status;
    if (status === 'เข้างาน') statusEl.className = "font-bold text-medical-700";
    else if (status === 'ออกงาน') statusEl.className = "font-bold text-rose-600";
    else statusEl.className = "font-bold text-amber-600";

    // วันที่และเวลา
    document.getElementById('m-date').textContent = f.d;
    document.getElementById('m-time').textContent = f.t;

    // ความล่าช้า
    const statusDetail = item[12] || 'ปกติ';
    const minutes = item[13] || '';
    let delayHtml = "-";
    if (statusDetail === 'สาย') {
        delayHtml = `<span class="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md text-xs">+${minutes} นาที</span>`;
    } else if (statusDetail === 'ออกก่อนเวลา') {
        delayHtml = `<span class="text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded-md text-xs">-${minutes} นาที</span>`;
    } else if (statusDetail === 'ตรงเวลา') {
        delayHtml = `<span class="text-emerald-600 font-bold text-xs"><i class="fas fa-check-circle mr-1"></i> ตรงเวลา</span>`;
    }
    document.getElementById('m-delay').innerHTML = delayHtml;

    // สถานที่ และ หมายเหตุ
    document.getElementById('m-location').textContent = item[8] || 'ไม่มีข้อมูลสถานที่';
    document.getElementById('m-note').textContent = item[5] && item[5] !== '-' ? item[5] : '-';

    // เปิดแอนิเมชัน Bottom Sheet
    document.getElementById('modalOverlay').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('modalOverlay').classList.remove('opacity-0');
        document.getElementById('detailModal').classList.add('open');
    }, 10);
}

function closeModal() {
    // ปิดแอนิเมชัน Bottom Sheet
    document.getElementById('modalOverlay').classList.add('opacity-0');
    document.getElementById('detailModal').classList.remove('open');
    setTimeout(() => {
        document.getElementById('modalOverlay').classList.add('hidden');
    }, 300);
}