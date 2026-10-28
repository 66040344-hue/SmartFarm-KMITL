// seminar-eval-app.js
// หน้าจอระบบประเมินการนำเสนอสัมมนา (อาจารย์ให้คะแนน / ผู้ดูแลดูผลและส่งออก)
import { API } from "./seminar-eval-api.js";
import { SEMINAR } from "./seminar-eval-data.js";

const app = document.getElementById("app");
const S = { user: null, cfg: null, mine: {}, all: null, unwatch: null, day: null, q: "", atab: "overview", aday: "all", sort: "no", open: null, users: null };
const params = new URLSearchParams(location.search);
const FAKE_NOW = params.get("now");                 // ทดลองเวลา เช่น ?now=2026-11-10T10:25

// ---------- helpers ----------
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => n == null || isNaN(n) ? "–" : (Math.round(n * 100) / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const p2 = n => String(n).padStart(2, "0");
const now = () => FAKE_NOW ? new Date(FAKE_NOW) : new Date();
const isoDay = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const canGrade = u => u && (u.role === "teacher" || u.role === "both");
const isAdmin = u => u && (u.role === "admin" || u.role === "both");
// ผู้ดูแลล้วน (ให้คะแนนไม่ได้) เปิดหน้าอาจารย์เพื่อดูตัวอย่างได้ — กรอกลองได้แต่บันทึกไม่ได้
const isPreview = u => isAdmin(u) && !canGrade(u);
const home = () => isPreview(S.user) ? "#/preview" : "#/";
const items = () => S.cfg.criteria.flatMap(s => s.items);
const fullMax = () => items().reduce((a, it) => a + it.max, 0);
// รวมคะแนนใหม่ตามเกณฑ์ปัจจุบัน (กรณีผู้ดูแลแก้เกณฑ์หลังมีคะแนนแล้ว ค่า total ที่เก็บไว้อาจล้าสมัย)
const recTotal = r => items().reduce((a, it) => a + (Number(r.items[it.id]) || 0), 0);
const secSum = (sec, vals) => sec.items.reduce((a, it) => a + (Number(vals[it.id]) || 0), 0);
const ROLE = { teacher: "อาจารย์ผู้ประเมิน", admin: "ผู้ดูแลระบบ", both: "อาจารย์ + ผู้ดูแล" };

function toast(msg, err) {
    const t = document.createElement("div");
    t.className = "toast" + (err ? " err" : ""); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), err ? 4200 : 2200);
}
function errMsg(e) {
    if (e && e.userMessage) return e.userMessage;
    console.error(e); return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}

function isNow(st) {
    const d = now();
    if (isoDay(d) !== st.date) return false;
    const [a, b] = st.time.split("-");
    const hm = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    return hm >= a && hm < b;
}

// ---------- in-app browser (LINE / Facebook) — Google ไม่อนุญาตให้ล็อกอินในนี้ ----------
const UA = navigator.userAgent || "";
if (/\bLine\//i.test(UA) && !params.has("openExternalBrowser")) {
    params.set("openExternalBrowser", "1");
    location.replace(location.pathname + "?" + params.toString() + location.hash);
}
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Messenger|\bLine\//i.test(UA);

// ---------- drafts (เครื่องนี้เท่านั้น กันข้อมูลหายระหว่างกรอก) ----------
const draftKey = sid => `seminar.eval.draft.${S.user.id}.${sid}`;
function getDraft(sid) { if (isPreview(S.user)) return null; try { return JSON.parse(localStorage.getItem(draftKey(sid))); } catch (e) { return null; } }
function setDraft(sid, d) { if (isPreview(S.user)) return; try { localStorage.setItem(draftKey(sid), JSON.stringify(d)); } catch (e) { } }
function dropDraft(sid) { try { localStorage.removeItem(draftKey(sid)); } catch (e) { } }

// ---------- boot / routing ----------
async function boot() {
    S.user = await API.currentUser();
    if (!S.user) return renderLogin(API.takeAuthError());
    try {
        S.cfg = await API.getConfig();
        S.mine = canGrade(S.user) ? await API.getMyScores() : {};
    } catch (e) { return renderLogin(errMsg(e)); }
    const today = isoDay(now());
    S.day = S.day || (S.cfg.days.find(d => d.date === today) || S.cfg.days[0]).date;
    route();
}

function route() {
    if (!S.user) return renderLogin();
    if (!S.cfg) return;                               // boot() ยังโหลดไม่เสร็จ
    const h = location.hash.replace(/^#\/?/, "").split("/");
    const pv = isPreview(S.user);
    if (h[0] === "eval" && h[1] && (canGrade(S.user) || pv)) return renderEval(decodeURIComponent(h[1]));
    if (h[0] === "admin" && isAdmin(S.user)) { if (h[1]) S.atab = h[1]; return renderAdmin(); }
    if (h[0] === "preview" && pv) return renderList();
    if (!canGrade(S.user)) { location.hash = "#/admin/" + S.atab; return; }
    renderList();
}
window.addEventListener("hashchange", route);

function stopWatch() { if (S.unwatch) { S.unwatch(); S.unwatch = null; } S.all = null; }

function shell(inner, mode) {
    const u = S.user;
    const modes = u.role === "both" || isPreview(u)
        ? `<div class="modes"><button data-go="${home()}" class="${mode === "grade" ? "on" : ""}">${isPreview(u) ? "ดูหน้าอาจารย์" : "ให้คะแนน"}</button><button data-go="#/admin/${S.atab}" class="${mode === "admin" ? "on" : ""}">ผู้ดูแล</button></div>` : "";
    app.innerHTML = `
      <header class="top"><div class="wrap">
        <div class="brand">ประเมินสัมมนา SFM<small>${esc(S.cfg.title)}</small></div>
        ${modes}
        <div class="who"><b>${esc(u.name)}</b>${esc(u.email)}</div>
        <button id="logout">ออก</button>
      </div></header>
      ${inner}`;
    app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { location.hash = b.dataset.go; });
    document.getElementById("logout").onclick = async () => {
        stopWatch();
        await API.logout(); S.user = null; S.cfg = null; S.users = null; S.crit = null;
        history.replaceState(null, "", location.pathname + location.search);
        renderLogin();
    };
}

