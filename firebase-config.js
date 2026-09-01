/**
 * Firebase Configuration & Durian Storage Engine
 * Handles Firebase Authentication, Firestore/Realtime DB Sync, and LocalStorage Fallback.
 */

// Default Baseline Durian Dataset (5 Varieties)
const INITIAL_DURIAN_DATA = {
  kanyao: {
    id: "kanyao",
    nameTh: "ทุเรียนก้านยาว",
    nameEn: "Kan Yao Durian",
    tagline: "ราชาแห่งทุเรียนพรีเมียม ก้านยาวเป็นเอกลักษณ์ เนื้อเนียนนุ่มละมุนลิ้น",
    image: "assets/kanyao.png",
    priceRange: "350 - 600 บาท/กก. (เกรดพรีเมียมอาจสูงถึง 2,000+ บาท)",
    sweetness: 9,
    creaminess: 10,
    aroma: 7,
    fleshThickness: 8,
    harvestDays: "120 - 135 วัน",
    season: "พฤษภาคม - มิถุนายน",
    origin: "นนทบุรี / จันทบุรี / ตราด",
    fruitWeight: "2.0 - 4.0 กก.",
    fleshColor: "สีเหลืองทองเนียนนุ่ม สวยงามเป็นธรรมชาติ",
    seedSize: "เมล็ดกลมปานกลาง-ใหญ่",
    description: "ทุเรียนก้านยาว ถือเป็นหนึ่งในสายพันธุ์ทุเรียนระดับพรีเมียมที่มีราคาสูงและเป็นที่ต้องการอย่างมาก จุดเด่นตามชื่อคือมีก้านผลที่ยาวกว่าพันธุ์อื่นอย่างเห็นได้ชัด เนื้อสัมผัสมีความเนียนละเอียด ละมุนลิ้น คล้ายคัสตาร์ดหรือครีม รสชาติหวานมันกลมกล่อมอย่างลงตัว ไม่เละง่ายเมื่อสุกจัด",
    characteristics: [
      "ก้านผลยาวแข็งแรง (ยาวประมาณ 10-15 ซม.)",
      "ผลทรงกลมรีเกือบสมบูรณ์ หนามถี่ขนาดเล็ก-กลาง",
      "เนื้อเนียนละเอียด ปราศจากเส้นใย รสชาติหวานมันลึกล้ำ",
      "กลิ่นหอมละมุนไม่ฉุนจัด ทานง่ายแม้ผู้เริ่มต้น"
    ],
    selectionTips: "เลือกผลที่มีก้านยาวสมบูรณ์ เคาะแล้วฟังเสียงหลวมปานกลาง หนามแห้งสีน้ำตาลเข้ม กลิ่นหอมหวานอ่อนๆ แสดงว่าสุกกำลังดีพร้อมรับประทาน",
    recommendedFor: "ผู้ที่ชื่นชอบทุเรียนรสชาติหวานมันระดับพรีเมียม เนื้อเนียนนุ่มแบบเนื้อครีม ไม่ชอบเนื้อเละ"
  },

  monthong: {
    id: "monthong",
    nameTh: "ทุเรียนหมอนทอง",
    nameEn: "Monthong Durian",
    tagline: "หมอนทองยอดนิยมครองใจมหาชน เนื้อหนา หวานมัน กลิ่นหอมปานกลาง",
    image: "assets/monthong.png",
    priceRange: "160 - 250 บาท/กก.",
    sweetness: 8.5,
    creaminess: 9,
    aroma: 6,
    fleshThickness: 10,
    harvestDays: "120 - 130 วัน",
    season: "เมษายน - กรกฎาคม",
    origin: "ระยอง / จันทบุรี / ตราด / ชุมพร",
    fruitWeight: "3.0 - 5.5 กก.",
    fleshColor: "สีเหลืองนวลสวย เนื้อหนาแห้งกำลังดี",
    seedSize: "เมล็ดลีบเล็ก ได้เนื้อเยอะ",
    description: "ทุเรียนหมอนทอง เป็นสายพันธุ์ทุเรียนที่เป็นที่นิยมมากที่สุดทั้งในไทยและส่งออกต่างประเทศ มีฉายาว่า 'หมอนทอง' เนื่องจากรูปร่างผลและพูเนื้อที่หนานุ่มเหมือนหมอนทองคำ จุดเด่นคือเนื้อหนามีเมล็ดลีบ ทำให้ได้เนื้อเต็มคำ รสชาติหวานมันกลมกล่อม กลิ่นหอมปานกลางไม่ฉุนเกินไป",
    characteristics: [
      "ผลขนาดใหญ่ ทรงยาวรีก้นแหลม มีพูชัดเจน",
      "เนื้อหนามาก เมล็ดลีบเล็ก เปอร์เซ็นต์เนื้อสูง",
      "รสชาติหวานมันกำลังดี เนื้อแห้งไม่ติดมือเมื่อสุกพอดี",
      "กลิ่นหอมนุ่มนวล เก็บรักษาไว้ได้นานกว่าพันธุ์อื่น"
    ],
    selectionTips: "สังเกตร่องพูชัดเจน ปลายหนามสีแห้งน้ำตาล เมื่อกดเนื้อบริเวณพูจะมีความยืดหยุ่นเล็กน้อย กลิ่นหอมหวานปานกลาง",
    recommendedFor: "ทุกคนที่ชอบทานทุเรียนเนื้อเยอะเต็มคำ รสหวานมัน ทานง่าย กลิ่นไม่แรงเกินไป"
  },

  kradum: {
    id: "kradum",
    nameTh: "ทุเรียนกระดุม (กระดุมทอง)",
    nameEn: "Kradum Thong Durian",
    tagline: "ทุเรียนผลเล็กทรงกระดุม สุกไวก่อนใคร เนื้อสีเหลืองเข้ม รสหวานทานง่าย",
    image: "assets/kradum.png",
    priceRange: "120 - 180 บาท/กก.",
    sweetness: 8,
    creaminess: 7.5,
    aroma: 6.5,
    fleshThickness: 7.5,
    harvestDays: "90 - 100 วัน",
    season: "มีนาคม - เมษายน (ออกก่อนพันธุ์อื่น)",
    origin: "จันทบุรี / ระยอง",
    fruitWeight: "1.5 - 2.5 กก.",
    fleshColor: "สีเหลืองเข้มสดใส สวยงามน่ารับประทาน",
    seedSize: "เมล็ดค่อนข้างใหญ่",
    description: "ทุเรียนกระดุม หรือ กระดุมทอง เป็นทุเรียนพันธุ์เบาที่ออกผลผลิตและสุกไวก่อนสายพันธุ์อื่นในฤดูกาล ผลมีขนาดเล็กถึงกลาง รูปร่างกลมแป้นคล้ายกระดุมเสื้อ เนื้อสีเหลืองทองเข้มสวยงาม รสชาติหวานนุ่ม เนื้อละเอียด เหมาะสำหรับผู้ที่ต้องการลิ้มรสทุเรียนต้อนรับต้นฤดูกาล",
    characteristics: [
      "ผลขนาดเล็กกระทัดรัด รูปร่างกลมแป้นคล้ายกระดุม",
      "หนามเล็กสั้น ถี่ ละเอียดทั่วทั้งผล",
      "เนื้อสีเหลืองทองสดใส เนื้อนุ่มละเอียด ทานง่าย",
      "สุกเร็ว ใช้เวลาปลูกและเก็บเกี่ยวสั้นที่สุด"
    ],
    selectionTips: "เลือกผลที่มีน้ำหนักเบา-ปานกลาง ร่องพูกลึงสวยงาม กลิ่นหอมหวานชัดเจน เคาะหลวมเบาๆ สุกเร็วควรรับประทานทันที",
    recommendedFor: "ผู้ที่ชอบทุเรียนผลเล็กทานหมดง่าย รสหวานนุ่ม และผู้ที่รอทานทุเรียนต้นฤดูกาล"
  },

  puangmanee: {
    id: "puangmanee",
    nameTh: "ทุเรียนพวงมณี",
    nameEn: "Puang Manee Durian",
    tagline: "จิ๋วแต่แจ๋ว! ทุเรียนเนื้อสีส้มทอง รสหวานจัดมันเข้มข้น กลิ่นหอมเตะจมูก",
    image: "assets/puangmanee.png",
    priceRange: "180 - 280 บาท/กก.",
    sweetness: 10,
    creaminess: 8.5,
    aroma: 9,
    fleshThickness: 7,
    harvestDays: "100 - 110 วัน",
    season: "เมษายน - พฤษภาคม",
    origin: "จันทบุรี / ตราด / ระยอง",
    fruitWeight: "1.2 - 2.0 กก.",
    fleshColor: "สีส้มทองเข้มข้น (Deep Golden Orange) โดดเด่นไม่เหมือนใคร",
    seedSize: "เมล็ดปานกลางถึงใหญ่",
    description: "ทุเรียนพวงมณี เป็นทุเรียนพื้นบ้านผลขนาดเล็กที่ติดผลเป็นพวง ได้รับความนิยมสูงมากในปัจจุบันจากเอกลักษณ์เนื้อสีส้มทองเข้มสวยงาม มีรสชาติหวานจัด เข้มข้น หอมมันสะใจ กลิ่นหอมเข้มข้นเตะจมูก ถึงแม้ผลจะเล็กและเมล็ดค่อนข้างใหญ่ แต่รสชาติและความเข้มข้นถือว่าโดดเด่นติดอันดับต้นๆ",
    characteristics: [
      "ผลขนาดเล็ก มักติดเป็นพวง 2-4 ผลต่อกิ่ง",
      "เนื้อสีส้มทองเข้มสวยงามสะดุดตา",
      "รสชาติหวานจัด เข้มข้นลึกซึ้ง หอมมันชัดเจน",
      "กลิ่นหอมเข้มข้นอันเป็นเอกลักษณ์เฉพาะตัว"
    ],
    selectionTips: "เลือกผลที่มีสีหนามเข้ม กลิ่นหอมฟุ้งชัดเจน เคาะได้ยินเสียงโปร่งพูแยก รับประทานช่วงสุกพอดีจะได้รสชาติหวานจัด",
    recommendedFor: "คอทุเรียนที่ชื่นชอบทุเรียนรสจัด หวานเข้มข้น สีสันสวยงาม และกลิ่นหอมฟุ้ง"
  },

  kobchainam: {
    id: "kobchainam",
    nameTh: "ทุเรียนกบชายน้ำ",
    nameEn: "Kob Chai Nam Durian",
    tagline: "ทุเรียนโบราณสายพันธุ์ตำนาน หายากระดับมรดก เนื้อคัสตาร์ดหอมหวานนุ่มลึก",
    image: "assets/kobchainam.png",
    priceRange: "500 - 1,500+ บาท/กก. (หายาก ทรงคุณค่า)",
    sweetness: 9.5,
    creaminess: 9.5,
    aroma: 8.5,
    fleshThickness: 8.5,
    harvestDays: "115 - 125 วัน",
    season: "พฤษภาคม - มิถุนายน",
    origin: "นนทบุรี / ปราจีนบุรี",
    fruitWeight: "2.0 - 3.5 กก.",
    fleshColor: "สีเหลืองตองอ่อน เนียนละเอียดเหมือนคัสตาร์ด",
    seedSize: "เมล็ดลีบเล็กถึงปานกลาง",
    description: "ทุเรียนกบชายน้ำ เป็นทุเรียนโบราณตระกูลกบที่ดั้งเดิมเติบโตบริเวณริมตลิ่งหรือชายน้ำ มีความทนทานต่อสภาพแวดล้อมและน้ำท่วมขังเป็นเลิศ จัดเป็นหนึ่งในทุเรียนหายากและมีมูลค่าสูง เนื้อสัมผัสเนียนนุ่มละเอียดเหมือนเนื้อเนยหรือคัสตาร์ด รสชาติหวานมันนุ่มลึก ไม่ติดขม กลิ่นหอมละมุนคลาสสิก",
    characteristics: [
      "ต้นพันธุ์โบราณทนทาน แหล่งกำเนิดริมน้ำนนทบุรี-ปราจีนบุรี",
      "ผลทรงกลมรี หนามงุ้มเล็กน้อยคล้ายขาโบกของกบ",
      "เนื้อเนียนละมุน คล้ายคัสตาร์ด ละลายในปาก",
      "รสชาติหวานมันกลมกล่อม ลุ่มลึก ไม่หวานแหลมบาดคอ"
    ],
    selectionTips: "เลือกผลทรงสมบูรณ์ ก้านแข็ง หนามแห้งสีน้ำตาลปนเขียว กลิ่นหอมหวานนุ่มนวล เป็นสายพันธุ์หายากที่ต้องจองล่วงหน้า",
    recommendedFor: "นักชิมทุเรียนสายแสวงหา (Durian Connoisseur) ที่ต้องการสัมผัสรสชาติทุเรียนโบราณชั้นสูง"
  }
};

