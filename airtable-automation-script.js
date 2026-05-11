// ═══════════════════════════════════════════════════════════════════
// SOPHIA · Automation "Alta participantes desde ventas"
// Step: Run Script  (dentro de un Repeating action)
//
// ── ESTRUCTURA DE LA AUTOMATION ──────────────────────────────────
//
//   1. Trigger: "When webhook is received"
//
//   2. Action: Repeating group
//      → Run for each: Trigger > participantes
//      (Airtable itera el array y expone cada elemento como
//       "Current item")
//
//      Dentro del Repeating group:
//
//   3. Action: Run Script  ← "Crear invitación SOPHIA"
//      Inputs (todos escalares):
//
//      nombre        ← Current item > nombre
//      apellidos     ← Current item > apellidos
//      email         ← Current item > email
//      rol           ← Current item > rol
//      cohorteId     ← Trigger > cohorteId
//      cohorteNombre ← Trigger > cohorteNombre
//      portalPat     ← (texto fijo) pega tu Airtable PAT aquí
//
//      El script fetcha fecha/hora de la Cohorte directamente desde
//      Airtable, crea la Persona CRM, crea la Invitación en PORTAL
//      y llama el webhook de GHL. No necesitas inputs extra.
//
// ═══════════════════════════════════════════════════════════════════

const config = input.config();

// ─── Extraer inputs ───────────────────────────────────────────────
const nombre       = String(config.nombre      || "").trim();
const apellidos    = String(config.apellidos   || "").trim();
const email        = String(config.email       || "").trim().toLowerCase();
const rol          = String(config.rol         || "participante").trim();
const cohorteId     = String(config.cohorteId     || "").trim();
const cohorteNombre = String(config.cohorteNombre || "").trim();
const portalPat     = String(config.portalPat     || "").trim();

// ─── Validaciones básicas ─────────────────────────────────────────
if (!nombre || !apellidos || !email) {
  output.set("ok", false);
  output.set("error", "Faltan campos requeridos: nombre, apellidos o email");
  output.set("linkInvitacion", "");
  return;
}
if (!portalPat) {
  output.set("ok", false);
  output.set("error", "portalPat no configurado en los inputs del script");
  output.set("linkInvitacion", "");
  return;
}

// ─── Schemas ──────────────────────────────────────────────────────
const PORTAL_BASE_ID     = "app0S6GrJQ8YatvCc";
const INVITACIONES_TABLE = "tblzNARG9ahLsKR9c";
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
  ROL:       "fldOF0bnjfErxEOCO",
  ORIGEN:    "fldR2ZD5Pi8Qsnm3i",
  ESTATUS:   "fld8Ig1z8qSAzVo3M",
};

// ─── 1. Fetch fecha y hora desde Cohortes (SOPHIA Portal) ────────
const COHORTES_TABLE   = "tblMwkKfk6U7a75Ja";
const FLD_FECHA_INICIO = "fldoqWrG9zEdeKWGt";
const FLD_HORA_INICIO  = "fld65dDf16bS1wR25";

const cohorteRes = await fetch(
  `https://api.airtable.com/v0/${PORTAL_BASE_ID}/${COHORTES_TABLE}/${cohorteId}?returnFieldsByFieldId=true`,
  {
    headers: {
      "Authorization": `Bearer ${portalPat}`,
      "Content-Type":  "application/json",
    },
  },
);

let primeraSesionFecha = "";
let primeraSesionHora  = "";

if (cohorteRes.ok) {
  const cohorteData = await cohorteRes.json();
  primeraSesionFecha = String(cohorteData.fields?.[FLD_FECHA_INICIO] || "").trim();
  primeraSesionHora  = String(cohorteData.fields?.[FLD_HORA_INICIO]  || "").trim();
  console.log(`Cohorte: fecha=${primeraSesionFecha} hora=${primeraSesionHora}`);
} else {
  console.error(`No se pudo fetch la cohorte ${cohorteId}: ${cohorteRes.status}`);
}

// ─── 2. Buscar Persona CRM por email ──────────────────────────────
const existing = await PERSONAS_CRM.selectRecordsAsync({
  fields: [P.EMAIL],
  filterByFormula: `LOWER(TRIM({${P.EMAIL}})) = "${email}"`,
});

let personaId;
if (existing.records.length > 0) {
  personaId = existing.records[0].id;
  console.log(`Persona existente encontrada: ${personaId}`);
} else {
  // Solo campos seguros (singleLineText). Origen, Rol, Estatus son
  // singleSelects en CRM y la Scripting API no tiene typecast — si el
  // valor no coincide exactamente con una opción existente, falla.
  // Pato puede setear defaults en Airtable field-level o llenarlos a mano.
  personaId = await PERSONAS_CRM.createRecordAsync({
    [P.NOMBRE]:    nombre,
    [P.APELLIDOS]: apellidos,
    [P.EMAIL]:     email,
  });
  console.log(`Nueva Persona CRM creada: ${personaId}`);
}

// ─── 3. Generar token de invitación ───────────────────────────────
// El prefijo "inv_" es OBLIGATORIO — el frontend (auth.js captureInviteFromUrl)
// y el edge function claim-invitation validan el regex /^inv_[A-Za-z0-9_-]{4,40}$/.
// Sin el prefijo, el link no se canjea aunque se genere correctamente.
const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
let inviteToken = "inv_";
for (let i = 0; i < 28; i++) {
  inviteToken += chars[Math.floor(Math.random() * chars.length)];
}

// ─── 4. Crear Invitación en base PORTAL (Web API) ─────────────────
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
  output.set("ok", false);
  output.set("error", `Error creando invitación (${inviteRes.status}): ${errText.slice(0, 200)}`);
  output.set("linkInvitacion", "");
  return;
}

const linkInvitacion = `https://portal.sophiamx.org/?invite=${inviteToken}`;
console.log(`✓ Invitación creada para ${email}: ${linkInvitacion}`);

// ─── 5. Output ───────────────────────────────────────────────────────
output.set("ok",             true);
output.set("nombre",         nombre);
output.set("apellidos",      apellidos);
output.set("email",          email);
output.set("cursoNombre",    cohorteNombre);
output.set("linkInvitacion", linkInvitacion);

// ─── 6. Enviar webhook a GHL ──────────────────────────────────────
const GHL_WEBHOOK = "https://services.leadconnectorhq.com/hooks/ek1LQvM0Kyj7fll9nDO7/webhook-trigger/845cecc4-28cd-4408-99b3-fd6622365af3";

const ghlRes = await fetch(GHL_WEBHOOK, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email:              email,
    nombre:             nombre,
    apellidos:          apellidos,
    cursoNombre:        cohorteNombre,
    primeraSesionFecha: primeraSesionFecha,
    primeraSesionHora:  primeraSesionHora,
    linkInvitacion:     linkInvitacion,
  }),
});

if (!ghlRes.ok) {
  const errText = await ghlRes.text();
  console.error(`GHL webhook error (${ghlRes.status}): ${errText.slice(0, 200)}`);
  // No detenemos — la invitación ya se creó, solo logueamos el fallo de GHL
} else {
  console.log(`✓ GHL notificado para ${email}`);
}