// ---------- login ----------
function renderLogin(error) {
    app.innerHTML = `
      <div class="login">
        <div class="hero"><span class="badge">ระบบประเมิน</span>
          <h1>แบบประเมินการนำเสนอสัมมนา</h1>
          <p>วิชาสัมมนาทางด้านการจัดการฟาร์มอย่างชาญฉลาด<br>สำหรับอาจารย์และผู้ดูแลระบบ</p></div>
        <div class="body">
          ${IN_APP ? `<div class="banner warn">กรุณาเปิดลิงก์นี้ใน Chrome หรือ Safari — Google ไม่อนุญาตให้เข้าสู่ระบบจากเบราว์เซอร์ในแอป LINE / Facebook
            <div class="copy"><input readonly value="${esc(location.href.split("#")[0])}" onclick="this.select()"></div></div>` : ""}
          <div class="err" id="err">${esc(error || "")}</div>
          <button class="gbtn" id="go">
            <svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            <span id="golbl">เข้าสู่ระบบด้วยบัญชี @${esc(SEMINAR.domain)}</span></button>
          <p class="small muted" style="margin:10px 0 0">ใช้ได้เฉพาะบัญชีสถาบันของอาจารย์ที่ผู้ดูแลเพิ่มสิทธิ์ไว้แล้ว</p>
        </div>
      </div>`;
    const btn = document.getElementById("go"), err = document.getElementById("err");
    btn.onclick = async () => {
        err.textContent = ""; btn.disabled = true; document.getElementById("golbl").textContent = "กำลังเข้าสู่ระบบ…";
        try { await API.login(); S.cfg = null; S.users = null; stopWatch(); boot(); }
        catch (e) {
            err.textContent = errMsg(e); btn.disabled = false;
            document.getElementById("golbl").textContent = `เข้าสู่ระบบด้วยบัญชี @${SEMINAR.domain}`;
        }
    };
}

// ---------- รายชื่อสำหรับอาจารย์ ----------
function renderList() {
    const days = S.cfg.days, list = S.cfg.students;
    const tabs = days.map(d => {
        const ss = list.filter(s => s.date === d.date);
        const done = ss.filter(s => S.mine[s.sid]).length;
        return `<button class="tab ${d.date === S.day ? "on" : ""}" data-day="${d.date}"><b>${esc(d.label)}</b>
          <span>ประเมินแล้ว ${done}/${ss.length}${S.cfg.locked[d.date] ? " · ปิดรับแล้ว" : ""}</span>
          <div class="bar"><i style="width:${ss.length ? done / ss.length * 100 : 0}%"></i></div></button>`;
    }).join("");
    shell(`<main class="wrap">
      <div class="tabs">${tabs}</div>
      ${S.user.superAdmin ? `<div class="banner warn">บัญชีทดลอง — ให้คะแนน แก้ไข และลบได้เฉพาะของคุณเอง คะแนนที่ลองให้จะไม่นับรวมในผลสรุป อันดับ และไฟล์ Excel (ติ๊ก "รวมคะแนนทดลองของฉัน" ในหน้าผู้ดูแลเพื่อดูผลทดลอง)</div>` : ""}
      ${isPreview(S.user) ? `<div class="banner warn">โหมดดูตัวอย่าง — นี่คือหน้าที่อาจารย์เห็น คุณลองกรอกได้แต่บันทึกคะแนนไม่ได้</div>` : ""}
      ${S.cfg.locked[S.day] ? `<div class="banner warn">ผู้ดูแลปิดรับคะแนนของวันนี้แล้ว ดูคะแนนที่ให้ไว้ได้แต่แก้ไขไม่ได้</div>` : ""}
      <input class="field search" id="q" type="search" placeholder="ค้นหาชื่อ รหัส หรือหัวข้อ" value="${esc(S.q)}">
      <div class="slist" id="slist"></div>
    </main>`, "grade");
    app.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { S.day = b.dataset.day; renderList(); });
    const q = document.getElementById("q");
    q.oninput = () => { S.q = q.value; fillList(); };
    fillList();
    const cur = app.querySelector(".srow.now");
    if (cur && !S.q) cur.scrollIntoView({ block: "center" });
}

function fillList() {
    const q = S.q.trim().toLowerCase();
    const ss = S.cfg.students.filter(s => s.date === S.day &&
        (!q || (s.name + " " + s.sid + " " + s.topic).toLowerCase().includes(q)));
    document.getElementById("slist").innerHTML = ss.length ? ss.map(s => {
        const r = S.mine[s.sid], d = !r && getDraft(s.sid), live = isNow(s);
        const st = r ? `<span class="score">${fmt(r.total)}</span><span class="pill ok">ส่งแล้ว</span>`
            : d ? `<span class="pill warn">ร่าง</span>` : `<span class="pill none">ยังไม่ประเมิน</span>`;
        return `<a class="srow ${r ? "done" : ""} ${live ? "now" : ""}" href="#/eval/${encodeURIComponent(s.sid)}">
          <div class="no">${s.no}</div>
          <div class="mid"><div class="nm">${esc(s.name)}</div><div class="tp">${esc(s.topic)}</div>
            <div class="meta">${esc(s.time)} น. · ${esc(s.sid)}</div></div>
          <div class="rt">${live ? `<span class="pill now">กำลังนำเสนอ</span>` : ""}${st}</div></a>`;
    }).join("") : `<p class="muted" style="text-align:center">ไม่พบรายชื่อ</p>`;
}

// ---------- ฟอร์มให้คะแนน ----------
function quickVals(max) {
    const out = [];
    [0.5, 0.6, 0.7, 0.8, 0.9, 1].forEach(f => { const v = Math.round(max * f * 2) / 2; if (!out.includes(v)) out.push(v); });
    return out;
}
function valid(v, max) { return v !== "" && v != null && !isNaN(v) && v >= 0 && v <= max && Math.round(v * 2) === v * 2; }

function renderEval(sid) {
    const list = S.cfg.students;
    const st = list.find(s => s.sid === sid);
    if (!st) { location.hash = home(); return; }
    const pv = isPreview(S.user);
    S.day = st.date;
    const dayList = list.filter(s => s.date === st.date);
    const idx = dayList.indexOf(st), prev = dayList[idx - 1], next = dayList[idx + 1];
    const saved = S.mine[sid], draft = getDraft(sid);
    const locked = !!S.cfg.locked[st.date];
    const vals = Object.assign({}, saved ? saved.items : {}, !locked && draft ? draft.items : {});
    let comment = !locked && draft ? draft.comment : saved ? saved.comment : "";
    const dis = locked ? "disabled" : "";

    const secs = S.cfg.criteria.map((sec, i) => `
      <section class="sec">
        <div class="sh"><b>ส่วนที่ ${i + 1} ${esc(sec.name)}</b><span class="sub" id="sub-${sec.id}">0</span><span class="cap">/${sec.max}</span></div>
        ${sec.items.map(it => `
          <div class="item">
            <div class="tx"><span>${esc(it.text)}</span><span class="mx">${it.max}</span></div>
            <div class="ctl" id="ctl-${it.id}">
              <input type="range" min="0" max="${it.max}" step="0.5" data-id="${it.id}" aria-label="${esc(it.text)}" ${dis}>
              <input class="num" type="number" inputmode="decimal" min="0" max="${it.max}" step="0.5" data-id="${it.id}" placeholder="–" ${dis}>
            </div>
            ${locked ? "" : `<div class="quick">${quickVals(it.max).map(v => `<button type="button" data-id="${it.id}" data-v="${v}">${fmt(v)}</button>`).join("")}</div>`}
          </div>`).join("")}
      </section>`).join("");

    shell(`<main class="wrap">
      <div class="nav">
        <a class="btn sm" href="${home()}">← รายชื่อ</a>
        <span>
          ${prev ? `<a class="btn sm" href="#/eval/${encodeURIComponent(prev.sid)}">‹ ก่อนหน้า</a>` : ""}
          ${next ? `<a class="btn sm" href="#/eval/${encodeURIComponent(next.sid)}">ถัดไป ›</a>` : ""}
        </span>
      </div>
      <div class="ehead">
        <div class="nm">${st.no}. ${esc(st.name)}</div>
        <div class="tp">${esc(st.topic)}</div>
        <div class="meta">รหัส ${esc(st.sid)} · ${esc(st.time)} น. · อาจารย์ที่ปรึกษา ${esc(st.advisor)}</div>
      </div>
      ${pv ? `<div class="banner warn">โหมดดูตัวอย่าง — กรอกลองได้แต่ไม่มีการบันทึก</div>` : ""}
      ${locked ? `<div class="banner warn">ปิดรับคะแนนของวันนี้แล้ว — แสดงคะแนนที่บันทึกไว้</div>` : ""}
      ${!locked && saved && draft ? `<div class="banner warn">มีการแก้ไขที่ยังไม่ได้บันทึก (คะแนนที่ส่งไว้: ${fmt(saved.total)})</div>` : ""}
      ${secs}
      <section class="sec"><div class="sh"><b>ข้อเสนอแนะ (ถ้ามี)</b></div>
        <div class="item"><textarea id="cm" class="field" rows="3" maxlength="1000" placeholder="ความเห็นถึงนักศึกษา" ${dis}>${esc(comment)}</textarea></div></section>
      ${S.user.superAdmin && saved ? `<div style="margin:12px 0"><button class="btn sm danger" id="delme">ลบคะแนนของฉัน (ทดลอง)</button></div>` : ""}
      <div style="height:20px"></div>
    </main>
    <div class="sticky"><div class="in">
      <div class="tot" id="tot">0<small> / ${fmt(fullMax())}</small></div>
      <div class="parts" id="parts"></div>
      ${locked ? "" : `<button class="btn primary" id="save" disabled>${pv ? "บันทึกไม่ได้ (ตัวอย่าง)" : "บันทึกคะแนน"}</button>`}
    </div></div>`, "grade");

    const ranges = app.querySelectorAll("input[type=range]"), nums = app.querySelectorAll("input.num");
    const byId = {}; items().forEach(it => byId[it.id] = it);

    function paint(id) {
        const it = byId[id], v = vals[id], ok = valid(v, it.max);
        const r = app.querySelector(`input[type=range][data-id="${id}"]`), n = app.querySelector(`input.num[data-id="${id}"]`);
        r.value = ok ? v : 0;
        if (document.activeElement !== n) n.value = v === "" || v == null ? "" : v;
        n.classList.toggle("bad", v !== "" && v != null && !ok);
        document.getElementById("ctl-" + id).classList.toggle("empty", !ok);
    }
    function totals() {
        let tot = 0, missing = 0;
        S.cfg.criteria.forEach(sec => {
            const s = secSum(sec, vals); tot += s;
            document.getElementById("sub-" + sec.id).textContent = fmt(s);
            sec.items.forEach(it => { if (!valid(vals[it.id], it.max)) missing++; });
        });
        document.getElementById("tot").innerHTML = `${fmt(tot)}<small> / ${fmt(fullMax())}</small>`;
        document.getElementById("parts").innerHTML = missing
            ? `ยังไม่ได้ให้คะแนน ${missing} ข้อ`
            : S.cfg.criteria.map((sec, i) => `ส่วน ${i + 1}: ${fmt(secSum(sec, vals))}/${sec.max}`).join(" · ");
        const btn = document.getElementById("save");
        if (btn) btn.disabled = pv || missing > 0;
        return missing;
    }
    function changed(id, v) {
        vals[id] = v === "" ? "" : Number(v);
        paint(id); totals();
        setDraft(sid, { items: vals, comment });
    }

    items().forEach(it => paint(it.id)); totals();
    const del = document.getElementById("delme");
    if (del) del.onclick = async () => {
        if (!confirm(`ลบคะแนนที่คุณให้ ${st.name}?`)) return;
        del.disabled = true;
        try {
            await API.deleteMyScore(sid);
            delete S.mine[sid]; dropDraft(sid);
            toast("ลบคะแนนของคุณแล้ว");
            location.hash = home();
        } catch (err) { del.disabled = false; toast(errMsg(err), true); }
    };
    if (locked) return;

    ranges.forEach(r => r.addEventListener("input", () => changed(r.dataset.id, r.value)));
    nums.forEach(n => {
        n.addEventListener("input", () => changed(n.dataset.id, n.value.trim()));
        n.addEventListener("blur", () => paint(n.dataset.id));
    });
    app.querySelectorAll(".quick button").forEach(b => b.onclick = () => changed(b.dataset.id, b.dataset.v));
    const cm = document.getElementById("cm");
    cm.oninput = () => { comment = cm.value; setDraft(sid, { items: vals, comment }); };

    if (pv) return;
    document.getElementById("save").onclick = async e => {
        if (totals()) return;
        const btn = e.currentTarget; btn.disabled = true; btn.textContent = "กำลังบันทึก…";
        const slow = setTimeout(() => toast("เครือข่ายช้า กำลังส่งคะแนน… กรุณาอย่าปิดหน้านี้"), 6000);
        try {
            S.mine[sid] = await API.saveScore(sid, vals, comment);
            dropDraft(sid);
            toast(`บันทึกแล้ว ${st.name} — ${fmt(S.mine[sid].total)} คะแนน`);
            if (location.hash.startsWith("#/eval/" + encodeURIComponent(sid))) location.hash = "#/";
        } catch (err) {
            if (/ปิดรับ/.test(errMsg(err))) S.cfg.locked[st.date] = true;
            toast(errMsg(err), true);
            if (btn.isConnected) { btn.disabled = false; btn.textContent = "บันทึกคะแนน"; }
        } finally { clearTimeout(slow); }
    };
}

// ---------- ผู้ดูแล ----------
function startWatch() {
    return new Promise((resolve, reject) => {
        S.unwatch = API.watchAllScores(list => {
            const first = S.all == null;
            S.all = list;
            if (first) resolve();
            else if (location.hash.startsWith("#/admin") && S.atab !== "users" && S.atab !== "criteria") renderAdminBody();
        }, err => { if (S.all == null) reject(err); else toast(errMsg(err), true); });
    });
}

async function renderAdmin() {
    if (!S.all) {
        shell(`<div class="loading">กำลังโหลดคะแนน…</div>`, "admin");
        try { S.cfg = await API.getConfig(); await startWatch(); }
        catch (e) { stopWatch(); shell(`<main class="wrap"><div class="banner err">${esc(errMsg(e))}</div></main>`, "admin"); return; }
    }
    const tabs = [["overview", "ภาพรวม"], ["results", "ผลคะแนน"], ["podium", "อันดับ"], ["criteria", "เกณฑ์ประเมิน"], ["users", "ผู้ใช้งาน"]];
    shell(`<main class="wrap">
      <div class="atabs">${tabs.map(([k, l]) => `<button data-go="#/admin/${k}" class="${S.atab === k ? "on" : ""}">${l}</button>`).join("")}
        <span style="flex:1"></span>
        ${S.user.superAdmin ? `<label class="small" style="white-space:nowrap;margin-right:8px"><input type="checkbox" id="inctest" ${S.incTest ? "checked" : ""}> รวมคะแนนทดลองของฉัน</label>` : ""}
        <span class="live" title="คะแนนอัปเดตอัตโนมัติเมื่ออาจารย์บันทึก"><i></i>อัปเดตสด</span></div>
      <div id="abody"></div></main>`, "admin");
    const inc = document.getElementById("inctest");
    if (inc) inc.onchange = () => { S.incTest = inc.checked; renderAdminBody(); };
    renderAdminBody();
}
function renderAdminBody() {
    const el = document.getElementById("abody");
    if (!el) return;
    ({ overview: adminOverview, results: adminResults, podium: adminPodium, criteria: adminCriteria, users: adminUsers }[S.atab] || adminOverview)(el);
}

// ผู้ดูแลถาวรไม่อยู่ในรายชื่อ evalUsers คะแนนทดลองจึงถูกตัดออกจากสรุป เว้นแต่เปิด "รวมคะแนนทดลอง" ไว้
const graders = () => S.cfg.teachers.filter(canGrade).concat(
    S.incTest && S.user.superAdmin ? [{ id: S.user.email, email: S.user.email, name: S.user.name + " (ทดลอง)", role: "both" }] : []);
function scoreIndex() {
    const ids = new Set(graders().map(t => t.id)), by = {};
    S.all.forEach(r => { if (ids.has(r.tid)) (by[r.sid] = by[r.sid] || []).push(r); });
    return by;
}
function summary(st, recs) {
    recs = recs || [];
    const n = recs.length, avg = f => n ? recs.reduce((a, r) => a + f(r), 0) / n : null;
    return {
        st, recs, n,
        secs: S.cfg.criteria.map(sec => avg(r => secSum(sec, r.items))),
        avg: avg(recTotal)
    };
}

function adminOverview(el) {
    const g = graders(), by = scoreIndex(), list = S.cfg.students;
    const ids = new Set(g.map(t => t.id));
    const expected = list.length * g.length, done = S.all.filter(r => ids.has(r.tid)).length;
    const full = list.filter(s => g.length && (by[s.sid] || []).length >= g.length).length;
    const none = list.filter(s => !(by[s.sid] || []).length).length;
    el.innerHTML = `
      <div class="tiles">
        <div class="tile"><div class="k">ใบประเมินที่ส่งแล้ว</div><div class="v">${done}<span class="small muted"> / ${expected}</span></div></div>
        <div class="tile"><div class="k">นักศึกษาที่ได้คะแนนครบทุกท่าน</div><div class="v">${full}<span class="small muted"> / ${list.length}</span></div></div>
        <div class="tile"><div class="k">ยังไม่มีใครประเมิน</div><div class="v">${none}</div></div>
        <div class="tile"><div class="k">อาจารย์ผู้ประเมิน</div><div class="v">${g.length}</div></div>
      </div>
      <div class="card"><h2>ความคืบหน้ารายอาจารย์</h2><div class="prog">
        ${g.map(t => {
            const c = S.all.filter(r => r.tid === t.id).length;
            return `<div class="r"><span>${esc(t.name)}</span><span class="c">${c}/${list.length}</span>
              <div class="bar"><i style="width:${list.length ? c / list.length * 100 : 0}%"></i></div></div>`;
        }).join("") || `<p class="muted">ยังไม่มีอาจารย์ผู้ประเมิน — เพิ่มได้ที่แท็บ “ผู้ใช้งาน”</p>`}
      </div></div>
      <div class="card"><h2>เปิด/ปิดรับคะแนน</h2>
        ${S.cfg.days.map(d => {
            const lk = !!S.cfg.locked[d.date];
            return `<div class="lock"><div><b>${esc(d.label)}</b><div class="small muted">${lk ? "ปิดรับแล้ว อาจารย์แก้ไขคะแนนไม่ได้" : "เปิดรับคะแนนอยู่"}</div></div>
              <button class="btn sm ${lk ? "" : "danger"}" data-lock="${d.date}" data-v="${lk ? 0 : 1}">${lk ? "เปิดรับอีกครั้ง" : "ปิดรับคะแนน"}</button></div>`;
        }).join("")}
      </div>`;
    el.querySelectorAll("[data-lock]").forEach(b => b.onclick = async () => {
        const lk = b.dataset.v === "1";
        if (lk && !confirm("ปิดรับคะแนนของวันนี้? อาจารย์จะแก้ไขคะแนนไม่ได้")) return;
        b.disabled = true;
        try { S.cfg.locked = await API.setLock(b.dataset.lock, lk); adminOverview(el); toast(lk ? "ปิดรับคะแนนแล้ว" : "เปิดรับคะแนนแล้ว"); }
        catch (e) { b.disabled = false; toast(errMsg(e), true); }
    });
}

function adminResults(el) {
    const by = scoreIndex(), g = graders(), tname = {};
    S.cfg.teachers.forEach(t => tname[t.id] = t.name);
    let rows = S.cfg.students.filter(s => S.aday === "all" || s.date === S.aday).map(s => summary(s, by[s.sid]));
    if (S.sort === "avg") rows = rows.slice().sort((a, b) => (b.avg == null ? -1 : b.avg) - (a.avg == null ? -1 : a.avg));
    const multiDay = S.aday === "all";

    el.innerHTML = `
      <div class="toolbar">
        <select class="btn sm" id="aday"><option value="all">ทุกวัน</option>${S.cfg.days.map(d => `<option value="${d.date}" ${S.aday === d.date ? "selected" : ""}>${esc(d.label)}</option>`).join("")}</select>
        <select class="btn sm" id="sort"><option value="no">เรียงตามลำดับนำเสนอ</option><option value="avg" ${S.sort === "avg" ? "selected" : ""}>เรียงตามคะแนนเฉลี่ย</option></select>
        <span class="sp"></span>
        <button class="btn sm primary" id="xls">ดาวน์โหลด Excel</button>
      </div>
      <div class="card" style="padding:0;overflow:hidden"><div class="tscroll"><table class="t">
        <thead><tr>${S.sort === "avg" ? "<th>อันดับ</th>" : ""}<th>ลำดับ</th><th>นักศึกษา</th><th class="n">ผู้ประเมิน</th>
          ${S.cfg.criteria.map((c, i) => `<th class="n">ส่วน ${i + 1}<br><span style="font-weight:400">/${c.max}</span></th>`).join("")}
          <th class="n">เฉลี่ย<br><span style="font-weight:400">/${fmt(fullMax())}</span></th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr class="clk" data-sid="${esc(r.st.sid)}">
            ${S.sort === "avg" ? `<td>${r.avg == null ? "" : `<span class="rank ${i < 3 ? "g" + (i + 1) : ""}">${i + 1}</span>`}</td>` : ""}
            <td>${multiDay ? `<span class="small muted">${r.st.date.slice(8)}/</span>` : ""}${r.st.no}</td>
            <td><b>${esc(r.st.name)}</b><div class="tp">${esc(r.st.topic)}</div></td>
            <td class="n">${r.n}/${g.length}</td>
            ${r.secs.map(v => `<td class="n">${fmt(v)}</td>`).join("")}
            <td class="n"><b>${fmt(r.avg)}</b></td></tr>
          ${S.open === r.st.sid ? `<tr class="detail"><td colspan="${4 + (S.sort === "avg" ? 1 : 0) + S.cfg.criteria.length}">${detail(r, tname)}</td></tr>` : ""}`).join("")}
        </tbody></table></div></div>
      <p class="small muted">กดที่แถวเพื่อดูคะแนนแยกรายอาจารย์ · คะแนนเฉลี่ยคิดจากอาจารย์ที่ส่งคะแนนแล้วเท่านั้น</p>`;
    el.querySelector("#aday").onchange = e => { S.aday = e.target.value; adminResults(el); };
    el.querySelector("#sort").onchange = e => { S.sort = e.target.value; adminResults(el); };
    el.querySelector("#xls").onclick = exportXlsx;
    el.querySelectorAll("tr.clk").forEach(tr => tr.onclick = () => { S.open = S.open === tr.dataset.sid ? null : tr.dataset.sid; adminResults(el); });
}

