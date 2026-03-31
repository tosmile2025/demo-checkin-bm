// ==========================================
// 🛡️ ADMIN DASHBOARD SYSTEM
// ==========================================

let fullData = [];
let filteredData = [];
let currentPage = 1;
let isAscending = false; // ค่าเริ่มต้นคือ เรียงล่าสุด (Desc)

// อ้างอิง DOM Elements (ตารางและปุ่ม)
const tableBody = document.getElementById('dataList');
const rowsInfo = document.getElementById('rowsInfo');
const rowsPerPageSelect = document.getElementById('rowsPerPage');
const prevBtn = document.getElementById('prevPageBtn');
const nextBtn = document.getElementById('nextPageBtn');

// ==========================================
// 🚀 INITIAL LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    fetchDataAndDisplay();

    // ผูก Event Listener ให้กับตัวกรองทั้งหมด
    const filterInputs = ['filterSearch', 'filterIn', 'filterDuring', 'filterOut', 'startDate', 'endDate', 'startTime', 'endTime'];
    filterInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            currentPage = 1;
            applyFiltersAndRender();
        });
    });

    // จำนวนหน้า
    rowsPerPageSelect.addEventListener('change', () => {
        currentPage = 1;
        applyFiltersAndRender();
    });

    // ปุ่มเรียงลำดับ
    document.getElementById('sortDescBtn').addEventListener('click', (e) => setSorting(false, e.target));
    document.getElementById('sortAscBtn').addEventListener('click', (e) => setSorting(true, e.target));

    // ปุ่มเปลี่ยนหน้า
    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / parseInt(rowsPerPageSelect.value));
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });

    // ระบบ Modal
    document.getElementById('closePopup').addEventListener('click', closeModal);
    document.getElementById('popupModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('popupModal')) closeModal();
    });

    // ปุ่มส่งออก
    document.getElementById('exportCsvBtn').addEventListener('click', () => exportData('csv'));
    document.getElementById('exportTxtBtn').addEventListener('click', () => exportData('txt'));
    document.getElementById('exportTxtCustomBtn').addEventListener('click', () => exportData('custom_txt'));
});

// ==========================================
// 📡 FETCH DATA
// ==========================================
async function fetchDataAndDisplay() {
    try {
        const response = await fetch(CONFIG.WEB_APP_API);
        if (!response.ok) throw new Error('Network response was not ok');

        const rawData = await response.json();

        if (!Array.isArray(rawData) || rawData.length <= 1) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-500">ไม่มีข้อมูลในระบบ</td></tr>';
            rowsInfo.textContent = 'ไม่พบข้อมูล';
            return;
        }

        // ตัด Header ออก (Index 0)
        fullData = rawData.slice(1);
        applyFiltersAndRender();

    } catch (error) {
        console.error("Error fetching data:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-rose-500"><i class="fas fa-exclamation-circle mr-2"></i>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
        rowsInfo.textContent = 'Error';
    }
}

// ==========================================
// 🔍 FILTER & SORTING
// ==========================================
function parseDateStr(dateStr) {
    // เปลี่ยนจาก dd/MM/yyyy เป็น Date Object ของ JS สำหรับเปรียบเทียบค่า
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(0);
}

function parseDateTimeForSort(dateStr, timeStr) {
    const d = parseDateStr(dateStr);
    if (timeStr) {
        const [hh, mm] = timeStr.split(':');
        d.setHours(parseInt(hh) || 0, parseInt(mm) || 0, 0);
    }
    return d.getTime();
}

