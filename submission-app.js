// submission-app.js - Logic for Student Submission Portal
import { firebaseConfig } from './seminar-firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, deleteField, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let db = null;
let storage = null;
let auth = null;
let useFirebase = false;
let isAdmin = false;
let currentStudent = null;
let currentStudentId = "";

const searchForm = document.getElementById('submitSearchForm');
const searchInput = document.getElementById('searchInput');
const resultCard = document.getElementById('submitResultCard');
const submissionForm = document.getElementById('submissionForm');
const linkForm = document.getElementById('linkForm');
const fileForm = document.getElementById('fileForm');
const pdfUpload = document.getElementById('pdfUpload');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const btnSubmitWork = document.getElementById('btnSubmitWork');
const uploadStatus = document.getElementById('uploadStatus');

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    setupEvents();
});

function initFirebase() {
    const savedConfigStr = localStorage.getItem('user_firebase_config');
    let configToUse = firebaseConfig;
    if (savedConfigStr) {
        try { configToUse = JSON.parse(savedConfigStr); } catch (e) { }
    }

    if (configToUse && configToUse.projectId) {
        try {
            const app = initializeApp(configToUse);
            db = getFirestore(app);
            storage = getStorage(app);
            auth = getAuth(app);
            useFirebase = true;
            console.log("Submission system connected to Firebase & Storage");
        } catch (err) {
            console.warn("Firebase init failed:", err);
        }
    }
}