function detail(r, tname) {
    if (!r.recs.length) return `<p class="muted" style="padding:10px 14px;margin:0">ยังไม่มีคะแนน</p>`;
    const its = items();
    return `<div class="tscroll"><table class="sub-t"><thead><tr><th>ผู้ประเมิน</th>
      ${its.map((it, i) => `<th title="${esc(it.text)}">ข้อ ${i + 1}<br><span class="muted" style="font-weight:400">/${it.max}</span></th>`).join("")}
      <th>รวม</th></tr></thead><tbody>
      ${r.recs.map(x => `<tr><td>${esc(tname[x.tid] || x.tid)}</td>${its.map(it => `<td>${fmt(x.items[it.id])}</td>`).join("")}<td><b>${fmt(recTotal(x))}</b></td></tr>
        ${x.comment ? `<tr><td class="cm" colspan="${its.length + 2}">💬 ${esc(x.comment)}</td></tr>` : ""}`).join("")}
      </tbody></table></div>`;
}

function exportXlsx() {
    if (!window.XLSX) { toast("โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ ลองรีเฟรชหน้า", true); return; }
    const by = scoreIndex(), g = graders(), its = items(), C = S.cfg.criteria;
    const tname = {}; S.cfg.teachers.forEach(t => tname[t.id] = t.name);
    const dayLabel = d => (S.cfg.days.find(x => x.date === d) || {}).label || d;
    const r2 = n => n == null ? "" : Math.round(n * 100) / 100;

    const sum = [["วันที่", "ลำดับ", "รหัสนักศึกษา", "ชื่อ-นามสกุล", "หัวข้อ", "อาจารย์ที่ปรึกษา",
        ...g.map(t => t.name), "จำนวนผู้ประเมิน", ...C.map((c, i) => `ส่วนที่ ${i + 1} (${c.max})`), `คะแนนเฉลี่ย (${fullMax()})`]];
    S.cfg.students.forEach(s => {
        const r = summary(s, by[s.sid]), mine = {};
        r.recs.forEach(x => mine[x.tid] = recTotal(x));
        sum.push([dayLabel(s.date), s.no, s.sid, s.name, s.topic, s.advisor,
            ...g.map(t => mine[t.id] == null ? "" : mine[t.id]), r.n, ...r.secs.map(r2), r2(r.avg)]);
    });

    const det = [["วันที่", "ลำดับ", "รหัสนักศึกษา", "ชื่อ-นามสกุล", "ผู้ประเมิน",
        ...its.map((it, i) => `ข้อ ${i + 1} (${it.max})`), ...C.map((c, i) => `ส่วนที่ ${i + 1}`), "รวม", "ข้อเสนอแนะ", "เวลาบันทึก"]];
    S.cfg.students.forEach(s => (by[s.sid] || []).forEach(x => det.push([dayLabel(s.date), s.no, s.sid, s.name, tname[x.tid] || x.tid,
        ...its.map(it => x.items[it.id]), ...C.map(c => secSum(c, x.items)), recTotal(x), x.comment || "",
        new Date(x.updatedAt).toLocaleString("th-TH")])));

    const crit = [["ส่วน", "ข้อ", "รายการ", "คะแนนเต็ม"]];
    let k = 0;
    C.forEach((c, i) => c.items.forEach(it => crit.push([`${i + 1}. ${c.name}`, ++k, it.text, it.max])));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(sum);
    ws1["!cols"] = [{ wch: 18 }, { wch: 6 }, { wch: 12 }, { wch: 28 }, { wch: 50 }, { wch: 26 }, ...g.map(() => ({ wch: 14 })), { wch: 10 }, ...C.map(() => ({ wch: 12 })), { wch: 14 }];
    const ws2 = XLSX.utils.aoa_to_sheet(det);
    ws2["!cols"] = [{ wch: 18 }, { wch: 6 }, { wch: 12 }, { wch: 28 }, { wch: 26 }, ...its.map(() => ({ wch: 8 })), ...C.map(() => ({ wch: 9 })), { wch: 8 }, { wch: 40 }, { wch: 20 }];
    const ws3 = XLSX.utils.aoa_to_sheet(crit);
    ws3["!cols"] = [{ wch: 36 }, { wch: 5 }, { wch: 70 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, "สรุปคะแนน");
    XLSX.utils.book_append_sheet(wb, ws2, "รายละเอียด");
    XLSX.utils.book_append_sheet(wb, ws3, "เกณฑ์");
    const d = new Date();
    XLSX.writeFile(wb, `ผลคะแนนสัมมนา_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.xlsx`);
}

// แท่นอันดับ 1–3 (3D) สำหรับเปิดโชว์หน้าห้อง — อัปเดตสดตาม watchAllScores
// เต็มจอด้วย #abody (องค์ประกอบถาวร) เพื่อไม่หลุดจากเต็มจอเมื่อข้อมูลอัปเดตแล้ววาดใหม่
// from = ตำแหน่งที่ซูมอยู่ก่อนกด (ใช้เป็นจุดเริ่มของการเลื่อนกล้อง) — ไม่ส่ง = วาดใหม่เฉย ๆ คงการซูมเดิม
function adminPodium(el, from) {
    const by = scoreIndex(), g = graders();
    const key = r => Math.round(r.avg * 100);
    const rows = S.cfg.students.filter(s => S.aday === "all" || s.date === S.aday)
        .map(s => summary(s, by[s.sid])).filter(r => r.avg != null)
        .sort((a, b) => b.avg - a.avg || a.st.no - b.st.no);
    rows.forEach(r => { r.rank = 1 + rows.filter(x => key(x) > key(r)).length; });
    const top = rows.slice(0, 3), rest = rows.slice(3, 10);
    const order = [1, 0, 2].filter(i => top[i]);                 // ตำแหน่งบนเวที: 2 · 1 · 3
    const enter = !el.dataset.podium; el.dataset.podium = "1";
    // โหมดลุ้น: Space ครั้งที่ 1–3 เปิดและซูมเข้า 3 → 2 → 1, ครั้งสุดท้ายซูมออก + พลุ/กระดาษสี
    // (อ้างตำแหน่งบนแท่น ไม่ใช่ตัวบุคคล)
    const n = top.length;
    S.rv = Math.min(S.rv || 0, n);
    if (!S.hide || S.zoom == null || !top[S.zoom]) S.zoom = null;
    const shown = i => !S.hide || S.rv >= n - i;
    const col = i => { const r = top[i], on = shown(i); return `
      <div class="pcol p${i + 1} ${on ? "" : "hid"} ${S.pop === i ? "pop" : ""}">
        ${i === 0 ? `<i class="rays"></i>` : ""}
        <div class="pcard">${on ? `<div class="pn">${esc(r.st.name)}</div><div class="pt">${esc(r.st.topic)}</div>
          <div class="ps"><span class="num" data-v="${r.avg}">${fmt(S.pop === i ? 0 : r.avg)}</span><small>/${fmt(fullMax())}</small></div>
          <div class="pm">ประเมินแล้ว ${r.n}/${g.length} ท่าน</div>`
          : `<div class="pn">อันดับที่ ${r.rank}</div><div class="ps">?</div><div class="pm">รอเปิดเผย</div>`}</div>
        <div class="blk"><i class="f"><b>${on ? r.rank : "?"}</b></i><i class="t"></i><i class="s"></i></div>
      </div>`; };
    const nextRank = n && S.rv < n ? top[n - S.rv - 1].rank : null;
    // ไฟเวที: รอ = ไฟกวาด, ซูม = สปอตไลต์กลางจอ (แท่นที่ซูมอยู่กลางจอเสมอ), ฉลอง = ไฟสีกวาดเร็ว
    const stage = !S.hide ? "" : S.fin ? "st-fin" : S.zoom != null ? "st-spot" : "st-wait";
    el.innerHTML = `
      <div class="toolbar nofs">
        <select class="btn sm" id="pday"><option value="all">ทุกวัน</option>${S.cfg.days.map(d => `<option value="${d.date}" ${S.aday === d.date ? "selected" : ""}>${esc(d.label)}</option>`).join("")}</select>
        <span class="sp"></span><span class="small muted">คะแนนเฉลี่ยจากอาจารย์ที่ส่งแล้ว · อัปเดตสด</span>
        <button class="btn sm primary" id="fs">โหมดนำเสนอ</button>
      </div>
      <div class="pctl">
        <label><input type="checkbox" id="phide" ${S.hide ? "checked" : ""}> ซ่อนคะแนน (โหมดลุ้น)</label>
        ${S.hide ? `<button class="btn sm primary" id="pnext" ${nextRank == null && (S.fin || !n) ? "disabled" : ""}>${nextRank != null ? "เปิดอันดับที่ " + nextRank : !S.fin && n ? "ซูมออก + ฉลอง" : "เปิดครบแล้ว"}</button>
          <button class="btn sm" id="preset">ซ่อนใหม่</button>
          <button class="btn sm" id="psnd">${SND.on ? "🔊 เสียงเปิด" : "🔇 เสียงปิด"}</button>
          <span class="small muted">กด Space หรือ → เพื่อเปิดอันดับถัดไป</span>` : ""}
      </div>
      <div class="pd ${enter ? "enter" : ""} ${stage}">
        <div class="lights"><i class="beam b1"></i><i class="beam b2"></i><i class="beam b3"></i></div><div class="vig"></div>
        <div class="ptitle">${esc(S.cfg.title)}<small>อันดับคะแนนการนำเสนอ${S.aday === "all" ? "" : " · " + esc((S.cfg.days.find(d => d.date === S.aday) || {}).label || "")}</small></div>
        ${top.length ? `<div class="pzoom"><div class="pscene"><div class="pstage">${order.map(col).join("")}<div class="pfloor"></div></div></div></div>`
            : `<p class="pempty">ยังไม่มีคะแนน — จะแสดงอันดับทันทีที่อาจารย์เริ่มบันทึก</p>`}
        ${rest.length && (!S.hide || S.fin) ? `<ol class="prest" start="${rest[0].rank}">${rest.map(r => `
          <li><span class="rk">${r.rank}</span><span class="nm">${esc(r.st.name)}</span><span class="tp">${esc(r.st.topic)}</span><b>${fmt(r.avg)}</b></li>`).join("")}</ol>` : ""}
      </div>`;
    el.querySelector("#pday").onchange = e => { S.aday = e.target.value; adminPodium(el); };
    const reset = () => { S.rv = 0; S.zoom = null; S.fin = false; };
    el.querySelector("#phide").onchange = e => { S.hide = e.target.checked; reset(); adminPodium(el); };
    const nx = el.querySelector("#pnext");
    if (nx) nx.onclick = () => {
        const prev = S.zoom;
        if (S.rv < n) {
            S.rv++; S.zoom = S.pop = n - S.rv;
            const first = S.zoom === 0;
            sfx("drumroll", ZOOM_S);                             // กลองรัวระหว่างเลื่อนกล้อง → เปิดชื่อพอดีตอนกล้องหยุด
            setTimeout(() => sfx(first ? "fanfare" : "hit"), ZOOM_S * 1000);
        } else if (!S.fin) {
            S.fin = true; S.zoom = null; sfx("hit");
            setTimeout(() => { celebrate(document.getElementById("abody")); sfx("applause", 6); }, 600);
        } else return;
        adminPodium(el, prev);
    };
    const rs = el.querySelector("#preset");
    if (rs) rs.onclick = () => { reset(); adminPodium(el); };
    const sb = el.querySelector("#psnd");
    if (sb) sb.onclick = () => {
        SND.on = !SND.on;
        try { localStorage.setItem("seminar.eval.sound", SND.on ? "1" : "0"); } catch (e) { }
        if (SND.on) sfx("hit");                                  // ทดสอบลำโพง
        adminPodium(el);
    };
    const num = S.pop != null && el.querySelector(".pcol.pop .num");
    if (num) countUp(num, +num.dataset.v, ZOOM_S * 1000, 1200);
    S.pop = null;
    if (from !== undefined) zoomTo(el, from, false);
    zoomTo(el, S.zoom, from !== undefined);
    if (FX.cv && FX.raf) el.appendChild(FX.cv);              // วาดใหม่ระหว่างพลุ → ย้าย canvas กลับเข้ามา
    if (FX.fwbox) el.appendChild(FX.fwbox);
    // โหมดนำเสนอ = เต็มหน้าต่างด้วย CSS — ไม่เรียก requestFullscreen เพราะเต็มจอ + เสียง + ดักปุ่ม
    // ทำให้ Edge Scareware blocker บล็อกทั้งเว็บ (อยากได้ขอบจอจริงให้ผู้ใช้กด F11 เอง)
    el.querySelector("#fs").onclick = () => {
        el.classList.add("pres");
        toast("โหมดนำเสนอ — กด F11 เพื่อเต็มจอ · กด Esc เพื่อออก");
    };
}

const ZOOM_S = 1.1;                                          // ต้องตรงกับ transition ของ .pzoom ใน CSS

// ตัวเลขคะแนนวิ่งจาก 0 ถึงคะแนนจริง (เริ่มหลังกล้องหยุด)
function countUp(node, to, delay, dur) {
    const t0 = performance.now() + delay;
    const step = t => {
        if (!node.isConnected) return;
        const k = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
        node.textContent = fmt(Math.round(to * e * 100) / 100);
        if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ---------- เสียง: ใช้ไฟล์ sounds/<ชื่อ>.mp3 ถ้ามี (ผ่าน Howler) ไม่มีก็สังเคราะห์ด้วย Web Audio ----------
const SND = { on: true, ctx: null, out: null, noise: null, files: {} };
try { SND.on = localStorage.getItem("seminar.eval.sound") !== "0"; } catch (e) { }
if (window.Howl) ["drumroll", "hit", "fanfare", "applause", "boom"].forEach(k => {
    const h = new window.Howl({ src: [`sounds/${k}.mp3`], onload: () => { SND.files[k] = h; }, onloaderror: () => { } });
});

function audio() {
    if (!SND.ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        const c = SND.ctx = new C();
        SND.out = c.createDynamicsCompressor(); SND.out.connect(c.destination);
        const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        SND.noise = b;
    }
    if (SND.ctx.state === "suspended") SND.ctx.resume();
    return SND.ctx;
}
function noise(t, dur, gain, type, freq, q) {
    const c = SND.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = SND.noise; s.loop = true;
    f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    g.gain.setValueAtTime(Math.max(gain, .0001), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(g).connect(SND.out);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
}
function tone(t, freq, dur, gain, type, toFreq, cutoff) {
    const c = SND.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    f.type = "lowpass"; f.frequency.value = cutoff || 8000;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(gain, t + .03);
    g.gain.setValueAtTime(gain, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(f).connect(g).connect(SND.out);
    o.start(t); o.stop(t + dur + .05);
}
const SYNTH = {
    drumroll(t, dur) {                                      // สแนร์รัวแล้วดังขึ้นเรื่อย ๆ
        for (let x = 0; x < dur; x += .04) noise(t + x, .07, .06 + .3 * x / dur, "bandpass", 1900, .7);
        for (let x = 0; x < dur; x += .16) tone(t + x, 110, .15, .12 + .2 * x / dur, "sine", 70);
    },
    hit(t) {                                                // กลองใหญ่ + ฉาบ
        tone(t, 150, .9, .9, "sine", 40);
        noise(t, .25, .7, "lowpass", 900);
        noise(t, 1.6, .35, "highpass", 5000);
    },
    fanfare(t) {                                            // แตร ตะ-ตะ-ตะ-ต้าาา + คอร์ด C major
        const brass = (at, f, d) => { tone(at, f, d, .16, "sawtooth", 0, 2200); tone(at, f * 1.003, d, .1, "sawtooth", 0, 2200); };
        [0, .13, .26].forEach(x => brass(t + x, 392, .12));
        [523.25, 659.25, 783.99, 1046.5].forEach(f => brass(t + .4, f, 1.8));
        SYNTH.hit(t + .4);
    },
    applause(t, dur) {                                      // เสียงปรบมือ = เสียงตบสั้น ๆ จำนวนมาก
        for (let i = 0; i < dur * 160; i++) {
            const x = Math.random() * dur, env = Math.min(1, x / .5) * Math.min(1, (dur - x) / 1.5);
            noise(t + x, .03, .3 * env * (.4 + Math.random() * .6), "bandpass", rnd(800, 2600), 1.3);
        }
    },
    boom(t) {                                               // พลุแตก
        noise(t, 1.1, .6, "lowpass", 260);
        for (let x = .15; x < .9; x += rnd(.03, .09)) noise(t + x, .04, .12, "highpass", 3500);
    }
};
function sfx(name, dur) {
    if (!SND.on) return;
    const h = SND.files[name];
    if (h) {
        const id = h.play();
        if (dur) setTimeout(() => h.fade(h.volume(), 0, 400, id), dur * 1000);
        return;
    }
    const c = audio();
    if (c) SYNTH[name](c.currentTime + .02, dur || 1);
}

// เลื่อนกล้องไปที่แท่นตำแหน่ง i (null = มุมกว้าง) — วัดตำแหน่งตอนไม่ซูม แล้วคืนค่าเดิมก่อนเริ่ม transition
function zoomTo(el, i, animate) {
    const z = el.querySelector(".pzoom");
    if (!z) return;
    const cur = z.style.transform;
    z.style.transition = "none"; z.style.transform = "none";
    let tf = "none";
    const col = i == null ? null : z.querySelector(".pcol.p" + (i + 1));
    if (col) {
        const a = z.getBoundingClientRect(), b = col.getBoundingClientRect();
        const s = Math.max(1, Math.min(2.2, a.width * .8 / b.width, a.height * .95 / b.height));
        const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
        tf = `scale(${s.toFixed(3)}) translate(${-dx}px, ${-dy}px)`;
    }
    z.style.transform = cur; z.getBoundingClientRect();
    z.style.transition = animate ? "" : "none";
    z.style.transform = tf;
}

// ---------- พลุ + กระดาษสี (canvas ทับทั้งจอ ไม่รับคลิก) ----------
const FX = { cv: null, ps: [], until: 0, raf: 0, last: 0, nextRocket: 0 };
const FXC = ["#ffcc00", "#ff4d6d", "#4cc9f0", "#7bd389", "#ffffff", "#f77f00", "#b388ff"];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

function confetti(x, y, count, angle, spread, speed) {
    for (let k = 0; k < count; k++) {
        const a = angle + rnd(-spread, spread), v = rnd(speed * .5, speed);
        FX.ps.push({ k: "c", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, 6.3), vr: rnd(-.2, .2),
            w: rnd(6, 11), h: rnd(9, 16), ph: rnd(0, 6.3), c: pick(FXC), life: rnd(260, 380) });
    }
}
function explode(x, y) {
    const c = pick(FXC), c2 = pick(FXC), m = Math.round(rnd(60, 90));
    for (let k = 0; k < m; k++) {
        const a = k / m * Math.PI * 2, v = rnd(2.5, 5.5);
        FX.ps.push({ k: "s", x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: k % 3 ? c : c2, life: rnd(55, 85), max: 85 });
    }
}
function celebrate(host) {
    if (!host) return;
    if (!FX.cv) { FX.cv = document.createElement("canvas"); FX.cv.className = "fx"; }
    host.appendChild(FX.cv);
    const W = innerWidth, H = innerHeight;
    confetti(0, H, 140, -Math.PI / 3, .35, 22);                // ปืนกระดาษสีมุมซ้ายล่าง
    confetti(W, H, 140, -Math.PI * 2 / 3, .35, 22);            // มุมขวาล่าง
    FX.until = performance.now() + 7000; FX.nextRocket = 0;
    // พลุจาก fireworks-js (สวยกว่า) ถ้าโหลดไม่ได้ใช้พลุที่วาดเองใน fxTick
    const FW = window.Fireworks && (window.Fireworks.Fireworks || window.Fireworks.default);
    if (FW) {
        try {
            if (!FX.fwbox) { FX.fwbox = document.createElement("div"); FX.fwbox.className = "fwbox"; }
            host.appendChild(FX.fwbox);
            if (!FX.fw) FX.fw = new FW(FX.fwbox, {
                autoresize: true, opacity: .5, acceleration: 1.05, friction: .97, gravity: 1.5,
                particles: 110, traceLength: 3, traceSpeed: 10, explosion: 7, intensity: 35, flickering: 50,
                lineStyle: "round", hue: { min: 0, max: 360 }, delay: { min: 25, max: 50 },
                rocketsPoint: { min: 15, max: 85 }, brightness: { min: 55, max: 85 }, decay: { min: .015, max: .03 },
                lineWidth: { explosion: { min: 1, max: 3.5 }, trace: { min: 1, max: 2 } },
                mouse: { click: false, move: false, max: 1 }, sound: { enabled: false }
            });
            FX.fw.start(); FX.lib = true;
            clearTimeout(FX.fwT);
            FX.fwT = setTimeout(() => { FX.fw.waitStop ? FX.fw.waitStop() : FX.fw.stop(); FX.lib = false; }, 7000);
        } catch (e) { console.error(e); FX.lib = false; }
    }
    for (let k = 0; k < 14; k++) setTimeout(() => sfx("boom"), rnd(200, 7000));
    if (!FX.raf) { FX.last = performance.now(); FX.raf = requestAnimationFrame(fxTick); }
}
function fxTick(t) {
    const cv = FX.cv, dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext("2d"), f = Math.min(3, (t - FX.last) / 16.7);
    FX.last = t;
    if (t < FX.until) {
        if (!FX.lib && t > FX.nextRocket) {
            FX.ps.push({ k: "r", x: rnd(W * .15, W * .85), y: H, vx: rnd(-1, 1), vy: -rnd(11, 15), ty: rnd(H * .12, H * .4), c: "#fff" });
            FX.nextRocket = t + rnd(250, 550);
        }
        if (t < FX.until - 2500) confetti(rnd(0, W), -20, 3, Math.PI / 2, .3, 3);   // ฝนกระดาษสีจากด้านบน
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    FX.ps = FX.ps.filter(p => {
        if (p.k === "r") {
            p.x += p.vx * f; p.y += p.vy * f; p.vy += .12 * f;
            if (p.y <= p.ty || p.vy >= -1) { explode(p.x, p.y); return false; }
            g.fillStyle = "#fff"; g.globalAlpha = 1; g.fillRect(p.x - 1.5, p.y, 3, 10);
            return true;
        }
        p.life -= f;
        if (p.life <= 0) return false;
        if (p.k === "s") {
            p.px = p.x; p.py = p.y;
            p.vx *= Math.pow(.97, f); p.vy = p.vy * Math.pow(.97, f) + .06 * f;
            p.x += p.vx * f; p.y += p.vy * f;
            g.globalAlpha = Math.min(1, p.life / p.max * 1.4);
            g.strokeStyle = p.c; g.lineWidth = 2.2;
            g.beginPath(); g.moveTo(p.px, p.py); g.lineTo(p.x, p.y); g.stroke();
            return true;
        }
        // กระดาษสี: ร่วงช้า ๆ แกว่งซ้ายขวา และพลิกหน้า
        p.vx *= Math.pow(.96, f); p.vy = Math.min(p.vy * Math.pow(.96, f) + .25 * f, 4.5);
        p.ph += .08 * f; p.rot += p.vr * f;
        p.x += (p.vx + Math.sin(p.ph) * 1.2) * f; p.y += p.vy * f;
        if (p.y > H + 30) return false;
        g.globalAlpha = Math.min(1, p.life / 60);
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.ph * 2));
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
        return true;
    });
    g.globalAlpha = 1;
    if (t < FX.until || FX.ps.length) FX.raf = requestAnimationFrame(fxTick);
    else { FX.raf = 0; cv.remove(); }
}

document.addEventListener("keydown", e => {
    const ab = document.getElementById("abody");
    if (e.key === "Escape" && ab && ab.classList.contains("pres")) { ab.classList.remove("pres"); return; }
    const nx = document.getElementById("pnext");
    if (!nx || S.atab !== "podium" || !location.hash.startsWith("#/admin")) return;
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(e.target.tagName)) return;
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); nx.click(); }
});

