// seminar-topic-app.js - Firebase & LocalStorage Seminar Work Management Script
import { firebaseConfig, isFirebaseConfigured } from './seminar-firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    arrayUnion,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Initial Initial Seed Data from image + additional mock data
const INITIAL_STUDENTS = [
];

// App State
let db = null;
let auth = null;
let useFirebase = false;
let currentStudent = null;
let allStudents = [];
let isAdmin = false;
let currentUser = null;
let systemConfig = {
    isSubmissionOpen: true,
    submissionDeadline: "",
    closedMessage: "ระบบปิดรับการอัปเดตและยืนยันหัวข้อสัมมนาแล้ว"
};

// DOM Elements
const dbStatusChip = document.getElementById('dbStatusChip');
const dbStatusText = document.getElementById('dbStatusText');
const searchInput = document.getElementById('searchInput');
const resultCard = document.getElementById('resultCard');
const editFormCard = document.getElementById('editFormCard');
const mainActions = document.getElementById('mainActions');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    initFirebaseOrLocalStorage();
    setupEventListeners();
    await loadSystemConfig();
    await loadAllStudents();
    renderOverviewTable();
    updateAdminUI(null);
});

// Setup Firebase connection or LocalStorage fallback
function initFirebaseOrLocalStorage() {
    // Check saved config in LocalStorage if any
    const savedConfigStr = localStorage.getItem('user_firebase_config');
    let configToUse = firebaseConfig;
    if (savedConfigStr) {
        try {
            configToUse = JSON.parse(savedConfigStr);
        } catch (e) { }
    }

    if (configToUse && configToUse.projectId && configToUse.projectId.trim() !== "") {
        try {
            const app = initializeApp(configToUse);
            db = getFirestore(app);
            auth = getAuth(app);
            useFirebase = true;

            // Listen to Firebase Auth
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    currentUser = user;
                    isAdmin = true;
                    updateAdminUI(user);
                } else {
                    currentUser = null;
                    isAdmin = false;
                    updateAdminUI(null);
                }
            });

            dbStatusChip.className = "status-chip firebase";
            dbStatusText.innerText = `เชื่อมต่อ Firebase Cloud (${configToUse.projectId})`;
            console.log("Connected to Firebase Firestore & Auth");
            return;
        } catch (err) {
            console.warn("Firebase init failed, switching to LocalStorage mode:", err);
        }
    }

    // Fallback to LocalStorage
    useFirebase = false;
    dbStatusChip.className = "status-chip local";
    dbStatusText.innerText = "โหมดทดสอบ (LocalStorage)";

    // Seed LocalStorage if empty
    if (!localStorage.getItem('seminar_students')) {
        localStorage.setItem('seminar_students', JSON.stringify(INITIAL_STUDENTS));
    }
}

// Check if system is closed based on open toggle & deadline datetime
function checkIsSubmissionClosed() {
    if (!systemConfig.isSubmissionOpen) return true;
    if (systemConfig.submissionDeadline && systemConfig.submissionDeadline.trim() !== "") {
        const deadlineDate = new Date(systemConfig.submissionDeadline);
        if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
            return true;
        }
    }
    return false;
}

// Load System Config from Firestore or LocalStorage
async function loadSystemConfig() {
    if (useFirebase && db) {
        try {
            const configRef = doc(db, "settings", "system_config");
            const docSnap = await getDoc(configRef);
            if (docSnap.exists()) {
                systemConfig = { ...systemConfig, ...docSnap.data() };
            }
            // Listen real-time to deadline changes
            onSnapshot(configRef, (snapshot) => {
                if (snapshot.exists()) {
                    systemConfig = { ...systemConfig, ...snapshot.data() };
                    updateSystemDeadlineUI();
                }
            });
        } catch (e) {
            console.error("Error loading system config from Firestore:", e);
        }
    } else {
        const localCfg = localStorage.getItem('seminar_system_config');
        if (localCfg) {
            try {
                systemConfig = { ...systemConfig, ...JSON.parse(localCfg) };
            } catch (e) { }
        }
    }
    updateSystemDeadlineUI();
}