function setupEvents() {
    // ---------------- Auth Events ----------------
    document.getElementById('btnGoogleLogin')?.addEventListener('click', () => {
        if (!auth) return alert("Firebase Auth ยังไม่ได้ตั้งค่า");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ hd: 'kmitl.ac.th' }); // บังคับ @kmitl.ac.th เบื้องต้น
        signInWithPopup(auth, provider).catch(err => {
            console.error(err);
            alert("เข้าสู่ระบบล้มเหลว: " + err.message);
        });
    });

    document.getElementById('btnToggleAdminLogin')?.addEventListener('click', () => {
        const form = document.getElementById('adminLoginForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const pass = document.getElementById('adminPassword').value;
        if (!auth) return alert("Firebase Auth ยังไม่ได้ตั้งค่า");
        signInWithEmailAndPassword(auth, email, pass).catch(err => {
            console.error(err);
            alert("อีเมลหรือรหัสผ่านไม่ถูกต้อง: " + err.message);
        });
    });

    const logoutHandler = async () => {
        if (auth) await signOut(auth);
        location.reload();
    };

    document.getElementById('btnLogout')?.addEventListener('click', logoutHandler);
    document.getElementById('btnStudentLogout')?.addEventListener('click', logoutHandler);

    if (auth) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const email = user.email;
                // ตรวจสอบโดเมน (กันพลาดกรณี provider.setCustomParameters ไม่ทำงาน)
                if (!email.endsWith('@kmitl.ac.th')) {
                    alert("กรุณาเข้าสู่ระบบด้วยอีเมลสถาบัน (@kmitl.ac.th) เท่านั้น");
                    await signOut(auth);
                    return;
                }

                // แยกรหัสนักศึกษาออกจากอีเมล (เช็กว่าขึ้นต้นด้วยตัวเลข 8 หลัก)
                const match = email.match(/^(\d{8})@kmitl\.ac\.th$/);
                if (match) {
                    isAdmin = false;
                    const studentId = match[1];
                    document.getElementById('loginSection').style.display = 'none';
                    document.getElementById('adminSearchSection').style.display = 'none';
                    await findStudent(studentId); // ค้นหาข้อมูลตัวเองอัตโนมัติ
                } else {
                    // ถ้าไม่มีตัวเลข 8 หลัก ให้ถือว่าเป็น Admin (อาจารย์/เจ้าหน้าที่)
                    isAdmin = true;
                    document.getElementById('loginSection').style.display = 'none';
                    document.getElementById('adminSearchSection').style.display = 'block';
                    document.getElementById('adminDashboardSection').style.display = 'block';
                    loadAdminDashboard();
                }
            } else {
                // Not logged in
                document.getElementById('loginSection').style.display = 'block';
                document.getElementById('adminSearchSection').style.display = 'none';
                document.getElementById('submitResultCard').style.display = 'none';
            }
        });
    }

    // ---------------- Form Events ----------------
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = searchInput.value.trim();
        if (!id) return;

        btnSubmitWork.disabled = false;
        await findStudent(id);
    });

    document.getElementById('btnDeleteSubmission')?.addEventListener('click', async () => {
        if (!currentStudent || !currentStudentId) return;

        if (confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการส่งงานนี้?\n(ข้อมูลจะถูกเปลี่ยนสถานะเป็น 'ยังไม่ส่งงาน')")) {
            try {
                if (useFirebase && db) {
                    await updateDoc(doc(db, "students", currentStudentId), {
                        submissionUrl: deleteField(),
                        submissionType: deleteField(),
                        submissionFileName: deleteField(),
                        submittedAt: deleteField()
                    });
                } else {
                    const localData = JSON.parse(localStorage.getItem('seminar_students') || '[]');
                    const idx = localData.findIndex(s => s.id === currentStudentId);
                    if (idx > -1) {
                        delete localData[idx].submissionUrl;
                        delete localData[idx].submissionType;
                        delete localData[idx].submissionFileName;
                        delete localData[idx].submittedAt;
                        localStorage.setItem('seminar_students', JSON.stringify(localData));
                    }
                }
                showCustomAlert('success', 'ยกเลิกสำเร็จ', 'ยกเลิกการส่งงานเรียบร้อยแล้ว');
                await findStudent(currentStudentId);
            } catch (err) {
                console.error("Delete error", err);
                showCustomAlert('error', 'ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการยกเลิกส่งงาน');
            }
        }
    });

    document.getElementById('btnRefreshDashboard')?.addEventListener('click', () => {
        loadAdminDashboard();
    });

    document.getElementById('btnSaveEval')?.addEventListener('click', async () => {
        if (!currentStudent || !currentStudentId) return;
        const evalStatus = document.querySelector('input[name="evalStatusInput"]:checked')?.value;
        const evalFeedback = document.getElementById('evalFeedbackInput').value.trim();

        if (!evalStatus) return alert("กรุณาเลือกสถานะการประเมิน (ผ่าน/ต้องแก้ไข)");

        try {
            if (useFirebase && db) {
                await updateDoc(doc(db, "students", currentStudentId), {
                    evalStatus: evalStatus,
                    evalFeedback: evalFeedback
                });
            } else {
                const localData = JSON.parse(localStorage.getItem('seminar_students') || '[]');
                const idx = localData.findIndex(s => s.id === currentStudentId);
                if (idx > -1) {
                    localData[idx].evalStatus = evalStatus;
                    localData[idx].evalFeedback = evalFeedback;
                    localStorage.setItem('seminar_students', JSON.stringify(localData));
                }
            }
            await findStudent(currentStudentId);
            if (isAdmin) {
                loadAdminDashboard();
                if (typeof window.closeAdminModal === 'function') {
                    window.closeAdminModal();
                }
            }
            setTimeout(() => {
                showCustomAlert('success', 'สำเร็จ', 'บันทึกผลการตรวจเรียบร้อย');
            }, 300); // delay so modal closes first
        } catch (err) {
            console.error("Save eval error", err);
            showCustomAlert('error', 'ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกผลการตรวจ');
        }
    });

    document.querySelectorAll('input[name="submitType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'link') {
                linkForm.style.display = 'block';
                fileForm.style.display = 'none';
            } else {
                linkForm.style.display = 'none';
                fileForm.style.display = 'block';
            }
        });
    });

    pdfUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.innerText = "ไฟล์ที่เลือก: " + e.target.files[0].name;
        }
    });

    submissionForm.addEventListener('submit', handleSubmission);
}