function adminCriteria(el) {
    if (!S.crit) S.crit = S.cfg.criteria.map(s => ({ name: s.name, items: s.items.map(i => Object.assign({}, i)) }));
    const C = S.crit, sec = s => s.items.reduce((a, i) => a + (Number(i.max) || 0), 0);
    const total = C.reduce((a, s) => a + sec(s), 0), n = C.reduce((a, s) => a + s.items.length, 0);
    el.innerHTML = `<div class="card">
      <h2>เกณฑ์การประเมิน</h2>
      <p class="small muted" style="margin-top:0">แก้ชื่อส่วน รายการประเมิน และคะแนนเต็มรายข้อได้ (เพิ่มทีละ 0.5, สูงสุด 20 ข้อ) · คะแนนเต็มของแต่ละส่วนคิดจากผลรวมของข้อในส่วนนั้น ·
        มีผลกับอาจารย์ทันทีที่บันทึก <b>ควรแก้ก่อนเริ่มให้คะแนน</b> — ถ้าแก้หลังมีคะแนนแล้ว ใบประเมินเดิมจะถูกนับใหม่ตามเกณฑ์ปัจจุบัน (ข้อที่เพิ่มใหม่นับเป็น 0 จนกว่าอาจารย์จะบันทึกซ้ำ)</p>
      ${C.map((s, si) => `
        <section class="sec" style="margin:0 0 12px">
          <div class="sh"><b>ส่วนที่ ${si + 1}</b>
            <input data-s="${si}" data-k="name" value="${esc(s.name)}" placeholder="ชื่อส่วน" style="flex:1;min-width:0;margin:0 8px">
            <span class="sub">${fmt(sec(s))}</span><span class="cap">คะแนน</span>
            <button class="btn sm danger" data-dels="${si}" style="margin-left:8px">ลบส่วน</button></div>
          ${s.items.map((it, ii) => `
            <div class="item" style="display:flex;gap:8px;align-items:flex-start">
              <span class="muted" style="padding-top:8px">${ii + 1}.</span>
              <textarea class="field" rows="2" data-s="${si}" data-i="${ii}" data-k="text" placeholder="รายการประเมิน" style="flex:1;min-width:0">${esc(it.text)}</textarea>
              <input class="num" type="number" inputmode="decimal" min="0.5" max="100" step="0.5" data-s="${si}" data-i="${ii}" data-k="max" value="${esc(it.max)}" style="width:72px" aria-label="คะแนนเต็ม">
              <button class="btn sm danger" data-deli="${si}.${ii}" title="ลบข้อนี้">ลบ</button>
            </div>`).join("")}
          <div class="item"><button class="btn sm" data-addi="${si}">+ เพิ่มข้อ</button></div>
        </section>`).join("")}
      <div class="toolbar" style="margin:12px 0 0"><button class="btn sm" id="adds">+ เพิ่มส่วน</button>
        <span class="small muted">${n} ข้อ · รวม <b>${fmt(total)}</b> คะแนน${total !== 100 ? " (ไม่เท่ากับ 100)" : ""}</span><span class="sp"></span>
        <button class="btn sm" id="undoc">ยกเลิกการแก้ไข</button><button class="btn sm primary" id="savec">บันทึกเกณฑ์</button></div>
    </div>`;
    // พิมพ์ได้ต่อเนื่อง: เก็บค่าลง state โดยไม่วาดหน้าใหม่ แล้วอัปเดตเฉพาะตัวเลขรวม
    el.querySelectorAll("[data-k]").forEach(inp => inp.oninput = () => {
        const s = C[+inp.dataset.s];
        (inp.dataset.i == null ? s : s.items[+inp.dataset.i])[inp.dataset.k] = inp.value;
    });
    el.querySelectorAll("input[data-k=max]").forEach(inp => inp.onchange = () => adminCriteria(el));
    el.querySelectorAll("[data-dels]").forEach(b => b.onclick = () => {
        if (C.length > 1 && confirm("ลบทั้งส่วนนี้?")) { C.splice(+b.dataset.dels, 1); adminCriteria(el); }
        else if (C.length <= 1) toast("ต้องมีอย่างน้อย 1 ส่วน", true);
    });
    el.querySelectorAll("[data-deli]").forEach(b => b.onclick = () => {
        const [si, ii] = b.dataset.deli.split(".").map(Number);
        if (C[si].items.length <= 1) return toast("แต่ละส่วนต้องมีอย่างน้อย 1 ข้อ", true);
        C[si].items.splice(ii, 1); adminCriteria(el);
    });
    el.querySelectorAll("[data-addi]").forEach(b => b.onclick = () => {
        if (n >= 20) return toast("มีรายการประเมินได้ไม่เกิน 20 ข้อ", true);
        C[+b.dataset.addi].items.push({ id: "", max: 10, text: "" }); adminCriteria(el);
    });
    el.querySelector("#adds").onclick = () => {
        if (n >= 20) return toast("มีรายการประเมินได้ไม่เกิน 20 ข้อ", true);
        C.push({ name: "", items: [{ id: "", max: 10, text: "" }] }); adminCriteria(el);
    };
    el.querySelector("#undoc").onclick = () => { S.crit = null; adminCriteria(el); };
    el.querySelector("#savec").onclick = async e => {
        const btn = e.currentTarget; btn.disabled = true;
        try {
            S.cfg.criteria = await API.saveCriteria(C.map(s => ({
                name: s.name, items: s.items.map(i => ({ id: i.id, max: Number(i.max), text: i.text }))
            })));
            S.crit = null;
            toast("บันทึกเกณฑ์แล้ว"); adminCriteria(el);
        } catch (err) { btn.disabled = false; toast(errMsg(err), true); }
    };
}