// Update Deadline UI Elements across Student Card & Top Banner
function updateSystemDeadlineUI() {
    const bannerEl = document.getElementById('systemDeadlineNotice');
    const bannerText = document.getElementById('deadlineBannerText');
    const bannerCountdown = document.getElementById('deadlineCountdown');
    const closureAlert = document.getElementById('closureAlert');
    const closureAlertDetail = document.getElementById('closureAlertDetail');
    const mainActions = document.getElementById('mainActions');

    const isClosed = checkIsSubmissionClosed();

    if (bannerEl) {
        if (isClosed) {
            bannerEl.style.display = 'flex';
            bannerEl.className = 'deadline-banner closed';
            bannerText.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <strong>ระบบปิดรับคำตอบแล้ว</strong> (${systemConfig.closedMessage || 'หมดเวลาทำการอัปเดต'})`;
            bannerCountdown.innerText = 'ปิดการรับข้อมูลแล้ว';
        } else if (systemConfig.submissionDeadline && systemConfig.submissionDeadline.trim() !== "") {
            const d = new Date(systemConfig.submissionDeadline);
            if (!isNaN(d.getTime())) {
                bannerEl.style.display = 'flex';
                bannerEl.className = 'deadline-banner open';
                const formattedDate = d.toLocaleString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
                bannerText.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ระบบเปิดรับคำตอบถึง: <strong>${formattedDate} น.</strong>`;
                bannerCountdown.innerText = `หมดเขต ${formattedDate}`;
            } else {
                bannerEl.style.display = 'none';
            }
        } else {
            bannerEl.style.display = 'none';
        }
    }

    if (closureAlert && mainActions) {
        if (isClosed) {
            closureAlert.style.display = 'flex';
            if (closureAlertDetail) {
                closureAlertDetail.innerText = systemConfig.closedMessage || "หมดระยะเวลาในการแก้ไขหัวข้อสัมมนาตามที่ผู้ดูแลระบบกำหนด";
            }
            mainActions.style.display = 'none';
            hideEditForm();
        } else {
            closureAlert.style.display = 'none';
            if (resultCard && resultCard.classList.contains('show') && (!editFormCard || !editFormCard.classList.contains('show'))) {
                mainActions.style.display = 'flex';
            }
        }
    }
}

// Global functions for inline HTML calls
window.switchView = function (viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    if (viewName === 'student') {
        document.getElementById('studentView').classList.add('active');
        document.getElementById('tabStudentBtn').classList.add('active');
    } else {
        document.getElementById('overviewView').classList.add('active');
        document.getElementById('tabOverviewBtn').classList.add('active');
        renderOverviewTable();
    }
};

window.quickSearch = function (sid) {
    searchInput.value = sid;
    handleSearch(new Event('submit'));
};

window.handleSearch = async function (event) {
    if (event) event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    const student = await findStudent(query);
    if (student) {
        currentStudent = student;
        renderStudentResult(student);
    } else {
        alert(`ไม่พบข้อมูลนักศึกษารหัส ${query} ในระบบ`);
        resultCard.classList.remove('show');
    }
};

// Find Student Logic (Firebase Firestore / LocalStorage)
async function findStudent(studentId) {
    if (useFirebase && db) {
        try {
            const docRef = doc(db, "students", studentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data();
            }
        } catch (e) {
            console.error("Firestore get error:", e);
        }
    }

    // LocalStorage fallback
    const localData = JSON.parse(localStorage.getItem('seminar_students') || "[]");
    return localData.find(s => s.studentId === studentId);
}

// Load All Students
async function loadAllStudents() {
    if (useFirebase && db) {
        try {
            const querySnapshot = await getDocs(collection(db, "students"));
            allStudents = [];
            querySnapshot.forEach((doc) => {
                allStudents.push(doc.data());
            });
            if (allStudents.length === 0) {
                // Seed initial data to Firebase if empty
                for (const s of INITIAL_STUDENTS) {
                    await setDoc(doc(db, "students", s.studentId), s);
                }
                allStudents = [...INITIAL_STUDENTS];
            }
            return;
        } catch (e) {
            console.error("Firestore getDocs error:", e);
        }
    }

    // LocalStorage fallback
    allStudents = JSON.parse(localStorage.getItem('seminar_students') || JSON.stringify(INITIAL_STUDENTS));
}

