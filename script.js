// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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
    
    const thresholdSlider = document.getElementById("threshold-slider");
    const thresholdDisplay = document.getElementById("threshold-display");

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
    let threshold = 40;
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
            thresholdSlider.disabled = false;
            
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
            thresholdSlider.disabled = true;
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
                    
                    if (data.soil_moisture < threshold) {
                        moistureStatusText.innerText = "ดินแห้งเกินไป";
                        moistureStatusText.className = "red-text";
                        moistureStatusDot.className = "dot red";
                    } else if (data.soil_moisture >= threshold && data.soil_moisture <= 60) {
                        moistureStatusText.innerText = "เหมาะสม";
                        moistureStatusText.className = "blue-text"; // Or green
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
                if (data.threshold !== undefined) {
                    threshold = data.threshold;
                    thresholdSlider.value = threshold;
                    thresholdDisplay.innerText = `${threshold}%`;
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
                waterBtn.innerHTML = '<span class="icon">⏹</span> ปิดปั๊มน้ำ';
                waterBtn.classList.add("active-pump");
            } else {
                pumpStatusText.innerText = "ปิดอยู่";
                pumpStatusDot.className = "dot gray";
                waterBtn.innerHTML = '<span class="icon">▶</span> เปิดปั๊มน้ำ';
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

    // อัปเดตตัวเลขตอนที่กำลังเลื่อน
    thresholdSlider.addEventListener("input", (e) => {
        thresholdDisplay.innerText = `${e.target.value}%`;
    });

    // บันทึกอัตโนมัติเมื่อปล่อยนิ้วจากการเลื่อน
    thresholdSlider.addEventListener("change", (e) => {
        if(!isAuthenticated) return;
        const newThreshold = parseInt(e.target.value);
        set(ref(db, 'state/config/threshold'), newThreshold).catch(err => {
            console.error("Failed to save threshold", err);
        });
    });

    waterBtn.addEventListener("click", () => {
        if(!isAuthenticated || isAutoMode) return; 
        
        const newState = !isWatering;
        waterBtn.innerHTML = "Processing...";
        
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
