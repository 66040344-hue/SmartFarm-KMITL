// submission-app.js - Logic for Student Submission Portal
import { firebaseConfig } from './seminar-firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 'student' (submission.html) หรือ 'admin' (หน้าผู้ดูแล) กำหนดจาก <body data-mode="...">
const PAGE_MODE = document.body.dataset.mode === 'admin' ? 'admin' : 'student';
const show = (id, display) => { const el = document.getElementById(id); if (el) el.style.display = display; };

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyy0laKaPhhbOFPJk7lDFT04en_qZldKvJnDHFZ9O_LQWvuXDOt2VRB2yCgG12sGAIv/exec"; // **นำ URL ที่ได้จาก Google Apps Script มาใส่ตรงนี้**

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

    document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const pass = document.getElementById('adminPassword').value;
        if (!auth) return alert("Firebase Auth ยังไม่ได้ตั้งค่า");
        showBusy('กำลังเข้าสู่ระบบ', ['ตรวจสอบอีเมลและรหัสผ่าน', 'โหลดรายชื่อและสถานะการส่งงาน']);
        signInWithEmailAndPassword(auth, email, pass).catch(err => {
            console.error(err);
            hideBusy();
            alert("อีเมลหรือรหัสผ่านไม่ถูกต้อง: " + err.message);
        });
    });

    const logoutHandler = async () => {
        showBusy('กำลังออกจากระบบ', ['ล้างเซสชันการเข้าใช้งาน']);
        if (auth) await signOut(auth);
        location.reload();
    };

    document.getElementById('btnLogout')?.addEventListener('click', logoutHandler);
    document.getElementById('btnStudentLogout')?.addEventListener('click', logoutHandler);

    if (auth) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const isPasswordUser = user.providerData.some(p => p.providerId === 'password');

                if (PAGE_MODE === 'admin') {
                    // หน้าผู้ดูแล: รับเฉพาะบัญชีอีเมล/รหัสผ่านที่สร้างใน Firebase Authentication
                    if (!isPasswordUser) {
                        hideBusy();
                        alert("บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ");
                        await signOut(auth);
                        return;
                    }
                    isAdmin = true;
                    show('loginSection', 'none');
                    show('adminSearchSection', 'block');
                    show('adminDashboardSection', 'block');
                    busyStep(1);
                    await loadAdminDashboard();
                    hideBusy();
                    return;
                }

                // หน้านักศึกษา: ต้องเป็น Google @kmitl.ac.th ที่เป็นรหัส 8 หลักเท่านั้น
                const match = !isPasswordUser && (user.email || '').match(/^(\d{8})@kmitl\.ac\.th$/);
                if (!match) {
                    alert("กรุณาเข้าสู่ระบบด้วยอีเมลนักศึกษา (รหัส 8 หลัก@kmitl.ac.th) เท่านั้น");
                    await signOut(auth);
                    return;
                }
                isAdmin = false;
                show('loginSection', 'none');
                await findStudent(match[1]); // ค้นหาข้อมูลตัวเองอัตโนมัติ
            } else {
                // Not logged in
                show('loginSection', 'block');
                show('adminSearchSection', 'none');
                show('adminDashboardSection', 'none');
                show('submitResultCard', 'none');
            }
        });
    }

    // ---------------- Form Events ----------------
    searchForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = searchInput.value.trim();
        if (!id) return;

        btnSubmitWork.disabled = false;
        await findStudent(id);
    });

    document.getElementById('btnDeleteSubmission')?.addEventListener('click', async () => {
        if (!currentStudent || !currentStudentId) return;

        if (confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการส่งงานนี้?\n(ข้อมูลจะถูกเปลี่ยนสถานะเป็น 'ยังไม่ส่งงาน')")) {
            showBusy('กำลังยกเลิกการส่งงาน', [`ล้างลิงก์/ไฟล์ที่ส่งไว้ของรหัส ${currentStudentId}`, 'โหลดข้อมูลล่าสุด']);
            try {
                if (useFirebase && db) {
                    await updateDoc(doc(db, "students", currentStudentId), {
                        submissionUrl: deleteField(),
                        submissionFileUrl: deleteField(),
                        submissionType: deleteField(),
                        submissionFileName: deleteField(),
                        submittedAt: deleteField()
                    });
                } else {
                    const localData = JSON.parse(localStorage.getItem('seminar_students') || '[]');
                    const idx = localData.findIndex(s => s.id === currentStudentId);
                    if (idx > -1) {
                        delete localData[idx].submissionUrl; delete localData[idx].submissionFileUrl;
                        delete localData[idx].submissionType;
                        delete localData[idx].submissionFileName;
                        delete localData[idx].submittedAt;
                        localStorage.setItem('seminar_students', JSON.stringify(localData));
                    }
                }
                busyStep(1);
                await findStudent(currentStudentId);
                if (isAdmin) await loadAdminDashboard();
                hideBusy();
                showCustomAlert('success', 'ยกเลิกสำเร็จ', 'ยกเลิกการส่งงานเรียบร้อยแล้ว');
            } catch (err) {
                console.error("Delete error", err);
                hideBusy();
                showCustomAlert('error', 'ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการยกเลิกส่งงาน');
            }
        }
    });

    document.getElementById('btnRefreshDashboard')?.addEventListener('click', () => {
        loadAdminDashboard();
    });
    document.getElementById('dashSearch')?.addEventListener('input', renderDashboard);
    document.getElementById('dashFilter')?.addEventListener('change', renderDashboard);
    document.getElementById('dashSort')?.addEventListener('change', renderDashboard);
    document.getElementById('dashSummary')?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-filter]');
        if (!card) return;
        document.getElementById('dashFilter').value = card.dataset.filter;
        renderDashboard();
    });
    document.getElementById('btnExportCsv')?.addEventListener('click', exportCsv);
    document.getElementById('dashboardTableBody')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-review-id]');
        if (btn) findStudent(btn.dataset.reviewId);
        const mailBtn = e.target.closest('[data-mail-id]');
        if (mailBtn) openMailModal(mailBtn.dataset.mailId);
    });

    document.getElementById('btnMailCancel')?.addEventListener('click', closeMailModal);
    document.getElementById('mailModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'mailModal') closeMailModal();
    });
    document.getElementById('btnMailSend')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnMailSend');
        const subject = document.getElementById('mailSubject').value.trim();
        const message = document.getElementById('mailBody').value.trim();
        if (!subject || !message) return alert("กรุณากรอกหัวข้อและเนื้อหาอีเมล");

        const to = document.getElementById('mailTo').value;
        btn.disabled = true;
        showBusy('กำลังส่งอีเมล', [`ส่งถึง ${to} ผ่าน Google Apps Script (ปกติใช้เวลา 3–10 วินาที)`]);
        const result = await sendMail(to, subject, message);
        hideBusy();
        btn.disabled = false;
        if (result.success) {
            closeMailModal();
            showCustomAlert('success', 'ส่งเมลสำเร็จ', 'ส่งอีเมลถึงนักศึกษาเรียบร้อยแล้ว');
        } else {
            showCustomAlert('error', 'ส่งเมลไม่สำเร็จ', result.error);
        }
    });

    document.getElementById('btnSaveEval')?.addEventListener('click', async () => {
        if (!currentStudent || !currentStudentId) return;
        const evalStatus = document.querySelector('input[name="evalStatusInput"]:checked')?.value;
        const evalFeedback = document.getElementById('evalFeedbackInput').value.trim();

        if (!evalStatus) return alert("กรุณาเลือกสถานะ (ผ่าน / ยังไม่ผ่าน / ยังไม่ได้ส่ง)");

        const resetSubmission = evalStatus === 'notsubmitted';
        if (resetSubmission && !confirm("การตั้งเป็น 'ยังไม่ได้ส่ง' จะล้างลิงก์/ไฟล์ที่นักศึกษาส่งไว้ ต้องการดำเนินการต่อหรือไม่?")) return;

        const notifyStudent = document.getElementById('evalNotifyEmail')?.checked;
        const steps = [`บันทึกผล "${EVAL_STATUS_LABEL[evalStatus]}" ของรหัส ${currentStudentId}`];
        if (notifyStudent) steps.push(`ส่งอีเมลแจ้งผลถึง ${currentStudentId}@kmitl.ac.th`);
        steps.push('อัปเดตสถานะในรายชื่อนักศึกษา');
        showBusy('กำลังบันทึกผลการตรวจ', steps);

        try {
            if (useFirebase && db) {
                const payload = { evalStatus, evalFeedback, evalUpdatedAt: new Date().toISOString() };
                if (resetSubmission) {
                    payload.submissionUrl = deleteField();
                    payload.submissionFileUrl = deleteField();
                    payload.submissionType = deleteField();
                    payload.submissionFileName = deleteField();
                    payload.submittedAt = deleteField();
                }
                await updateDoc(doc(db, "students", currentStudentId), payload);
            } else {
                const localData = JSON.parse(localStorage.getItem('seminar_students') || '[]');
                const idx = localData.findIndex(s => s.id === currentStudentId);
                if (idx > -1) {
                    localData[idx].evalStatus = evalStatus;
                    localData[idx].evalFeedback = evalFeedback;
                    localData[idx].evalUpdatedAt = new Date().toISOString();
                    if (resetSubmission) {
                        delete localData[idx].submissionUrl; delete localData[idx].submissionFileUrl;
                        delete localData[idx].submissionType;
                        delete localData[idx].submissionFileName;
                        delete localData[idx].submittedAt;
                    }
                    localStorage.setItem('seminar_students', JSON.stringify(localData));
                }
            }
            if (notifyStudent) busyStep(1);
            const mailResult = notifyStudent
                ? await sendEvalEmail(currentStudentId, currentStudent?.name, evalStatus, evalFeedback)
                : null;

            busyStep(steps.length - 1);
            await findStudent(currentStudentId);
            if (isAdmin) {
                await loadAdminDashboard();
                if (typeof window.closeAdminModal === 'function') {
                    window.closeAdminModal();
                }
            }
            hideBusy();
            setTimeout(() => {
                if (mailResult && !mailResult.success) {
                    showCustomAlert('error', 'บันทึกแล้ว แต่ส่งเมลไม่สำเร็จ', mailResult.error);
                } else {
                    showCustomAlert('success', 'สำเร็จ', mailResult ? 'บันทึกผลการตรวจและส่งเมลแจ้งนักศึกษาเรียบร้อย' : 'บันทึกผลการตรวจเรียบร้อย');
                }
            }, 300); // delay so modal closes first
        } catch (err) {
            console.error("Save eval error", err);
            hideBusy();
            showCustomAlert('error', 'ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกผลการตรวจ');
        }
    });

    setupOtpInput();

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

    // ถ้าเรียกจากขั้นตอนอื่นที่แสดงหน้าต่างรออยู่แล้ว ไม่ต้องเปิดซ้อน
    const ownBusy = !isBusy();
    if (ownBusy) showBusy(isAdmin ? 'กำลังเปิดข้อมูลนักศึกษา' : 'กำลังโหลดข้อมูลการส่งงานของคุณ',
        [`โหลดข้อมูล งานที่ส่ง และผลการตรวจของรหัส ${id}`]);

    if (useFirebase && db) {
        try {
            const docRef = doc(db, "students", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                found = docSnap.data();
                // เบอร์โทรเก็บแยกใน contacts (อ่านได้เฉพาะผู้ดูแลและเจ้าของ)
                try {
                    const contact = await getDoc(doc(db, "contacts", id));
                    found.phone = contact.exists() ? contact.data().phone : "";
                } catch (e) { console.warn("Contact read error", e); }
            }
        } catch (e) { console.error("Firestore error", e); }
    } else {
        const localData = JSON.parse(localStorage.getItem('seminar_students') || '[]');
        found = localData.find(s => s.id === id);
    }
    if (ownBusy) hideBusy();

    if (found) {
        currentStudent = found;
        document.getElementById('resStudentName').innerText = found.name || "ไม่มีชื่อ";
        document.getElementById('resStudentID').innerText = id;

        updateSubmissionUI(found);

        if (isAdmin) {
            // หน้าผู้ดูแล: แสดงการ์ดเป็นหน้าต่างรายละเอียด (สไตล์อยู่ใน review-portal)
            resultCard.classList.add('is-modal');
            document.getElementById('adminEvalModalOverlay').style.display = 'block';
            document.body.classList.add('modal-open');
            const phoneEl = document.getElementById('resStudentPhone');
            if (phoneEl) phoneEl.textContent = found.phone || 'ไม่ได้ระบุ';
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
    document.body.classList.remove('modal-open');
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isAdmin && !isBusy()) window.closeAdminModal(); });

