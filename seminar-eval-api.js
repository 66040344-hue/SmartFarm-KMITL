// seminar-eval-api.js
// ชั้นข้อมูลของระบบประเมินสัมมนา (Firebase Auth + Firestore)
// สิทธิ์จริงบังคับที่ firestore.rules — ไฟล์นี้ตรวจซ้ำเพื่อให้ข้อความแจ้งเตือนอ่านเข้าใจ
//
// Firestore:
//   evalUsers/{email}            { name, role: teacher|admin|both, order }
//   evalConfig/main              { locked: { "2026-11-10": true }, updatedAt, updatedBy }
//   evalScores/{sid}__{email}    { sid, email, name, date, items{c1..c8}, total, comment, updatedAt }

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, getDocs, setDoc, collection, query, where,
    writeBatch, onSnapshot, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./seminar-firebase-config.js";
import { SEMINAR } from "./seminar-eval-data.js";

// ใช้ app แยกชื่อ เพื่อไม่ให้ session ของหน้านี้ทับ session นักศึกษา/แอดมินของหน้าอื่นในโดเมนเดียวกัน
const fbApp = initializeApp(firebaseConfig, "seminar-eval");
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

const DOMAIN = SEMINAR.domain;
const STUDENT_RE = /^\d{8}@kmitl\.ac\.th$/i;      // บัญชีนักศึกษา = รหัส 8 หลัก
// ผู้ดูแลระบบถาวร (ข้อยกเว้นบัญชีนักศึกษา) — ดูแลระบบและทดลองให้คะแนนได้ (ไม่นับรวมในผลสรุป เพราะไม่อยู่ในรายชื่อ evalUsers)
// และลบคะแนนของตัวเองได้ ต้องตรงกับ isEvalSuperAdmin ใน firestore.rules
const SUPER_ADMINS = ["66040344@kmitl.ac.th"];
const MAX_ITEMS = 20;                              // รหัสข้อ c1..c20 — ต้องตรงกับ validEvalScore ใน firestore.rules
const ROLES = ["teacher", "admin", "both"];

const canGrade = u => u.role === "teacher" || u.role === "both";
const isAdmin = u => u.role === "admin" || u.role === "both";

function fail(msg) { const e = new Error(msg); e.userMessage = msg; throw e; }
function friendly(e) {
    if (e && e.userMessage) return e;
    const code = e && e.code || "";
    if (code === "permission-denied" || code === "firestore/permission-denied")
        e.userMessage = "ไม่มีสิทธิ์ทำรายการนี้ (หรือผู้ดูแลปิดรับคะแนนแล้ว)";
    else if (code === "unavailable" || code === "firestore/unavailable")
        e.userMessage = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
    return e;
}
async function guard(fn) { try { return await fn(); } catch (e) { throw friendly(e); } }

let me = null, authError = null;

async function authorize(u) {
    const email = String(u.email || "").toLowerCase();
    if (!email.endsWith("@" + DOMAIN)) fail(`ต้องใช้บัญชีของสถาบัน (@${DOMAIN}) เท่านั้น — บัญชีที่เลือก: ${email || "-"}`);
    if (SUPER_ADMINS.includes(email))
        return { id: email, email, name: u.displayName || email, role: "both", superAdmin: true };
    if (STUDENT_RE.test(email)) fail("ระบบนี้สำหรับอาจารย์และผู้ดูแลเท่านั้น บัญชีนักศึกษาเข้าใช้ไม่ได้");
    let snap = null;
    try { snap = await getDoc(doc(db, "evalUsers", email)); }
    catch (e) { if (e.code !== "permission-denied") throw friendly(e); }
    if (!snap || !snap.exists()) fail(`บัญชี ${email} ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาแจ้งผู้ดูแลระบบ`);
    const d = snap.data();
    return { id: email, email, name: d.name || u.displayName || email, role: d.role };
}

const ready = new Promise(resolve => {
    const off = onAuthStateChanged(auth, async u => {
        off();
        if (u) {
            try { me = await authorize(u); }
            catch (e) { authError = e.userMessage || "ตรวจสอบสิทธิ์ไม่สำเร็จ"; me = null; await signOut(auth); }
        }
        resolve();
    });
});

function needUser() { if (!me) fail("กรุณาเข้าสู่ระบบ"); return me; }
function needAdmin() { if (!isAdmin(needUser())) fail("เฉพาะผู้ดูแลระบบ"); }

function toRec(d) {
    const t = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate() : new Date();
    return { tid: d.email, sid: d.sid, items: d.items || {}, total: d.total, comment: d.comment || "", updatedAt: t.toISOString() };
}

async function readMain() {
    const s = await getDoc(doc(db, "evalConfig", "main"));
    return s.exists() ? s.data() : {};
}
async function readLocked() { return (await readMain()).locked || {}; }