// Storage Key
const DURIAN_STORAGE_KEY = "durian_expo_data_v1";

// Firebase Web App Configuration
window.firebaseConfig = {
  apiKey: "AIzaSyD_CUkSiqoX2szxgZuLTqdsfR20LETYOF4",
  authDomain: "smartfarm-kmitl.firebaseapp.com",
  databaseURL: "https://smartfarm-kmitl-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartfarm-kmitl",
  storageBucket: "smartfarm-kmitl.firebasestorage.app",
  messagingSenderId: "819207526985",
  appId: "1:819207526985:web:0aca2227ba7ab28241fd98",
  measurementId: "G-R2EMB9PXNS"
};

// Initialize Firebase SDK if scripts are loaded
if (window.firebase && !window.firebase.apps.length) {
  window.firebase.initializeApp(window.firebaseConfig);
  console.log("Firebase App initialized with smartfarm-kmitl config.");
}

/**
 * Data Access Layer Functions
 */
class DurianDataManager {
  constructor() {
    this.initLocalStorage();
  }

  initLocalStorage() {
    if (!localStorage.getItem(DURIAN_STORAGE_KEY)) {
      localStorage.setItem(DURIAN_STORAGE_KEY, JSON.stringify(INITIAL_DURIAN_DATA));
    }
  }