function setSorting(asc, btnElement) {
    isAscending = asc;
    // อัปเดต UI ปุ่ม
    document.getElementById('sortDescBtn').className = "px-4 py-2 text-sm font-semibold bg-white text-slate-600 hover:bg-slate-50 transition";
    document.getElementById('sortAscBtn').className = "px-4 py-2 text-sm font-semibold bg-white text-slate-600 hover:bg-slate-50 transition";
    btnElement.className = "px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-800 transition"; // Active state

    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    const searchVal = document.getElementById('filterSearch').value.toLowerCase();
    const showIn = document.getElementById('filterIn').checked;
    const showDuring = document.getElementById('filterDuring').checked;
    const showOut = document.getElementById('filterOut').checked;

    const sd = document.getElementById('startDate').value; // yyyy-mm-dd
    const ed = document.getElementById('endDate').value;
    const st = document.getElementById('startTime').value; // hh:mm
    const et = document.getElementById('endTime').value;

    const startDateObj = sd ? new Date(sd) : null;
    const endDateObj = ed ? new Date(ed) : null;

    filteredData = fullData.filter(item => {
        // อ้างอิง: [2]ชื่อ, [3]รหัส, [4]เข้า/ออก, [6]วันที่ dd/MM/yyyy, [7]เวลา HH:mm
        const name = (item[2] || '').toLowerCase();
        const empId = (item[3] || '').toString().toLowerCase();
        const status = item[4] || '';
        const itemDateStr = item[6];
        const itemTimeStr = item[7];

        // 1. ค้นหา Name / ID
        if (searchVal && !name.includes(searchVal) && !empId.includes(searchVal)) return false;

        // 2. เช็ค Status
        const matchIn = showIn && status === 'เข้างาน';
        const matchDuring = showDuring && status === 'ระหว่างวัน';
        const matchOut = showOut && status === 'ออกงาน';
        if (!matchIn && !matchDuring && !matchOut) return false;

        // 3. กรองช่วงวันที่
        if (startDateObj || endDateObj) {
            const itemDateObj = parseDateStr(itemDateStr);
            if (startDateObj && itemDateObj < startDateObj) return false;
            if (endDateObj && itemDateObj > endDateObj) return false;
        }

        // 4. กรองช่วงเวลา
        if (st || et) {
            if (!itemTimeStr) return false;
            if (st && itemTimeStr < st) return false;
            if (et && itemTimeStr > et) return false;
        }

        return true;
    });

    // เรียงข้อมูล
    filteredData.sort((a, b) => {
        const timeA = parseDateTimeForSort(a[6], a[7]);
        const timeB = parseDateTimeForSort(b[6], b[7]);
        return isAscending ? timeA - timeB : timeB - timeA;
    });

    renderTable();
}

