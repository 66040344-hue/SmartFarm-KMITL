// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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
            updateChartTheme();
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

    // --- Tab Navigation Engine (3 User Tabs) ---
    const navDashboard = document.getElementById("nav-tab-dashboard");
    const navControl = document.getElementById("nav-tab-control");
    const navSettings = document.getElementById("nav-tab-settings");

    const viewDashboard = document.getElementById("view-dashboard");
    const viewControl = document.getElementById("view-control");
    const viewSettings = document.getElementById("view-settings");

    const tabs = [
        { nav: navDashboard, view: viewDashboard },
        { nav: navControl, view: viewControl },
        { nav: navSettings, view: viewSettings }
    ];

    tabs.forEach(({ nav, view }) => {
        if (nav && view) {
            nav.addEventListener("click", () => {
                tabs.forEach(t => {
                    if (t.nav) t.nav.classList.remove("active");
                    if (t.view) t.view.classList.remove("active");
                });
                nav.classList.add("active");
                view.classList.add("active");
            });
        }
    });

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

    // Dashboard Read-Only Badges
    const dashPumpBadge = document.getElementById("dash-pump-badge");
    const dashPumpDot = document.getElementById("dash-pump-dot");
    const dashPumpText = document.getElementById("dash-pump-text");
    const dashModeBadge = document.getElementById("dash-mode-badge");
    const dashModeText = document.getElementById("dash-mode-text");
    
    // Alert Banner Element
    const criticalAlertBanner = document.getElementById("critical-alert-banner");
    const alertBannerText = document.getElementById("alert-banner-text");

    // Recommendations Elements (Dashboard View)
    const recTextMoisture = document.getElementById("rec-text-moisture");
    const recTextTemp = document.getElementById("rec-text-temp");
    const recTextGeneral = document.getElementById("rec-text-general");

    // Control Elements
    const btnModeManual = document.getElementById("btn-mode-manual");
    const btnModeAuto = document.getElementById("btn-mode-auto");
    const waterBtn = document.getElementById("water-btn");
    const pumpStatusDot = document.getElementById("pump-status-dot");
    const pumpStatusText = document.getElementById("pump-status-text");
    
    // Timer Presets & Countdown Elements
    const timerBtns = document.querySelectorAll(".timer-btn");
    const pumpCountdownBadge = document.getElementById("pump-countdown-badge");
    const countdownTimerText = document.getElementById("countdown-timer-text");
    let selectedTimerMinutes = 0; // 0 = continuous manual
    let countdownInterval = null;
    let timerRemainingSeconds = 0;

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

    // --- Chart.js Initialization (24 Hours History Persistent) ---
    let moistureChart = null;
    const maxHistoryPoints = 288; // 24 Hours x 12 (5-min intervals) = 288 points
    const chartLabels = [];
    const chartDataPoints = [];

    initMoistureChart();

    function initMoistureChart() {
        const ctx = document.getElementById('moisture-trend-chart');
        if (!ctx) return;

        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const strokeColor = "#2563eb";
        const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
        const textColor = isDark ? "#94a3b8" : "#64748b";

        moistureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'ความชื้นดิน (%)',
                    data: chartDataPoints,
                    borderColor: strokeColor,
                    borderWidth: 2.5,
                    pointBackgroundColor: strokeColor,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: true,
                    backgroundColor: (context) => {
                        const bgCtx = context.chart.ctx;
                        const gradient = bgCtx.createLinearGradient(0, 0, 0, 150);
                        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
                        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
                        return gradient;
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (ctx) => `ความชื้นดิน: ${ctx.parsed.y}%`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { 
                            color: textColor, 
                            font: { family: 'Prompt', size: 10 },
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { family: 'Prompt', size: 10 } }
                    }
                }
            }
        });
    }

    function updateChartTheme() {
        if (!moistureChart) return;
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
        const textColor = isDark ? "#94a3b8" : "#64748b";

        moistureChart.options.scales.x.grid.color = gridColor;
        moistureChart.options.scales.x.ticks.color = textColor;
        moistureChart.options.scales.y.grid.color = gridColor;
        moistureChart.options.scales.y.ticks.color = textColor;
        moistureChart.update();
    }

    // --- Timer Preset Handlers ---
    timerBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            timerBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedTimerMinutes = parseInt(btn.getAttribute("data-minutes")) || 0;
        });
    });

    // --- Start Public Listeners Immediately ---
    startDatabaseListeners();

    // --- Authentication Flow ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            isAuthenticated = true;
            loginModal.style.display = 'none';
            btnShowLogin.style.display = 'none';
            btnLogout.style.display = 'flex';
            
            if (controlLockOverlay) {
                controlLockOverlay.style.opacity = '0';
                setTimeout(() => controlLockOverlay.style.display = 'none', 300);
            }

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
            
            if (controlLockOverlay) {
                controlLockOverlay.style.display = 'flex';
                setTimeout(() => controlLockOverlay.style.opacity = '1', 10);
            }

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

        // 1. Listen to Sensor Data (Live Realtime Reads)
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

                // Check Critical Alerts Banner
                evaluateCriticalAlerts(data);
            }
        });

        // 2. Listen to Persistent 24-Hour History (/history)
        const historyQuery = query(ref(db, 'history'), limitToLast(maxHistoryPoints));
        onValue(historyQuery, (snapshot) => {
            if (snapshot.exists() && moistureChart) {
                chartLabels.length = 0;
                chartDataPoints.length = 0;

                const historyData = snapshot.val();
                Object.keys(historyData).forEach((key) => {
                    const item = historyData[key];
                    if (item && item.soil_moisture !== undefined) {
                        let timeStr = "";
                        if (item.timestamp) {
                            const date = new Date(item.timestamp);
                            timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                        } else {
                            timeStr = "--:--";
                        }
                        chartLabels.push(timeStr);
                        chartDataPoints.push(item.soil_moisture);
                    }
                });

                moistureChart.update();
            }
        });

        // 3. Listen to Config
        const configRef = ref(db, 'state/config');
        onValue(configRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.auto_mode !== undefined) {
                    isAutoMode = data.auto_mode;
                    if(isAuthenticated) updateUIVisibility();
                    updateModeButtonsUI();
                    updateDashboardModeUI();
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

        // 4. Listen to Pump State
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

                // Dashboard Readout Update
                if (dashPumpBadge && dashPumpText && dashPumpDot) {
                    dashPumpBadge.className = "status-badge active-pump";
                    dashPumpDot.className = "dot green";
                    dashPumpText.innerText = "กำลังรดน้ำ";
                }
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
                
                // Clear Timer Countdown if pump is manually turned off
                stopCountdownTimer();

                // Dashboard Readout Update
                if (dashPumpBadge && dashPumpText && dashPumpDot) {
                    dashPumpBadge.className = "status-badge gray";
                    dashPumpDot.className = "dot gray";
                    dashPumpText.innerText = "ปิดอยู่";
                }
            }
        });

        // 5. Listen to Realtime Recommendations
        const recRef = ref(db, 'recommendations');
        onValue(recRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.moisture && recTextMoisture) recTextMoisture.innerText = data.moisture;
                if (data.temp && recTextTemp) recTextTemp.innerText = data.temp;
                if (data.general && recTextGeneral) recTextGeneral.innerText = data.general;
            }
        });
    }

    // --- 🚨 CRITICAL ALERT BANNER EVALUATOR ---
    function evaluateCriticalAlerts(data) {
        if (!criticalAlertBanner || !alertBannerText) return;

        if (data.soil_moisture !== undefined && data.soil_moisture < thresholdMin) {
            alertBannerText.innerText = `⚠️ เตือน: ความชื้นในดินต่ำเกินไป (${data.soil_moisture}%) ควรรดน้ำ`;
            criticalAlertBanner.style.display = "flex";
        } else if (data.temperature !== undefined && data.temperature > 35) {
            alertBannerText.innerText = `🔥 เตือน: อุณหภูมิในฟาร์มสูงเกินไป (${data.temperature.toFixed(1)}°C) ควรระบายอากาศ`;
            criticalAlertBanner.style.display = "flex";
        } else if (data.soil_moisture !== undefined && data.soil_moisture > thresholdMax + 15) {
            alertBannerText.innerText = `💧 เตือน: ความชื้นดินสูงเกินไป (${data.soil_moisture}%) ควรหยุดให้น้ำ`;
            criticalAlertBanner.style.display = "flex";
        } else {
            criticalAlertBanner.style.display = "none";
        }
    }

    // --- ⏱️ COUNTDOWN TIMER LOGIC ---
    function startCountdownTimer(minutes) {
        stopCountdownTimer();
        if (minutes <= 0) return;

        timerRemainingSeconds = minutes * 60;
        updateCountdownDisplay();
        pumpCountdownBadge.style.display = "block";

        countdownInterval = setInterval(() => {
            timerRemainingSeconds--;
            if (timerRemainingSeconds <= 0) {
                stopCountdownTimer();
                // Turn off pump automatically
                set(ref(db, 'state/control/pump_state'), false);
            } else {
                updateCountdownDisplay();
            }
        }, 1000);
    }

    function stopCountdownTimer() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (pumpCountdownBadge) {
            pumpCountdownBadge.style.display = "none";
        }
    }

    function updateCountdownDisplay() {
        if (!countdownTimerText) return;
        const mins = Math.floor(timerRemainingSeconds / 60);
        const secs = timerRemainingSeconds % 60;
        countdownTimerText.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
        
        set(ref(db, 'state/control/pump_state'), newState).then(() => {
            if (newState && selectedTimerMinutes > 0) {
                startCountdownTimer(selectedTimerMinutes);
            }
        }).catch(err => {
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

    function updateDashboardModeUI() {
        if (dashModeBadge && dashModeText) {
            if (isAutoMode) {
                dashModeBadge.className = "status-badge primary";
                dashModeText.innerText = "อัตโนมัติ (Auto)";
            } else {
                dashModeBadge.className = "status-badge gray";
                dashModeText.innerText = "กำหนดเอง (Manual)";
            }
        }
    }

    function updateUIVisibility() {
        const timerWrapper = document.getElementById("timer-selection-wrapper");

        if (isAutoMode) {
            waterBtn.disabled = true;
            waterBtn.style.opacity = '0.5';
            if (timerWrapper) timerWrapper.style.opacity = '0.5';
        } else {
            waterBtn.disabled = false;
            waterBtn.style.opacity = '1';
            if (timerWrapper) timerWrapper.style.opacity = '1';
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

        if (criticalAlertBanner) criticalAlertBanner.style.display = "none";
    }
});
