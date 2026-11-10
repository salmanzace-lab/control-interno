/**
 * BACKEND GOOGLE APPS SCRIPT · CONTROL INTERNO 2026
 * Este proyecto se despliega como Web App y usa Google Sheets como registro
 * de metadatos y Google Drive para conservar los archivos.
 *
 * Configurar en Project Settings > Script Properties:
 * SPREADSHEET_ID       ID de una hoja de cálculo nueva para registros
 * DRIVE_FOLDER_ID      ID de carpeta raíz institucional en Drive
 * ADMIN_TOKEN          Clave temporal del tablero administrativo
 * AREA_CODES_JSON      JSON: {"Nombre exacto del área":"código"}
 *
 * No reutilizar IDs ni carpetas del ejercicio 2025 sin autorización.
 */

const PROP = PropertiesService.getScriptProperties();
const SUBMISSIONS_SHEET = "Respuestas";
const FILES_SHEET = "Evidencias";

function doGet(e) {
  const p = e.parameter || {};
  const callback = String(p.callback || "");
  let result;
  try {
    if (p.action === "list") {
      const area = String(p.area || "");
      verifyArea_(area, String(p.code || ""));
      result = { ok: true, records: listByArea_(area) };
    } else if (p.action === "admin") {
      if (!safeEqual_(String(p.token || ""), PROP.getProperty("ADMIN_TOKEN") || "")) {
        throw new Error("Acceso administrativo no autorizado.");
      }
      result = { ok: true, records: listAll_() };
    } else {
      result = { ok: true, service: "Control Interno 2026 API" };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  const json = JSON.stringify(result).replace(/</g, "\\u003c");
  if (!/^[A-Za-z_$][\w.$]*$/.test(callback)) {
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(callback + "(" + json + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) throw new Error("No se recibió información.");
    const data = JSON.parse(raw);
    if (data.action !== "save") throw new Error("Acción no reconocida.");
    const area = String(data.area || "");
    verifyArea_(area, String(data.area_code || ""));
    saveSubmission_(data);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function setup_() {
  const spreadsheetId = PROP.getProperty("SPREADSHEET_ID");
  const folderId = PROP.getProperty("DRIVE_FOLDER_ID");
  if (!spreadsheetId || !folderId) throw new Error("Configura SPREADSHEET_ID y DRIVE_FOLDER_ID en Script Properties.");
  const ss = SpreadsheetApp.openById(spreadsheetId);
  ensureSheet_(ss, SUBMISSIONS_SHEET, ["action_key","action_number","component","area","response","status","updated_at","folder_url"]);
  ensureSheet_(ss, FILES_SHEET, ["action_key","area","file_name","mime_type","file_id","file_url","uploaded_at"]);
  DriveApp.getFolderById(folderId);
  return "Configuración verificada.";
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
}

function verifyArea_(area, code) {
  if (!area) throw new Error("Área no especificada.");
  const codes = JSON.parse(PROP.getProperty("AREA_CODES_JSON") || "{}");
  if (!Object.prototype.hasOwnProperty.call(codes, area)) throw new Error("Área no habilitada.");
  if (!safeEqual_(String(codes[area]), String(code))) throw new Error("Código de área incorrecto.");
}

function safeEqual_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function saveSubmission_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.openById(PROP.getProperty("SPREADSHEET_ID"));
    const sh = ss.getSheetByName(SUBMISSIONS_SHEET);
    const folderRoot = DriveApp.getFolderById(PROP.getProperty("DRIVE_FOLDER_ID"));
    const areaFolder = getOrCreateFolder_(folderRoot, safeFolder_(data.area));
    const actionFolder = getOrCreateFolder_(areaFolder, "Accion_" + Number(data.action_number));
    const uploaded = [];
    (data.files || []).forEach(file => {
      if (!file.name || !file.base64) return;
      const bytes = Utilities.base64Decode(file.base64);
      if (bytes.length > 5 * 1024 * 1024) throw new Error("Archivo superior a 5 MB.");
      const blob = Utilities.newBlob(bytes, file.mimeType || "application/octet-stream", safeFile_(file.name));
      const created = actionFolder.createFile(blob);
      uploaded.push({ name: created.getName(), url: created.getUrl(), id: created.getId(), mime: created.getMimeType() });
    });
    const now = new Date();
    const row = findSubmissionRow_(sh, String(data.action_key), String(data.area));
    const folderUrl = actionFolder.getUrl();
    const values = [String(data.action_key), Number(data.action_number), String(data.component), String(data.area),
      String(data.response || ""), String(data.status || "pendiente"), now, folderUrl];
    if (row) sh.getRange(row, 1, 1, values.length).setValues([values]);
    else sh.appendRow(values);
    const fileSheet = ss.getSheetByName(FILES_SHEET);
    uploaded.forEach(f => fileSheet.appendRow([data.action_key, data.area, f.name, f.mime, f.id, f.url, now]));
  } finally {
    lock.releaseLock();
  }
}

function findSubmissionRow_(sh, actionKey, area) {
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === actionKey && String(values[i][3]) === area) return i + 1;
  }
  return 0;
}

function listByArea_(area) {
  return listAll_().filter(r => r.area === area);
}

function listAll_() {
  const ss = SpreadsheetApp.openById(PROP.getProperty("SPREADSHEET_ID"));
  const sh = ss.getSheetByName(SUBMISSIONS_SHEET);
  const fileSh = ss.getSheetByName(FILES_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getDataRange().getValues().slice(1);
  const fileRows = fileSh && fileSh.getLastRow() > 1 ? fileSh.getDataRange().getValues().slice(1) : [];
  return rows.map(r => ({
    action_key: String(r[0]), action_number: Number(r[1]), component: String(r[2]),
    area: String(r[3]), response: String(r[4]), status: String(r[5]),
    updated_at: r[6] instanceof Date ? r[6].toISOString() : String(r[6]),
    folder_url: String(r[7] || ""),
    files: fileRows.filter(f => String(f[0]) === String(r[0]) && String(f[1]) === String(r[3]))
      .map(f => ({ name: String(f[2]), url: String(f[5] || "") }))
  }));
}

function getOrCreateFolder_(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}
function safeFolder_(s) { return String(s || "Area").replace(/[\\/:*?"<>|#%{}~&]/g, "_").substring(0, 80); }
function safeFile_(s) { return String(s || "evidencia").replace(/[\\/:*?"<>|#%{}~&]/g, "_").substring(0, 120); }
