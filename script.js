/**
 * Durian Website Main JavaScript Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  
  // Identify active page type
  const path = window.location.pathname.toLowerCase();
  
  if (path.includes("main.html") || path.endsWith("/") || path.endsWith("durian") || (!path.includes(".html") && !path.includes("admin"))) {
    initMainPage();
  } else if (path.includes("admindurian.html")) {
    initAdminPage();
  } else {
    initDetailPage();
  }
});

// Toast notification helper
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Global Navbar & Mobile Bottom Bar Handler
function initNavbar() {
  const currentPath = window.location.pathname.split("/").pop() || "main.html";
  const navLinks = document.querySelectorAll(".nav-link");
  const bottomTabs = document.querySelectorAll(".bottom-tab");

  const setActive = (elements) => {
    elements.forEach(link => {
      const href = link.getAttribute("href");
      if (href === currentPath || (currentPath === "" && href === "main.html")) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  };

  setActive(navLinks);
  setActive(bottomTabs);

  // Listen for storage changes across tabs
  window.addEventListener("durianDataChanged", (e) => {
    console.log("Data updated dynamically:", e.detail);
    const activePath = window.location.pathname.toLowerCase();
    if (activePath.includes("main.html")) {
      renderMainPageGrid();
    } else if (!activePath.includes("admindurian.html")) {
      initDetailPage();
    }
  });
}

/**
 * Main Summary Page (main.html) Controller
 */
let currentSearchTerm = "";
let currentFilter = "all";

function initMainPage() {
  const searchInput = document.getElementById("durianSearchInput");
  const filterBtns = document.querySelectorAll(".filter-btn");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchTerm = e.target.value.toLowerCase().trim();
      renderMainPageGrid();
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderMainPageGrid();
    });
  });

  renderMainPageGrid();
  renderComparisonTable();
}