// Render Result Card (Requirement 2)
function renderStudentResult(student) {
    document.getElementById('resStudentName').innerHTML = `<i class="fa-solid fa-user"></i> ${student.name}`;
    document.getElementById('resStudentID').innerText = student.studentId;
    document.getElementById('resTopic').innerText = student.topic || "(ยังไม่ได้ระบุหัวข้อ)";
    document.getElementById('resAdvisor').innerText = student.advisor || "(ยังไม่ได้ระบุอาจารย์ที่ปรึกษา)";

    // Render Status Badge
    const badgeEl = document.getElementById('resStatusBadge');
    if (student.status === 'confirmed') {
        badgeEl.className = "status-badge confirmed";
        badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ยืนยันข้อมูลเดิมแล้ว`;
    } else if (student.status === 'updated') {
        badgeEl.className = "status-badge updated";
        badgeEl.innerHTML = `<i class="fa-solid fa-pen-clip"></i> อัปเดตหัวข้อแล้ว`;
    } else {
        badgeEl.className = "status-badge pending";
        badgeEl.innerHTML = `<i class="fa-solid fa-clock"></i> รอการยืนยัน/อัปเดต`;
    }

    // Render Timeline History
    const timelineEl = document.getElementById('timelineList');
    timelineEl.innerHTML = '';
    if (student.history && student.history.length > 0) {
        student.history.slice().reverse().forEach(h => {
            const dt = new Date(h.timestamp).toLocaleString('th-TH');
            const item = document.createElement('div');
            item.className = 'timeline-item';
            item.innerHTML = `
                <div class="timeline-date"><i class="fa-regular fa-clock"></i> ${dt}</div>
                <div>${h.action}</div>
            `;
            timelineEl.appendChild(item);
        });
    } else {
        timelineEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">ไม่มีประวัติการอัปเดต</div>';
    }

    hideEditForm();
    updateSystemDeadlineUI();
    resultCard.classList.add('show');
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Requirement 3: Confirm Current Data without Changes
window.confirmCurrentData = async function () {
    if (!currentStudent) return;

    if (checkIsSubmissionClosed()) {
        alert(systemConfig.closedMessage || 'ระบบปิดรับคำตอบและการแก้ไขหัวข้อสัมมนาแล้ว');
        return;
    }

    const timestamp = new Date().toISOString();
    const updatePayload = {
        status: 'confirmed',
        updatedAt: timestamp,
        history: [...(currentStudent.history || []), {
            timestamp: timestamp,
            action: 'นักศึกษายืนยันข้อมูลหัวข้อเดิมและอาจารย์ที่ปรึกษาถูกต้อง'
        }]
    };

    await saveStudentUpdate(currentStudent.studentId, updatePayload);
    alert('บันทึกการยืนยันข้อมูลเดิมเรียบร้อยแล้ว');
    handleSearch();
};

// Dynamic Advisor Dropdown Handler
window.populateAdvisorDropdown = function () {
    const selectEl = document.getElementById('editAdvisorSelect');
    if (!selectEl) return;

    // Collect all unique advisor names from allStudents and initial list
    const defaultAdvisors = [
        "ดร.ศิรเมศร์ วีระสกุลวัฒน์",
        "รศ.น.สพ.ดร.จำลอง มิตรชาวไทย"
    ];
    const advisorSet = new Set(defaultAdvisors);
    if (allStudents && allStudents.length > 0) {
        allStudents.forEach(s => {
            if (s.advisor && s.advisor.trim() !== '') {
                advisorSet.add(s.advisor.trim());
            }
        });
    }

    const advisorsList = Array.from(advisorSet).sort();

    selectEl.innerHTML = '<option value="">-- เลือกอาจารย์ที่ปรึกษา --</option>';
    advisorsList.forEach(adv => {
        const opt = document.createElement('option');
        opt.value = adv;
        opt.textContent = adv;
        selectEl.appendChild(opt);
    });

    const newOpt = document.createElement('option');
    newOpt.value = '__NEW__';
    newOpt.textContent = '+ พิมพ์ระบุชื่ออาจารย์ท่านใหม่...';
    selectEl.appendChild(newOpt);
};

window.handleAdvisorSelectChange = function (selectEl) {
    const customInput = document.getElementById('editAdvisorCustom');
    if (selectEl.value === '__NEW__') {
        customInput.style.display = 'block';
        customInput.required = true;
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
};

// Requirement 4: Show Edit Form
window.showEditForm = function () {
    if (!currentStudent) return;

    if (checkIsSubmissionClosed()) {
        alert(systemConfig.closedMessage || 'ระบบปิดรับคำตอบและการแก้ไขหัวข้อสัมมนาแล้ว');
        return;
    }

    document.getElementById('editTopic').value = currentStudent.topic || '';

    // Populate advisor dropdown dynamically
    populateAdvisorDropdown();

    const selectEl = document.getElementById('editAdvisorSelect');
    const customInput = document.getElementById('editAdvisorCustom');
    const currentAdv = (currentStudent.advisor || '').trim();

    // Check if current advisor exists in select options
    let found = false;
    for (let i = 0; i < selectEl.options.length; i++) {
        if (selectEl.options[i].value === currentAdv) {
            selectEl.selectedIndex = i;
            found = true;
            break;
        }
    }

    if (!found && currentAdv) {
        selectEl.value = '__NEW__';
        customInput.style.display = 'block';
        customInput.value = currentAdv;
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
        customInput.required = false;
    }

    editFormCard.classList.add('show');
    mainActions.style.display = 'none';
};

window.hideEditForm = function () {
    editFormCard.classList.remove('show');
    mainActions.style.display = 'flex';
};

// Save Topic & Advisor Update
window.handleSaveUpdate = async function (event) {
    if (event) event.preventDefault();
    if (!currentStudent) return;

    if (checkIsSubmissionClosed()) {
        alert(systemConfig.closedMessage || 'ระบบปิดรับคำตอบและการแก้ไขหัวข้อสัมมนาแล้ว');
        return;
    }

    const newTopic = document.getElementById('editTopic').value.trim();
    const selectVal = document.getElementById('editAdvisorSelect').value;
    const customVal = document.getElementById('editAdvisorCustom').value.trim();

    let newAdvisor = selectVal;
    if (selectVal === '__NEW__') {
        newAdvisor = customVal;
    }

    if (!newTopic || !newAdvisor) {
        alert('กรุณากรอกทั้งชื่อหัวข้อสัมมนาและเลือก/ระบุอาจารย์ที่ปรึกษา');
        return;
    }

    const timestamp = new Date().toISOString();
    const updatePayload = {
        topic: newTopic,
        advisor: newAdvisor,
        status: 'updated',
        updatedAt: timestamp,
        history: [...(currentStudent.history || []), {
            timestamp: timestamp,
            action: `อัปเดตหัวข้อเป็น: "${newTopic}" (อาจารย์ที่ปรึกษา: ${newAdvisor})`
        }]
    };

    await saveStudentUpdate(currentStudent.studentId, updatePayload);
    alert('บันทึกการปรับเปลี่ยนหัวข้อและอาจารย์ที่ปรึกษาเรียบร้อยแล้ว');
    handleSearch();
};

// Save Student Update to Firebase or LocalStorage
async function saveStudentUpdate(studentId, payload) {
    if (useFirebase && db) {
        try {
            const docRef = doc(db, "students", studentId);
            await setDoc(docRef, payload, { merge: true });
            console.log("Updated/Saved in Firestore:", studentId);
        } catch (e) {
            console.error("Firestore save error:", e);
        }
    }

    // Also update LocalStorage
    let localData = JSON.parse(localStorage.getItem('seminar_students') || "[]");
    const idx = localData.findIndex(s => s.studentId === studentId);
    if (idx !== -1) {
        localData[idx] = { ...localData[idx], ...payload };
        localStorage.setItem('seminar_students', JSON.stringify(localData));
    }
}

// Render Overview Table
async function renderOverviewTable() {
    await loadAllStudents();
    const tbody = document.getElementById('overviewTableBody');
    tbody.innerHTML = '';

    let confirmedCount = 0;
    let updatedCount = 0;

    allStudents.forEach((student, index) => {
        if (student.status === 'confirmed') confirmedCount++;
        if (student.status === 'updated') updatedCount++;

        const tr = document.createElement('tr');

        let statusTag = `<span class="status-badge pending" style="padding: 2px 8px; font-size: 0.75rem;">รอการอัปเดต</span>`;
        if (student.status === 'confirmed') {
            statusTag = `<span class="status-badge confirmed" style="padding: 2px 8px; font-size: 0.75rem;">ยืนยันแล้ว</span>`;
        } else if (student.status === 'updated') {
            statusTag = `<span class="status-badge updated" style="padding: 2px 8px; font-size: 0.75rem;">อัปเดตแล้ว</span>`;
        }

        const formattedDate = student.updatedAt ? new Date(student.updatedAt).toLocaleDateString('th-TH') : '-';

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong style="font-family: 'Space Grotesk', sans-serif; color: var(--orange-primary);">${student.studentId}</strong></td>
            <td><strong style="color: var(--text-black-bold);">${student.name}</strong></td>
            <td style="max-width: 320px; line-height: 1.4; font-weight: 500;">${student.topic}</td>
            <td>${student.advisor}</td>
            <td>${statusTag}</td>
            <td>${formattedDate}</td>
            <td>
                <button class="tag-btn" onclick="quickSearch('${student.studentId}'); switchView('student');">
                    <i class="fa-solid fa-arrow-right"></i> ดู/อัปเดต
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('statTotal').innerText = allStudents.length;
    document.getElementById('statConfirmed').innerText = confirmedCount;
    document.getElementById('statUpdated').innerText = updatedCount;
}

// Admin UI Visibility Control
function updateAdminUI(user) {
    const loginBtn = document.getElementById('adminLoginBtn');
    const userChip = document.getElementById('adminUserChip');
    const emailText = document.getElementById('adminEmailText');
    const configBtn = document.getElementById('adminConfigBtn');
    const statusBar = document.getElementById('dbStatusBar');
    const importBtn = document.getElementById('btnImportCSV');
    const addBtn = document.getElementById('btnAddStudent');
    const deadlineConfigBtn = document.getElementById('btnDeadlineConfig');

    if (isAdmin) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userChip) userChip.style.display = 'inline-flex';
        if (emailText) emailText.innerText = user && user.email ? user.email : 'ผู้ดูแลระบบ';
        if (statusBar) statusBar.style.display = 'block';
        if (configBtn) configBtn.style.display = 'inline-block';
        if (importBtn) importBtn.style.display = 'inline-flex';
        if (addBtn) addBtn.style.display = 'inline-flex';
        if (deadlineConfigBtn) deadlineConfigBtn.style.display = 'inline-flex';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (userChip) userChip.style.display = 'none';
        if (statusBar) statusBar.style.display = 'none';
        if (configBtn) configBtn.style.display = 'none';
        if (importBtn) importBtn.style.display = 'none';
        if (addBtn) addBtn.style.display = 'none';
        if (deadlineConfigBtn) deadlineConfigBtn.style.display = 'none';
    }
}

// Admin Auth Modal Handlers
window.openAdminLoginModal = function () {
    const errEl = document.getElementById('adminLoginError');
    if (errEl) errEl.style.display = 'none';
    document.getElementById('adminLoginModal').classList.add('active');
};

window.closeAdminLoginModal = function () {
    document.getElementById('adminLoginModal').classList.remove('active');
};

window.handleAdminLoginSubmit = async function (event) {
    if (event) event.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const errorEl = document.getElementById('adminLoginError');

    if (errorEl) errorEl.style.display = 'none';

    if (useFirebase && auth) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            closeAdminLoginModal();
            alert('เข้าสู่ระบบผู้ดูแลระบบเรียบร้อยแล้ว');
        } catch (err) {
            console.error("Firebase Auth Error:", err);
            if (errorEl) {
                errorEl.innerText = "เข้าสู่ระบบไม่สำเร็จ: อีเมลหรือรหัสผ่านไม่ถูกต้อง";
                errorEl.style.display = 'block';
            }
        }
    } else {
        // Fallback for LocalStorage Demo Mode
        if (email && password) {
            isAdmin = true;
            currentUser = { email: email };
            updateAdminUI(currentUser);
            closeAdminLoginModal();
            alert('เข้าสู่ระบบผู้ดูแลเรียบร้อยแล้ว');
        }
    }
};

window.handleAdminLogout = async function () {
    if (useFirebase && auth) {
        try {
            await signOut(auth);
        } catch (e) { }
    }
    isAdmin = false;
    currentUser = null;
    updateAdminUI(null);
    alert('ออกจากระบบผู้ดูแลเรียบร้อยแล้ว');
};

// Export CSV for Excel (UTF-8 BOM support - Publicly accessible)
window.exportCSV = function () {
    let csvContent = "\uFEFFลำดับ,รหัสนักศึกษา,ชื่อ-นามสกุล,หัวข้อสัมมนา,อาจารย์ที่ปรึกษา,สถานะ,วันที่อัปเดตล่าสุด\n";
    allStudents.forEach((s, idx) => {
        const topicClean = `"${(s.topic || '').replace(/"/g, '""')}"`;
        const nameClean = `"${(s.name || '').replace(/"/g, '""')}"`;
        const advisorClean = `"${(s.advisor || '').replace(/"/g, '""')}"`;
        const statusClean = s.status === 'confirmed' ? 'ยืนยันแล้ว' : (s.status === 'updated' ? 'อัปเดตแล้ว' : 'รอการอัปเดต');
        const dt = s.updatedAt ? new Date(s.updatedAt).toLocaleString('th-TH') : '-';

        csvContent += `${idx + 1},${s.studentId},${nameClean},${topicClean},${advisorClean},${statusClean},"${dt}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `seminar_topic_updates_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Modal handlers for Firebase settings (Admin Only)
