// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Your web app's Firebase configuration
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

    // Sensor Elements
    const moistureVal = document.getElementById("moisture-val");
    const moistureBar = document.getElementById("moisture-bar");
    const moistureStatusText = document.getElementById("moisture-status-text");
    const moistureStatusDot = document.getElementById("moisture-status-dot");

    const tempVal = document.getElementById("temp-val");
    const tempErrDot = document.getElementById("temp-err-dot");
    const tempStatusText = document.getElementById("temp-status-text");

    const humidVal = document.getElementById("humid-val");
    const humidErrDot = document.getElementById("humid-err-dot");
    const humidStatusText = document.getElementById("humid-status-text");
    
    // Control Elements
    const btnModeManual = document.getElementById("btn-mode-manual");
    const btnModeAuto = document.getElementById("btn-mode-auto");
    const waterBtn = document.getElementById("water-btn");
    const pumpStatusDot = document.getElementById("pump-status-dot");
    const pumpStatusText = document.getElementById("pump-status-text");
    
    const thresholdMinInput = document.getElementById("threshold-min");
    const thresholdMaxInput = document.getElementById("threshold-max");
    const saveThresholdBtn = document.getElementById("save-threshold-btn");

    const statusDot = document.getElementById("connection-status");
    const statusText = document.getElementById("connection-text");
    
    const heroTemp = document.getElementById("hero-temp");

    // Login/Auth UI
    const loginModal = document.getElementById("login-modal");
    const btnShowLogin = document.getElementById("btn-show-login");
    const btnLogout = document.getElementById("btn-logout");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const btnLoginSubmit = document.getElementById("btn-login-submit");
    const btnLoginCancel = document.getElementById("btn-login-cancel");
    const errorText = document.getElementById("login-error");
    
    const controlLockOverlay = document.getElementById("control-lock-overlay");

    // State
    let isAutoMode = true;
    let isWatering = false;
    let thresholdMin = 30;
    let thresholdMax = 60;
    let lastHeartbeatTime = Date.now();
    let isDeviceOffline = false;
    let isAuthenticated = false;

    // --- Start Public Listeners Immediately ---
    startDatabaseListeners();

    // --- Authentication Flow ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            isAuthenticated = true;
            loginModal.style.display = 'none';
            btnShowLogin.style.display = 'none';
            btnLogout.style.display = 'flex';
            
            controlLockOverlay.style.opacity = '0';
            setTimeout(() => controlLockOverlay.style.display = 'none', 300);
            
            btnModeManual.disabled = false;
            btnModeAuto.disabled = false;
            thresholdMinInput.disabled = false;
            thresholdMaxInput.disabled = false;
            saveThresholdBtn.disabled = false;
            
            updateUIVisibility();
        } else {
            isAuthenticated = false;
            btnShowLogin.style.display = 'flex';
            btnLogout.style.display = 'none';
            
            controlLockOverlay.style.display = 'flex';
            setTimeout(() => controlLockOverlay.style.opacity = '1', 10);
            
            btnModeManual.disabled = true;
            btnModeAuto.disabled = true;
            waterBtn.disabled = true;
            thresholdMinInput.disabled = true;
            thresholdMaxInput.disabled = true;
            saveThresholdBtn.disabled = true;
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

    // --- Firebase Database Listeners ---

    function startDatabaseListeners() {
        // Monitor Heartbeat
        const heartbeatRef = ref(db, 'status/heartbeat');
        onValue(heartbeatRef, (snapshot) => {
            if (snapshot.exists()) {
                lastHeartbeatTime = Date.now();
                if (isDeviceOffline) {
                    isDeviceOffline = false;
                    updateConnectionStatus(true);
                }
            }
        });

        // Offline Checker
        setInterval(() => {
            if (Date.now() - lastHeartbeatTime > 15000) {
                if (!isDeviceOffline) {
                    isDeviceOffline = true;
                    updateConnectionStatus(false);
                    setOfflineUI();
                }
            }
        }, 2000);

        // 1. Listen to Sensor Data
        const sensorsRef = ref(db, 'sensors');
        onValue(sensorsRef, (snapshot) => {
            if (isDeviceOffline) return; 

            const data = snapshot.val();
            if (data) {
                updateConnectionStatus(true);
                
                // Moisture Logic
                if(data.soil_moisture !== undefined) {
                    moistureVal.innerText = data.soil_moisture;
                    moistureBar.style.width = `${data.soil_moisture}%`;
                    
                    if (data.soil_moisture < thresholdMin) {
                        moistureStatusText.innerText = "ดินแห้งเกินไป";
                        moistureStatusText.className = "red-text";
                        moistureStatusDot.className = "dot red";
                    } else if (data.soil_moisture >= thresholdMin && data.soil_moisture <= thresholdMax) {
                        moistureStatusText.innerText = "เหมาะสม";
                        moistureStatusText.className = "blue-text";
                        moistureStatusDot.className = "dot green";
                    } else {
                        moistureStatusText.innerText = "ชื้นเกินไป";
                        moistureStatusText.className = "orange-text";
                        moistureStatusDot.className = "dot orange";
                    }
                }

                // DHT Logic
                if (data.dht_error === true) {
                    tempVal.innerText = "--";
                    humidVal.innerText = "--";
                    tempStatusText.style.display = 'inline';
                    tempErrDot.style.display = 'inline-block';
                    humidStatusText.style.display = 'inline';
                    humidErrDot.style.display = 'inline-block';
                    heroTemp.innerText = "--°C";
                } else {
                    tempStatusText.style.display = 'none';
                    tempErrDot.style.display = 'none';
                    humidStatusText.style.display = 'none';
                    humidErrDot.style.display = 'none';
                    
                    if(data.temperature !== undefined) {
                        tempVal.innerText = data.temperature.toFixed(1);
                        heroTemp.innerText = `${data.temperature.toFixed(1)}°C`;
                    }
                    if(data.humidity !== undefined) humidVal.innerText = data.humidity.toFixed(1);
                }
            }
        });

        // 2. Listen to Config
        const configRef = ref(db, 'state/config');
        onValue(configRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.auto_mode !== undefined) {
                    isAutoMode = data.auto_mode;
                    if(isAuthenticated) updateUIVisibility();
                    updateModeButtonsUI();
                }
                if (data.threshold_min !== undefined) {
                    thresholdMin = data.threshold_min;
                    thresholdMinInput.value = data.threshold_min;
                }
                if (data.threshold_max !== undefined) {
                    thresholdMax = data.threshold_max;
                    thresholdMaxInput.value = data.threshold_max;
                }
            }
        });

        // 3. Listen to Pump State
        const controlRef = ref(db, 'state/control/pump_state');
        onValue(controlRef, (snapshot) => {
            const state = snapshot.val();
            isWatering = state || false;
            
            if (isWatering) {
                pumpStatusText.innerText = "กำลังรดน้ำ";
                pumpStatusDot.className = "dot green";
                waterBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="6" y="6" width="12" height="12" rx="1"/>
                    </svg>
                    <span>ปิดปั๊มน้ำ</span>
                `;
                waterBtn.classList.add("active-pump");
            } else {
                pumpStatusText.innerText = "ปิดอยู่";
                pumpStatusDot.className = "dot gray";
                waterBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span>เปิดปั๊มน้ำ</span>
                `;
                waterBtn.classList.remove("active-pump");
            }
        });
    }

    // --- UI Write Actions (Requires Auth) ---

    btnModeManual.addEventListener("click", () => {
        if(!isAuthenticated) return;
        set(ref(db, 'state/config/auto_mode'), false);
    });

    btnModeAuto.addEventListener("click", () => {
        if(!isAuthenticated) return;
        set(ref(db, 'state/config/auto_mode'), true);
    });

    saveThresholdBtn.addEventListener("click", () => {
        if(!isAuthenticated) return;
        const minVal = parseInt(thresholdMinInput.value);
        const maxVal = parseInt(thresholdMaxInput.value);
        
        if (minVal >= maxVal) {
            alert("ค่า Min (ความชื้นต่ำสุด) ต้องน้อยกว่าค่า Max (ความชื้นสูงสุด) ครับ");
            return;
        }

        saveThresholdBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>กำลังบันทึก...</span>
        `;
        
        const updates = {};
        updates['state/config/threshold_min'] = minVal;
        updates['state/config/threshold_max'] = maxVal;

        update(ref(db), updates).then(() => {
            setTimeout(() => {
                saveThresholdBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>บันทึกเกณฑ์สำเร็จ!</span>
                `;
                setTimeout(() => {
                    saveThresholdBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                            <polyline points="17 21 17 13 7 13 7 21"/>
                            <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        <span>บันทึกเกณฑ์ความชื้น</span>
                    `;
                }, 1500);
            }, 300);
        }).catch(err => {
            console.error("Failed to save threshold", err);
            saveThresholdBtn.innerHTML = "<span>เกิดข้อผิดพลาด!</span>";
            setTimeout(() => {
                saveThresholdBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <span>บันทึกเกณฑ์ความชื้น</span>
                `;
            }, 2000);
        });
    });

    waterBtn.addEventListener("click", () => {
        if(!isAuthenticated || isAutoMode) return; 
        
        const newState = !isWatering;
        waterBtn.innerHTML = "<span>Processing...</span>";
        
        set(ref(db, 'state/control/pump_state'), newState).catch(err => {
            console.error("Failed to toggle pump", err);
            waterBtn.innerText = "Error";
        });
    });

    // --- Helpers ---

    function updateModeButtonsUI() {
        if (isAutoMode) {
            btnModeAuto.classList.add('active');
            btnModeManual.classList.remove('active');
        } else {
            btnModeManual.classList.add('active');
            btnModeAuto.classList.remove('active');
        }
    }

    function updateUIVisibility() {
        if (isAutoMode) {
            waterBtn.disabled = true;
            waterBtn.style.opacity = '0.5';
        } else {
            waterBtn.disabled = false;
            waterBtn.style.opacity = '1';
        }
    }

    function updateConnectionStatus(connected) {
        if (connected) {
            statusDot.className = "status-dot connected";
            statusText.innerText = "Connected to Cloud";
            statusText.style.color = "var(--text-main)";
        } else {
            statusDot.className = "status-dot disconnected";
            statusText.innerText = "Disconnected";
            statusText.style.color = "var(--red)";
        }
    }

    function setOfflineUI() {
        moistureVal.innerText = "--";
        tempVal.innerText = "--";
        humidVal.innerText = "--";
        moistureBar.style.width = `0%`;
        
        moistureStatusText.innerText = "ไม่พบอุปกรณ์";
        moistureStatusText.className = "red-text";
        moistureStatusDot.className = "dot red";
        
        tempStatusText.innerText = "ไม่พบอุปกรณ์";
        tempStatusText.className = "red-text";
        tempStatusText.style.display = 'inline';
        tempErrDot.style.display = 'inline-block';
        
        humidStatusText.innerText = "ไม่พบอุปกรณ์";
        humidStatusText.className = "red-text";
        humidStatusText.style.display = 'inline';
        humidErrDot.style.display = 'inline-block';
    }
});
