// ═══════════════════════════════════════════════════════════════════
// SOPHIA · Automation "Alta participantes desde ventas"
// Step: Run Script
//
// ── ESTRUCTURA DE LA AUTOMATION ──────────────────────────────────
//
//   1. Trigger: "When webhook is received"
//   2. Action: Run Script  ← "Crear invitación SOPHIA"
//
// NO usa Repeating action. Este script recibe los participantes como
// arrays (Airtable expone los valores del array `participantes` del
// trigger como listas planas por campo) y los procesa internamente con
// un loop. Por cada participante:
//   - Crea o reusa Persona CRM
//   - Crea Invitación en PORTAL con token único
//   - Manda un webhook independiente a GHL
//
// ── INPUTS DEL SCRIPT (Variables panel) ──────────────────────────
//
//   nombre        ← Trigger > participantes > nombre
//   apellidos     ← Trigger > participantes > apellidos
//   email         ← Trigger > participantes > email
//   rol           ← Trigger > participantes > rol
//   cohorteId     ← Trigger > cohorteId
//   cohorteNombre ← Trigger > cohorteNombre
//   portalPat     ← (texto fijo) tu Airtable PAT
//
//   Cuando el trigger trae 1 participante, los inputs son strings.
//   Cuando trae N participantes, Airtable los pasa como arrays — el
//   script normaliza ambos casos a array.
//
// ═══════════════════════════════════════════════════════════════════

const config = input.config();

// ─── Schemas ──────────────────────────────────────────────────────
const PORTAL_BASE_ID     = "app0S6GrJQ8YatvCc";
const INVITACIONES_TABLE = "tblzNARG9ahLsKR9c";
const COHORTES_TABLE     = "tblMwkKfk6U7a75Ja";
const FLD_FECHA_INICIO       = "fldoqWrG9zEdeKWGt";
const FLD_HORA_INICIO        = "fld65dDf16bS1wR25";
const FLD_COORD_NOMBRE       = "fldU2xqvEFk0dHo4T"; // Director / Coordinador (texto)
const FLD_COORD_EMAIL        = "fldfNGBjnefsgapH7"; // Director email
const FLD_COORD_WHATSAPP     = "fldcfirbPH4TmB7OW"; // Coordinador WhatsApp
const FLD_COORD_FOTO_URL     = "fld4RobmNveKH3dLs"; // Coordinador Foto URL
const FLD_COORD_MENSAJE      = "fldZlEH4zEhdrekEc"; // Coordinador Mensaje
const INV = {
  TOKEN:              "fldn1D8JFG7n2RYfA",
  EMAIL_DESTINATARIO: "fldZK5s5m208cR5r6",
  COHORTE:            "fldKDSCMDaJgHKZ60",
  ESTATUS:            "fldHtt9NUtcU0795f",
  ORIGEN:             "fldw4WgogSTJamWsq",
};
const PERSONAS_CRM = base.getTable("tbl5XKtg0mRfLeFYH");
const P = {
  NOMBRE:    "fldEbEI3pLEAmlYAe",
  APELLIDOS: "fldCnRa0XFvH1FtfQ",
  EMAIL:     "fldJlxMp6NKCpvAuv",
  ROL:       "fldOF0bnjfErxEOCO",  // singleSelect: participante / admin / instructor / profesor / facilitador / coordinador
};
const GHL_WEBHOOK = "https://services.leadconnectorhq.com/hooks/ek1LQvM0Kyj7fll9nDO7/webhook-trigger/845cecc4-28cd-4408-99b3-fd6622365af3";

// ─── Helpers ─────────────────────────────────────────────────────
// Airtable puede pasar el input como:
//   - Array nativo: ["a", "b"]
//   - String con comas: "a, b"
//   - String simple: "a"
// Normalizamos a array siempre.
function toArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
  const s = String(val).trim();
  if (!s) return [];
  // Si tiene comas, dividir; si no, tratar como un solo elemento
  if (s.includes(",")) return s.split(",").map(v => v.trim()).filter(Boolean);
  return [s];
}