window.openConfigModal = function () {
    if (!isAdmin) {
        alert("สงวนสิทธิ์เฉพาะผู้ดูแลระบบเท่านั้น กรุณาล็อกอินผู้ดูแลก่อน");
        openAdminLoginModal();
        return;
    }
    document.getElementById('configModal').classList.add('active');
};

window.closeConfigModal = function () {
    document.getElementById('configModal').classList.remove('active');
};

window.openImportModal = function () {
    if (!isAdmin) {
        alert("สงวนสิทธิ์เฉพาะผู้ดูแลระบบเท่านั้น กรุณาล็อกอินผู้ดูแลก่อน");
        openAdminLoginModal();
        return;
    }
    document.getElementById('importModal').classList.add('active');
};

window.closeImportModal = function () {
    document.getElementById('importModal').classList.remove('active');
};

// Handle CSV / Text Import (Admin Only)
window.handleProcessImport = async function () {
    if (!isAdmin) {
        alert("สงวนสิทธิ์เฉพาะผู้ดูแลระบบเท่านั้น");
        return;
    }

    const fileInput = document.getElementById('csvFileInput');
    const textInput = document.getElementById('csvTextInput').value.trim();

    let rawText = "";

    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        rawText = await file.text();
    } else if (textInput) {
        rawText = textInput;
    } else {
        alert("กรุณาเลือกไฟล์ CSV หรือวางข้อความข้อมูลนักศึกษา");
        return;
    }

    const lines = rawText.split(/\r?\n/).filter(line => line.trim() !== "");
    let successCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip header if present
        if (line.includes("รหัสนักศึกษา") && line.includes("ชื่อ-นามสกุล")) continue;

        // Split by comma or tab
        const parts = line.split(/,|\t/).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2) {
            let studentId = parts[0];
            let name = parts[1];
            let topic = parts[2] || "";
            let advisor = parts[3] || "";

            if (/^\d{1,3}$/.test(parts[0]) && /^\d{8,10}$/.test(parts[1])) {
                studentId = parts[1];
                name = parts[2] || "";
                topic = parts[3] || "";
                advisor = parts[4] || "";
            }

            if (studentId && name) {
                const studentObj = {
                    id: studentId,
                    studentId: studentId,
                    name: name,
                    topic: topic,
                    advisor: advisor,
                    status: 'pending',
                    updatedAt: new Date().toISOString(),
                    history: [{ timestamp: new Date().toISOString(), action: "นำเข้าข้อมูลเข้าสู่ระบบ" }]
                };
                await saveStudentUpdate(studentId, studentObj);
                successCount++;
            }
        }
    }

    alert(`นำเข้าข้อมูลสำเร็จทั้งหมด ${successCount} รายการ เข้าสู่ ${useFirebase ? 'Firebase Firestore' : 'ระบบ'}`);
    closeImportModal();
    renderOverviewTable();
};

