/**
 * Smart Farm Management KMITL - Application Logic & Interactive Systems
 * Includes Web Audio Synthesizer, Live Telemetry Simulator, Modals & UI Widgets
 */

// Initialize Lucide Icons
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  initCustomCursor();
  initWebAudioSFX();
  initBgWidgetControls();
  initHeroCounters();
  initIoTSimulator();
  initModuleModals();
  initAdmissionModal();
});

/* ==========================================================================
   WEB AUDIO SYNTHESIZER (Sci-Fi Cyber SFX)
   ========================================================================== */
let audioCtx = null;
let soundEnabled = true;

function initWebAudioSFX() {
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');

  const getAudioContext = () => {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  };

  soundToggleBtn.addEventListener('click', () => {
    getAudioContext();
    soundEnabled = !soundEnabled;

    if (soundEnabled) {
      soundToggleBtn.classList.remove('muted');
      if (soundIcon) soundIcon.setAttribute('data-lucide', 'volume-2');
      playTone(587.33, 'sine', 0.1, 0.05); // D5 chime
    } else {
      soundToggleBtn.classList.add('muted');
      if (soundIcon) soundIcon.setAttribute('data-lucide', 'volume-x');
    }
    if (window.lucide) window.lucide.createIcons();
  });
}

function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.04) {
  if (!soundEnabled) return;
  try {
    const ctx = audioCtx || (window.AudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null);
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silent catch if audio not allowed without gesture
  }
}

function playCyberChime() {
  if (!soundEnabled) return;
  playTone(523.25, 'sine', 0.08, 0.04); // C5
  setTimeout(() => playTone(659.25, 'sine', 0.08, 0.04), 60); // E5
  setTimeout(() => playTone(783.99, 'sine', 0.15, 0.05), 120); // G5
}

/* ==========================================================================
   CUSTOM CURSOR FOLLOWER
   ========================================================================== */
function initCustomCursor() {
  const dot = document.getElementById('cursorDot');
  const follower = document.getElementById('cursorFollower');

  if (!dot || !follower) return;

  document.addEventListener('mousemove', (e) => {
    dot.style.left = `${e.clientX}px`;
    dot.style.top = `${e.clientY}px`;

    follower.style.left = `${e.clientX}px`;
    follower.style.top = `${e.clientY}px`;
  });

  const hoverElements = document.querySelectorAll('a, button, input, .glass-card, .switch');
  hoverElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('cursor-hover');
      playTone(440, 'sine', 0.04, 0.02);
    });
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('cursor-hover');
    });
  });
}

/* ==========================================================================
   BACKGROUND FX CONTROLLER WIDGET
   ========================================================================== */
function initBgWidgetControls() {
  const toggleBtn = document.getElementById('bgWidgetToggle');
  const panel = document.getElementById('bgWidgetPanel');
  const closeBtn = document.getElementById('closeWidgetBtn');

  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('active');
    playTone(520, 'triangle', 0.1, 0.04);
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      panel.classList.remove('active');
    });
  }

  // Mode Buttons
  const modeBtns = panel.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode');

      if (window.canvasEngine) {
        window.canvasEngine.setMode(mode);
      }
      playCyberChime();
    });
  });

  // Speed Slider
  const speedRange = document.getElementById('speedRange');
  const speedVal = document.getElementById('speedVal');
  if (speedRange) {
    speedRange.addEventListener('input', (e) => {
      const val = e.target.value;
      if (speedVal) speedVal.textContent = `${val}x`;
      if (window.canvasEngine) window.canvasEngine.setSpeed(val);
    });
  }

  // Density Slider
  const densityRange = document.getElementById('densityRange');
  const densityVal = document.getElementById('densityVal');
  if (densityRange) {
    densityRange.addEventListener('input', (e) => {
      const val = e.target.value;
      if (densityVal) {
        densityVal.textContent = val < 60 ? 'Low' : (val > 110 ? 'High' : 'Normal');
      }
      if (window.canvasEngine) window.canvasEngine.setDensity(val);
    });
  }

  // Hyper Glow Toggle
  const pulseToggleBtn = document.getElementById('pulseToggleBtn');
  if (pulseToggleBtn) {
    let glowActive = true;
    pulseToggleBtn.addEventListener('click', () => {
      glowActive = !glowActive;
      if (glowActive) {
        pulseToggleBtn.classList.add('active');
        pulseToggleBtn.innerHTML = `<i data-lucide="zap"></i> Hyper Neon Active`;
      } else {
        pulseToggleBtn.classList.remove('active');
        pulseToggleBtn.innerHTML = `<i data-lucide="zap-off"></i> Glow Off`;
      }
      if (window.lucide) window.lucide.createIcons();
      if (window.canvasEngine) window.canvasEngine.setHyperGlow(glowActive);
      playTone(350, 'square', 0.08, 0.03);
    });
  }
}