// เกณฑ์ที่ผู้ดูแลแก้ไว้เก็บใน evalConfig/main.criteria — ถ้ายังไม่เคยแก้ใช้ค่าเริ่มต้นจาก seminar-eval-data.js
function criteriaOf(main) {
    const src = Array.isArray(main.criteria) && main.criteria.length ? main.criteria : SEMINAR.criteria;
    return src.map(s => ({
        id: s.id, name: s.name,
        items: s.items.map(i => ({ id: i.id, max: i.max, text: i.text })),
        max: s.items.reduce((a, i) => a + i.max, 0)
    }));
}

export const API = {
    mode: "firebase",

    async login() {
        const p = new GoogleAuthProvider();
        p.setCustomParameters({ hd: DOMAIN, prompt: "select_account" });
        let cred;
        try { cred = await signInWithPopup(auth, p); }
        catch (e) {
            if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") fail("ยกเลิกการเข้าสู่ระบบ");
            if (e.code === "auth/popup-blocked") fail("เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ กรุณาอนุญาต pop-up แล้วลองใหม่");
            if (e.code === "auth/unauthorized-domain") fail("โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication (Authorized domains)");
            if (e.code === "auth/network-request-failed") fail("เชื่อมต่ออินเทอร์เน็ตไม่ได้");
            throw e;
        }
        try { me = await authorize(cred.user); return me; }
        catch (e) { me = null; await signOut(auth); throw e; }
    },
    async logout() { me = null; await signOut(auth); return true; },
    async currentUser() { await ready; return me; },
    takeAuthError() { const e = authError; authError = null; return e; },

    getConfig: () => guard(async () => {
        const u = needUser();
        const main = await readMain(), locked = main.locked || {};
        let teachers = null;
        if (isAdmin(u)) {
            teachers = (await getDocs(collection(db, "evalUsers"))).docs
                .map(d => Object.assign({ id: d.id, email: d.id }, d.data()))
                .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, "th"));
        }
        return {
            title: SEMINAR.title, venue: SEMINAR.venue, domain: DOMAIN,
            criteria: criteriaOf(main), days: SEMINAR.days, students: SEMINAR.students,
            locked, teachers
        };
    }),

    getMyScores: () => guard(async () => {
        const u = needUser(), out = {};
        const qs = await getDocs(query(collection(db, "evalScores"), where("email", "==", u.email)));
        qs.forEach(d => { const r = toRec(d.data()); out[r.sid] = r; });
        return out;
    }),

    saveScore: (sid, items, comment) => guard(async () => {
        const u = needUser();
        if (!canGrade(u)) fail("บัญชีนี้ไม่มีสิทธิ์ให้คะแนน");
        const st = SEMINAR.students.find(s => s.sid === sid);
        if (!st) fail("ไม่พบนักศึกษา");
        const main = await readMain();
        if ((main.locked || {})[st.date]) fail("ผู้ดูแลปิดรับคะแนนของวันนี้แล้ว");
        const ITEMS = criteriaOf(main).flatMap(s => s.items), clean = {};
        for (const it of ITEMS) {
            const v = Number(items[it.id]);
            if (!(v >= 0 && v <= it.max) || Math.round(v * 2) !== v * 2) fail(`คะแนน "${it.text}" ไม่ถูกต้อง`);
            clean[it.id] = v;
        }
        const total = ITEMS.reduce((a, it) => a + clean[it.id], 0);
        const data = {
            sid, email: u.email, name: u.name, date: st.date, items: clean, total,
            comment: String(comment || "").slice(0, 1000), updatedAt: serverTimestamp()
        };
        await setDoc(doc(db, "evalScores", `${sid}__${u.email}`), data);
        return toRec(Object.assign({}, data, { updatedAt: null }));
    }),

    // ลบได้เฉพาะคะแนนของบัญชีผู้ดูแลถาวร (ใช้ทดลองระบบ) — rules บังคับซ้ำ
    deleteMyScore: sid => guard(async () => {
        const u = needUser();
        if (!u.superAdmin) fail("เฉพาะบัญชีทดลองของผู้ดูแลถาวรเท่านั้นที่ลบคะแนนได้");
        await deleteDoc(doc(db, "evalScores", `${sid}__${u.email}`));
        return true;
    }),

    getAllScores: () => guard(async () => {
        needAdmin();
        return (await getDocs(collection(db, "evalScores"))).docs.map(d => toRec(d.data()));
    }),

    // ผู้ดูแล: รับคะแนนแบบสด — คืนฟังก์ชันสำหรับยกเลิก
    watchAllScores(onData, onError) {
        needAdmin();
        return onSnapshot(collection(db, "evalScores"),
            qs => onData(qs.docs.map(d => toRec(d.data({ serverTimestamps: "estimate" })))),
            e => onError && onError(friendly(e)));
    },

    saveTeachers: list => guard(async () => {
        const u = needUser(); needAdmin();
        const seen = new Set();
        list.forEach(t => {
            t.email = String(t.email || "").trim().toLowerCase();
            t.name = String(t.name || "").trim();
            if (!t.name) fail("กรุณากรอกชื่อให้ครบ");
            if (!t.email.endsWith("@" + DOMAIN)) fail(`${t.name}: อีเมลต้องลงท้ายด้วย @${DOMAIN}`);
            if (STUDENT_RE.test(t.email)) fail(`${t.name}: ใช้บัญชีนักศึกษาไม่ได้`);
            if (SUPER_ADMINS.includes(t.email)) fail(`${t.email} เป็นผู้ดูแลถาวรอยู่แล้ว ไม่ต้องเพิ่มในรายการ`);
            if (seen.has(t.email)) fail("อีเมลซ้ำ: " + t.email);
            if (!ROLES.includes(t.role)) fail("สิทธิ์ไม่ถูกต้อง");
            seen.add(t.email);
        });
        if (!u.superAdmin && !list.some(t => t.email === u.email && (t.role === "admin" || t.role === "both")))
            fail("ห้ามลบสิทธิ์ผู้ดูแลของบัญชีที่กำลังใช้อยู่");

        const existing = (await getDocs(collection(db, "evalUsers"))).docs.map(d => d.id);
        const batch = writeBatch(db);
        existing.filter(id => !seen.has(id)).forEach(id => batch.delete(doc(db, "evalUsers", id)));
        list.forEach((t, i) => batch.set(doc(db, "evalUsers", t.email), { name: t.name, role: t.role, order: i }));
        await batch.commit();
        const out = list.map((t, i) => ({ id: t.email, email: t.email, name: t.name, role: t.role, order: i }));
        const self = out.find(t => t.email === u.email);
        if (self) me = Object.assign({}, me, { name: self.name, role: self.role });
        return out;
    }),

    setLock: (date, locked) => guard(async () => {
        const u = needUser(); needAdmin();
        const cur = Object.assign({}, await readLocked());
        if (locked) cur[date] = true; else delete cur[date];
        // mergeFields: แทนที่ฟิลด์ locked ทั้งก้อน (ไม่ merge ลึก) และไม่ทับ criteria
        await setDoc(doc(db, "evalConfig", "main"), { locked: cur, updatedAt: serverTimestamp(), updatedBy: u.email },
            { mergeFields: ["locked", "updatedAt", "updatedBy"] });
        return cur;
    }),

    // ผู้ดูแล: แก้รายการประเมินและคะแนนเต็ม — list = [{ name, items: [{ id?, max, text }] }]
    saveCriteria: list => guard(async () => {
        const u = needUser(); needAdmin();
        if (!Array.isArray(list) || !list.length) fail("ต้องมีอย่างน้อย 1 ส่วน");
        const idOk = id => /^c([1-9]|1\d|20)$/.test(id || "");
        const kept = new Set(), used = new Set();
        list.forEach(s => s.items.forEach(i => { if (idOk(i.id) && !kept.has(i.id)) kept.add(i.id); }));
        let count = 0;
        const out = list.map((s, si) => {
            const name = String(s.name || "").trim();
            if (!name) fail(`กรุณากรอกชื่อส่วนที่ ${si + 1}`);
            if (!s.items.length) fail(`ส่วนที่ ${si + 1} ต้องมีอย่างน้อย 1 ข้อ`);
            const items = s.items.map(i => {
                const text = String(i.text || "").trim(), max = Number(i.max);
                if (!text) fail(`ส่วนที่ ${si + 1}: กรุณากรอกรายการประเมินให้ครบ`);
                if (!(max > 0 && max <= 100) || Math.round(max * 2) !== max * 2) fail(`"${text}": คะแนนเต็มต้องเป็นเลข 0.5–100 (เพิ่มทีละ 0.5)`);
                let id = i.id;
                if (!idOk(id) || used.has(id)) {
                    for (let k = 1; k <= MAX_ITEMS; k++) if (!kept.has("c" + k) && !used.has("c" + k)) { id = "c" + k; break; }
                    if (!idOk(id) || used.has(id)) fail(`มีรายการประเมินได้ไม่เกิน ${MAX_ITEMS} ข้อ`);
                    kept.add(id);
                }
                used.add(id); count++;
                return { id, max, text };
            });
            return { id: "s" + (si + 1), name, items };
        });
        if (count > MAX_ITEMS) fail(`มีรายการประเมินได้ไม่เกิน ${MAX_ITEMS} ข้อ`);
        const maxes = {};
        out.forEach(s => s.items.forEach(i => { maxes[i.id] = i.max; }));
        await setDoc(doc(db, "evalConfig", "main"),
            { criteria: out, maxes, updatedAt: serverTimestamp(), updatedBy: u.email },
            { mergeFields: ["criteria", "maxes", "updatedAt", "updatedBy"] });
        return criteriaOf({ criteria: out });
    })
};