window.saveFirebaseSettings = function () {
    if (!isAdmin) return;

    const projectId = document.getElementById('cfgProjectId').value.trim();
    const apiKey = document.getElementById('cfgApiKey').value.trim();

    if (!projectId) {
        alert('กรุณาระบุ Project ID');
        return;
    }

    const configObj = {
        apiKey: apiKey,
        authDomain: `${projectId}.firebaseapp.com`,
        projectId: projectId,
        storageBucket: `${projectId}.appspot.com`,
        messagingSenderId: "",
        appId: ""
    };

    localStorage.setItem('user_firebase_config', JSON.stringify(configObj));
    alert('บันทึกการตั้งค่าแล้ว ระบบจะรีโหลดหน้าเพื่อเชื่อมต่อ Firebase');
    window.location.reload();
};

window.openAddStudentModal = function () {
    if (!isAdmin) {
        alert("สงวนสิทธิ์เฉพาะผู้ดูแลระบบเท่านั้น กรุณาล็อกอินผู้ดูแลก่อน");
        openAdminLoginModal();
        return;
    }

    const sid = prompt("กรอกรหัสนักศึกษาใหม่:");
    if (!sid) return;
    const name = prompt("กรอกชื่อ-นามสกุล:");
    if (!name) return;
    const topic = prompt("กรอกหัวข้อสัมมนา:");
    if (!topic) return;
    const advisor = prompt("กรอกชื่ออาจารย์ที่ปรึกษา:");
    if (!advisor) return;

    const newStudent = {
        id: sid,
        studentId: sid,
        name: name,
        topic: topic,
        advisor: advisor,
        status: 'pending',
        updatedAt: new Date().toISOString(),
        history: [{ timestamp: new Date().toISOString(), action: "เพิ่มนักศึกษาใหม่ในระบบ" }]
    };

    saveStudentUpdate(sid, newStudent).then(() => {
        alert('เพิ่มนักศึกษาเรียบร้อยแล้ว');
        renderOverviewTable();
    });
};