/* ==========================================================================
   HERO STAT COUNTERS
   ========================================================================== */
function initHeroCounters() {
  const statNumbers = document.querySelectorAll('.stat-number');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.getAttribute('data-target'));
        animateCounter(entry.target, target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => observer.observe(el));
}

function animateCounter(element, targetVal) {
  let current = 0;
  const duration = 1500; // ms
  const stepTime = 30;
  const steps = duration / stepTime;
  const increment = targetVal / steps;

  const timer = setInterval(() => {
    current += increment;
    if (current >= targetVal) {
      element.textContent = targetVal;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, stepTime);
}

/* ==========================================================================
   LIVE IOT TELEMETRY FARM SIMULATOR
   ========================================================================== */
function initIoTSimulator() {
  // Telemetry State Variables
  let simState = {
    moisture: 75,
    temp: 28.5,
    ec: 1.8,
    aiHealth: 96,
    autoMode: true,
    pumpOn: true,
    mistOn: false,
    shadeOn: true,
    fanOn: true
  };

  // Chart Canvas Buffer
  const chartCanvas = document.getElementById('simChartCanvas');
  let chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;

  let historyData = {
    moisture: Array(40).fill(75),
    temp: Array(40).fill(28.5),
    ec: Array(40).fill(1.8)
  };

  // Switch Listeners
  const pumpSwitch = document.getElementById('pumpSwitch');
  const mistSwitch = document.getElementById('mistSwitch');
  const shadeSwitch = document.getElementById('shadeSwitch');
  const fanSwitch = document.getElementById('fanSwitch');
  const autoModeBtn = document.getElementById('autoModeBtn');
  const resetSimBtn = document.getElementById('resetSimBtn');

  if (pumpSwitch) {
    pumpSwitch.addEventListener('change', (e) => {
      simState.pumpOn = e.target.checked;
      playTone(simState.pumpOn ? 600 : 300, 'sine', 0.1, 0.04);
    });
  }

  if (mistSwitch) {
    mistSwitch.addEventListener('change', (e) => {
      simState.mistOn = e.target.checked;
      playTone(simState.mistOn ? 650 : 320, 'sine', 0.1, 0.04);
    });
  }

  if (shadeSwitch) {
    shadeSwitch.addEventListener('change', (e) => {
      simState.shadeOn = e.target.checked;
      playTone(480, 'sine', 0.1, 0.04);
    });
  }

  if (fanSwitch) {
    fanSwitch.addEventListener('change', (e) => {
      simState.fanOn = e.target.checked;
      playTone(400, 'sine', 0.1, 0.04);
    });
  }

  if (autoModeBtn) {
    autoModeBtn.addEventListener('click', () => {
      simState.autoMode = !simState.autoMode;
      if (simState.autoMode) {
        autoModeBtn.classList.add('active');
        autoModeBtn.innerHTML = `<i data-lucide="bot"></i> ระบบ AI อัตโนมัติ: ON`;
      } else {
        autoModeBtn.classList.remove('active');
        autoModeBtn.innerHTML = `<i data-lucide="bot"></i> ระบบ AI อัตโนมัติ: MANUAL`;
      }
      if (window.lucide) window.lucide.createIcons();
      playCyberChime();
    });
  }

  if (resetSimBtn) {
    resetSimBtn.addEventListener('click', () => {
      simState.moisture = 75;
      simState.temp = 28.5;
      simState.ec = 1.8;
      simState.aiHealth = 96;
      playTone(700, 'triangle', 0.12, 0.05);
    });
  }

  // Telemetry Loop (updates every 1.5 seconds)
  setInterval(() => {
    // 1. Calculate values based on actuator switches & auto mode
    if (simState.autoMode) {
      if (simState.moisture < 65 && !simState.pumpOn) {
        simState.pumpOn = true;
        if (pumpSwitch) pumpSwitch.checked = true;
      } else if (simState.moisture > 85 && simState.pumpOn) {
        simState.pumpOn = false;
        if (pumpSwitch) pumpSwitch.checked = false;
      }

      if (simState.temp > 30.0 && !simState.mistOn) {
        simState.mistOn = true;
        if (mistSwitch) mistSwitch.checked = true;
      } else if (simState.temp < 27.0 && simState.mistOn) {
        simState.mistOn = false;
        if (mistSwitch) mistSwitch.checked = false;
      }
    }

    // Effect of actuators
    if (simState.pumpOn) simState.moisture = Math.min(95, simState.moisture + 1.2);
    else simState.moisture = Math.max(40, simState.moisture - 0.8);

    if (simState.mistOn) simState.temp = Math.max(24.0, simState.temp - 0.3);
    else simState.temp = Math.min(36.0, simState.temp + 0.2);

    // Random micro fluctuation
    simState.moisture += (Math.random() - 0.5) * 0.8;
    simState.temp += (Math.random() - 0.5) * 0.2;
    simState.ec += (Math.random() - 0.5) * 0.04;

    simState.moisture = Math.max(30, Math.min(99, simState.moisture));
    simState.temp = Math.max(20, Math.min(42, simState.temp));
    simState.ec = Math.max(0.8, Math.min(3.2, simState.ec));

    // Update DOM Display
    updateGaugeUI(simState);

    // Push into history data chart
    historyData.moisture.push(simState.moisture);
    historyData.moisture.shift();

    historyData.temp.push(simState.temp);
    historyData.temp.shift();

    historyData.ec.push(simState.ec * 30); // Scaled for chart visual
    historyData.ec.shift();

    drawTelemetryChart(chartCtx, chartCanvas, historyData);

  }, 1200);
}

function updateGaugeUI(simState) {
  const moistureVal = document.getElementById('moistureVal');
  const moistureGauge = document.getElementById('moistureGauge');
  if (moistureVal && moistureGauge) {
    const val = Math.round(simState.moisture);
    moistureVal.textContent = val;
    moistureGauge.style.setProperty('--percent', val);
  }

  const tempVal = document.getElementById('tempVal');
  const tempGauge = document.getElementById('tempGauge');
  if (tempVal && tempGauge) {
    const val = simState.temp.toFixed(1);
    tempVal.textContent = val;
    tempGauge.style.setProperty('--percent', Math.round((simState.temp / 45) * 100));
  }

  const ecVal = document.getElementById('ecVal');
  const ecGauge = document.getElementById('ecGauge');
  if (ecVal && ecGauge) {
    const val = simState.ec.toFixed(1);
    ecVal.textContent = val;
    ecGauge.style.setProperty('--percent', Math.round((simState.ec / 3.0) * 100));
  }
}

function drawTelemetryChart(ctx, canvas, history) {
  if (!ctx || !canvas) return;

  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = canvas.offsetHeight;

  ctx.clearRect(0, 0, w, h);

  // Draw Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;

  for (let y = 0; y < h; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const pointsCount = history.moisture.length;
  const stepX = w / (pointsCount - 1);

  // Draw Moisture Line (Emerald)
  drawLineSeries(ctx, history.moisture, stepX, h, 100, '#00FF87');
  // Draw Temp Line (Red)
  drawLineSeries(ctx, history.temp, stepX, h, 50, '#f87171');
  // Draw EC Line (Yellow)
  drawLineSeries(ctx, history.ec, stepX, h, 100, '#facc15');
}

function drawLineSeries(ctx, data, stepX, h, maxVal, color) {
  ctx.save();
  ctx.beginPath();

  for (let i = 0; i < data.length; i++) {
    const x = i * stepX;
    const norm = data[i] / maxVal;
    const y = h - (norm * (h - 20) + 10);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();
}

/* ==========================================================================
   MODULE DETAILS MODAL DRAWER
   ========================================================================== */
const moduleData = {
  1: {
    num: "MODULE 01",
    title: "IoT, Sensors & Smart Microcontrollers",
    desc: "ศึกษาการต่อวงจร ออกแบบเซนเซอร์วัดค่าสภาวะแวดล้อมทางการเกษตร การใช้ไมโครคอนโทรลเลอร์ ESP32 และเครือข่ายสื่อสารไร้สายระยะไกล LoRaWAN",
    topics: [
      "สถาปัตยกรรมระบบ IoT สำหรับสมาร์ตฟาร์ม (Edge to Cloud)",
      "การปรับแต่งเซนเซอร์ความชื้นดิน, อุณหภูมิ, EC, NPK และ ค่าแสง Lux",
      "การเขียนโปรแกรม ESP32 ด้วย C++ / MicroPython",
      "การสื่อสาร LoRaWAN, NB-IoT และโปรโตคอล MQTT เชื่อมต่อบอร์ด",
      "การทำระบบประหยัดพลังงาน Solar Powered IoT Node"
    ],
    tools: ["ESP32", "LoRaWAN Gateway", "MQTT Broker", "Node-RED", "Arduino IDE"],
    outcomes: "นักศึกษาสามารถออกแบบและสร้างกล่องเซนเซอร์ IoT ไร้สายใช้งานกลางแจ้งได้ด้วยตนเอง พร้อมส่งข้อมูลเข้า Cloud Dashboard ได้ทันที"
  },
  2: {
    num: "MODULE 02",
    title: "AI & Computer Vision for Plant Diagnostics",
    desc: "เรียนรู้การใช้ปัญญาประดิษฐ์ (AI) ในการวิเคราะห์ภาพถ่ายพืช ตรวจจับโรคแมลงศัตรูพืช และประเมินผลผลิตแม่นยำสูง",
    topics: [
      "การประมวลผลภาพดิจิทัล (Digital Image Processing) ทางการเกษตร",
      "การเทรน Deep Learning Model ด้วย YOLOv8 และ PyTorch",
      "ระบบคัดแยกเกรดผลไม้และจำแนกโรคพืชจากใบอัตโนมัติ",
      "การใช้งาน Edge AI Camera (เช่น Raspberry Pi + Coral TPU)",
      "การบูรณาการ AI เข้ากับไลน์การผลิตและบรรจุภัณฑ์"
    ],
    tools: ["Python", "YOLOv8", "OpenCV", "TensorFlow", "Raspberry Pi 5"],
    outcomes: "สร้างโมเดล AI ตรวจจับโรคพืชเฉพาะถิ่น และระบบคัดเกรดผลผลิตอัตโนมัติได้อย่างมืออาชีพ"
  },
  3: {
    num: "MODULE 03",
    title: "Agricultural Robotics & Drone Precision",
    desc: "การใช้โดรนเพื่อการเกษตร การวิเคราะห์ดัชนีพืชพรรณ NDVI และการตั้งโปรแกรมหุ่นยนต์ฟาร์มอัตโนมัติ",
    topics: [
      "การวางแผนเส้นทางบินฉีดพ่นและสแกนพื้นที่ด้วยโดรนไร้คนขับ",
      "การประมวลผลภาพถ่าย Multispectral / Thermal Imaging",
      "การคำนวณดัชนีความสมบูรณ์พืช (NDVI, NDRE) วางแผนใส่ปุ๋ยเฉพาะจุด",
      "การเขียนโปรแกรมควบคุมหุ่นยนต์สำรวจแปลงด้วย ROS 2",
      "กฎหมายและการบินโดรนอย่างปลอดภัยตามมาตรฐานกรมการบินพลเรือน"
    ],
    tools: ["DJI Agras", "Pix4Dfields", "QGIS", "ROS 2", "Thermal Cameras"],
    outcomes: "สามารถบินโดรนสแกนแปลง วิเคราะห์แผนที่การใส่ปุ๋ยแม่นยำ และเขียนโปรแกรมหุ่นยนต์ฟาร์มได้"
  },
  4: {
    num: "MODULE 04",
    title: "Hydroponics & Automated Greenhouse PLC",
    desc: "วิศวกรรมการปลูกพืชไร้ดินในโรงเรือนปิดอัจฉริยะ การควบคุมระบบผสมสารอาหารและสภาพแวดล้อมด้วย PLC",
    topics: [
      "การออกแบบระบบ Hydroponics, Aeroponics และ Plant Factory (PFAL)",
      "การผสมและเติมสารอาหาร A-B อัตโนมัติควบคุมค่า pH / EC",
      "การใช้โปรแกรมเมเบิลลอจิกคอนโทรลเลอร์ (PLC) ระดับอุตสาหกรรม",
      "การควบคุมระบบพัดลม Evap, สแลนพรางแสง และไฟ LED ปลูกพืช",
      "เทคโนโลยีการลดการใช้พลังงานในโรงเรือนปิด"
    ],
    tools: ["Industrial PLC", "HMI Touchscreen", "EC/pH Controllers", "Plant LED Grow Lights"],
    outcomes: "สามารถออกแบบ บริหารจัดการ และบำรุงรักษาโรงเรือนปิดอัจฉริยะมาตรฐานโรงงานอุตสาหกรรมได้"
  },
  5: {
    num: "MODULE 05",
    title: "Agri-Data Analytics & Digital Enterprise",
    desc: "การนำข้อมูลขนาดใหญ่ (Big Data) ฟาร์มมาทำนายตลาด ประเมินความเสี่ยง และการบริหารธุรกิจเกษตรดิจิทัล",
    topics: [
      "การบริหารจัดการฐานข้อมูลฟาร์มขนาดใหญ่ (Agri-Cloud Data)",
      "การสร้าง Dashboard สำหรับผู้บริหารด้วย Power BI และ Grafana",
      "การทำนายราคาผลผลิตและสภาวะตลาดพืชเศรษฐกิจ",
      "การบริหารจัดการ Supply Chain และระบบตรวจสอบย้อนกลับ (Traceability)",
      "แนวทางการระดมทุนและการตั้งบริษัท Agri-Tech Startup"
    ],
    tools: ["Power BI", "Grafana", "PostgreSQL", "Python Pandas", "Agri-ERP"],
    outcomes: "พร้อมก้าวสู่การเป็นผู้บริหารฟาร์มยุคใหม่ หรือผู้ก่อตั้งธุรกิจ Agri-Startup ที่พร้อมขยายสเกล"
  },
  6: {
    num: "MODULE 06",
    title: "Capstone Smart Farm Project",
    desc: "โปรเจกต์จบภาคปฏิบัติ สร้างระบบสมาร์ตฟาร์มจริง ร่วมกับแปลงใหญ่หรือองค์กรพันธมิตรชั้นนำ",
    topics: [
      "การสำรวจความต้องการและโจทย์จริงจากฟาร์มเกษตรกรแปลงใหญ่",
      "การออกแบบและติดตั้งระบบครบวงจร (Hardware, Software, Cloud)",
      "การทดสอบประสิทธิภาพและการคำนวณความคุ้มค่าทางเศรษฐศาสตร์ (ROI)",
      "การนำเสนอผลงานต่อคณะกรรมการ experts และนักลงทุน"
    ],
    tools: ["Full Tech Stack", "Field Deployment Kits", "Cloud Infrastructure"],
    outcomes: "ได้ผลงานชิ้นงานจริงสำหรับแฟ้มสะสมผลงาน (Portfolio) พร้อมลงมือปฏิบัติงานจริงในภาคอุตสาหกรรม"
  }
};

function initModuleModals() {
  const moduleModal = document.getElementById('moduleModal');
  const closeBtn = document.getElementById('closeModuleModal');
  const closeActionBtns = document.querySelectorAll('.close-modal-action');
  const viewBtns = document.querySelectorAll('.view-module-btn');

  if (!moduleModal) return;

  viewBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.module-card');
      if (!card) return;
      const modId = card.getAttribute('data-module');
      const data = moduleData[modId];
      if (!data) return;

      // Populate Modal Content
      document.getElementById('modalModuleNum').textContent = data.num;
      document.getElementById('modalModuleTitle').textContent = data.title;
      document.getElementById('modalModuleDesc').textContent = data.desc;
      document.getElementById('modalOutcomesText').textContent = data.outcomes;

      const topicsList = document.getElementById('modalTopicsList');
      topicsList.innerHTML = data.topics.map(t => `<li>${t}</li>`).join('');

      const toolsWrapper = document.getElementById('modalToolsTags');
      toolsWrapper.innerHTML = data.tools.map(t => `<span class="module-tags">${t}</span>`).join('');

      moduleModal.classList.add('active');
      playCyberChime();
    });
  });

  const closeModal = () => {
    moduleModal.classList.remove('active');
    playTone(300, 'sine', 0.08, 0.03);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  closeActionBtns.forEach(btn => btn.addEventListener('click', closeModal));

  moduleModal.addEventListener('click', (e) => {
    if (e.target === moduleModal) closeModal();
  });
}

/* ==========================================================================
   ADMISSION MODAL & FORM VALIDATION
   ========================================================================== */
function initAdmissionModal() {
  const admissionModal = document.getElementById('admissionModal');
  const openModalBtns = document.querySelectorAll('.open-modal-btn');
  const closeBtn = document.getElementById('closeAdmissionModal');
  const form = document.getElementById('admissionForm');
  const successScreen = document.getElementById('formSuccessScreen');
  const resetFormBtn = document.getElementById('resetFormBtn');

  if (!admissionModal) return;

  openModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // Close module modal if open
      const moduleModal = document.getElementById('moduleModal');
      if (moduleModal) moduleModal.classList.remove('active');

      admissionModal.classList.add('active');
      playCyberChime();
    });
  });

  const closeModal = () => {
    admissionModal.classList.remove('active');
    playTone(300, 'sine', 0.08, 0.03);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  admissionModal.addEventListener('click', (e) => {
    if (e.target === admissionModal) closeModal();
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Show success screen inside modal
      form.classList.add('hidden');
      if (successScreen) successScreen.classList.remove('hidden');

      // Celebration SFX & Canvas Pulse
      playCyberChime();
      setTimeout(() => playTone(880, 'sine', 0.3, 0.08), 200);

      if (window.canvasEngine) {
        window.canvasEngine.triggerClickPulse(window.innerWidth / 2, window.innerHeight / 2);
      }
    });
  }

  if (resetFormBtn) {
    resetFormBtn.addEventListener('click', () => {
      if (form) {
        form.reset();
        form.classList.remove('hidden');
      }
      if (successScreen) successScreen.classList.add('hidden');
      closeModal();
    });
  }
}
