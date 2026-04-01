// ==========================================
// 🛡️ ADMIN DASHBOARD SYSTEM
// ==========================================

let fullData = [];
let membersData = []; // เก็บข้อมูลสมาชิกเพื่อดึงรูปโปรไฟล์/ชั้นปี
let filteredData = [];
let currentPage = 1;
let isAscending = false;

const tableBody = document.getElementById('dataList');
const rowsInfo = document.getElementById('rowsInfo');
const rowsPerPageSelect = document.getElementById('rowsPerPage');
const prevBtn = document.getElementById('prevPageBtn');
const nextBtn = document.getElementById('nextPageBtn');

const DEFAULT_AVATAR = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/No-Image-Placeholder.svg/330px-No-Image-Placeholder.svg.png";

// ==========================================
// 🚀 INITIAL LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    fetchDataAndDisplay();

    const filterInputs = ['filterSearch', 'filterDept', 'filterIn', 'filterDuring', 'filterOut', 'startDate', 'endDate', 'startTime', 'endTime'];
    filterInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            currentPage = 1; applyFiltersAndRender();
        });
    });

    rowsPerPageSelect.addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });
    document.getElementById('sortDescBtn').addEventListener('click', (e) => setSorting(false, e.target));
    document.getElementById('sortAscBtn').addEventListener('click', (e) => setSorting(true, e.target));

    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / parseInt(rowsPerPageSelect.value));
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });

    document.getElementById('closePopup').addEventListener('click', closeModal);
    document.getElementById('popupModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('popupModal')) closeModal();
    });

    document.getElementById('exportCsvBtn').addEventListener('click', () => exportData('csv'));
    document.getElementById('exportTxtBtn').addEventListener('click', () => exportData('txt'));

});

// ==========================================
// 📡 FETCH DATA (ดึงข้อมูลลงเวลา + ข้อมูลนิสิต)
// ==========================================
async function fetchDataAndDisplay() {
    try {
        // ยิง API 2 ตัวพร้อมกันเพื่อความรวดเร็ว
        const [checkinRes, memberRes] = await Promise.all([
            fetch(CONFIG.WEB_APP_API, { method: 'POST', body: JSON.stringify({ action: 'fetchData' }) }),
            fetch(CONFIG.WEB_APP_API, { method: 'POST', body: JSON.stringify({ action: 'fetchData', source: 'member' }) })
        ]);

        if (!checkinRes.ok || !memberRes.ok) throw new Error('Network response error');

        const rawData = await checkinRes.json();
        const rawMembers = await memberRes.json();

        if (!Array.isArray(rawData) || rawData.length <= 1) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-16 text-slate-500 text-lg font-medium">ไม่มีข้อมูลในระบบ</td></tr>';
            rowsInfo.textContent = 'ไม่พบข้อมูล';
            return;
        }

        fullData = rawData.slice(1);
        membersData = Array.isArray(rawMembers) ? rawMembers.slice(1) : []; // เก็บไว้สำหรับอ้างอิงรูปและชั้นปี

        applyFiltersAndRender();

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-16 text-rose-500 font-bold text-lg"><i class="fas fa-exclamation-circle text-3xl mb-3 block"></i>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
        rowsInfo.textContent = 'Error';
    }
}

// ==========================================
// 📅 DATE FORMATTER (แปลง ISO -> ไทย แบบฉลาด)
// ==========================================
function parseAndFormatDate(dateStr, timeStr) {
    if (!dateStr || dateStr === "-") return { date: "-", time: "-" };
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
                day = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; year = parseInt(parts[2], 10);
            } else { return { date: safeDateStr, time: safeTimeStr }; }
        } else { return { date: safeDateStr, time: safeTimeStr }; }

        let timeFormatted = "-";
        if (safeTimeStr.includes("T")) {
            const t = new Date(safeTimeStr);
            timeFormatted = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        } else if (safeTimeStr && safeTimeStr !== "undefined" && safeTimeStr !== "-") {
            timeFormatted = safeTimeStr.replace(" น.", "").trim();
        }

        if (year < 2500) year += 543;
        const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

        return { date: `${day} ${thaiMonths[month]} ${year}`, time: timeFormatted, rawDateObj: new Date(year - 543, month, day) };
    } catch (e) {
        return { date: String(dateStr), time: String(timeStr), rawDateObj: new Date(0) };
    }
}

function parseDateTimeForSort(dateStr, timeStr) {
    const f = parseAndFormatDate(dateStr, timeStr);
    const d = f.rawDateObj || new Date(0);
    if (f.time !== "-") {
        const parts = f.time.split(':');
        d.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, 0);
    }
    return d.getTime();
}

