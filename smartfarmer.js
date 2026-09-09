// ==========================================
// Smart Farmer Telemetry & Environmental Dashboard
// Pure Monitoring Dashboard - Pure Real Database Mode
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

document.addEventListener("DOMContentLoaded", () => {
    // --- Theme Engine ---
    const themeBtn = document.getElementById("btn-theme-toggle");
    const sunIcon = document.getElementById("theme-sun");
    const moonIcon = document.getElementById("theme-moon");

    let currentTheme = localStorage.getItem("smartfarmer_theme") || "light";
    applyTheme(currentTheme);

    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            currentTheme = currentTheme === "light" ? "dark" : "light";
            localStorage.setItem("smartfarmer_theme", currentTheme);
            applyTheme(currentTheme);
            updateChartsTheme();
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        if (theme === "dark") {
            if (sunIcon) sunIcon.style.display = "none";
            if (moonIcon) moonIcon.style.display = "block";
        } else {
            if (sunIcon) sunIcon.style.display = "block";
            if (moonIcon) moonIcon.style.display = "none";
        }
    }

    // --- Fullscreen Toggle ---
    const btnFullscreen = document.getElementById("btn-fullscreen");
    if (btnFullscreen) {
        btnFullscreen.addEventListener("click", () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log(`Fullscreen error: ${err.message}`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });
    }

    // --- DOM Elements ---
    // Soil Moisture
    const soilMoistureVal = document.getElementById("val-soil-moisture");
    const soilMoistureBar = document.getElementById("bar-soil-moisture");
    const soilMoistureThumb = document.getElementById("thumb-soil-moisture");
    const soilMoistureStatus = document.getElementById("status-soil-moisture");

    // Soil Temp
    const soilTempVal = document.getElementById("val-soil-temp");
    const soilTempBar = document.getElementById("bar-soil-temp");
    const soilTempThumb = document.getElementById("thumb-soil-temp");
    const soilTempStatus = document.getElementById("status-soil-temp");

    // Air Humidity
    const airHumidityVal = document.getElementById("val-air-humidity");
    const airHumidityBar = document.getElementById("bar-air-humidity");
    const airHumidityThumb = document.getElementById("thumb-air-humidity");
    const airHumidityStatus = document.getElementById("status-air-humidity");

    // Air Temp
    const airTempVal = document.getElementById("val-air-temp");
    const airTempBar = document.getElementById("bar-air-temp");
    const airTempThumb = document.getElementById("thumb-air-temp");
    const airTempStatus = document.getElementById("status-air-temp");

    // Top Weather Header & Sync Badges
    const heroTempDisplay = document.getElementById("hero-temp-display");
    const heroWeatherCondition = document.getElementById("hero-weather-condition");
    const farmHealthScore = document.getElementById("hero-health-score");
    const farmVPDVal = document.getElementById("hero-vpd-val");
    const lastDataTimestampBadge = document.getElementById("last-data-timestamp");
    const lastUpdateTs = document.getElementById("last-update-ts");
    const cloudStatusText = document.getElementById("cloud-status-text");
    const cloudStatusDot = document.getElementById("cloud-status-dot");

    // Summary Table Elements
    const summaryAvgMoisture = document.getElementById("summary-avg-soil-moisture");
    const summaryAvgSoilTemp = document.getElementById("summary-avg-soil-temp");
    const summaryAvgHumidity = document.getElementById("summary-avg-air-humidity");
    const summaryTempMinMax = document.getElementById("summary-temp-minmax");
    const summaryDeviceStatus = document.getElementById("summary-device-status");

    // Diagnostic Insights
    const insightMoistureText = document.getElementById("insight-moisture-text");
    const insightTempText = document.getElementById("insight-temp-text");
    const insightVpdText = document.getElementById("insight-vpd-text");

    // State Variables
    let lastHeartbeatTime = Date.now();
    let isDeviceOffline = false;
    let rawHistoryRecords = [];
    let selectedTimeRange = "1h"; // "1h", "6h", "24h"
    let lastValidTimestampFormatted = "--/--/---- --:--:--";

    // --- Chart.js Instances (Grouped: Soil vs Air) ---
    let soilChart = null;
    let airChart = null;

    initCharts();

    function initCharts() {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
        const textColor = isDark ? "#94a3b8" : "#64748b";

        // Chart 1: Soil Environment (Soil Moisture % & Soil Temp °C)
        const ctxSoil = document.getElementById("chart-soil-telemetry");
        if (ctxSoil) {
            soilChart = new Chart(ctxSoil, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'ความชื้นในดิน (%)',
                            data: [],
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.15)',
                            borderWidth: 2.5,
                            fill: true,
                            tension: 0.35,
                            pointRadius: 2,
                            yAxisID: 'y'
                        },
                        {
                            label: 'อุณหภูมิดิน (°C)',
                            data: [],
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.35,
                            pointRadius: 2,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top', labels: { font: { family: 'Prompt', size: 10 }, color: textColor } },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Prompt', size: 9 } } },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            min: 0,
                            max: 100,
                            title: { display: true, text: '%', color: textColor, font: { family: 'Prompt', size: 9 } },
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { family: 'Prompt', size: 9 } }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            min: 0,
                            max: 50,
                            title: { display: true, text: '°C', color: textColor, font: { family: 'Prompt', size: 9 } },
                            grid: { drawOnChartArea: false },
                            ticks: { color: textColor, font: { family: 'Prompt', size: 9 } }
                        }
                    }
                }
            });
        }

        // Chart 2: Air Environment (Air Humidity %RH & Air Temp °C)
        const ctxAir = document.getElementById("chart-air-telemetry");
        if (ctxAir) {
            airChart = new Chart(ctxAir, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'ความชื้นในอากาศ (%RH)',
                            data: [],
                            borderColor: '#0284c7',
                            backgroundColor: 'rgba(2, 132, 199, 0.15)',
                            borderWidth: 2.5,
                            fill: true,
                            tension: 0.35,
                            pointRadius: 2,
                            yAxisID: 'y'
                        },
                        {
                            label: 'อุณหภูมิอากาศ (°C)',
                            data: [],
                            borderColor: '#ea580c',
                            backgroundColor: 'rgba(234, 88, 12, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.35,
                            pointRadius: 2,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top', labels: { font: { family: 'Prompt', size: 10 }, color: textColor } },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Prompt', size: 9 } } },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            min: 0,
                            max: 100,
                            title: { display: true, text: '%RH', color: textColor, font: { family: 'Prompt', size: 9 } },
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { family: 'Prompt', size: 9 } }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            min: 0,
                            max: 50,
                            title: { display: true, text: '°C', color: textColor, font: { family: 'Prompt', size: 9 } },
                            grid: { drawOnChartArea: false },
                            ticks: { color: textColor, font: { family: 'Prompt', size: 9 } }
                        }
                    }
                }
            });
        }
    }

    function updateChartsTheme() {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
        const textColor = isDark ? "#94a3b8" : "#64748b";

        [soilChart, airChart].forEach(chart => {
            if (chart) {
                chart.options.plugins.legend.labels.color = textColor;
                chart.options.scales.x.grid.color = gridColor;
                chart.options.scales.x.ticks.color = textColor;
                if (chart.options.scales.y) {
                    chart.options.scales.y.grid.color = gridColor;
                    chart.options.scales.y.ticks.color = textColor;
                    if (chart.options.scales.y.title) chart.options.scales.y.title.color = textColor;
                }
                if (chart.options.scales.y1) {
                    chart.options.scales.y1.ticks.color = textColor;
                    if (chart.options.scales.y1.title) chart.options.scales.y1.title.color = textColor;
                }
                chart.update();
            }
        });
    }

    // --- Format Actual Database Epoch / Payload Timestamp ---
    function formatActualTimestamp(timestamp) {
        if (!timestamp) return null;
        let d;
        if (typeof timestamp === 'number' || typeof timestamp === 'string') {
            const num = Number(timestamp);
            d = isNaN(num) ? new Date(timestamp) : new Date(num);
        } else if (timestamp instanceof Date) {
            d = timestamp;
        } else {
            return null;
        }

        if (isNaN(d.getTime())) return null;

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }

    // --- Firebase Database Listeners ---
    startRealDatabaseListeners();

    function startRealDatabaseListeners() {
        // 1. Listen to Status Heartbeat
        const heartbeatRef = ref(db, 'status/heartbeat');
        onValue(heartbeatRef, (snapshot) => {
            if (snapshot.exists()) {
                lastHeartbeatTime = Date.now();
                const hbValue = snapshot.val();
                
                let hbFormatted = formatActualTimestamp(hbValue);
                if (hbFormatted) {
                    lastValidTimestampFormatted = hbFormatted;
                    updateTimestampUI(hbFormatted);
                }

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
        }, 2500);

        // 2. Listen to Sensors (Real-time Telemetry)
        const sensorsRef = ref(db, 'sensors');
        onValue(sensorsRef, (snapshot) => {
            if (isDeviceOffline) return;
            const data = snapshot.val();
            if (data) {
                updateConnectionStatus(true);
                updateTelemetryFromDatabase(data);
            }
        });

        // 3. Listen to History Records (288 points = 24 Hours)
        const maxHistoryPoints = 288;
        const historyQuery = query(ref(db, 'history'), limitToLast(maxHistoryPoints));
        onValue(historyQuery, (snapshot) => {
            if (snapshot.exists()) {
                rawHistoryRecords = [];
                const historyData = snapshot.val();
                Object.keys(historyData).forEach((key) => {
                    const item = historyData[key];
                    if (item) {
                        rawHistoryRecords.push(item);
                    }
                });

                if (rawHistoryRecords.length > 0) {
                    const latestRecord = rawHistoryRecords[rawHistoryRecords.length - 1];
                    if (latestRecord && latestRecord.timestamp) {
                        const historyFormatted = formatActualTimestamp(latestRecord.timestamp);
                        if (historyFormatted) {
                            lastValidTimestampFormatted = historyFormatted;
                            updateTimestampUI(historyFormatted);
                        }
                    }
                }

                renderHistoryCharts();
                calculateSummaryStatistics();
            }
        });
    }

    function updateTimestampUI(formattedTime) {
        if (lastDataTimestampBadge) {
            lastDataTimestampBadge.innerText = formattedTime;
        }
        if (lastUpdateTs) {
            lastUpdateTs.innerText = formattedTime;
        }
    }

    function updateConnectionStatus(connected) {
        if (!cloudStatusDot || !cloudStatusText) return;
        if (connected) {
            cloudStatusDot.className = "status-dot-pulse connected";
            cloudStatusText.innerText = "Online";
            cloudStatusText.style.color = "var(--green)";
            if (summaryDeviceStatus) {
                summaryDeviceStatus.innerText = "ออนไลน์ปกติ";
                summaryDeviceStatus.style.color = "var(--green)";
            }
        } else {
            cloudStatusDot.className = "status-dot-pulse disconnected";
            cloudStatusText.innerText = "ไม่พบเซนเซอร์";
            cloudStatusText.style.color = "var(--red)";
            if (summaryDeviceStatus) {
                summaryDeviceStatus.innerText = "ขาดการติดต่อ";
                summaryDeviceStatus.style.color = "var(--red)";
            }
        }
    }

    function setOfflineUI() {
        if (soilMoistureVal) soilMoistureVal.innerText = "--";
        if (soilTempVal) soilTempVal.innerText = "--";
        if (airHumidityVal) airHumidityVal.innerText = "--";
        if (airTempVal) airTempVal.innerText = "--";

        if (soilMoistureBar) soilMoistureBar.style.width = "0%";
        if (soilTempBar) soilTempBar.style.width = "0%";
        if (airHumidityBar) airHumidityBar.style.width = "0%";
        if (airTempBar) airTempBar.style.width = "0%";

        if (soilMoistureStatus) {
            soilMoistureStatus.className = "telemetry-status-badge badge-red";
            soilMoistureStatus.innerText = "ไม่พบอุปกรณ์";
        }
        if (soilTempStatus) {
            soilTempStatus.className = "telemetry-status-badge badge-red";
            soilTempStatus.innerText = "ไม่พบอุปกรณ์";
        }
        if (airHumidityStatus) {
            airHumidityStatus.className = "telemetry-status-badge badge-red";
            airHumidityStatus.innerText = "ไม่พบอุปกรณ์";
        }
        if (airTempStatus) {
            airTempStatus.className = "telemetry-status-badge badge-red";
            airTempStatus.innerText = "ไม่พบอุปกรณ์";
        }

        if (farmHealthScore) farmHealthScore.innerText = "--%";
        if (farmVPDVal) farmVPDVal.innerText = "-- kPa";

        if (lastDataTimestampBadge) {
            lastDataTimestampBadge.innerText = lastValidTimestampFormatted !== "--/--/---- --:--:--"
                ? `${lastValidTimestampFormatted} (Offline)`
                : "ไม่พบข้อมูลจาก DB";
        }
    }

    // --- Core Database Telemetry UI Renderer ---
    function updateTelemetryFromDatabase(data) {
        let soilMoisture = null;
        let soilTemp = null;
        let airTemp = null;
        let airHumidity = null;

        if (data.timestamp || data.updated_at) {
            const rawTs = data.timestamp || data.updated_at;
            const formatted = formatActualTimestamp(rawTs);
            if (formatted) {
                lastValidTimestampFormatted = formatted;
                updateTimestampUI(formatted);
            }
        }

        // 1. Soil Moisture
        if (data.soil_moisture !== undefined && data.soil_moisture !== null) {
            soilMoisture = Number(data.soil_moisture);
            const moisturePct = Math.min(100, Math.max(0, soilMoisture));
            if (soilMoistureVal) soilMoistureVal.innerText = soilMoisture;
            if (soilMoistureBar) soilMoistureBar.style.width = `${moisturePct}%`;
            if (soilMoistureThumb) soilMoistureThumb.style.left = `${moisturePct}%`;

            if (soilMoistureStatus) {
                if (soilMoisture < 30) {
                    soilMoistureStatus.className = "telemetry-status-badge badge-red";
                    soilMoistureStatus.innerText = "ดินแห้งเกินไป";
                } else if (soilMoisture <= 65) {
                    soilMoistureStatus.className = "telemetry-status-badge badge-green";
                    soilMoistureStatus.innerText = "ความชื้นเหมาะสม";
                } else {
                    soilMoistureStatus.className = "telemetry-status-badge badge-amber";
                    soilMoistureStatus.innerText = "ความชื้นสูง";
                }
            }
        } else {
            if (soilMoistureVal) soilMoistureVal.innerText = "--";
            if (soilMoistureThumb) soilMoistureThumb.style.left = "0%";
        }

        // 2. Soil Temperature (soil_temperature or soil_temp)
        const rawSoilTemp = data.soil_temperature !== undefined ? data.soil_temperature : data.soil_temp;
        if (rawSoilTemp !== undefined && rawSoilTemp !== null) {
            soilTemp = Number(rawSoilTemp);
            const soilTempPct = Math.min(100, Math.max(0, (soilTemp / 45) * 100));
            if (soilTempVal) soilTempVal.innerText = soilTemp.toFixed(1);
            if (soilTempBar) soilTempBar.style.width = `${soilTempPct}%`;
            if (soilTempThumb) soilTempThumb.style.left = `${soilTempPct}%`;

            if (soilTempStatus) {
                if (soilTemp < 18) {
                    soilTempStatus.className = "telemetry-status-badge badge-amber";
                    soilTempStatus.innerText = "ดินเย็นเกินไป";
                } else if (soilTemp <= 32) {
                    soilTempStatus.className = "telemetry-status-badge badge-green";
                    soilTempStatus.innerText = "อุณหภูมิดินดีเยี่ยม";
                } else {
                    soilTempStatus.className = "telemetry-status-badge badge-red";
                    soilTempStatus.innerText = "ดินมีความร้อนสะสม";
                }
            }
        } else {
            if (soilTempVal) soilTempVal.innerText = "--";
            if (soilTempBar) soilTempBar.style.width = "0%";
            if (soilTempThumb) soilTempThumb.style.left = "0%";
            if (soilTempStatus) {
                soilTempStatus.className = "telemetry-status-badge badge-gray";
                soilTempStatus.innerText = "ไม่พบเซนเซอร์ดิน";
            }
        }

        // 3. DHT Sensor Data (Air Temp & Air Humidity)
        if (data.dht_error === true) {
            if (airTempVal) airTempVal.innerText = "--";
            if (airHumidityVal) airHumidityVal.innerText = "--";
            if (airTempThumb) airTempThumb.style.left = "0%";
            if (airHumidityThumb) airHumidityThumb.style.left = "0%";
            if (airTempStatus) {
                airTempStatus.className = "telemetry-status-badge badge-red";
                airTempStatus.innerText = "ไม่พบเซนเซอร์ DHT";
            }
            if (airHumidityStatus) {
                airHumidityStatus.className = "telemetry-status-badge badge-red";
                airHumidityStatus.innerText = "ไม่พบเซนเซอร์ DHT";
            }
        } else {
            // Air Humidity
            if (data.humidity !== undefined && data.humidity !== null) {
                airHumidity = Number(data.humidity);
                const humPct = Math.min(100, Math.max(0, airHumidity));
                if (airHumidityVal) airHumidityVal.innerText = airHumidity.toFixed(1);
                if (airHumidityBar) airHumidityBar.style.width = `${humPct}%`;
                if (airHumidityThumb) airHumidityThumb.style.left = `${humPct}%`;

                if (airHumidityStatus) {
                    if (airHumidity < 45) {
                        airHumidityStatus.className = "telemetry-status-badge badge-amber";
                        airHumidityStatus.innerText = "อากาศแห้ง";
                    } else if (airHumidity <= 75) {
                        airHumidityStatus.className = "telemetry-status-badge badge-green";
                        airHumidityStatus.innerText = "ความชื้นอากาศดีมาก";
                    } else {
                        airHumidityStatus.className = "telemetry-status-badge badge-red";
                        airHumidityStatus.innerText = "ความชื้นสูงเสี่ยงโรครา";
                    }
                }
            }

            // Air Temp
            if (data.temperature !== undefined && data.temperature !== null) {
                airTemp = Number(data.temperature);
                const airTempPct = Math.min(100, Math.max(0, (airTemp / 50) * 100));
                if (airTempVal) airTempVal.innerText = airTemp.toFixed(1);
                if (airTempBar) airTempBar.style.width = `${airTempPct}%`;
                if (airTempThumb) airTempThumb.style.left = `${airTempPct}%`;

                if (airTempStatus) {
                    if (airTemp < 20) {
                        airTempStatus.className = "telemetry-status-badge badge-amber";
                        airTempStatus.innerText = "อากาศเย็น";
                    } else if (airTemp <= 33) {
                        airTempStatus.className = "telemetry-status-badge badge-green";
                        airTempStatus.innerText = "อุณหภูมิอบอุ่นพอดี";
                    } else {
                        airTempStatus.className = "telemetry-status-badge badge-red";
                        airTempStatus.innerText = "อากาศร้อนจัด";
                    }
                }
            }
        }

        // Calculate Vapor Pressure Deficit (VPD)
        if (airTemp !== null && airHumidity !== null) {
            const vpSat = 0.61078 * Math.exp((17.27 * airTemp) / (airTemp + 237.3));
            const vpd = vpSat * (1 - airHumidity / 100);
            if (farmVPDVal) farmVPDVal.innerText = `${vpd.toFixed(2)} kPa`;
            updateVPDDiagnostic(vpd);
        } else {
            if (farmVPDVal) farmVPDVal.innerText = "-- kPa";
        }

        // Calculate Health Score
        calculateOverallHealthScore(soilMoisture, soilTemp, airHumidity, airTemp);

        // Update Insight Text
        if (soilMoisture !== null) updateSoilInsight(soilMoisture);
        if (airTemp !== null) updateTempInsight(airTemp, soilTemp);
    }

    function calculateOverallHealthScore(sm, st, ah, at) {
        if (!farmHealthScore) return;
        let score = 100;
        let count = 0;

        if (sm !== null) {
            count++;
            if (sm < 30 || sm > 70) score -= 20;
        }
        if (at !== null) {
            count++;
            if (at > 34 || at < 18) score -= 20;
        }
        if (ah !== null) {
            count++;
            if (ah < 40 || ah > 80) score -= 15;
        }
        if (st !== null) {
            count++;
            if (st > 33) score -= 15;
        }

        if (count === 0) {
            farmHealthScore.innerText = "--%";
        } else {
            farmHealthScore.innerText = `${Math.max(40, score)}%`;
        }
    }

    function updateSoilInsight(sm) {
        if (!insightMoistureText) return;
        if (sm >= 35 && sm <= 65) {
            insightMoistureText.innerText = `ความชื้นในดินอยู่ที่ ${sm}% ซึ่งอยู่ในเกณฑ์สมบูรณ์ รากพืชสามารถดูดซึมสารอาหารได้เต็มที่`;
        } else if (sm < 35) {
            insightMoistureText.innerText = `ความชื้นในดินต่ำลงอยู่ที่ ${sm}% ดินเริ่มแห้ง ควรสังเกตความเหี่ยวของใบพืช`;
        } else {
            insightMoistureText.innerText = `ความชื้นในดินสูงถึง ${sm}% ดินอิ่มตัวด้วยน้ำ ควรระวังการอุ้มน้ำระบายอากาศของดิน`;
        }
    }

    function updateTempInsight(at, st) {
        if (!insightTempText) return;
        if (st !== null) {
            insightTempText.innerText = `อุณหภูมิอากาศ ${at.toFixed(1)}°C และอุณหภูมิดิน ${st.toFixed(1)}°C ต่างกัน ${Math.abs(at - st).toFixed(1)}°C ช่วยรักษาสมดุลความเย็นในระบบราก`;
        } else {
            insightTempText.innerText = `อุณหภูมิอากาศปัจจุบันอยู่ที่ ${at.toFixed(1)}°C ควรรักษาระดับระบายอากาศในโรงเรือน`;
        }
    }

    function updateVPDDiagnostic(vpd) {
        if (!insightVpdText) return;
        if (vpd >= 0.8 && vpd <= 1.2) {
            insightVpdText.innerText = `ค่าแรงด่วนไอน้ำ (VPD) อยู่ที่ ${vpd.toFixed(2)} kPa เหมาะสมสำหรับการปากใบเปิดและคายน้ำได้มีประสิทธิภาพสูงสุด`;
        } else if (vpd < 0.8) {
            insightVpdText.innerText = `ค่า VPD ต่ำ (${vpd.toFixed(2)} kPa) อากาศชื้น การคายน้ำของพืชชะลอตัว`;
        } else {
            insightVpdText.innerText = `ค่า VPD สูง (${vpd.toFixed(2)} kPa) อากาศแห้ง พืชอาจปิดปากใบเพื่อลดการสูญเสียน้ำ`;
        }
    }

    // --- Render History Charts Grouped: Soil vs Air ---
    function renderHistoryCharts() {
        if (!rawHistoryRecords || rawHistoryRecords.length === 0) return;

        let limitPoints = 12; // default 1h
        if (selectedTimeRange === "6h") limitPoints = 72;
        if (selectedTimeRange === "24h") limitPoints = 288;

        const records = rawHistoryRecords.slice(-limitPoints);

        const labels = [];
        const soilMoistureData = [];
        const soilTempData = [];
        const airHumidityData = [];
        const airTempData = [];

        records.forEach(item => {
            let timeStr = "";
            if (item.timestamp) {
                const d = new Date(item.timestamp);
                timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } else {
                timeStr = "-";
            }
            labels.push(timeStr);

            // Soil telemetry
            soilMoistureData.push(item.soil_moisture !== undefined ? item.soil_moisture : null);
            const stVal = item.soil_temperature !== undefined ? item.soil_temperature : (item.soil_temp !== undefined ? item.soil_temp : null);
            soilTempData.push(stVal);

            // Air telemetry
            airHumidityData.push(item.humidity !== undefined ? item.humidity : null);
            airTempData.push(item.temperature !== undefined ? item.temperature : null);
        });

        // Update Soil Environment Chart (Soil Moisture & Soil Temp)
        if (soilChart) {
            soilChart.data.labels = labels;
            soilChart.data.datasets[0].data = soilMoistureData;
            soilChart.data.datasets[1].data = soilTempData;
            soilChart.update();
        }

        // Update Air Environment Chart (Air Humidity & Air Temp)
        if (airChart) {
            airChart.data.labels = labels;
            airChart.data.datasets[0].data = airHumidityData;
            airChart.data.datasets[1].data = airTempData;
            airChart.update();
        }
    }

    // --- Calculate Daily Summary Statistics from Database History ---
    function calculateSummaryStatistics() {
        if (!rawHistoryRecords || rawHistoryRecords.length === 0) return;

        let smSum = 0, smCount = 0;
        let stSum = 0, stCount = 0;
        let ahSum = 0, ahCount = 0;
        let atMin = Infinity, atMax = -Infinity, atCount = 0;

        rawHistoryRecords.forEach(item => {
            if (item.soil_moisture !== undefined && item.soil_moisture !== null) {
                smSum += Number(item.soil_moisture);
                smCount++;
            }
            const stVal = item.soil_temperature !== undefined ? item.soil_temperature : item.soil_temp;
            if (stVal !== undefined && stVal !== null) {
                stSum += Number(stVal);
                stCount++;
            }
            if (item.humidity !== undefined && item.humidity !== null) {
                ahSum += Number(item.humidity);
                ahCount++;
            }
            if (item.temperature !== undefined && item.temperature !== null) {
                const t = Number(item.temperature);
                if (t < atMin) atMin = t;
                if (t > atMax) atMax = t;
                atCount++;
            }
        });

        if (summaryAvgMoisture) {
            summaryAvgMoisture.innerText = smCount > 0 ? `${(smSum / smCount).toFixed(1)}%` : "--%";
        }
        if (summaryAvgSoilTemp) {
            summaryAvgSoilTemp.innerText = stCount > 0 ? `${(stSum / stCount).toFixed(1)}°C` : "--°C";
        }
        if (summaryAvgHumidity) {
            summaryAvgHumidity.innerText = ahCount > 0 ? `${(ahSum / ahCount).toFixed(1)}%` : "--%";
        }
        if (summaryTempMinMax) {
            if (atCount > 0) {
                summaryTempMinMax.innerText = `${atMax.toFixed(1)} / ${atMin.toFixed(1)}°C`;
            } else {
                summaryTempMinMax.innerText = "-- / --°C";
            }
        }
    }

    // --- Time Filter Event Handlers ---
    const filterBtns = document.querySelectorAll(".filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedTimeRange = btn.getAttribute("data-range") || "1h";
            renderHistoryCharts();
        });
    });
});