async function findStudent(id) {
    currentStudentId = id;
    let found = null;

    if (useFirebase && db) {
        try {
            const docRef = doc(db, "students", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                found = docSnap.data();
            }
        } catch (e) { console.error("Firestore error", e); }
    } else {
        const localData = JSON.parse(localStorage.getItem('seminar_students') || '[]');
        found = localData.find(s => s.id === id);
    }

    if (found) {
        currentStudent = found;
        document.getElementById('resStudentName').innerText = found.name || "ไม่มีชื่อ";
        document.getElementById('resStudentID').innerText = id;

        updateSubmissionUI(found);

        if (isAdmin) {
            let overlay = document.getElementById('adminEvalModalOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'adminEvalModalOverlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.background = 'rgba(0,0,0,0.5)';
                overlay.style.zIndex = '9998';
                overlay.style.display = 'none';
                document.body.appendChild(overlay);

                overlay.addEventListener('click', () => {
                    closeAdminModal();
                });
            }

            // Transform resultCard into modal
            resultCard.style.position = 'fixed';
            resultCard.style.top = '50%';
            resultCard.style.left = '50%';
            resultCard.style.transform = 'translate(-50%, -50%)';
            resultCard.style.zIndex = '9999';
            resultCard.style.width = '90%';
            resultCard.style.maxWidth = '600px';
            resultCard.style.maxHeight = '90vh';
            resultCard.style.overflowY = 'auto';
            resultCard.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
            resultCard.style.margin = '0';

            // Add Close button if not exists
            if (!document.getElementById('btnAdminCloseModal')) {
                const closeBtn = document.createElement('button');
                closeBtn.id = 'btnAdminCloseModal';
                closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                closeBtn.style.position = 'absolute';
                closeBtn.style.top = '1rem';
                closeBtn.style.right = '1rem';
                closeBtn.style.background = 'var(--bg-surface-subtle)';
                closeBtn.style.border = 'none';
                closeBtn.style.fontSize = '1.2rem';
                closeBtn.style.cursor = 'pointer';
                closeBtn.style.borderRadius = '50%';
                closeBtn.style.width = '35px';
                closeBtn.style.height = '35px';
                closeBtn.style.display = 'flex';
                closeBtn.style.justifyContent = 'center';
                closeBtn.style.alignItems = 'center';
                closeBtn.onclick = closeAdminModal;
                resultCard.appendChild(closeBtn);
            }
            document.getElementById('btnAdminCloseModal').style.display = 'flex';

            overlay.style.display = 'block';
        }

        resultCard.style.display = 'block';
    } else {
        alert("ไม่พบข้อมูลนักศึกษารหัส " + id);
        resultCard.style.display = 'none';
    }
}

window.closeAdminModal = () => {
    document.getElementById('submitResultCard').style.display = 'none';
    const overlay = document.getElementById('adminEvalModalOverlay');
    if (overlay) overlay.style.display = 'none';
};

