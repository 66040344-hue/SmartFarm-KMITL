// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_CUkSiqoX2szxgZuLTqdsfR20LETYOF4",
  authDomain: "smartfarm-kmitl.firebaseapp.com",
  databaseURL: "https://smartfarm-kmitl-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartfarm-kmitl",
  storageBucket: "smartfarm-kmitl.firebasestorage.app",
  messagingSenderId: "819207526985",
  appId: "1:819207526985:web:0aca2227ba7ab28241fd98",
  measurementId: "G-R2EMB9PXNS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
    // Theme Engine (Light Mode Default)
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const themeIconSun = document.getElementById("theme-icon-sun");
    const themeIconMoon = document.getElementById("theme-icon-moon");

    let currentTheme = localStorage.getItem("kale_theme") || "light";
    applyTheme(currentTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            currentTheme = currentTheme === "light" ? "dark" : "light";
            localStorage.setItem("kale_theme", currentTheme);
            applyTheme(currentTheme);
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        if (theme === "dark") {
            if (themeIconSun) themeIconSun.style.display = "none";
            if (themeIconMoon) themeIconMoon.style.display = "block";
        } else {
            if (themeIconSun) themeIconSun.style.display = "block";
            if (themeIconMoon) themeIconMoon.style.display = "none";
        }
    }

    // Admin Elements
    const adminInputMoisture = document.getElementById("admin-input-moisture");
    const adminInputTemp = document.getElementById("admin-input-temp");
    const adminInputGeneral = document.getElementById("admin-input-general");
    const saveAdminRecBtn = document.getElementById("save-admin-rec-btn");
    const adminLockOverlay = document.getElementById("admin-lock-overlay");

    // Login Modal Elements
    const loginModal = document.getElementById("login-modal");
    const btnShowLogin = document.getElementById("btn-show-login");
    const btnLogout = document.getElementById("btn-logout");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const btnLoginSubmit = document.getElementById("btn-login-submit");
    const btnLoginCancel = document.getElementById("btn-login-cancel");
    const errorText = document.getElementById("login-error");

    let isAuthenticated = false;

    // --- Authentication Flow ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            isAuthenticated = true;
            loginModal.style.display = 'none';
            btnShowLogin.style.display = 'none';
            btnLogout.style.display = 'flex';
            
            if (adminLockOverlay) {
                adminLockOverlay.style.opacity = '0';
                setTimeout(() => adminLockOverlay.style.display = 'none', 300);
            }

            if (adminInputMoisture) adminInputMoisture.disabled = false;
            if (adminInputTemp) adminInputTemp.disabled = false;
            if (adminInputGeneral) adminInputGeneral.disabled = false;
            if (saveAdminRecBtn) saveAdminRecBtn.disabled = false;
        } else {
            isAuthenticated = false;
            btnShowLogin.style.display = 'flex';
            btnLogout.style.display = 'none';
            
            if (adminLockOverlay) {
                adminLockOverlay.style.display = 'flex';
                setTimeout(() => adminLockOverlay.style.opacity = '1', 10);
            }

            if (adminInputMoisture) adminInputMoisture.disabled = true;
            if (adminInputTemp) adminInputTemp.disabled = true;
            if (adminInputGeneral) adminInputGeneral.disabled = true;
            if (saveAdminRecBtn) saveAdminRecBtn.disabled = true;
        }
    });

    btnShowLogin.addEventListener("click", () => {
        loginModal.style.display = 'flex';
        errorText.innerText = "";
    });
    btnLoginCancel.addEventListener("click", () => loginModal.style.display = 'none');
    
    btnLoginSubmit.addEventListener("click", () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        btnLoginSubmit.innerText = "Processing...";
        errorText.innerText = "";
        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                btnLoginSubmit.innerText = "Login";
                emailInput.value = "";
                passwordInput.value = "";
            })
            .catch((error) => {
                btnLoginSubmit.innerText = "Login";
                errorText.innerText = "รหัสผ่านไม่ถูกต้อง";
            });
    });

    btnLogout.addEventListener("click", () => signOut(auth));

    // --- Read Realtime Recommendations ---
    const recRef = ref(db, 'recommendations');
    onValue(recRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            if (data.moisture && adminInputMoisture && document.activeElement !== adminInputMoisture) {
                adminInputMoisture.value = data.moisture;
            }
            if (data.temp && adminInputTemp && document.activeElement !== adminInputTemp) {
                adminInputTemp.value = data.temp;
            }
            if (data.general && adminInputGeneral && document.activeElement !== adminInputGeneral) {
                adminInputGeneral.value = data.general;
            }
        }
    });

    // --- Save Admin Recommendations ---
    if (saveAdminRecBtn) {
        saveAdminRecBtn.addEventListener("click", () => {
            if (!isAuthenticated) return;

            const moistureText = adminInputMoisture.value.trim();
            const tempText = adminInputTemp.value.trim();
            const generalText = adminInputGeneral.value.trim();

            if (!moistureText || !tempText || !generalText) {
                alert("กรุณากรอกข้อมูลให้ครบทุกช่องครับ");
                return;
            }

            saveAdminRecBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>กำลังบันทึก...</span>
            `;

            const updates = {};
            updates['recommendations/moisture'] = moistureText;
            updates['recommendations/temp'] = tempText;
            updates['recommendations/general'] = generalText;

            update(ref(db), updates).then(() => {
                setTimeout(() => {
                    saveAdminRecBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>บันทึกคำแนะนำสำเร็จ!</span>
                    `;
                    setTimeout(() => {
                        saveAdminRecBtn.innerHTML = `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            <span>บันทึกคำแนะนำ</span>
                        `;
                    }, 1500);
                }, 300);
            }).catch(err => {
                console.error("Failed to save recommendations", err);
                saveAdminRecBtn.innerHTML = "<span>เกิดข้อผิดพลาด!</span>";
                setTimeout(() => {
                    saveAdminRecBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                            <polyline points="17 21 17 13 7 13 7 21"/>
                            <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        <span>บันทึกคำแนะนำ</span>
                    `;
                }, 2000);
            });
        });
    }
});