function renderMainPageGrid() {
  const gridContainer = document.getElementById("durianGrid");
  if (!gridContainer) return;

  const durians = window.durianManager.getAllDurians();
  let list = Object.values(durians);

  // Apply Search Filter
  if (currentSearchTerm) {
    list = list.filter(item => 
      item.nameTh.toLowerCase().includes(currentSearchTerm) ||
      item.nameEn.toLowerCase().includes(currentSearchTerm) ||
      item.tagline.toLowerCase().includes(currentSearchTerm) ||
      item.description.toLowerCase().includes(currentSearchTerm)
    );
  }

  // Apply Category Filter Pills
  if (currentFilter === "sweet") {
    list = list.filter(item => item.sweetness >= 9);
  } else if (currentFilter === "cream") {
    list = list.filter(item => item.creaminess >= 9);
  } else if (currentFilter === "rare") {
    list = list.filter(item => item.id === "kobchainam" || item.id === "puangmanee" || item.id === "kanyao");
  } else if (currentFilter === "popular") {
    list = list.filter(item => item.id === "monthong" || item.id === "kanyao" || item.id === "kradum");
  }

  if (list.length === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <p style="font-size: 1.2rem;">ไม่พบข้อมูลสายพันธุ์ทุเรียนที่ตรงกับเงื่อนไขการค้นหา</p>
      </div>
    `;
    return;
  }

  const pageMap = {
    kanyao: "kanyao.html",
    monthong: "monthong.html",
    kradum: "kradum.html",
    puangmanee: "puangmanee.html",
    kobchainam: "kobchainam.html"
  };

  gridContainer.innerHTML = list.map(item => `
    <div class="durian-card" data-id="${item.id}">
      <div class="card-image-wrap">
        <img src="${item.image}" alt="${item.nameTh}" onerror="this.src='assets/hero_durian.png'">
        <span class="card-badge">${item.origin.split('/')[0]}</span>
      </div>
      <div class="card-body">
        <div class="card-header">
          <h3 class="card-title">${item.nameTh}</h3>
          <span class="card-subtitle">${item.nameEn}</span>
        </div>
        <p class="card-desc">${item.tagline}</p>
        
        <div class="flavor-meters">
          <div class="meter-item">
            <div class="meter-label"><span>หวาน</span><span>${item.sweetness}/10</span></div>
            <div class="meter-bar"><div class="meter-fill" style="width: ${item.sweetness * 10}%"></div></div>
          </div>
          <div class="meter-item">
            <div class="meter-label"><span>มัน/ครีม</span><span>${item.creaminess}/10</span></div>
            <div class="meter-bar"><div class="meter-fill" style="width: ${item.creaminess * 10}%"></div></div>
          </div>
          <div class="meter-item">
            <div class="meter-label"><span>ความหอม</span><span>${item.aroma}/10</span></div>
            <div class="meter-bar"><div class="meter-fill" style="width: ${item.aroma * 10}%"></div></div>
          </div>
          <div class="meter-item">
            <div class="meter-label"><span>ความหนาเนื้อ</span><span>${item.fleshThickness}/10</span></div>
            <div class="meter-bar"><div class="meter-fill" style="width: ${item.fleshThickness * 10}%"></div></div>
          </div>
        </div>

        <div class="card-footer">
          <span class="price-tag">🏷️ ${item.priceRange.split('(')[0]}</span>
          <a href="${pageMap[item.id] || '#'}" class="btn-detail">อ่านรายละเอียด ➔</a>
        </div>
      </div>
    </div>
  `).join('');
}

function renderComparisonTable() {
  const tableBody = document.getElementById("comparisonTableBody");
  if (!tableBody) return;

  const durians = Object.values(window.durianManager.getAllDurians());
  const pageMap = {
    kanyao: "kanyao.html",
    monthong: "monthong.html",
    kradum: "kradum.html",
    puangmanee: "puangmanee.html",
    kobchainam: "kobchainam.html"
  };

  tableBody.innerHTML = durians.map(d => `
    <tr>
      <td>
        <strong style="color: var(--text-main); font-size: 1.05rem;">
          <a href="${pageMap[d.id]}" style="color: inherit; text-decoration: none;">${d.nameTh}</a>
        </strong><br>
        <small style="color: var(--text-muted);">${d.nameEn}</small>
      </td>
      <td><span style="color: var(--gold-primary); font-weight:700;">${d.sweetness}</span> / 10</td>
      <td><span style="color: var(--gold-primary); font-weight:700;">${d.creaminess}</span> / 10</td>
      <td>${d.fleshColor}</td>
      <td>${d.harvestDays}</td>
      <td><span class="price-tag">${d.priceRange.split('(')[0]}</span></td>
      <td><a href="${pageMap[d.id]}" class="btn-detail" style="padding: 6px 14px; font-size: 0.78rem;">เข้าชม</a></td>
    </tr>
  `).join('');
}

/**
 * Individual Durian Detail Pages Controller
 */
function initDetailPage() {
  const path = window.location.pathname.toLowerCase();
  let durianId = null;

  if (path.includes("kanyao")) durianId = "kanyao";
  else if (path.includes("monthong")) durianId = "monthong";
  else if (path.includes("kradum")) durianId = "kradum";
  else if (path.includes("puangmanee")) durianId = "puangmanee";
  else if (path.includes("kobchainam")) durianId = "kobchainam";

  if (!durianId) return;

  const data = window.durianManager.getDurianById(durianId);
  if (!data) return;

  // Set Page Title
  document.title = `${data.nameTh} (${data.nameEn}) - ข้อมูลสายพันธุ์ทุเรียนไทย`;

  // Bind Dynamic Data to Detail Page Elements
  const elImage = document.getElementById("detailImage");
  const elTitle = document.getElementById("detailTitle");
  const elSubtitle = document.getElementById("detailSubtitle");
  const elTagline = document.getElementById("detailTagline");
  const elDesc = document.getElementById("detailDescription");
  const elPrice = document.getElementById("detailPrice");
  const elHarvest = document.getElementById("detailHarvest");
  const elWeight = document.getElementById("detailWeight");
  const elColor = document.getElementById("detailColor");
  const elSeed = document.getElementById("detailSeed");
  const elOrigin = document.getElementById("detailOrigin");
  const elTips = document.getElementById("detailTips");
  const elRec = document.getElementById("detailRec");
  const elCharList = document.getElementById("detailCharacteristics");

  if (elImage) elImage.src = data.image;
  if (elTitle) elTitle.textContent = data.nameTh;
  if (elSubtitle) elSubtitle.textContent = data.nameEn;
  if (elTagline) elTagline.textContent = data.tagline;
  if (elDesc) elDesc.textContent = data.description;
  if (elPrice) elPrice.textContent = data.priceRange;
  if (elHarvest) elHarvest.textContent = data.harvestDays;
  if (elWeight) elWeight.textContent = data.fruitWeight;
  if (elColor) elColor.textContent = data.fleshColor;
  if (elSeed) elSeed.textContent = data.seedSize;
  if (elOrigin) elOrigin.textContent = data.origin;
  if (elTips) elTips.textContent = data.selectionTips;
  if (elRec) elRec.textContent = data.recommendedFor;

  // Flavor meters
  const setMeter = (id, val) => {
    const fill = document.getElementById(`meter${id}`);
    const num = document.getElementById(`num${id}`);
    if (fill) fill.style.width = `${val * 10}%`;
    if (num) num.textContent = `${val}/10`;
  };

  setMeter("Sweetness", data.sweetness);
  setMeter("Creaminess", data.creaminess);
  setMeter("Aroma", data.aroma);
  setMeter("FleshThickness", data.fleshThickness);

  // Render characteristics list
  if (elCharList && data.characteristics) {
    elCharList.innerHTML = data.characteristics.map(c => `<li>${c}</li>`).join('');
  }
}

/**
 * Admin Dashboard Controller (Admindurian.html)
 */
function initAdminPage() {
  const loginModal = document.getElementById("loginModal");
  const adminContent = document.getElementById("adminContent");
  const loginForm = document.getElementById("loginForm");
  const btnLogout = document.getElementById("btnLogout");

  // Check login state
  if (window.durianAuth.isLoggedIn()) {
    if (loginModal) loginModal.style.display = "none";
    if (adminContent) adminContent.style.display = "block";
    setupAdminFormControls();
  } else {
    if (loginModal) loginModal.style.display = "flex";
    if (adminContent) adminContent.style.display = "none";
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const pass = document.getElementById("loginPassword").value;

      window.durianAuth.login(email, pass)
        .then(() => {
          showToast("เข้าสู่ระบบเรียบร้อยแล้ว!", "success");
          if (loginModal) loginModal.style.display = "none";
          if (adminContent) adminContent.style.display = "block";
          setupAdminFormControls();
        })
        .catch(err => {
          showToast(err.message, "error");
        });
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      window.durianAuth.logout();
    });
  }
}

let activeAdminTab = "monthong";

function setupAdminFormControls() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const adminForm = document.getElementById("adminForm");
  const btnReset = document.getElementById("btnResetDefaults");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeAdminTab = btn.getAttribute("data-tab");
      loadAdminFormValues(activeAdminTab);
    });
  });

  // Range Slider live output updates
  const ranges = ["editSweetness", "editCreaminess", "editAroma", "editFleshThickness"];
  ranges.forEach(rId => {
    const input = document.getElementById(rId);
    const output = document.getElementById(`${rId}Val`);
    if (input && output) {
      input.addEventListener("input", () => {
        output.textContent = `${input.value}/10`;
      });
    }
  });

  // File Upload image handler (Firebase Storage + Base64 Local Fallback)
  const fileInput = document.getElementById("editImageFile");
  const imageInput = document.getElementById("editImage");
  const imagePreview = document.getElementById("adminImagePreview");

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      showToast("กำลังประมวลผลรูปภาพ...", "success");

      // Attempt Firebase Storage Upload if SDK is ready
      if (window.firebase && window.firebase.storage) {
        try {
          const storageRef = window.firebase.storage().ref();
          const fileRef = storageRef.child(`durians/${Date.now()}_${file.name}`);
          fileRef.put(file).then((snapshot) => {
            return snapshot.ref.getDownloadURL();
          }).then((downloadURL) => {
            if (imageInput) imageInput.value = downloadURL;
            if (imagePreview) imagePreview.src = downloadURL;
            showToast("อัปโหลดรูปขึ้น Firebase Storage สำเร็จ!", "success");
          }).catch((err) => {
            console.warn("Firebase Storage upload fallback to Local Storage:", err);
            readAsDataURLFallback(file);
          });
          return;
        } catch(err) {
          console.warn("Firebase Storage Exception fallback:", err);
        }
      }

      readAsDataURLFallback(file);
    });
  }

  function readAsDataURLFallback(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const dataUrl = evt.target.result;
      if (imageInput) imageInput.value = dataUrl;
      if (imagePreview) imagePreview.src = dataUrl;
      showToast("แปลงรูปภาพเป็น DataURL สำเร็จ!", "success");
    };
    reader.readAsDataURL(file);
  }

  if (imageInput) {
    imageInput.addEventListener("input", () => {
      if (imagePreview) imagePreview.src = imageInput.value;
    });
  }

  // Submit Save
  if (adminForm) {
    adminForm.onsubmit = (e) => {
      e.preventDefault();
      saveAdminFormValues(activeAdminTab);
    };
  }

  if (btnReset) {
    btnReset.onclick = () => {
      if (confirm("คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น?")) {
        window.durianManager.resetToDefaults();
        loadAdminFormValues(activeAdminTab);
        showToast("รีเซ็ตข้อมูลเป็นค่าเริ่มต้นเรียบร้อยแล้ว!", "success");
      }
    };
  }

  loadAdminFormValues(activeAdminTab);
}

function loadAdminFormValues(durianId) {
  const data = window.durianManager.getDurianById(durianId);
  if (!data) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  setVal("editNameTh", data.nameTh);
  setVal("editNameEn", data.nameEn);
  setVal("editTagline", data.tagline);
  setVal("editPriceRange", data.priceRange);
  setVal("editOrigin", data.origin);
  setVal("editHarvestDays", data.harvestDays);
  setVal("editFruitWeight", data.fruitWeight);
  setVal("editFleshColor", data.fleshColor);
  setVal("editSeedSize", data.seedSize);
  setVal("editDescription", data.description);
  setVal("editSelectionTips", data.selectionTips);
  setVal("editRecommendedFor", data.recommendedFor);
  setVal("editImage", data.image);

  const preview = document.getElementById("adminImagePreview");
  if (preview) preview.src = data.image;

  // Set ranges
  const setRange = (id, val) => {
    const input = document.getElementById(id);
    const output = document.getElementById(`${id}Val`);
    if (input) input.value = val || 5;
    if (output) output.textContent = `${val || 5}/10`;
  };

  setRange("editSweetness", data.sweetness);
  setRange("editCreaminess", data.creaminess);
  setRange("editAroma", data.aroma);
  setRange("editFleshThickness", data.fleshThickness);

  // Set characteristics textarea (joined by newline)
  const charTextarea = document.getElementById("editCharacteristics");
  if (charTextarea && data.characteristics) {
    charTextarea.value = data.characteristics.join("\n");
  }
}

function saveAdminFormValues(durianId) {
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };

  const getNumVal = (id) => {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : 5;
  };

  const charRaw = getVal("editCharacteristics");
  const characteristics = charRaw.split("\n").map(s => s.trim()).filter(s => s.length > 0);

  const updatedFields = {
    nameTh: getVal("editNameTh"),
    nameEn: getVal("editNameEn"),
    tagline: getVal("editTagline"),
    priceRange: getVal("editPriceRange"),
    origin: getVal("editOrigin"),
    harvestDays: getVal("editHarvestDays"),
    fruitWeight: getVal("editFruitWeight"),
    fleshColor: getVal("editFleshColor"),
    seedSize: getVal("editSeedSize"),
    description: getVal("editDescription"),
    selectionTips: getVal("editSelectionTips"),
    recommendedFor: getVal("editRecommendedFor"),
    image: getVal("editImage"),
    sweetness: getNumVal("editSweetness"),
    creaminess: getNumVal("editCreaminess"),
    aroma: getNumVal("editAroma"),
    fleshThickness: getNumVal("editFleshThickness"),
    characteristics: characteristics
  };

  window.durianManager.saveDurian(durianId, updatedFields);
  showToast(`บันทึกข้อมูล ${updatedFields.nameTh} สำเร็จเรียบร้อย!`, "success");
}