function adminUsers(el) {
    if (!S.users) S.users = S.cfg.teachers.map(t => Object.assign({}, t));
    const rows = S.users.map((t, i) => `<tr>
      <td><input data-i="${i}" data-k="name" value="${esc(t.name)}" placeholder="ชื่อ-นามสกุล"></td>
      <td><input data-i="${i}" data-k="email" value="${esc(t.email)}" placeholder="name@${esc(S.cfg.domain)}" type="email"></td>
      <td><select data-i="${i}" data-k="role">${Object.entries(ROLE).map(([k, l]) => `<option value="${k}" ${t.role === k ? "selected" : ""}>${l}</option>`).join("")}</select></td>
      <td><button class="btn sm danger" data-del="${i}" title="ลบ">ลบ</button></td></tr>`).join("");
    el.innerHTML = `<div class="card">
      <h2>ผู้มีสิทธิ์เข้าใช้งาน</h2>
      <p class="small muted" style="margin-top:0">เข้าสู่ระบบได้เฉพาะอีเมล @${esc(S.cfg.domain)} ของอาจารย์ที่อยู่ในรายการนี้ (บัญชีนักศึกษาเพิ่มไม่ได้) ·
        <b>อาจารย์ผู้ประเมิน</b> ให้คะแนนได้ · <b>ผู้ดูแลระบบ</b> ดูผล ส่งออก และจัดการสิทธิ์ได้</p>
      ${S.user.superAdmin ? `<p class="small muted">บัญชี ${esc(S.user.email)} เป็นผู้ดูแลถาวร (กำหนดไว้ในระบบ) จึงไม่แสดงในรายการนี้</p>` : ""}
      <div class="tscroll"><table class="t users"><thead><tr><th>ชื่อ</th><th>อีเมลสถาบัน</th><th>สิทธิ์</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="toolbar" style="margin:12px 0 0"><button class="btn sm" id="add">+ เพิ่มผู้ใช้</button><span class="sp"></span>
        <button class="btn sm" id="undo">ยกเลิกการแก้ไข</button><button class="btn sm primary" id="saveu">บันทึก</button></div>
    </div>`;
    el.querySelectorAll("[data-k]").forEach(inp => inp.oninput = inp.onchange = () => { S.users[+inp.dataset.i][inp.dataset.k] = inp.value; });
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
        const t = S.users[+b.dataset.del];
        if (S.all.some(r => r.tid === t.id) && !confirm(`${t.name} ให้คะแนนไปแล้ว ถ้าลบออก คะแนนเหล่านั้นจะไม่ถูกนับในสรุป ยืนยัน?`)) return;
        S.users.splice(+b.dataset.del, 1); adminUsers(el);
    });
    el.querySelector("#add").onclick = () => { S.users.push({ id: "new-" + Date.now().toString(36), name: "", email: "", role: "teacher" }); adminUsers(el); };
    el.querySelector("#undo").onclick = () => { S.users = null; adminUsers(el); };
    el.querySelector("#saveu").onclick = async e => {
        const btn = e.currentTarget; btn.disabled = true;
        try {
            S.cfg.teachers = await API.saveTeachers(S.users.map(t => Object.assign({}, t)));
            S.users = null;
            S.user = await API.currentUser();
            toast("บันทึกรายชื่อผู้ใช้แล้ว"); renderAdmin();
        } catch (err) { btn.disabled = false; toast(errMsg(err), true); }
    };
}

boot();