// ติดตามสถานะแบบขนส่ง: ส่งงานแล้ว → บันทึกเข้าระบบ → รอตรวจ → แจ้งผลตรวจ
function updateTracker(student) {
    const box = document.getElementById('trackBox');
    if (!box) return; // หน้า Admin ไม่มีส่วนนี้

    const submitted = !!student.submissionUrl;
    box.style.display = submitted ? 'block' : 'none';
    if (!submitted) return;

    const evaluated = student.evalStatus === 'pass' || student.evalStatus === 'revise';
    const stage = evaluated ? 4 : 3; // ขั้นปัจจุบัน (1-4); ขั้นที่ 1-2 เสร็จทันทีที่บันทึกลง Firestore สำเร็จ
    const dateStr = student.submittedAt
        ? new Date(student.submittedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const subs = [
        dateStr,
        'บันทึกเรียบร้อย',
        evaluated ? 'ตรวจเสร็จแล้ว' : 'อยู่ระหว่างการตรวจ',
        evaluated ? (student.evalStatus === 'pass' ? 'ผ่าน' : 'ต้องแก้ไข') : 'รอผู้ตรวจแจ้งผล'
    ];

    box.querySelectorAll('.t-step').forEach((el, i) => {
        const n = i + 1;
        el.style.setProperty('--n', i);
        el.classList.toggle('done', n < stage || (n === 4 && evaluated));
        el.classList.toggle('active', n === stage && !evaluated);
        el.classList.toggle('warn', n === 4 && student.evalStatus === 'revise');
        el.querySelector('.t-sub').textContent = subs[i];
    });
}

function updateSubmissionUI(student) {
    updateTracker(student);

    const otpBoxes = document.querySelectorAll('.otp-box');
    if (student.phone && ![...otpBoxes].some(b => b.value)) {
        String(student.phone).slice(0, 10).split('').forEach((d, i) => { if (otpBoxes[i]) otpBoxes[i].value = d; });
    }

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
        linkElem.href = safeUrl(student.submissionUrl);
        linkElem.rel = "noopener noreferrer";
        linkElem.innerText = student.submissionType === 'file' ? `เปิดดูไฟล์ที่แนบ: ${student.submissionFileName}` : "คลิกดูลิงก์ที่ส่ง";

        // กรณีส่งทั้งลิงก์และไฟล์ แสดงไฟล์เพิ่มอีกหนึ่งลิงก์
        const fileLinkElem = document.getElementById('submittedFileLink');
        if (student.submissionFileUrl) {
            fileLinkElem.href = safeUrl(student.submissionFileUrl);
            fileLinkElem.innerText = `เปิดดูไฟล์ที่แนบ: ${student.submissionFileName}`;
            fileLinkElem.style.display = 'block';
        } else {
            fileLinkElem.style.display = 'none';
        }
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
            } else if (student.evalStatus === 'notsubmitted') {
                evalStatusDisplay.innerHTML = '<span style="color: var(--text-muted);"><i class="fa-solid fa-file-circle-xmark"></i> ยังไม่ได้ส่ง <br>(ผู้ตรวจยกเลิกการส่งให้ กรุณาส่งงานใหม่)</span>';
                evalDisplayBox.style.borderLeftColor = '#94a3b8';
                evalDisplayBox.style.background = '#f1f5f9';
            } else {
                evalStatusDisplay.innerHTML = '<span style="color: var(--error-red, #ef4444);"><i class="fa-solid fa-xmark"></i> ยังไม่ผ่าน (ต้องแก้ไข)</span>';
                evalDisplayBox.style.borderLeftColor = '#ef4444';
                evalDisplayBox.style.background = '#fef2f2';
            }
            evalFeedbackDisplay.innerText = student.evalFeedback || "-";
        } else {
            evalDisplayBox.style.display = 'none';
        }
    }
}

