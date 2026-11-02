// abstract-appsscript.gs
// คืนรายชื่อไฟล์บทคัดย่อในโฟลเดอร์ Drive เป็น JSON { ok: true, files: { "66040130": "<fileId>", ... } }
// ชื่อไฟล์ต้องเป็น <รหัสนักศึกษา>.pdf — หน้าประเมิน (seminar-eval-app.js) ใช้ fileId สร้างลิงก์เปิดไฟล์
//
// วิธีติดตั้ง
//  1) script.google.com → โปรเจกต์ใหม่ → วางโค้ดนี้ แล้วแก้ FOLDER_ID เป็นรหัสโฟลเดอร์บทคัดย่อ
//     (ส่วนท้ายของลิงก์โฟลเดอร์ drive.google.com/drive/folders/<FOLDER_ID>)
//  2) Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone
//  3) คัดลอก URL (ลงท้าย /exec) ไปใส่ abstractApi ใน seminar-eval-data.js
//  4) ไฟล์ในโฟลเดอร์ต้องแชร์เป็น "ทุกคนที่มีลิงก์" หรือแชร์ให้อาจารย์ผู้ประเมิน ไม่เช่นนั้นเปิดไฟล์ไม่ได้
//  ถ้าเพิ่มไฟล์ใหม่ รายชื่อจะอัปเดตภายใน 5 นาที (แคช)

const FOLDER_ID = 'PUT_ABSTRACT_FOLDER_ID_HERE';
const CACHE_SEC = 300;

function doGet() {
  try {
    const cache = CacheService.getScriptCache();
    let json = cache.get('abstracts');
    if (!json) {
      const files = {};
      const it = DriveApp.getFolderById(FOLDER_ID).getFiles();
      while (it.hasNext()) {
        const f = it.next();
        const m = f.getName().match(/^(\d{8})\.pdf$/i);
        if (m) files[m[1]] = f.getId();
      }
      json = JSON.stringify({ ok: true, files: files });
      cache.put('abstracts', json, CACHE_SEC);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
