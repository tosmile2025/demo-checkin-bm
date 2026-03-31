// ==========================================
// 📱 MOBILE DASHBOARD SYSTEM
// ==========================================

let currentPage = 1;
const ROWS_PER_PAGE = 15;
let fullData = [];
let filteredData = [];

// ==========================================
// 🚀 INITIAL LOAD & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // ตั้งค่าช่องวันที่ให้เป็นวันปัจจุบันอัตโนมัติ
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('filterDate').value = `${yyyy}-${mm}-${dd}`;

    fetchDataAndDisplay();

    // Event Listeners 
    document.getElementById('filterSearch').addEventListener('input', () => { currentPage = 1; updateDisplay(); });
    document.getElementById('filterDate').addEventListener('change', () => { currentPage = 1; updateDisplay(); });

    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; updateDisplay(); }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
        if (currentPage < totalPages) { currentPage++; updateDisplay(); }
    });

    // ระบบปิด Modal
    document.getElementById('closePopup').addEventListener('click', closeModal);
    document.getElementById('popupModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('popupModal')) closeModal();
    });
});

// ==========================================
// 📡 FETCH DATA
// ==========================================
async function fetchDataAndDisplay() {
    const loadingEl = document.getElementById('loading');
    const containerEl = document.getElementById('data-container');
    const paginationEl = document.getElementById('pagination-controls');
    const noDataEl = document.getElementById('no-data');

    loadingEl.style.display = 'flex';
    containerEl.style.display = 'none';
    paginationEl.style.display = 'none';
    noDataEl.style.display = 'none';

    try {
        const response = await fetch(CONFIG.WEB_APP_API);
        if (!response.ok) throw new Error('Network response was not ok');

        const rawData = await response.json();

        if (!Array.isArray(rawData) || rawData.length <= 1) {
            loadingEl.style.display = 'none';
            noDataEl.style.display = 'flex';
            return;
        }

        // เก็บข้อมูลโดยตัด Header ทิ้ง
        fullData = rawData.slice(1);
        updateDisplay();

    } catch (error) {
        console.error("Error fetching data:", error);
        loadingEl.innerHTML = `<i class="fas fa-exclamation-triangle text-3xl text-rose-400 mb-3"></i><p class="text-rose-500 text-sm">ไม่สามารถโหลดข้อมูลได้</p>`;
    }
}

// ==========================================
// 🔍 FILTER & RENDER 
// ==========================================
function parseDateStr(dateStr) {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/'); // dd/MM/yyyy
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(0);
}

