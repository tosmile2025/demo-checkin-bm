// ==========================================
// 🧑‍💼 MEMBER MANAGEMENT SYSTEM
// ==========================================

const rowsPerPage = 10;
let currentPage = 1;
let tableData = [];
let filteredData = [];
const departmentColors = {};
const badgeColors = [
    "bg-red-100 text-red-800", "bg-green-100 text-green-800", "bg-blue-100 text-blue-800",
    "bg-yellow-100 text-yellow-800", "bg-purple-100 text-purple-800", "bg-pink-100 text-pink-800",
    "bg-indigo-100 text-indigo-800", "bg-teal-100 text-teal-800",
];

// ฟังก์ชันสุ่มสีสำหรับ Badge (ชั้นปี)
function getRandomColorClass() {
    return badgeColors[Math.floor(Math.random() * badgeColors.length)];
}

function getDepartmentColor(dept) {
    if (!departmentColors[dept]) {
        departmentColors[dept] = getRandomColorClass();
    }
    return departmentColors[dept];
}

// จัดการปุ่ม (Loading State)
function setButtonState(buttonElement, isLoading, originalText, loadingText) {
    if (!buttonElement) return;
    if (isLoading) {
        buttonElement.dataset.originalText = originalText;
        buttonElement.textContent = loadingText;
        buttonElement.disabled = true;
        buttonElement.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        buttonElement.textContent = buttonElement.dataset.originalText || originalText;
        buttonElement.disabled = false;
        buttonElement.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// ==========================================
// 📡 FETCH DATA (ดึงข้อมูล)
// ==========================================
async function fetchData() {
    const tableBody = document.querySelector("#data-table tbody");
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500">กำลังโหลดข้อมูล...</td></tr>`;

    try {
        // ใช้ WEB_APP_API จาก config.js และส่ง source: 'member' เข้าไป
        const response = await fetch(`${CONFIG.WEB_APP_API}?source=member`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        // ลบ Header แถวที่ 1 ออก (index 0)
        tableData = data.slice(1);
        applyFilters();
    } catch (error) {
        console.error("Error fetching data:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500">ไม่สามารถโหลดข้อมูลได้: ${error.message}</td></tr>`;
    }
}

// ==========================================
// 🗂️ DISPLAY & PAGINATION (แสดงผล & แบ่งหน้า)
// ==========================================
function displayPage(page) {
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const tableBody = document.querySelector("#data-table tbody");

    tableBody.innerHTML = "";

    if (paginatedData.length === 0 && filteredData.length > 0 && currentPage > 1) {
        currentPage = 1;
        displayPage(currentPage);
        return;
    }
    if (paginatedData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500">ไม่พบข้อมูลพนักงาน</td></tr>`;
        return;
    }

    paginatedData.forEach((row) => {
        if (row.every(cell => cell === null || cell === undefined || cell === "")) return;

        const tr = document.createElement("tr");
        tr.className = "hover:bg-gray-50 transition duration-150 ease-in-out";

        // อ้างอิง Index: [0]ID, [1]UserID, [2]ชื่อ, [3]รหัสนิสิต, [4]ชั้นปี, [5]รูปภาพ, 
        // [6]เวลาล่าสุด, [7]เวลาเข้างาน, [8]ลาพักร้อน, [9]ลากิจ, [10]ลาป่วย, [11]OT, [12]เวลาออกงาน
        const id = row[0] || "-";
        const name = row[2] || "ไม่ระบุชื่อ";
        const employeeCode = row[3] || "-";
        const department = row[4] || "ไม่ระบุ";
        const imageUrl = row[5];

        // ปรับ index ให้ตรงกับ Google Sheet (ตามโค้ด Backend ใหม่)
        const expectedIn = row[7] || "-";
        const expectedOut = row[12] || "-";
        const vacation = row[8] || 0;
        const personal = row[9] || 0;
        const sick = row[10] || 0;
        const ot = row[11] || 0;

        tr.innerHTML = `
            <td class="py-3 px-4 border-b border-gray-100 text-center font-medium">${id}</td>
            <td class="py-3 px-4 border-b border-gray-100">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0">
                        ${imageUrl ? `<img src="${imageUrl}" alt="Profile" class="h-16 w-16 object-cover rounded-md border border-gray-200 shadow-sm">` : `<div class="h-16 w-16 bg-gray-200 rounded-md flex items-center justify-center text-gray-400 text-xs shadow-sm">No Img</div>`}
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 text-base">${name}</div>
                        <div class="text-sm text-gray-600 mt-0.5">รหัส: ${employeeCode}</div>
                        <div class="text-xs text-slate-500 mt-1.5 flex gap-2 flex-wrap">
                            <span class="bg-slate-100 px-2 py-0.5 rounded">เวลา: ${expectedIn} - ${expectedOut}</span>
                            <span class="bg-slate-100 px-2 py-0.5 rounded">ลา: ${vacation}/${personal}/${sick}</span>
                            <span class="bg-slate-100 px-2 py-0.5 rounded">OT: ${ot} ชม.</span>
                        </div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4 border-b border-gray-100">
                <span class="inline-block px-3 py-1 text-xs rounded-full font-bold ${getDepartmentColor(department)}">${department}</span>
            </td>
            <td class="py-3 px-4 border-b border-gray-100 text-center space-x-2">
                <button class="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out text-sm font-semibold shadow-sm edit-btn">แก้ไข</button>
                <button class="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition duration-200 ease-in-out text-sm font-semibold shadow-sm delete-btn">ลบ</button>
            </td>
        `;

        tr.querySelector('.edit-btn').onclick = () => openEditModal(row);
        tr.querySelector('.delete-btn').onclick = (event) => confirmDelete(id, event.target);
        tableBody.appendChild(tr);
    });
}

function setupPagination() {
    const pageCount = Math.ceil(filteredData.length / rowsPerPage);
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";
    if (pageCount <= 1) return;

    const prevButton = document.createElement("button");
    prevButton.textContent = "ก่อนหน้า";
    prevButton.className = `py-2 px-4 rounded-lg bg-black text-white hover:bg-gray-800 transition font-semibold disabled:opacity-50 mr-2`;
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) { currentPage--; displayPage(currentPage); updatePaginationButtons(); }
    };
    pagination.appendChild(prevButton);

    for (let i = 1; i <= pageCount; i++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = i;
        pageButton.className = `py-2 px-4 rounded-lg ${i === currentPage ? "bg-black text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"} transition font-semibold mx-1`;
        pageButton.onclick = () => {
            currentPage = i; displayPage(currentPage); updatePaginationButtons();
        };
        pagination.appendChild(pageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.textContent = "ถัดไป";
    nextButton.className = `py-2 px-4 rounded-lg bg-black text-white hover:bg-gray-800 transition font-semibold disabled:opacity-50 ml-2`;
    nextButton.disabled = currentPage === pageCount;
    nextButton.onclick = () => {
        if (currentPage < pageCount) { currentPage++; displayPage(currentPage); updatePaginationButtons(); }
    };
    pagination.appendChild(nextButton);
}

function updatePaginationButtons() {
    const pageCount = Math.ceil(filteredData.length / rowsPerPage);
    const paginationButtons = document.getElementById("pagination").querySelectorAll("button");

    paginationButtons.forEach((button) => {
        if (!isNaN(parseInt(button.textContent))) {
            if (parseInt(button.textContent) === currentPage) {
                button.className = "py-2 px-4 rounded-lg bg-black text-white transition font-semibold mx-1";
            } else {
                button.className = "py-2 px-4 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition font-semibold mx-1";
            }
        }
    });

    const prevButton = paginationButtons[0];
    const nextButton = paginationButtons[paginationButtons.length - 1];
    if (prevButton && nextButton) {
        prevButton.disabled = currentPage === 1;
        nextButton.disabled = currentPage === pageCount;
    }
}

// ==========================================
// ✏️ EDIT & MODAL (แก้ไขข้อมูล)
// ==========================================
function openEditModal(row) {
    document.getElementById("edit-id").value = row[0] || "";
    document.getElementById("edit-userID").value = row[1] || "";
    document.getElementById("edit-name").value = row[2] || "";
    document.getElementById("edit-employeeID").value = row[3] || "";
    document.getElementById("edit-department").value = row[4] || "";
    document.getElementById("edit-imageUrl").value = row[5] || "";

    // อ้างอิงตาม Column Index ของชีตสมาชิกใหม่
    document.getElementById("edit-workStart").value = row[7] || "";
    document.getElementById("edit-vacationLeave").value = row[8] || "0";
    document.getElementById("edit-personalLeave").value = row[9] || "0";
    document.getElementById("edit-sickLeave").value = row[10] || "0";
    document.getElementById("edit-ot").value = row[11] || "0";
    document.getElementById("edit-workEnd").value = row[12] || "";

    document.getElementById("edit-image").value = "";
    const previewImage = document.getElementById("preview-image");

    if (row[5]) {
        previewImage.src = row[5];
        previewImage.classList.remove("hidden");
    } else {
        previewImage.src = "#";
        previewImage.classList.add("hidden");
    }

    setButtonState(document.getElementById("save-button"), false, "บันทึก", "กำลังบันทึก...");
    document.getElementById("edit-modal").classList.remove("hidden");
}

function closeEditModal() {
    document.getElementById("edit-modal").classList.add("hidden");
    document.getElementById("edit-form").reset();
    document.getElementById("preview-image").src = "#";
    document.getElementById("preview-image").classList.add("hidden");
}

document.getElementById("edit-image").addEventListener('change', function (event) {
    const preview = document.getElementById('preview-image');
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        }
        reader.readAsDataURL(file);
    } else {
        const originalImageUrl = document.getElementById("edit-imageUrl").value;
        if (originalImageUrl) {
            preview.src = originalImageUrl;
            preview.classList.remove('hidden');
        } else {
            preview.src = '#';
            preview.classList.add('hidden');
        }
    }
});

// ==========================================
// 💾 SAVE, DELETE & RESET DATA (บันทึก ลบ รีเซ็ต)
// ==========================================

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(",")[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

document.getElementById("edit-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const id = document.getElementById("edit-id").value;
    const userID = document.getElementById("edit-userID").value;
    const name = document.getElementById("edit-name").value;
    const employeeID = document.getElementById("edit-employeeID").value;
    const department = document.getElementById("edit-department").value;
    const vacationLeave = document.getElementById("edit-vacationLeave").value;
    const personalLeave = document.getElementById("edit-personalLeave").value;
    const sickLeave = document.getElementById("edit-sickLeave").value;
    const ot = document.getElementById("edit-ot").value;
    const workStart = document.getElementById("edit-workStart").value;
    const workEnd = document.getElementById("edit-workEnd").value;

    const imageFile = document.getElementById("edit-image").files[0];
    let imageData = document.getElementById("edit-imageUrl").value;
    let isNewImage = false;

    if (imageFile) {
        try {
            imageData = await getBase64(imageFile);
            isNewImage = true;
        } catch (error) {
            Swal.fire("เกิดข้อผิดพลาด", "การแปลงรูปภาพล้มเหลว กรุณาลองใหม่อีกครั้ง", "error");
            return;
        }
    }

    const saveButton = document.getElementById("save-button");
    setButtonState(saveButton, true, "บันทึก", "กำลังบันทึก...");

    // ใช้ URLSearchParams แทน JSON เพื่อให้เข้ากับระบบ doPost ที่คุณเขียนไว้ใน Google Script
    const formData = new URLSearchParams();
    formData.append('method', 'updateData');
    formData.append('id', id);
    formData.append('userID', userID);
    formData.append('name', name);
    formData.append('employeeID', employeeID);
    formData.append('department', department);
    formData.append('imageUrl', imageData);
    formData.append('isNewImage', isNewImage.toString());
    formData.append('vacationLeave', vacationLeave);
    formData.append('personalLeave', personalLeave);
    formData.append('sickLeave', sickLeave);
    formData.append('ot', ot);
    formData.append('workStart', workStart);
    formData.append('workEnd', workEnd);

    try {
        const response = await fetch(CONFIG.WEB_APP_API, {
            method: "POST",
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const result = await response.text();
        Swal.fire("สำเร็จ!", "บันทึกข้อมูลเรียบร้อยแล้ว", "success");
        await fetchData();
        closeEditModal();
    } catch (error) {
        Swal.fire("เกิดข้อผิดพลาด!", `การอัปเดตข้อมูลล้มเหลว: ${error.message}`, "error");
    } finally {
        setButtonState(saveButton, false, "บันทึก", "กำลังบันทึก...");
    }
});

async function deleteData(id, buttonElement) {
    setButtonState(buttonElement, true, "ลบ", "กำลังลบ...");

    const formData = new URLSearchParams();
    formData.append('method', 'deleteData');
    formData.append('id', id);

    try {
        const response = await fetch(CONFIG.WEB_APP_API, {
            method: "POST",
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const result = await response.text();
        Swal.fire("ลบเรียบร้อย", "ลบข้อมูลสำเร็จ", "success");
        await fetchData();
    } catch (error) {
        Swal.fire("เกิดข้อผิดพลาด!", `การลบข้อมูลล้มเหลว: ${error.message}`, "error");
        setButtonState(buttonElement, false, "ลบ", "ลบ");
    }
}

function confirmDelete(id, buttonElement) {
    Swal.fire({
        title: "คุณแน่ใจหรือไม่?",
        text: `คุณต้องการลบข้อมูลพนักงาน ID: ${id} หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้!`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#6B7280",
        confirmButtonText: "ใช่, ลบเลย!",
        cancelButtonText: "ยกเลิก"
    }).then((result) => {
        if (result.isConfirmed) { deleteData(id, buttonElement); }
    });
}

async function handleReset(methodName, btnId, btnText, titleText, confirmColor) {
    const btn = document.getElementById(btnId);
    setButtonState(btn, true, btnText, "กำลังรีเซต...");

    Swal.fire({
        title: "คุณแน่ใจหรือไม่?",
        text: `คุณต้องการรีเซต${titleText}ทั้งหมดเป็น 0 หรือไม่?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: confirmColor,
        cancelButtonColor: "#6B7280",
        confirmButtonText: "ใช่, รีเซตเลย!",
        cancelButtonText: "ยกเลิก"
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const formData = new URLSearchParams();
                formData.append('method', methodName);

                await fetch(CONFIG.WEB_APP_API, {
                    method: "POST",
                    body: formData,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                Swal.fire("สำเร็จ!", `รีเซต${titleText}เรียบร้อยแล้ว`, "success");
                fetchData();
            } catch (error) {
                Swal.fire("เกิดข้อผิดพลาด", `ไม่สามารถรีเซตได้: ${error.message}`, "error");
            }
        }
        setButtonState(btn, false, btnText, "กำลังรีเซต...");
    });
}

document.getElementById("reset-leaves").addEventListener("click", () => handleReset('resetLeaves', 'reset-leaves', 'วันลา', 'วันลา', '#10B981'));
document.getElementById("reset-ot").addEventListener("click", () => handleReset('resetOT', 'reset-ot', 'โอที', 'OT', '#10B981'));

// ==========================================
// 🔍 FILTER (การค้นหา)
// ==========================================
const filterNameInput = document.getElementById("filter-name");
const filterDeptInput = document.getElementById("filter-department");
const filterEmpIDInput = document.getElementById("filter-employeeID");

function applyFilters() {
    const nameValue = filterNameInput.value.toLowerCase().trim();
    const deptValue = filterDeptInput.value.toLowerCase().trim();
    const empIdValue = filterEmpIDInput.value.toLowerCase().trim();

    filteredData = tableData.filter((row) => {
        if (row.every(cell => cell === null || cell === undefined || cell === "")) return false;

        const empName = (row[2] || "").toLowerCase();
        const employeeID = (row[3] || "").toLowerCase();
        const department = (row[4] || "").toLowerCase();

        return (
            empName.includes(nameValue) &&
            employeeID.includes(empIdValue) &&
            department.includes(deptValue)
        );
    });
    currentPage = 1;
    displayPage(currentPage);
    setupPagination();
}

filterNameInput.addEventListener("input", applyFilters);
filterDeptInput.addEventListener("input", applyFilters);
filterEmpIDInput.addEventListener("input", applyFilters);

// เริ่มต้นทำงานเมื่อโหลดไฟล์เสร็จ
window.onload = fetchData;