function updateSubmissionUI(student) {
    const statusBadge = document.getElementById('resSubmitStatusBadge');
    const submittedInfoBox = document.getElementById('submittedInfoBox');
    const submitFormSection = document.getElementById('submitFormSection');

    if (student.submissionUrl) {
        statusBadge.innerHTML = '<i class="fa-solid fa-check-circle"></i> ส่งงานแล้ว';
        statusBadge.style.background = 'var(--green-subtle)';
        statusBadge.style.color = 'var(--green-primary)';
        statusBadge.style.borderColor = 'var(--green-primary)';

        submittedInfoBox.style.display = 'block';
        submitFormSection.style.display = 'none'; // ซ่อนฟอร์มเมื่อส่งแล้ว

        const dateStr = student.submittedAt ? new Date(student.submittedAt).toLocaleString('th-TH') : "ไม่ระบุเวลา";
        document.getElementById('submittedTimeText').innerText = "ส่งเมื่อ: " + dateStr;

        const linkElem = document.getElementById('submittedLink');
        linkElem.href = student.submissionUrl;
        linkElem.innerText = student.submissionType === 'file' ? `เปิดดูไฟล์ที่แนบ: ${student.submissionFileName}` : "คลิกดูลิงก์ที่ส่ง";
    } else {
        statusBadge.innerHTML = '<i class="fa-solid fa-file-circle-xmark"></i> ยังไม่ส่งงาน';
        statusBadge.style.background = 'var(--bg-surface-subtle)';
        statusBadge.style.color = 'var(--text-muted)';
        statusBadge.style.borderColor = '#cbd5e1';

        submittedInfoBox.style.display = 'none';
        submitFormSection.style.display = 'block';
    }

    const evalDisplayBox = document.getElementById('evalDisplayBox');
    const evalStatusDisplay = document.getElementById('evalStatusDisplay');
    const evalFeedbackDisplay = document.getElementById('evalFeedbackDisplay');
    const adminEvalBox = document.getElementById('adminEvalBox');

    if (evalDisplayBox) {
        if (isAdmin) {
            adminEvalBox.style.display = 'block';
            if (student.evalStatus) {
                const radio = document.querySelector(`input[name="evalStatusInput"][value="${student.evalStatus}"]`);
                if (radio) radio.checked = true;
            } else {
                document.querySelectorAll('input[name="evalStatusInput"]').forEach(r => r.checked = false);
            }
            document.getElementById('evalFeedbackInput').value = student.evalFeedback || "";
        } else {
            if (adminEvalBox) adminEvalBox.style.display = 'none';
        }

        if (student.evalStatus) {
            evalDisplayBox.style.display = 'block';
            if (student.evalStatus === 'pass') {
                evalStatusDisplay.innerHTML = '<span style="color: var(--green-primary);"><i class="fa-solid fa-check"></i> ผ่าน (Pass)</span>';
                evalDisplayBox.style.borderLeftColor = 'var(--green-primary)';
                evalDisplayBox.style.background = '#f0fdf4';
            } else {
                evalStatusDisplay.innerHTML = '<span style="color: var(--error-red, #ef4444);"><i class="fa-solid fa-xmark"></i> ต้องแก้ไข (Revise)</span>';
                evalDisplayBox.style.borderLeftColor = '#ef4444';
                evalDisplayBox.style.background = '#fef2f2';
            }
            evalFeedbackDisplay.innerText = student.evalFeedback || "-";
        } else {
            evalDisplayBox.style.display = 'none';
        }
    }
}