function updateDisplay() {
    const loadingEl = document.getElementById('loading');
    const containerEl = document.getElementById('data-container');
    const paginationEl = document.getElementById('pagination-controls');
    const noDataEl = document.getElementById('no-data');

    loadingEl.style.display = 'none';
    containerEl.innerHTML = '';

    // 1. ดึงค่า Filter
    const searchTerm = document.getElementById('filterSearch').value.toLowerCase();
    const filterDate = document.getElementById('filterDate').value; // yyyy-mm-dd

    // 2. กรองข้อมูล
    filteredData = fullData.filter(item => {
        const name = (item[2] || '').toLowerCase();
        const id = (item[3] || '').toString().toLowerCase();

        // กรองชื่อ / รหัส
        if (searchTerm && !name.includes(searchTerm) && !id.includes(searchTerm)) return false;

        // กรองวันที่
        if (filterDate) {
            const itemDate = parseDateStr(item[6]);
            const selectedDate = new Date(filterDate);
            if (itemDate.getFullYear() !== selectedDate.getFullYear() ||
                itemDate.getMonth() !== selectedDate.getMonth() ||
                itemDate.getDate() !== selectedDate.getDate()) {
                return false;
            }
        }
        return true;
    });

    // 3. เรียงล่าสุดขึ้นก่อน (เทียบจากคอลัมน์ 6 และ 7)
    filteredData.sort((a, b) => {
        const timeA = parseDateStr(a[6]).getTime() + (a[7] ? a[7].replace(':', '') : 0);
        const timeB = parseDateStr(b[6]).getTime() + (b[7] ? b[7].replace(':', '') : 0);
        return timeB - timeA;
    });

    // 4. ระบบ Pagination
    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
    const pageData = filteredData.slice(startIdx, startIdx + ROWS_PER_PAGE);

    // 5. แสดงผล
    if (pageData.length === 0) {
        containerEl.style.display = 'none';
        paginationEl.style.display = 'none';
        noDataEl.style.display = 'flex';
    } else {
        containerEl.style.display = 'flex';
        noDataEl.style.display = 'none';
        paginationEl.style.display = 'flex';

        renderCards(pageData, startIdx);
    }

    // อัปเดตปุ่มเปลี่ยนหน้า
    document.getElementById('rowsInfo').textContent = `${currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
}

function getStatusStyle(status) {
    if (status === 'เข้างาน') return { dot: 'dot-green', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
    if (status === 'ออกงาน') return { dot: 'dot-red', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-600 border-rose-200' };
    if (status === 'ระหว่างวัน') return { dot: 'dot-yellow', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-600 border-amber-200' };
    return { dot: 'dot-gray', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function renderCards(dataToRender, startIdx) {
    const container = document.getElementById('data-container');

    dataToRender.forEach((item, index) => {
        const imgUrl = item[1] || 'https://via.placeholder.com/80';
        const styles = getStatusStyle(item[4]);

        const card = document.createElement('div');
        card.className = 'bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 cursor-pointer active:bg-slate-50 transition-colors';

        // เมื่อคลิกที่การ์ด ให้แสดง Modal ทันที
        card.onclick = () => openModal(filteredData[startIdx + index]);

        card.innerHTML = `
            <div class="relative flex-shrink-0">
                <img src="${imgUrl}" class="w-14 h-14 rounded-full object-cover border border-slate-100 shadow-sm bg-white">
                <div class="status-dot ${styles.dot}"></div>
            </div>

            <div class="flex-1 min-w-0">
                <h3 class="text-sm font-bold text-slate-800 truncate">${item[2] || 'ไม่ระบุชื่อ'}</h3>
                <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>${item[3] || '-'}</span>
                    <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span class="font-medium ${styles.text}">${item[4] || '-'}</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-1 font-medium">
                    <i class="far fa-clock mr-1"></i> ${item[7] ? item[7] + ' น.' : '-'}
                </div>
            </div>

            <div class="text-slate-300 flex-shrink-0">
                <i class="fas fa-chevron-right text-sm"></i>
            </div>
        `;

        container.appendChild(card);
    });
}

// ==========================================
// 🖼️ MODAL (POPUP DETAILS)
// ==========================================
const modal = document.getElementById('popupModal');
const modalContent = document.getElementById('popupContent');

function openModal(item) {
    document.getElementById('modalImg').src = item[1] || 'https://via.placeholder.com/100';
    document.getElementById('modalName').textContent = item[2] || 'ไม่ระบุชื่อ';
    document.getElementById('modalId').textContent = `รหัส: ${item[3] || '-'}`;

    const styles = getStatusStyle(item[4]);
    const dotEl = document.getElementById('modalStatusDot');
    const badgeEl = document.getElementById('modalStatusBadge');

    // อัปเดตสีสถานะใน Modal
    dotEl.className = `status-dot w-5 h-5 border-4 ${styles.dot}`;
    badgeEl.className = `font-bold px-2.5 py-1 rounded-md text-[11px] border ${styles.badge}`;
    badgeEl.textContent = item[4] || '-';

    document.getElementById('modalDate').textContent = item[6] || '-';
    document.getElementById('modalTime').textContent = item[7] ? item[7] + ' น.' : '-';

    // ความล่าช้า
    let delayHtml = "-";
    if (item[12] && item[12] !== "ปกติ" && item[12] !== "ตรงเวลา") {
        delayHtml = `<span class="text-rose-600 font-bold">${item[12]} ${item[13] ? item[13] + ' นาที' : ''}</span>`;
    } else if (item[12] === "ตรงเวลา") {
        delayHtml = `<span class="text-emerald-600 font-bold">ตรงเวลา</span>`;
    }
    document.getElementById('modalDelay').innerHTML = delayHtml;

    // สถานที่ และ หมายเหตุ
    document.getElementById('modalLocation').textContent = item[8] || 'ไม่ระบุสถานที่';
    document.getElementById('modalNote').textContent = item[5] || 'ไม่มีหมายเหตุ';

    // Show animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

function closeModal() {
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}