  getAllDurians() {
    try {
      const stored = localStorage.getItem(DURIAN_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return { ...INITIAL_DURIAN_DATA, ...data };
      }
    } catch (e) {
      console.warn("Error reading from LocalStorage, using fallback data:", e);
    }
    return INITIAL_DURIAN_DATA;
  }

  getDurianById(id) {
    const all = this.getAllDurians();
    return all[id] || INITIAL_DURIAN_DATA[id] || null;
  }

  saveDurian(id, updatedFields) {
    const all = this.getAllDurians();
    if (!all[id]) {
      all[id] = { ...INITIAL_DURIAN_DATA[id] || {}, id };
    }
    all[id] = { ...all[id], ...updatedFields, updatedAt: new Date().toISOString() };
    localStorage.setItem(DURIAN_STORAGE_KEY, JSON.stringify(all));

    // Dispatch custom event for live page updates
    window.dispatchEvent(new CustomEvent("durianDataChanged", { detail: { id, data: all[id] } }));
    return all[id];
  }

  saveAllDurians(fullDataset) {
    localStorage.setItem(DURIAN_STORAGE_KEY, JSON.stringify(fullDataset));
    window.dispatchEvent(new CustomEvent("durianDataChanged", { detail: { data: fullDataset } }));
  }

  resetToDefaults() {
    localStorage.setItem(DURIAN_STORAGE_KEY, JSON.stringify(INITIAL_DURIAN_DATA));
    window.dispatchEvent(new CustomEvent("durianDataChanged", { detail: { data: INITIAL_DURIAN_DATA } }));
    return INITIAL_DURIAN_DATA;
  }
}