// ช่องกรอกเบอร์โทรแบบ OTP: 1 ช่อง = 1 หลัก
function setupOtpInput() {
    const boxes = [...document.querySelectorAll('.otp-box')];
    const fill = (start, digits) => {
        digits.split('').forEach((d, i) => { if (boxes[start + i]) boxes[start + i].value = d; });
        boxes[Math.min(start + digits.length, boxes.length - 1)].focus();
    };
    boxes.forEach((box, i) => {
        box.addEventListener('input', () => {
            const digits = box.value.replace(/\D/g, '');
            box.value = '';
            if (digits) fill(i, digits);
        });
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); }
            else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
            else if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
        });
        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
            if (digits) fill(i, digits);
        });
        box.addEventListener('focus', () => box.select());
    });
}

async function handleSubmission(e) {
    e.preventDefault();
    if (!currentStudent) return;

    let fileName = "";

    const otpBoxes = [...document.querySelectorAll('.otp-box')];
    const phone = otpBoxes.map(b => b.value).join('');
    const linkUrl = document.getElementById('linkInput').value.trim();
    const file = pdfUpload.files[0];

    if (!linkUrl && !file) {
        alert("กรุณาแนบลิงก์หรืออัปโหลดไฟล์ PDF อย่างน้อย 1 อย่าง");
        return;
    }
    if (linkUrl && safeUrl(linkUrl) === '#') {
        alert("ลิงก์ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://");
        return;
    }
    // หน้าผู้ดูแล (ส่งแทนนักศึกษา) ไม่มีช่องเบอร์ จึงไม่บังคับ
    if (otpBoxes.length && !/^\d{10}$/.test(phone)) {
        alert("กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก (ตัวเลขเท่านั้น)");
        (otpBoxes.find(b => !b.value) || otpBoxes[0]).focus();
        return;
    }

    btnSubmitWork.disabled = true;
    let fileUrl = "";

    if (file) {
        if (file.size > 20 * 1024 * 1024) {
            alert("ไฟล์มีขนาดเกิน 20MB");
            btnSubmitWork.disabled = false;
            return;
        }
        fileName = `${currentStudentId}_${file.name}`;
        // เปลี่ยนไปใช้ Google Apps Script เพื่ออัปโหลดเข้า Google Drive แทน

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

            progressText.innerText = "กำลังอัปโหลด รอสักครู่...";
            progressBar.style.width = "10%";
            progressPercent.innerText = "10%";

            const idToken = await auth?.currentUser?.getIdToken();
            if (!idToken) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");

            const payload = JSON.stringify({
                idToken,
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
                fileUrl = data.fileUrl; // ได้ลิงก์จาก Google Drive
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
        submissionType: linkUrl && fileUrl ? 'both' : (fileUrl ? 'file' : 'link'),
        submissionUrl: linkUrl || fileUrl, // ลิงก์หลัก (ใช้กับหน้าแอดมิน)
        submissionFileUrl: linkUrl && fileUrl ? fileUrl : "",
        submissionFileName: fileName,
        submittedAt: new Date().toISOString()
    };

    // ส่งใหม่หลังถูกรีเซ็ต -> เคลียร์สถานะ "ยังไม่ได้ส่ง" ออก
    const clearReset = currentStudent.evalStatus === 'notsubmitted';

    // Save to Firestore (or Local)
    if (useFirebase && db) {
        showBusy('กำลังบันทึกการส่งงาน', [`บันทึกลิงก์/ไฟล์ของรหัส ${currentStudentId} ลงระบบ`]);
        try {
            // เบอร์โทรเก็บใน contacts (ไม่อยู่ใน students ที่อ่านได้สาธารณะ)
            if (phone) await setDoc(doc(db, "contacts", currentStudentId), { phone, updatedAt: new Date().toISOString() });
            await updateDoc(doc(db, "students", currentStudentId),
                clearReset ? { ...submitData, evalStatus: deleteField(), evalFeedback: deleteField() } : submitData);
            if (clearReset) { delete currentStudent.evalStatus; delete currentStudent.evalFeedback; }
            hideBusy();
        } catch (err) {
            console.error(err);
            hideBusy();
            alert("บันทึกข้อมูลสถานะการส่งงานล้มเหลว");
            btnSubmitWork.disabled = false;
            return;
        }
    } else {
        const localData = JSON.parse(localStorage.getItem('seminar_students') || '[]');
        const idx = localData.findIndex(s => s.id === currentStudentId);
        if (idx > -1) {
            localData[idx] = { ...localData[idx], ...submitData, ...(phone ? { phone } : {}) };
            localStorage.setItem('seminar_students', JSON.stringify(localData));
        }
    }

    btnSubmitWork.disabled = false;
    pdfUpload.value = '';
    fileNameDisplay.innerText = '';
    document.getElementById('linkInput').value = '';
    currentStudent = { ...currentStudent, ...submitData, ...(phone ? { phone } : {}) };
    updateSubmissionUI(currentStudent);
    if (isAdmin) loadAdminDashboard();

    showCustomAlert('success', 'ส่งงานเรียบร้อยแล้ว!', 'ข้อมูลของคุณถูกบันทึกเข้าระบบแล้ว');
}

async function loadAdminDashboard() {
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="empty"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดรายชื่อและสถานะการส่งงานล่าสุด...</td></tr>';
    const refreshIcon = document.querySelector('#btnRefreshDashboard i');
    refreshIcon?.classList.add('fa-spin');

    let allStudents = [];
    if (useFirebase && db) {
        try {
            const querySnapshot = await getDocs(collection(db, "students"));
            querySnapshot.forEach(d => {
                allStudents.push({ id: d.id, ...d.data() });
            });
            try {
                const contacts = {};
                (await getDocs(collection(db, "contacts"))).forEach(d => { contacts[d.id] = d.data().phone; });
                allStudents.forEach(s => { s.phone = contacts[s.id] || ''; });
            } catch (e) { console.warn("Error fetching contacts", e); }
        } catch (e) {
            console.error("Error fetching students", e);
        }
    } else {
        allStudents = JSON.parse(localStorage.getItem('seminar_students') || '[]');
    }

    // เรียงตามรหัสนักศึกษา
    refreshIcon?.classList.remove('fa-spin');
    allStudents.sort((a, b) => a.id.localeCompare(b.id));
    dashboardData = allStudents;
    const upd = document.getElementById('dashUpdated');
    if (upd) upd.textContent = 'อัปเดตล่าสุด ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    renderDashboard();
}

// ---------- Dashboard helpers ----------
let dashboardData = [];

function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// อนุญาตเฉพาะ http/https กัน javascript: URL
function safeUrl(u) {
    try {
        const p = new URL(u);
        return (p.protocol === 'https:' || p.protocol === 'http:') ? p.href : '#';
    } catch { return '#'; }
}

function getStatusKey(st) {
    if (st.evalStatus === 'pass') return 'pass';
    if (st.evalStatus === 'revise') return 'revise';
    if (!st.submissionUrl || st.evalStatus === 'notsubmitted') return 'notsubmitted';
    return 'pending';
}

const STATUS_LABEL = { pass: 'ผ่าน', revise: 'ยังไม่ผ่าน', notsubmitted: 'ยังไม่ได้ส่ง', pending: 'รอตรวจ' };

function getFilteredStudents() {
    const q = (document.getElementById('dashSearch')?.value || '').trim().toLowerCase();
    const f = document.getElementById('dashFilter')?.value || 'all';
    return dashboardData.filter(st => {
        if (f !== 'all' && getStatusKey(st) !== f) return false;
        return !q || st.id.toLowerCase().includes(q) || (st.name || '').toLowerCase().includes(q) || (st.phone || '').includes(q);
    });
}

function exportCsv() {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['รหัส', 'ชื่อ', 'เบอร์โทร', 'สถานะ', 'ลิงก์งาน', 'ลิงก์ไฟล์ PDF', 'เวลาส่ง', 'Feedback']];
    getFilteredStudents().forEach(st => rows.push([
        st.id, st.name || '', st.phone || '', STATUS_LABEL[getStatusKey(st)], st.submissionUrl || '', st.submissionFileUrl || '',
        st.submittedAt ? new Date(st.submittedAt).toLocaleString('th-TH') : '', st.evalFeedback || ''
    ]));
    // กัน CSV injection ใน Excel: ค่าที่ขึ้นต้นด้วย = + - @ ให้นำหน้าด้วย ' (เบอร์โทรเติม ' เพื่อคงเลข 0 นำหน้า)
    const csv = '﻿' + rows.map((r, ri) => r.map((c, ci) => {
        const s = String(c ?? '');
        return q(/^[=+\-@]/.test(s) || (ri > 0 && ci === 2 && s) ? "'" + s : s);
    }).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `submissions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

const STATUS_ORDER = { pending: 0, revise: 1, notsubmitted: 2, pass: 3 };
const STATUS_CHIP = {
    pass: '<span class="chip chip-pass"><i class="fa-solid fa-check"></i> ผ่าน</span>',
    revise: '<span class="chip chip-revise"><i class="fa-solid fa-xmark"></i> ยังไม่ผ่าน</span>',
    pending: '<span class="chip chip-pending"><i class="fa-solid fa-hourglass-half"></i> รอตรวจ</span>',
    notsubmitted: '<span class="chip chip-none"><i class="fa-regular fa-circle"></i> ยังไม่ได้ส่ง</span>'
};
const fmtThai = (iso) => iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
const fmtPhone = (p) => /^\d{10}$/.test(p || '') ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : '';

function renderDashboard() {
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;

    const filter = document.getElementById('dashFilter')?.value || 'all';
    const summary = document.getElementById('dashSummary');
    if (summary) {
        const counts = { pass: 0, revise: 0, notsubmitted: 0, pending: 0 };
        dashboardData.forEach(st => counts[getStatusKey(st)]++);
        const card = (key, label, n, cls) =>
            `<button type="button" class="stat ${cls} ${filter === key ? 'on' : ''}" data-filter="${key}"><span class="stat-n">${n}</span><span class="stat-l">${label}</span></button>`;
        summary.innerHTML = card('all', 'ทั้งหมด', dashboardData.length, 'stat-all') +
            card('pending', 'รอตรวจ', counts.pending, 'stat-pending') +
            card('pass', 'ผ่าน', counts.pass, 'stat-pass') +
            card('revise', 'ยังไม่ผ่าน', counts.revise, 'stat-revise') +
            card('notsubmitted', 'ยังไม่ได้ส่ง', counts.notsubmitted, 'stat-none');
    }

    const students = getFilteredStudents();
    const sortBy = document.getElementById('dashSort')?.value || 'queue';
    students.sort((a, b) => {
        if (sortBy === 'queue') {
            // คิวตรวจ: รอตรวจก่อน (ส่งก่อนตรวจก่อน) แล้วค่อยตามด้วยสถานะอื่น
            const d = STATUS_ORDER[getStatusKey(a)] - STATUS_ORDER[getStatusKey(b)];
            if (d) return d;
            return (a.submittedAt || '').localeCompare(b.submittedAt || '') || a.id.localeCompare(b.id);
        }
        return a.id.localeCompare(b.id);
    });

    const count = document.getElementById('dashCount');
    if (count) count.textContent = `แสดง ${students.length} จาก ${dashboardData.length} คน`;

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">ไม่พบนักศึกษาตามเงื่อนไขที่เลือก</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(st => {
        const key = getStatusKey(st);
        const links = [];
        if (st.submissionUrl) {
            const isFileOnly = st.submissionType === 'file';
            links.push(`<a class="doc-link" href="${escapeHtml(safeUrl(st.submissionUrl))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid ${isFileOnly ? 'fa-file-pdf' : 'fa-link'}"></i> ${isFileOnly ? 'ไฟล์ PDF' : 'ลิงก์'}</a>`);
        }
        if (st.submissionFileUrl) {
            links.push(`<a class="doc-link" href="${escapeHtml(safeUrl(st.submissionFileUrl))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-file-pdf"></i> ไฟล์ PDF</a>`);
        }
        const phone = fmtPhone(st.phone);
        return `<tr>
            <td data-label="นักศึกษา"><div class="s-id">${escapeHtml(st.id)}</div><div class="s-name">${escapeHtml(st.name || 'ไม่มีชื่อ')}</div></td>
            <td data-label="เบอร์โทร">${phone ? `<a class="tel" href="tel:${escapeHtml(st.phone)}">${phone}</a>` : '<span class="dim">-</span>'}</td>
            <td data-label="งานที่ส่ง">${links.length ? links.join('') : '<span class="dim">ยังไม่ส่ง</span>'}</td>
            <td data-label="ส่งเมื่อ" class="nowrap">${fmtThai(st.submittedAt)}</td>
            <td data-label="สถานะ">${STATUS_CHIP[key]}</td>
            <td class="actions-cell">
                <button class="btn-row primary" data-review-id="${escapeHtml(st.id)}"><i class="fa-solid fa-clipboard-check"></i> ตรวจ</button>
                <button class="btn-row" data-mail-id="${escapeHtml(st.id)}" title="ส่งอีเมล"><i class="fa-solid fa-envelope"></i></button>
            </td>
        </tr>`;
    }).join('');
}

window.findStudent = findStudent;

const EVAL_STATUS_LABEL = { pass: 'ผ่าน', revise: 'ยังไม่ผ่าน (ต้องแก้ไข)', notsubmitted: 'ยังไม่ได้ส่ง (รีเซ็ตการส่ง)' };
const MAIL_SUBJECT = 'แจ้งผลการตรวจงานสัมมนา';

// ร่างเนื้อหาอีเมลเริ่มต้น ผู้ดูแลแก้ไขได้ก่อนส่ง
function buildMailBody(name, status, feedback) {
    const lines = ['เรียน ' + (name || 'นักศึกษา') + ','];
    if (status && EVAL_STATUS_LABEL[status]) lines.push('', 'ผลการตรวจงานสัมมนาของคุณ: ' + EVAL_STATUS_LABEL[status]);
    if (feedback) lines.push('ข้อความจากผู้ตรวจ: ' + feedback);
    lines.push('', 'ตรวจสอบ/ส่งงานได้ที่: ' + new URL('submission.html', location.href).href, '', '(อีเมลนี้ส่งโดยระบบอัตโนมัติ)');
    return lines.join('\n');
}

function openMailModal(studentId) {
    const st = dashboardData.find(s => s.id === studentId);
    if (!st) return;
    document.getElementById('mailTo').value = `${st.id}@kmitl.ac.th`;
    document.getElementById('mailSubject').value = MAIL_SUBJECT;
    document.getElementById('mailBody').value = buildMailBody(st.name, st.evalStatus, st.evalFeedback);
    document.getElementById('mailModal').style.display = 'flex';
}

function closeMailModal() {
    document.getElementById('mailModal').style.display = 'none';
}

function sendEvalEmail(studentId, name, status, feedback) {
    return sendMail(`${studentId}@kmitl.ac.th`, MAIL_SUBJECT, buildMailBody(name, status, feedback));
}

// ส่งเมลผ่าน Google Apps Script (ฝั่งสคริปต์จะตรวจ ID token ว่าเป็นผู้ดูแลก่อนส่ง)
async function sendMail(to, subject, message) {
    try {
        const idToken = await auth?.currentUser?.getIdToken();
        if (!idToken) return { success: false, error: 'ไม่พบการเข้าสู่ระบบผู้ดูแล' };
        const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'sendEmail', idToken, to, subject, message })
        });
        return await res.json();
    } catch (err) {
        console.error('Send email error', err);
        return { success: false, error: err.message };
    }
}

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
            <h2 style="margin: 0 0 0.5rem; font-size: 1.5rem; color: #1e293b;">${escapeHtml(title)}</h2>
            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">${escapeHtml(text)}</p>
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

// ---------- หน้าต่างรอ (Loading overlay) ----------
// บอกผู้ใช้ว่าระบบกำลังทำอะไรอยู่ แทนการปล่อยหน้าจอนิ่ง; steps = รายการขั้นตอน (ขั้นปัจจุบันหมุนโหลด)
let busySteps = [], busySlowTimer = null;

function busyOverlay() {
    let el = document.getElementById('busyOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'busyOverlay';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
        <style>
            #busyOverlay { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(15,23,42,.55); backdrop-filter: blur(2px); align-items: center; justify-content: center; padding: 1rem; }
            #busyOverlay.on { display: flex; }
            #busyOverlay .busy-card { background: #fff; border-radius: 16px; padding: 1.6rem 1.5rem 1.3rem; width: 100%; max-width: 380px; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,.3); }
            #busyOverlay .busy-spin { width: 46px; height: 46px; margin: 0 auto .9rem; border-radius: 50%; border: 4px solid #e2e8f0; border-top-color: var(--brand, #15803d); animation: busySpin .8s linear infinite; }
            #busyOverlay h3 { margin: 0; font-size: 1.1rem; color: #0f172a; }
            #busyOverlay .busy-detail { margin: .35rem 0 0; font-size: .88rem; color: #64748b; word-break: break-word; }
            #busyOverlay ol { list-style: none; margin: 1rem 0 0; padding: .8rem .9rem; text-align: left; background: #f8fafc; border-radius: 10px; display: grid; gap: .45rem; font-size: .88rem; color: #94a3b8; }
            #busyOverlay ol:empty { display: none; }
            #busyOverlay li { display: flex; gap: .55rem; align-items: baseline; word-break: break-word; }
            #busyOverlay li i { width: 1em; flex: none; }
            #busyOverlay li.now { color: #0f172a; font-weight: 600; }
            #busyOverlay li.now i { color: var(--brand, #15803d); }
            #busyOverlay li.done { color: #334155; }
            #busyOverlay li.done i { color: var(--brand, #15803d); }
            #busyOverlay .busy-slow { margin: .9rem 0 0; font-size: .8rem; color: #b45309; }
            @keyframes busySpin { to { transform: rotate(360deg); } }
        </style>
        <div class="busy-card">
            <div class="busy-spin" aria-hidden="true"></div>
            <h3 id="busyTitle"></h3>
            <p class="busy-detail" id="busyDetail"></p>
            <ol id="busySteps"></ol>
            <p class="busy-slow" id="busySlow" hidden><i class="fa-solid fa-clock"></i> ใช้เวลานานกว่าปกติ ระบบยังทำงานอยู่ กรุณาอย่าปิดหน้านี้</p>
        </div>`;
    document.body.appendChild(el);
    return el;
}

function showBusy(title, steps = []) {
    const el = busyOverlay();
    busySteps = steps;
    el.querySelector('#busyTitle').textContent = title;
    el.classList.add('on');
    busyStep(0);
}

function busyStep(i) {
    const el = document.getElementById('busyOverlay');
    if (!el || !el.classList.contains('on')) return;
    const multi = busySteps.length > 1;
    el.querySelector('#busyDetail').textContent = multi ? `ขั้นตอนที่ ${i + 1} จาก ${busySteps.length}` : (busySteps[0] || '');
    el.querySelector('#busySteps').innerHTML = multi ? busySteps.map((s, k) => {
        const state = k < i ? 'done' : k === i ? 'now' : '';
        const icon = k < i ? 'fa-solid fa-circle-check' : k === i ? 'fa-solid fa-spinner fa-spin' : 'fa-regular fa-circle';
        return `<li class="${state}"><i class="${icon}"></i><span>${escapeHtml(s)}</span></li>`;
    }).join('') : '';
    // ถ้าขั้นตอนนี้ค้างเกิน 8 วินาที แจ้งว่ายังทำงานอยู่
    const slow = el.querySelector('#busySlow');
    slow.hidden = true;
    clearTimeout(busySlowTimer);
    busySlowTimer = setTimeout(() => { slow.hidden = false; }, 8000);
}

function hideBusy() {
    clearTimeout(busySlowTimer);
    document.getElementById('busyOverlay')?.classList.remove('on');
}

const isBusy = () => !!document.getElementById('busyOverlay')?.classList.contains('on');