async function handleSubmission(e) {
    e.preventDefault();
    if (!currentStudent) return;

    const submitType = document.querySelector('input[name="submitType"]:checked').value;
    let url = "";
    let fileName = "";

    btnSubmitWork.disabled = true;

    if (submitType === 'link') {
        url = document.getElementById('linkInput').value.trim();
        if (!url) {
            alert("กรุณากรอกลิงก์");
            btnSubmitWork.disabled = false;
            return;
        }
    } else {
        const file = pdfUpload.files[0];
        if (!file) {
            alert("กรุณาเลือกไฟล์ PDF");
            btnSubmitWork.disabled = false;
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert("ไฟล์มีขนาดเกิน 10MB");
            btnSubmitWork.disabled = false;
            return;
        }
        fileName = `${currentStudentId}_${file.name}`;
        // เปลี่ยนไปใช้ Google Apps Script เพื่ออัปโหลดเข้า Google Drive แทน
        const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyy0laKaPhhbOFPJk7lDFT04en_qZldKvJnDHFZ9O_LQWvuXDOt2VRB2yCgG12sGAIv/exec"; // **นำ URL ที่ได้จาก Google Apps Script มาใส่ตรงนี้**

        if (GOOGLE_APPS_SCRIPT_URL.trim() === "") {
            alert("ระบบยังไม่ได้เชื่อมต่อกับ Google Drive (ยังไม่ได้ใส่ Apps Script URL ในไฟล์ submission-app.js)");
            btnSubmitWork.disabled = false;
            return;
        }

        uploadStatus.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="font-weight: 600; color: var(--green-primary);"><i class="fa-solid fa-cloud-arrow-up"></i> กำลังอัปโหลด...</span>
                <span id="uploadPercent" style="font-weight: bold; color: var(--green-primary);">0%</span>
            </div>
            <div style="width: 100%; background: #e2e8f0; border-radius: 10px; overflow: hidden; height: 10px;">
                <div id="uploadProgressBar" style="width: 0%; background: var(--green-primary); height: 100%; transition: width 0.3s ease;"></div>
            </div>
            <p id="uploadStatusText" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">กำลังเตรียมไฟล์...</p>
        `;
        uploadStatus.style.display = 'block';

        const progressBar = document.getElementById('uploadProgressBar');
        const progressPercent = document.getElementById('uploadPercent');
        const progressText = document.getElementById('uploadStatusText');

        try {
            // แปลงไฟล์เป็น Base64
            progressText.innerText = "กำลังแปลงไฟล์เป็นรูปแบบที่รองรับ...";
            progressBar.style.width = "5%";
            progressPercent.innerText = "5%";

            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });

            progressText.innerText = "กำลังส่งข้อมูลไปยัง Google Drive...";
            progressBar.style.width = "10%";
            progressPercent.innerText = "10%";

            const payload = JSON.stringify({
                filename: fileName,
                mimeType: file.type,
                base64: base64
            });

            // ส่งข้อมูลไปที่ Google Apps Script
            // จำเป็นต้องใช้ fetch ปกติเพื่อหลีกเลี่ยง CORS preflight error 
            // (ถ้าดักจับ upload progress จะเกิด OPTIONS request ที่ Google ไม่รองรับ)

            // จำลอง Progress Bar ขณะกำลังส่งข้อมูลและรอ Google ประมวลผล
            let p = 10;
            const fakeInterval = setInterval(() => {
                if (p < 99) {
                    p += Math.floor(Math.random() * 5) + 1; // สุ่มเพิ่มทีละ 1-5%
                    if (p > 99) p = 99;
                    if (p > 50) progressText.innerText = "กำลังจัดเก็บและสร้างลิงก์ (อาจใช้เวลาสักครู่)...";
                    progressBar.style.width = p + "%";
                    progressPercent.innerText = p + "%";
                }
            }, 600);

            let data;
            try {
                const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    body: payload
                });
                data = await res.json();
            } finally {
                clearInterval(fakeInterval);
            }

            if (data.success) {
                progressBar.style.width = "100%";
                progressPercent.innerText = "100%";
                progressText.innerText = "อัปโหลดสำเร็จ!";
                progressText.style.color = "var(--green-primary)";
                url = data.fileUrl; // ได้ลิงก์จาก Google Drive
            } else {
                throw new Error(data.error || "เกิดข้อผิดพลาดจากฝั่ง Google Drive");
            }
        } catch (err) {
            console.error(err);
            showCustomAlert('error', 'อัปโหลดไฟล์ล้มเหลว', err.message);
            uploadStatus.style.display = 'none';
            btnSubmitWork.disabled = false;
            return;
        }

        // รอให้เห็น 100% สัก 0.5 วิแล้วค่อยซ่อน
        await new Promise(r => setTimeout(r, 500));
        uploadStatus.style.display = 'none';
    }

    const submitData = {
        submissionType: submitType,
        submissionUrl: url,
        submissionFileName: fileName,
        submittedAt: new Date().toISOString()
    };

    // Save to Firestore (or Local)
    if (useFirebase && db) {
        try {
            await updateDoc(doc(db, "students", currentStudentId), submitData);
        } catch (err) {
            console.error(err);
            alert("บันทึกข้อมูลสถานะการส่งงานล้มเหลว");
            btnSubmitWork.disabled = false;
            return;
        }
    } else {
        const localData = JSON.parse(localStorage.getItem('seminar_students') || '[]');
        const idx = localData.findIndex(s => s.id === currentStudentId);
        if (idx > -1) {
            localData[idx] = { ...localData[idx], ...submitData };
            localStorage.setItem('seminar_students', JSON.stringify(localData));
        }
    }

    btnSubmitWork.disabled = false;
    currentStudent = { ...currentStudent, ...submitData };
    updateSubmissionUI(currentStudent);
    if (isAdmin) loadAdminDashboard();

    showCustomAlert('success', 'ส่งงานเรียบร้อยแล้ว!', 'ข้อมูลของคุณถูกบันทึกเข้าระบบแล้ว');
}

async function loadAdminDashboard() {
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem;">กำลังโหลดข้อมูล...</td></tr>';

    let allStudents = [];
    if (useFirebase && db) {
        try {
            const querySnapshot = await getDocs(collection(db, "students"));
            querySnapshot.forEach(doc => {
                allStudents.push({ id: doc.id, ...doc.data() });
            });
        } catch (e) {
            console.error("Error fetching students", e);
        }
    } else {
        allStudents = JSON.parse(localStorage.getItem('seminar_students') || '[]');
    }

    // เรียงตามรหัสนักศึกษา
    allStudents.sort((a, b) => a.id.localeCompare(b.id));

    if (allStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem;">ไม่มีข้อมูลนักศึกษา</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    allStudents.forEach(st => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #e2e8f0";

        // รหัส/ชื่อ
        const nameCell = `<div><strong>${st.id}</strong></div><div style="font-size: 0.85rem; color: var(--text-muted);">${st.name || 'ไม่มีชื่อ'}</div>`;

        // การส่ง
        let submitCell = `<span style="color: var(--text-muted);"><i class="fa-solid fa-file-circle-xmark"></i> ยังไม่ส่ง</span>`;
        if (st.submissionUrl) {
            submitCell = `<a href="${st.submissionUrl}" target="_blank" style="color: var(--accent-blue); font-weight: bold; text-decoration: none;"><i class="fa-solid fa-file-arrow-up"></i> ส่งแล้ว</a>`;
        }

        // เวลา
        const timeCell = st.submittedAt ? new Date(st.submittedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';

        // ผลตรวจ
        let evalCell = '-';
        if (st.evalStatus === 'pass') evalCell = `<span style="color: var(--green-primary); font-weight: bold;"><i class="fa-solid fa-check"></i> ผ่าน</span>`;
        else if (st.evalStatus === 'revise') evalCell = `<span style="color: #ef4444; font-weight: bold;"><i class="fa-solid fa-xmark"></i> แก้ไข</span>`;

        // ปุ่มจัดการ (ตรวจงาน & ส่งอีเมล)
        const emailLink = `mailto:${st.id}@kmitl.ac.th?subject=แจ้งผลการตรวจงานสัมมนา&body=เรียน ${st.name || 'นักศึกษา'},%0A%0A`;
        const actionCell = `
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn-edit" onclick="findStudent('${st.id}')" style="font-size: 0.8rem; padding: 4px 8px; background: var(--orange-primary); color: white;"><i class="fa-solid fa-magnifying-glass"></i> ตรวจงาน</button>
                <a href="${emailLink}" class="btn-edit" style="font-size: 0.8rem; padding: 4px 8px; background: #3b82f6; color: white; text-decoration: none;"><i class="fa-solid fa-envelope"></i> เมล</a>
            </div>
        `;

        tr.innerHTML = `
            <td style="padding: 0.75rem;">${nameCell}</td>
            <td style="padding: 0.75rem;">${submitCell}</td>
            <td style="padding: 0.75rem;">${timeCell}</td>
            <td style="padding: 0.75rem;">${evalCell}</td>
            <td style="padding: 0.75rem;">${actionCell}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.findStudent = findStudent;

function showCustomAlert(type, title, text) {
    let overlay = document.getElementById('customAlertOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'customAlertOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100%'; overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.backdropFilter = 'blur(3px)';
        document.body.appendChild(overlay);
    }

    let iconHtml = '';
    let btnColor = 'var(--green-primary)';
    if (type === 'success') {
        iconHtml = '<div style="width: 60px; height: 60px; border-radius: 50%; background: #dcfce7; color: var(--green-primary); display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1rem;"><i class="fa-solid fa-check"></i></div>';
    } else if (type === 'error') {
        iconHtml = '<div style="width: 60px; height: 60px; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1rem;"><i class="fa-solid fa-xmark"></i></div>';
        btnColor = '#ef4444';
    }

    overlay.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 16px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); transform: scale(0.9); animation: popIn 0.3s forwards;">
            ${iconHtml}
            <h2 style="margin: 0 0 0.5rem; font-size: 1.5rem; color: #1e293b;">${title}</h2>
            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">${text}</p>
            <button id="customAlertBtn" style="background: ${btnColor}; color: white; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; transition: opacity 0.2s;">ตกลง</button>
        </div>
        <style>
            @keyframes popIn {
                to { transform: scale(1); }
            }
            #customAlertBtn:hover { opacity: 0.9; }
        </style>
    `;

    overlay.style.display = 'flex';

    document.getElementById('customAlertBtn').onclick = () => {
        overlay.style.display = 'none';
    };
}
window.showCustomAlert = showCustomAlert;