// ==========================================
// 🔍 FILTER & SORTING
// ==========================================
function setSorting(asc, btnElement) {
    isAscending = asc;
    document.getElementById('sortDescBtn').className = "px-5 py-2.5 text-sm font-bold bg-white text-slate-500 hover:bg-slate-50 transition";
    document.getElementById('sortAscBtn').className = "px-5 py-2.5 text-sm font-bold bg-white text-slate-500 hover:bg-slate-50 transition";
    btnElement.className = "px-5 py-2.5 text-sm font-bold bg-slate-100 text-slate-800 transition";
    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    const searchVal = document.getElementById('filterSearch').value.toLowerCase();
    const deptVal = document.getElementById('filterDept').value; // ชั้นปี
    const showWard = document.getElementById('filterWard').checked;
    const showIn = document.getElementById('filterIn').checked;
    const showOut = document.getElementById('filterOut').checked;

    const sd = document.getElementById('startDate').value;
    const ed = document.getElementById('endDate').value;
    const st = document.getElementById('startTime').value;
    const et = document.getElementById('endTime').value;

    const startDateObj = sd ? new Date(sd) : null;
    const endDateObj = ed ? new Date(ed) : null;

    filteredData = fullData.filter(item => {
        // [2]ชื่อ, [3]รหัส, [4]เข้า/ออก, [11]UserId
        const name = (item[2] || '').toLowerCase();
        const empId = (item[3] || '').toString().toLowerCase();
        const status = item[4] || '';
        const userId = item[11] || '';

        // ดึงข้อมูลชั้นปีจากฐานสมาชิกมาอ้างอิงในการกรอง
        const member = membersData.find(m => m[1] === userId);
        const dept = member ? String(member[4] || '') : '';

        const f = parseAndFormatDate(item[6], item[7]);

        // 1. ค้นหา
        if (searchVal && !name.includes(searchVal) && !empId.includes(searchVal)) return false;
        if (deptVal && !dept.includes(deptVal)) return false;

        // 2. สถานะ
        const matchWard = showWard && status === 'ราว ward';
        const matchIn = showIn && status === 'เข้าเวร';
        const matchOut = showOut && status === 'ออกเวร';
        if (!matchWard && !matchIn && !matchOut) return false;

        // 3. วันที่ & เวลา
        if (startDateObj || endDateObj) {
            const itemDateObj = f.rawDateObj;
            if (startDateObj && itemDateObj < startDateObj) return false;
            if (endDateObj && itemDateObj > endDateObj) return false;
        }
        if (st || et) {
            if (f.time === "-") return false;
            if (st && f.time < st) return false;
            if (et && f.time > et) return false;
        }

        // แนบข้อมูล member ใส่ไปใน item ชั่วคราวเพื่อเอาไปใช้ตอน Render
        item._memberData = member;
        return true;
    });

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
    if (status === 'เข้าเวร') return { dot: 'dot-green', badge: 'bg-medical-50 text-medical-700 border-medical-200' };
    if (status === 'ออกเวร') return { dot: 'dot-red', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
    if (status === 'ราว ward') return { dot: 'dot-yellow', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
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
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-16 text-slate-500 text-base font-medium">ไม่พบข้อมูลที่ตรงกับตัวกรอง</td></tr>';
        rowsInfo.textContent = 'ไม่พบข้อมูล';
        prevBtn.disabled = true; nextBtn.disabled = true;
        return;
    }

    pageData.forEach((item, index) => {
        // จัดการรูปภาพ (ดึงจาก Member และ Checkin)
        let checkinImgUrl = item[1];
        if (!checkinImgUrl || String(checkinImgUrl).trim() === "" || !String(checkinImgUrl).startsWith("http")) checkinImgUrl = DEFAULT_AVATAR;

        let profileImgUrl = item._memberData ? item._memberData[5] : "";
        if (!profileImgUrl || String(profileImgUrl).trim() === "" || !String(profileImgUrl).startsWith("http")) profileImgUrl = DEFAULT_AVATAR;

        const dept = item._memberData ? item._memberData[4] : '-';

        const styles = getStatusStyle(item[4]);
        const f = parseAndFormatDate(item[6], item[7]);

        // จัดการความล่าช้า (+15 น. แดง / -10 น. ส้ม)
        const statusDetail = item[12] || 'ปกติ';
        const minutes = item[13] || '';
        let lateHtml = '-';
        if (statusDetail === 'สาย') {
            lateHtml = `<span class="bg-rose-50 text-rose-600 font-bold px-2.5 py-1.5 rounded text-sm border border-rose-200 shadow-sm">+${minutes} น.</span>`;
        } else if (statusDetail === 'ออกก่อนเวลา') {
            lateHtml = `<span class="bg-orange-50 text-orange-600 font-bold px-2.5 py-1.5 rounded text-sm border border-orange-200 shadow-sm">-${minutes} น.</span>`;
        } else if (statusDetail === 'ตรงเวลา') {
            lateHtml = `<span class="text-emerald-500 font-bold text-sm"><i class="fas fa-check-circle mr-1"></i> ตรงเวลา</span>`;
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-50/50';

        tr.innerHTML = `
            <td class="px-4 py-3 text-center w-32">
                <div class="flex items-center justify-center gap-1.5">
                    <div class="relative cursor-pointer group" onclick="openLightbox('${profileImgUrl}')" title="รูปโปรไฟล์ตอนลงทะเบียน">
                        <img src="${profileImgUrl}" class="h-10 w-10 rounded-full object-cover shadow-sm bg-white border border-slate-200 group-hover:opacity-80 transition">
                        <div class="absolute -bottom-1 -left-1 bg-slate-700 text-white text-[8px] px-1 rounded">โปรไฟล์</div>
                    </div>
                    <div class="relative cursor-pointer group" onclick="openLightbox('${checkinImgUrl}')" title="รูปตอนลงเวลา">
                        <img src="${checkinImgUrl}" class="h-10 w-10 rounded-full object-cover shadow-sm bg-white border-2 border-medical-300 group-hover:opacity-80 transition">
                        <div class="status-dot ${styles.dot}"></div>
                        <div class="absolute -bottom-1 -right-1 bg-medical-600 text-white text-[8px] px-1 rounded">ล่าสุด</div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-4">
                <div class="font-bold text-slate-800 text-base truncate mb-0.5">${item[2] || 'ไม่ระบุชื่อ'}</div>
                <div class="text-sm font-medium text-slate-500">รหัสนิสิต: ${item[3] || '-'} <span class="ml-1 text-medical-600 bg-medical-50 px-1.5 py-0.5 rounded text-xs border border-medical-100">ปี ${dept}</span></div>
            </td>
            <td class="px-4 py-4 hidden sm:table-cell">
                <span class="px-3 py-1.5 text-xs font-bold rounded-lg border ${styles.badge}">${item[4] || '-'}</span>
            </td>
            <td class="px-4 py-4 hidden md:table-cell text-center">
                ${lateHtml}
            </td>
            <td class="px-4 py-4 hidden lg:table-cell">
                <div class="text-sm font-bold text-slate-700">${f.date}</div>
                <div class="text-xs font-bold text-medical-600 mt-0.5">${f.time} น.</div>
            </td>
            <td class="px-4 py-4 hidden xl:table-cell">
                <div class="text-xs font-medium text-slate-600 truncate max-w-[150px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">${item[5] && item[5] !== '-' ? item[5] : 'ไม่มี'}</div>
            </td>
            <td class="px-4 py-4 text-center">
                <button class="view-btn text-medical-700 bg-medical-50 border border-medical-100 hover:bg-medical-100 hover:text-medical-800 p-2.5 rounded-xl transition shadow-sm" data-index="${startIdx + index}">
                    <i class="fas fa-search-plus"></i> <span class="text-xs font-bold ml-1 sm:hidden">ดู</span>
                </button>
            </td>
        `;

        tr.querySelector('.view-btn').addEventListener('click', function () {
            openModal(filteredData[this.getAttribute('data-index')]);
        });
        tableBody.appendChild(tr);
    });

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
    const f = parseAndFormatDate(item[6], item[7]);

    // รูปภาพ 2 รูป
    document.getElementById('modalCheckinImg').src = item[1] || 'https://via.placeholder.com/100';
    document.getElementById('modalProfileImg').src = item._memberData && item._memberData[5] ? item._memberData[5] : 'https://via.placeholder.com/100';

    document.getElementById('modalName').textContent = item[2] || 'ไม่ระบุชื่อ';
    document.getElementById('modalId').textContent = `รหัส: ${item[3] || '-'} | ชั้นปี: ${item._memberData ? item._memberData[4] : '-'}`;

    const styles = getStatusStyle(item[4]);
    const statusEl = document.getElementById('modalStatus');
    statusEl.className = `font-bold px-3 py-1.5 rounded-lg text-sm border ${styles.badge}`;
    statusEl.textContent = item[4] || '-';

    document.getElementById('modalDateTime').innerHTML = `${f.date} <span class="text-medical-600 ml-1.5">${f.time} น.</span>`;

    // ความล่าช้าใน Modal
    const statusDetail = item[12] || 'ปกติ';
    const minutes = item[13] || '';
    let delayHtml = "-";
    if (statusDetail === 'สาย') delayHtml = `<span class="text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 shadow-sm">+${minutes} นาที</span>`;
    else if (statusDetail === 'ออกก่อนเวลา') delayHtml = `<span class="text-orange-600 font-bold bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">-${minutes} นาที</span>`;
    else if (statusDetail === 'ตรงเวลา') delayHtml = `<span class="text-emerald-600 font-bold"><i class="fas fa-check-circle"></i> ตรงเวลา</span>`;

    document.getElementById('modalDelay').innerHTML = delayHtml;
    document.getElementById('modalLocation').textContent = item[8] || 'ไม่มีข้อมูลสถานที่';
    document.getElementById('modalNote').textContent = item[5] || '-';

    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
}

function closeModal() {
    modal.classList.add('opacity-0'); modalContent.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// ==========================================
// 🔎 LIGHTBOX (ดูรูปเต็มจอ)
// ==========================================
const lightboxModal = document.getElementById('lightboxModal');
const lightboxImg = document.getElementById('lightboxImg');

function openLightbox(url) {
    lightboxImg.src = url;
    lightboxModal.classList.remove('hidden');
    setTimeout(() => {
        lightboxModal.classList.remove('opacity-0');
        lightboxImg.classList.remove('scale-95');
    }, 10);
}

function closeLightbox() {
    lightboxModal.classList.add('opacity-0');
    lightboxImg.classList.add('scale-95');
    setTimeout(() => { lightboxModal.classList.add('hidden'); lightboxImg.src = ''; }, 300);
}

lightboxModal.addEventListener('click', (e) => {
    if (e.target !== lightboxImg) closeLightbox();
});

// ==========================================
// 💾 EXPORT DATA
// ==========================================
function getExportColumns() {
    const cols = [];
    if (document.getElementById('colImage').checked) cols.push({ i: 1, name: 'รูปภาพ' });
    if (document.getElementById('colEmployeeId').checked) cols.push({ i: 3, name: 'รหัสนิสิต' });
    if (document.getElementById('colName').checked) cols.push({ i: 2, name: 'ชื่อ' });
    if (document.getElementById('colStatus').checked) cols.push({ i: 4, name: 'สถานะ' });
    if (document.getElementById('colLate').checked) cols.push({ i: 'LATE', name: 'ความล่าช้า' });
    if (document.getElementById('colNote').checked) cols.push({ i: 5, name: 'หมายเหตุ' });
    if (document.getElementById('colDate').checked) cols.push({ i: 'DATE', name: 'วันที่' });
    if (document.getElementById('colTime').checked) cols.push({ i: 'TIME', name: 'เวลา' });
    if (document.getElementById('colLocation').checked) cols.push({ i: 8, name: 'สถานที่' });
    return cols;
}

function exportData(type) {
    if (filteredData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลที่ตรงกับเงื่อนไขสำหรับการส่งออก', 'warning');

    const cols = getExportColumns();
    let content = '';
    let fileName = `Export_${new Date().getTime()}`;

    Swal.fire({ title: 'กำลังเตรียมไฟล์...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        if (type === 'custom_txt') {
            content = 'รหัสที่เครื่อง\tวัน/เวลา\n';
            filteredData.forEach(row => {
                const f = parseAndFormatDate(row[6], row[7]);
                content += `${row[3] || ''}\t${f.date} ${f.time}\n`;
            });
            fileName += '.txt';
            downloadBlob(content, fileName, 'text/plain;charset=utf-8');

        } else if (type === 'txt') {
            content = cols.map(c => c.name).join('\t') + '\n';
            filteredData.forEach(row => {
                const f = parseAndFormatDate(row[6], row[7]);
                content += cols.map(c => {
                    if (c.i === 'DATE') return f.date;
                    if (c.i === 'TIME') return f.time;
                    if (c.i === 'LATE') return row[12] === 'สาย' || row[12] === 'ออกก่อนเวลา' ? `${row[12]} ${row[13]} นาที` : (row[12] || '-');
                    return (row[c.i] || '').toString().replace(/\t/g, ' ');
                }).join('\t') + '\n';
            });
            fileName += '.txt';
            downloadBlob(content, fileName, 'text/plain;charset=utf-8');

        } else if (type === 'csv') {
            content = '\uFEFF' + cols.map(c => `"${c.name}"`).join(',') + '\n';
            filteredData.forEach(row => {
                const f = parseAndFormatDate(row[6], row[7]);
                content += cols.map(c => {
                    let cell = '';
                    if (c.i === 'DATE') cell = f.date;
                    else if (c.i === 'TIME') cell = f.time;
                    else if (c.i === 'LATE') cell = row[12] === 'สาย' || row[12] === 'ออกก่อนเวลา' ? `${row[12]} ${row[13]} นาที` : (row[12] || '-');
                    else cell = (row[c.i] || '').toString();

                    cell = cell.replace(/"/g, '""');
                    return `"${cell}"`;
                }).join(',') + '\n';
            });
            fileName += '.csv';
            downloadBlob(content, fileName, 'text/csv;charset=utf-8');
        }
        Swal.close();
    } catch (e) {
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการส่งออกไฟล์', 'error');
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