function setupEventListeners() {
    // extra event listeners if needed
}

// Deadline & Submission Settings Handlers (Admin Only)
window.openDeadlineModal = function () {
    if (!isAdmin) {
        alert("สงวนสิทธิ์เฉพาะผู้ดูแลระบบเท่านั้น กรุณาล็อกอินผู้ดูแลก่อน");
        openAdminLoginModal();
        return;
    }
    const openToggle = document.getElementById('cfgSubmissionOpen');
    const deadlineInput = document.getElementById('cfgSubmissionDeadline');
    const msgInput = document.getElementById('cfgClosedMessage');

    if (openToggle) openToggle.checked = systemConfig.isSubmissionOpen !== false;
    updateToggleLabel(openToggle);
    if (deadlineInput) deadlineInput.value = systemConfig.submissionDeadline || '';
    if (msgInput) msgInput.value = systemConfig.closedMessage || '';

    document.getElementById('deadlineModal').classList.add('active');
};

window.closeDeadlineModal = function () {
    document.getElementById('deadlineModal').classList.remove('active');
};

window.updateToggleLabel = function (checkbox) {
    const label = document.getElementById('toggleStatusLabel');
    if (label) {
        if (checkbox.checked) {
            label.innerText = 'กำลังเปิดรับคำตอบ (ผู้ใช้งานสามารถยืนยัน/แก้ไขได้)';
            label.style.color = 'var(--green-primary)';
        } else {
            label.innerText = 'ปิดรับคำตอบทันที (ผู้ใช้งานไม่สามารถยืนยัน/แก้ไขได้)';
            label.style.color = '#dc2626';
        }
    }
};

window.handleSaveDeadlineSettings = async function (event) {
    if (event) event.preventDefault();
    if (!isAdmin) return;

    const isSubmissionOpen = document.getElementById('cfgSubmissionOpen').checked;
    const submissionDeadline = document.getElementById('cfgSubmissionDeadline').value;
    const closedMessage = document.getElementById('cfgClosedMessage').value.trim() || 'ระบบปิดรับการอัปเดตและยืนยันหัวข้อสัมมนาแล้ว';

    systemConfig = {
        isSubmissionOpen,
        submissionDeadline,
        closedMessage
    };

    if (useFirebase && db) {
        try {
            await setDoc(doc(db, "settings", "system_config"), systemConfig, { merge: true });
        } catch (e) {
            console.error("Error saving system_config to Firestore:", e);
        }
    }

    localStorage.setItem('seminar_system_config', JSON.stringify(systemConfig));
    updateSystemDeadlineUI();
    closeDeadlineModal();
    alert('บันทึกการตั้งค่ากำหนดเวลาปิดรับคำตอบเรียบร้อยแล้ว');
};