window.durianManager = new DurianDataManager();

// Firebase Auth Admin helper simulation & bindings
window.durianAuth = {
  isLoggedIn: () => {
    if (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
      return true;
    }
    return localStorage.getItem("durian_admin_session") === "true";
  },
  login: (email, password) => {
    // Standard Firebase Auth integration
    if (window.firebase && window.firebase.auth) {
      return window.firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          localStorage.setItem("durian_admin_session", "true");
          localStorage.setItem("durian_admin_email", email);
          return userCredential;
        })
        .catch((err) => {
          // Fallback to local admin credentials if Firebase Auth User is not yet created in console
          if ((email === "admin@durian.com" || email === "admin") && password === "admin1234") {
            localStorage.setItem("durian_admin_session", "true");
            localStorage.setItem("durian_admin_email", email);
            return Promise.resolve({ user: { email } });
          }
          throw err;
        });
    }
    // Fallback authentication for quick setup/demo
    if ((email === "admin@durian.com" || email === "admin") && password === "admin1234") {
      localStorage.setItem("durian_admin_session", "true");
      localStorage.setItem("durian_admin_email", email);
      return Promise.resolve({ user: { email } });
    } else {
      return Promise.reject(new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง (ทดลองใช้: admin@durian.com / admin1234)"));
    }
  },
  logout: () => {
    if (window.firebase && window.firebase.auth) {
      window.firebase.auth().signOut();
    }
    localStorage.removeItem("durian_admin_session");
    localStorage.removeItem("durian_admin_email");
    window.location.reload();
  }
};
