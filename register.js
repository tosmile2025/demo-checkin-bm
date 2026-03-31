// ==========================================
// 📝 REGISTRATION SYSTEM (ระบบลงทะเบียน)
// ==========================================

// ตัวแปร DOM
const fileInput = document.getElementById("file");
const imgPreview = document.getElementById("preview");
const userlineIdInput = document.getElementById("userlineId");
const nameIdInput = document.getElementById("nameId");
const keynumberIdInput = document.getElementById("keynumberId");
const keynumber2IdInput = document.getElementById("keynumber2Id");
const submitBtn = document.getElementById("submitBtn");

// ==========================================
// 🚀 INITIALIZE LIFF
// ==========================================
window.onload = function () {
    initializeLiff();
};

async function initializeLiff() {
    try {
        // ใช้ LIFF_ID_REGISTER จาก config.js
        await liff.init({ liffId: CONFIG.LIFF_ID_REGISTER });

        if (liff.isLoggedIn()) {
            getUserProfile();
        } else {
            liff.login();
        }
    } catch (error) {
        console.error("LIFF Initialization failed", error);
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อระบบ LINE ได้", "error");
    }
}

async function getUserProfile() {
    try {
        const profile = await liff.getProfile();
        userlineIdInput.value = profile.userId;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์:', error);
    }
}

// ==========================================
// 🖼️ IMAGE HANDLING
// ==========================================
function getBase64(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // เอาเฉพาะส่วน data base64
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function previewImage() {
    if (fileInput.files.length > 0) {
        let file = fileInput.files[0];
        let reader = new FileReader();
        reader.onload = function (e) {
            imgPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        imgPreview.src = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";
    }
}

fileInput.addEventListener('change', previewImage);

// ==========================================
// ✅ FORM VALIDATION & SUBMISSION
// ==========================================
function validateForm() {
    const userlineId = userlineIdInput.value.trim();
    const nameId = nameIdInput.value.trim();
    const keynumberId = keynumberIdInput.value.trim();
    const keynumber2Id = keynumber2IdInput.value.trim();

    if (!userlineId || !nameId || !keynumberId || !keynumber2Id) {
        return false;
    }
    return true;
}

submitBtn.addEventListener('click', async (event) => {
    event.preventDefault();

    if (!validateForm()) {
        Swal.fire({
            icon: 'warning',
            title: 'ข้อมูลไม่ครบถ้วน',
            text: 'กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วน',
            confirmButtonColor: '#1e293b' // สี slate-800
        });
        return;
    }

    const isConfirmed = await showConfirmationDialog();

    if (isConfirmed) {
        submitBtn.disabled = true;

        try {
            let obj;

            // ตรวจสอบรูปภาพ
            if (fileInput.files.length > 0) {
                let file = fileInput.files[0];
                let base64 = await getBase64(file);

                obj = {
                    base64: base64,
                    type: file.type,
                    name: file.name,
                    userlineId: userlineIdInput.value,
                    nameId: nameIdInput.value,
                    keynumberId: keynumberIdInput.value,
                    keynumber2Id: keynumber2IdInput.value
                };
            } else {
                // หากไม่ได้อัปโหลดรูป ให้ดึงรูป Default มาแปลงเป็น Base64
                let response = await fetch("https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png");
                let blob = await response.blob();
                let base64 = await getBase64(blob);

                obj = {
                    base64: base64,
                    type: "image/png",
                    name: "Avatar.png",
                    userlineId: userlineIdInput.value,
                    nameId: nameIdInput.value,
                    keynumberId: keynumberIdInput.value,
                    keynumber2Id: keynumber2IdInput.value
                };
            }

            // แสดงหน้าจอโหลด (ปรับจาก onBeforeOpen เป็น didOpen)
            Swal.fire({
                title: 'กำลังบันทึกข้อมูล...',
                text: 'กรุณารอสักครู่',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // ส่งข้อมูลไปยัง API ใหม่
            let response = await fetch(CONFIG.WEB_APP_API, {
                method: "POST",
                body: JSON.stringify(obj)
            });

            let data = await response.text();

            Swal.fire({
                title: 'สำเร็จ!',
                text: 'ลงทะเบียนบัญชีของคุณเรียบร้อยแล้ว!',
                icon: 'success',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#1e293b'
            }).then((result) => {
                if (result.isConfirmed) {
                    sendFlexMessage();
                }
            });

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'เกิดข้อผิดพลาดขณะส่งข้อมูล กรุณาลองใหม่อีกครั้ง',
            });
            console.error(error);
        } finally {
            submitBtn.disabled = false;
        }
    }
});

async function showConfirmationDialog() {
    const confirmation = await Swal.fire({
        title: 'ยืนยันการลงทะเบียน',
        text: 'โปรดตรวจสอบข้อมูลก่อนกดยืนยัน',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1e293b', // slate-800
        cancelButtonColor: '#cbd5e1', // slate-300
        confirmButtonText: 'บันทึกข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });
    return confirmation.isConfirmed;
}

// ==========================================
// 💬 LINE FLEX MESSAGE
// ==========================================
async function sendFlexMessage() {
    const flexMessage = {
        type: 'flex',
        altText: 'ข้อมูลลงทะเบียนสำเร็จ',
        contents: {
            type: 'bubble',
            styles: {
                header: { backgroundColor: '#FFFFFF' },
                body: { backgroundColor: '#FFFFFF' },
                footer: { backgroundColor: '#FFFFFF' }
            },
            header: {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'text',
                        text: 'ลงทะเบียนสำเร็จ ✅',
                        weight: 'bold',
                        size: 'md',
                        color: '#16a34a', // green-600
                        flex: 1
                    }
                ]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'box', layout: 'horizontal', margin: 'md',
                        contents: [
                            { type: 'text', text: 'ชื่อ-สกุล', size: 'sm', color: '#64748b', flex: 2 },
                            { type: 'text', text: nameIdInput.value, size: 'sm', color: '#0f172a', align: 'end', flex: 4, weight: 'bold' }
                        ]
                    },
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'box', layout: 'horizontal', margin: 'md',
                        contents: [
                            { type: 'text', text: 'รหัส นสพ.', size: 'sm', color: '#64748b', flex: 2 },
                            { type: 'text', text: keynumberIdInput.value, size: 'sm', color: '#0f172a', align: 'end', flex: 4, weight: 'bold' }
                        ]
                    },
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'box', layout: 'horizontal', margin: 'md',
                        contents: [
                            { type: 'text', text: 'ชั้นปี', size: 'sm', color: '#64748b', flex: 2 },
                            { type: 'text', text: keynumber2IdInput.value, size: 'sm', color: '#0f172a', align: 'end', flex: 4, weight: 'bold' }
                        ]
                    }
                ]
            }
        }
    };

    try {
        await liff.sendMessages([flexMessage]);
        liff.closeWindow();
    } catch (error) {
        console.error('Error sending message:', error);
        liff.closeWindow(); // ปิดหน้าต่างแม้ว่าจะส่งข้อความไม่สำเร็จ
    }
}