// ==========================================
// 🗂️ RENDER TABLE
// ==========================================
function getStatusStyle(status) {
    if (status === 'เข้างาน') return { dot: 'dot-green', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
    if (status === 'ออกงาน') return { dot: 'dot-red', badge: 'bg-rose-50 text-rose-600 border-rose-200' };
    if (status === 'ระหว่างวัน') return { dot: 'dot-yellow', badge: 'bg-amber-50 text-amber-600 border-amber-200' };
    return { dot: 'dot-gray', badge: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function renderTable() {
    tableBody.innerHTML = '';
    const perPage = parseInt(rowsPerPageSelect.value);
    const totalPages = Math.ceil(filteredData.length / perPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * perPage;
    const pageData = filteredData.slice(startIdx, startIdx + perPage);

    if (pageData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-500">ไม่พบข้อมูลที่ตรงกับตัวกรอง</td></tr>';
        rowsInfo.textContent = 'ไม่พบข้อมูล';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    pageData.forEach((item, index) => {
        // [1]รูป, [2]ชื่อ, [3]รหัส, [4]สถานะ, [5]หมายเหตุ, [6]วันที่, [7]เวลา, [8]สถานที่
        const imgUrl = item[1] || 'https://via.placeholder.com/40';
        const styles = getStatusStyle(item[4]);

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-50/50';

        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <div class="relative inline-block">
                    <img src="${imgUrl}" class="h-10 w-10 rounded-full object-cover shadow-sm bg-white">
                    <div class="status-dot ${styles.dot}"></div>
                </div>
            </td>
            <td class="px-4 py-3">
                <div class="font-bold text-slate-800 text-sm truncate">${item[2] || 'ไม่ระบุชื่อ'}</div>
                <div class="text-xs text-slate-500 mt-0.5">ID: ${item[3] || '-'}</div>
            </td>
            <td class="px-4 py-3 hidden sm:table-cell">
                <span class="px-2.5 py-1 text-[11px] font-bold rounded-md border ${styles.badge}">${item[4] || '-'}</span>
            </td>
            <td class="px-4 py-3 hidden md:table-cell">
                <div class="text-sm font-medium text-slate-700">${item[6] || '-'}</div>
                <div class="text-xs text-slate-500">${item[7] ? item[7] + ' น.' : '-'}</div>
            </td>
            <td class="px-4 py-3 hidden lg:table-cell">
                <div class="text-xs text-slate-600 truncate max-w-[200px]">${item[5] || '-'}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <button class="view-btn text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 p-2 rounded-lg transition" data-index="${startIdx + index}">
                    <i class="fas fa-search-plus"></i> <span class="text-xs font-semibold ml-1 sm:hidden">ดู</span>
                </button>
            </td>
        `;

        // ปุ่มเปิด Modal
        tr.querySelector('.view-btn').addEventListener('click', function () {
            const dataIndex = this.getAttribute('data-index');
            openModal(filteredData[dataIndex]);
        });

        tableBody.appendChild(tr);
    });

    // อัปเดต UI แบ่งหน้า
    rowsInfo.textContent = `แสดง ${startIdx + 1}-${Math.min(startIdx + perPage, filteredData.length)} จาก ${filteredData.length} รายการ`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
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
    const statusEl = document.getElementById('modalStatus');
    statusEl.className = `font-bold px-2.5 py-1 rounded-md text-xs border ${styles.badge}`;
    statusEl.textContent = item[4] || '-';

    document.getElementById('modalDateTime').textContent = `${item[6] || '-'}  เวลา ${item[7] ? item[7] + ' น.' : '-'}`;

    // โชว์ความล่าช้า ถ้ามี [12]สาย/ตรงเวลา, [13]นาที
    let delayText = "-";
    if (item[12] && item[12] !== "ปกติ" && item[12] !== "ตรงเวลา") {
        delayText = `<span class="text-rose-600 font-bold">${item[12]} ${item[13] ? item[13] + ' นาที' : ''}</span>`;
    } else if (item[12] === "ตรงเวลา") {
        delayText = `<span class="text-emerald-600 font-bold">ตรงเวลา</span>`;
    }
    document.getElementById('modalDelay').innerHTML = delayText;

    document.getElementById('modalLocation').textContent = item[8] || 'ไม่มีข้อมูลสถานที่';
    document.getElementById('modalNote').textContent = item[5] || 'ไม่มีหมายเหตุเพิ่มเติม';

    // Show animation
    modal.classList.remove('hidden');
    // เล็กน้อย delay ให้ browser render ก่อนใส่ opacity
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
    }, 300); // 300ms matches transition duration
}

// ==========================================
// 💾 EXPORT DATA
// ==========================================
function getExportColumns() {
    const cols = [];
    if (document.getElementById('colImage').checked) cols.push({ i: 1, name: 'รูปภาพ' });
    if (document.getElementById('colEmployeeId').checked) cols.push({ i: 3, name: 'รหัสนิสิต' });
    if (document.getElementById('colName').checked) cols.push({ i: 2, name: 'ชื่อ' });
    if (document.getElementById('colStatus').checked) cols.push({ i: 4, name: 'สถานะ' });
    if (document.getElementById('colNote').checked) cols.push({ i: 5, name: 'หมายเหตุ' });
    if (document.getElementById('colDate').checked) cols.push({ i: 6, name: 'วันที่' });
    if (document.getElementById('colTime').checked) cols.push({ i: 7, name: 'เวลา' });
    if (document.getElementById('colLocation').checked) cols.push({ i: 8, name: 'สถานที่' });
    return cols;
}

function exportData(type) {
    if (filteredData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลที่ตรงกับเงื่อนไขสำหรับการส่งออก', 'warning');

    const cols = getExportColumns();
    let content = '';
    let fileName = `Export_${new Date().getTime()}`;

    Swal.fire({
        title: 'กำลังเตรียมไฟล์...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        if (type === 'custom_txt') {
            // ฟอร์แมตพิเศษของเครื่องตอกบัตร
            content = 'รหัสที่เครื่อง\tวัน/เวลา\n';
            filteredData.forEach(row => {
                content += `${row[3] || ''}\t${row[6] || ''} ${row[7] || ''}\n`;
            });
            fileName += '.txt';
            downloadBlob(content, fileName, 'text/plain;charset=utf-8');

        } else if (type === 'txt') {
            // TXT ธรรมดา แท็บคั่น
            content = cols.map(c => c.name).join('\t') + '\n';
            filteredData.forEach(row => {
                content += cols.map(c => (row[c.i] || '').toString().replace(/\t/g, ' ')).join('\t') + '\n';
            });
            fileName += '.txt';
            downloadBlob(content, fileName, 'text/plain;charset=utf-8');

        } else if (type === 'csv') {
            // CSV จุลภาคคั่น
            content = '\uFEFF' + cols.map(c => `"${c.name}"`).join(',') + '\n'; // \uFEFF for Excel UTF-8
            filteredData.forEach(row => {
                content += cols.map(c => {
                    let cell = (row[c.i] || '').toString();
                    cell = cell.replace(/"/g, '""'); // Escape double quotes
                    return `"${cell}"`;
                }).join(',') + '\n';
            });
            fileName += '.csv';
            downloadBlob(content, fileName, 'text/csv;charset=utf-8');
        }
        Swal.close();
    } catch (e) {
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการส่งออกไฟล์', 'error');
        console.error(e);
    }
}

function downloadBlob(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}