function generateToken() {
  // "inv_" + 28 chars hex (32 total). El prefijo es obligatorio:
  // auth.js y claim-invitation validan /^inv_[A-Za-z0-9_-]{4,40}$/
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let t = "inv_";
  for (let i = 0; i < 28; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

// Formatea "2026-05-12" → "Martes, 12 de mayo de 2026" para que se vea
// bonito en el email de GHL. Si la fecha es inválida, devuelve "" para no
// romper el correo (queda solo la hora).
//
// OJO con zonas horarias: Airtable guarda dates como ISO sin hora. Si
// hacemos new Date("2026-05-12") se interpreta como UTC midnight, lo que
// en MX (UTC-6) es May 11 a las 18:00. Para evitar shift, parseamos a
// mediodía UTC y leemos con getUTC*().
function formatFechaEs(isoDate) {
  if (!isoDate) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate; // fallback: devolver tal cual si no es ISO
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const dia = dias[date.getUTCDay()];
  const numero = date.getUTCDate();
  const mes = meses[date.getUTCMonth()];
  const ano = date.getUTCFullYear();
  return `${dia}, ${numero} de ${mes} de ${ano}`;
}

// Calcula iniciales del coordinador: "Natalia Arriaga" → "NA",
// "Irelda Walls Boone" → "IW". Útil como fallback para el avatar del email.
function calcIniciales(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SC";
  const first = parts[0][0] || "";
  const second = parts[1] ? parts[1][0] : "";
  return (first + second).toUpperCase();
}

// Para el link de WhatsApp, devolvemos solo dígitos (formato wa.me).
function whatsappDigits(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

// Formatea un teléfono mexicano para que se vea legible en el email.
// Acepta cualquier input con o sin "+" y produce "+52 81 8011 1608"
// para los números mexicanos típicos (LADA 2 + 8 dígitos = 10 dígitos
// después del 52). Para otros formatos devuelve el input tal cual con
// un espacio después del país, intentando no romper.
function whatsappPretty(phone) {
  const digits = whatsappDigits(phone);
  if (!digits) return "";
  // Mexico: 52 + 10 dígitos → +52 LA AAAA BBBB (lada 2 + 4+4)
  if (digits.startsWith("52") && digits.length === 12) {
    return `+52 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  }
  // Mexico móvil viejo: 521 + 10 dígitos (legacy, mismo display)
  if (digits.startsWith("521") && digits.length === 13) {
    return `+52 ${digits.slice(3, 5)} ${digits.slice(5, 9)} ${digits.slice(9, 13)}`;
  }
  // USA: 1 + 10 dígitos → +1 (AAA) BBB-CCCC
  if (digits.startsWith("1") && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
  // Fallback: solo agregar "+" al inicio
  return `+${digits}`;
}

// ─── Extraer y normalizar inputs ─────────────────────────────────
const nombres    = toArray(config.nombre);
const apellidos  = toArray(config.apellidos);
const emails     = toArray(config.email).map(e => e.toLowerCase());
const roles      = toArray(config.rol);

const cohorteId     = String(config.cohorteId     || "").trim();
const cohorteNombre = String(config.cohorteNombre || "").trim();
const portalPat     = String(config.portalPat     || "").trim();

if (emails.length === 0) {
  output.set("ok", false);
  output.set("error", "No se recibió ningún participante");
  return;
}
if (!cohorteId || !portalPat) {
  output.set("ok", false);
  output.set("error", "Faltan cohorteId o portalPat");
  return;
}

console.log(`Procesando ${emails.length} participante(s) para cohorte ${cohorteNombre}`);

// ─── 1. Fetch fecha, hora y datos del coordinador desde Cohortes ──
let primeraSesionFecha = "";
let primeraSesionHora  = "";
let coordinadorNombre   = "";
let coordinadorEmail    = "";
let coordinadorWhatsapp = "";
let coordinadorFotoUrl  = "";
let coordinadorMensaje  = "";
try {
  const cohorteRes = await fetch(
    `https://api.airtable.com/v0/${PORTAL_BASE_ID}/${COHORTES_TABLE}/${cohorteId}?returnFieldsByFieldId=true`,
    { headers: { "Authorization": `Bearer ${portalPat}` } },
  );
  if (cohorteRes.ok) {
    const cohorteData = await cohorteRes.json();
    const rawFecha = String(cohorteData.fields?.[FLD_FECHA_INICIO] || "").trim();
    primeraSesionFecha   = formatFechaEs(rawFecha);
    primeraSesionHora    = String(cohorteData.fields?.[FLD_HORA_INICIO]    || "").trim();
    coordinadorNombre    = String(cohorteData.fields?.[FLD_COORD_NOMBRE]   || "").trim();
    coordinadorEmail     = String(cohorteData.fields?.[FLD_COORD_EMAIL]    || "").trim();
    coordinadorWhatsapp  = String(cohorteData.fields?.[FLD_COORD_WHATSAPP] || "").trim();
    coordinadorFotoUrl   = String(cohorteData.fields?.[FLD_COORD_FOTO_URL] || "").trim();
    coordinadorMensaje   = String(cohorteData.fields?.[FLD_COORD_MENSAJE]  || "").trim();
    console.log(`Cohorte: fecha=${primeraSesionFecha} hora=${primeraSesionHora} coord=${coordinadorNombre}`);
  } else {
    console.error(`Cohorte fetch failed (${cohorteRes.status}): ${cohorteId}`);
  }
} catch (e) {
  console.error(`Cohorte fetch threw: ${e.message || e}`);
}

const coordinadorIniciales = calcIniciales(coordinadorNombre);
const coordinadorWhatsappDigits = whatsappDigits(coordinadorWhatsapp);
const coordinadorWhatsappPretty = whatsappPretty(coordinadorWhatsapp);

// ─── 2. Cargar Personas CRM una sola vez (para hacer lookup eficiente) ────
const allPersonas = await PERSONAS_CRM.selectRecordsAsync({
  fields: [P.EMAIL],
});
const personaIdByEmail = new Map();
for (const r of allPersonas.records) {
  const e = String(r.getCellValueAsString(P.EMAIL) || "").trim().toLowerCase();
  if (e) personaIdByEmail.set(e, r.id);
}

// ─── 3. Loop por participante ────────────────────────────────────
const resultsOk = [];
const errores = [];

for (let i = 0; i < emails.length; i++) {
  const email = emails[i];
  // Si nombres/apellidos/roles tienen menos elementos que emails,
  // usar el último valor disponible como fallback (caso típico cuando
  // se inscribe una sola fila pero múltiples emails — raro, pero seguro)
  const nombre    = nombres[i]    ?? nombres[nombres.length - 1]       ?? "";
  const apellido  = apellidos[i]  ?? apellidos[apellidos.length - 1]   ?? "";
  // Rol por participante. Default a "participante" si no viene o no
  // empata con la lista del form. Esto evita romper Airtable si el
  // singleSelect no tiene la opción exacta (aunque typecast: true las
  // crea on-the-fly cuando llegan nuevas).
  const rol       = (roles[i]     ?? roles[roles.length - 1]           ?? "participante")
                      .toString().trim().toLowerCase() || "participante";

  if (!email || !nombre || !apellido) {
    errores.push({ email, motivo: "Faltan nombre, apellidos o email" });
    continue;
  }

  try {
    // 3.1 Encontrar o crear Persona CRM
    let personaId = personaIdByEmail.get(email);
    if (!personaId) {
      personaId = await PERSONAS_CRM.createRecordAsync({
        [P.NOMBRE]:    nombre,
        [P.APELLIDOS]: apellido,
        [P.EMAIL]:     email,
        [P.ROL]:       { name: rol },
      });
      personaIdByEmail.set(email, personaId);
      console.log(`✓ Persona CRM creada: ${personaId} (${email}, rol=${rol})`);
    } else {
      console.log(`↻ Persona CRM existente: ${personaId} (${email})`);
    }

    // 3.2 Generar token + crear Invitación en PORTAL
    const inviteToken = generateToken();
    const inviteRes = await fetch(
      `https://api.airtable.com/v0/${PORTAL_BASE_ID}/${INVITACIONES_TABLE}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${portalPat}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          records: [{
            fields: {
              [INV.TOKEN]:              inviteToken,
              [INV.EMAIL_DESTINATARIO]: email,
              [INV.COHORTE]:            [cohorteId],
              [INV.ESTATUS]:            "pendiente",
              [INV.ORIGEN]:             "alta-ventas",
            },
          }],
          typecast: true,
        }),
      },
    );

    if (!inviteRes.ok) {
      const errText = await inviteRes.text();
      throw new Error(`Invitación API ${inviteRes.status}: ${errText.slice(0, 150)}`);
    }

    const linkInvitacion = `https://portal.sophiamx.org/?invite=${inviteToken}`;
    console.log(`✓ Invitación creada para ${email}: ${linkInvitacion}`);

    // 3.3 Enviar webhook independiente a GHL para ESTA persona
    const ghlRes = await fetch(GHL_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:                       email,
        nombre:                      nombre,
        apellidos:                   apellido,
        rol:                         rol,
        cursoNombre:                 cohorteNombre,
        primeraSesionFecha:          primeraSesionFecha,
        primeraSesionHora:           primeraSesionHora,
        linkInvitacion:              linkInvitacion,
        coordinadorNombre:           coordinadorNombre,
        coordinadorEmail:            coordinadorEmail,
        coordinadorWhatsapp:         coordinadorWhatsapp,
        coordinadorWhatsappDigits:   coordinadorWhatsappDigits,
        coordinadorWhatsappPretty:   coordinadorWhatsappPretty,
        coordinadorFotoUrl:          coordinadorFotoUrl,
        coordinadorMensaje:          coordinadorMensaje,
        coordinadorIniciales:        coordinadorIniciales,
      }),
    });

    if (!ghlRes.ok) {
      const errText = await ghlRes.text();
      // No abortamos — la invitación ya quedó. Solo logueamos.
      console.error(`GHL webhook error para ${email} (${ghlRes.status}): ${errText.slice(0, 150)}`);
    } else {
      console.log(`✓ GHL notificado para ${email}`);
    }

    resultsOk.push({ email, nombre, apellidos: apellido, linkInvitacion });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Error procesando ${email}: ${msg}`);
    errores.push({ email, motivo: msg });
  }
}

// ─── 4. Output ────────────────────────────────────────────────────
output.set("ok",              true);
output.set("totalProcesados", resultsOk.length);
output.set("totalErrores",    errores.length);
output.set("cursoNombre",     cohorteNombre);
console.log(`Resumen: ${resultsOk.length} OK, ${errores.length} errores`);
