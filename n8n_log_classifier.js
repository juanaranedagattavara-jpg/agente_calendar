// ═══════════════════════════════════════════════════════════════════════════
//  NODO: Log Classifier (Code node)
//  Posición: Después del nodo "orquestador", en paralelo con "Code3"
//  Tipo: Code node — "Run once for each item"
// ═══════════════════════════════════════════════════════════════════════════
//
//  Cómo agregar en n8n:
//  1. Hacer click en el nodo "orquestador"
//  2. Arrastrar desde el output "main[0]" para crear nueva conexión
//  3. Agregar nodo tipo "Code"
//  4. Pegar este código
//  5. Después del Code node, agregar un nodo "Postgres" → Execute Query
//     con la query del archivo n8n_postgres_insert.sql
//
// ═══════════════════════════════════════════════════════════════════════════

const output = $json.output || '';

// Unificar el output (puede ser JSON array o texto plano)
let fullText = output;
try {
  const parsed = JSON.parse(output);
  if (Array.isArray(parsed)) fullText = parsed.join(' ');
  else if (typeof parsed === 'object') fullText = JSON.stringify(parsed);
} catch (_) {
  // output ya es texto plano
}

fullText = fullText.toLowerCase();

// ── Clasificar evento ──────────────────────────────────────────────────────
let event_type = 'inquiry_answered';
let time_saved_minutes = 4;

if (/agendad[ao]|reservad[ao]|cita confirmada|hora confirm|registr[aé]|creé.*cita|cita.*cread/i.test(fullText)) {
  event_type = 'appointment_booked';
  time_saved_minutes = 6;
} else if (/reagendad[ao]|cambiada|modificada|nueva fecha|nueva hora|actualizad[ao]|rescheduled/i.test(fullText)) {
  event_type = 'appointment_rescheduled';
  time_saved_minutes = 7;
} else if (/cancelad[ao]|eliminad[ao]|anulad[ao]|cancelled|removid[ao]/i.test(fullText)) {
  event_type = 'appointment_cancelled';
  time_saved_minutes = 3;
}

// ── Extraer datos del contexto ─────────────────────────────────────────────
const client_name     = $('Edit Fields').item.json.Nombre || null;
const conversation_id = String($('Edit Fields').item.json.ID || '');

// Intentar extraer servicio del output (texto entre comillas o después de "servicio:")
let service_name = null;
const serviceMatch = fullText.match(/servicio[:\s]+["']?([^"'\n,\.]+)/i)
  || fullText.match(/["']([^"']{3,40})["']/);
if (serviceMatch) service_name = serviceMatch[1].trim();

return [{
  json: {
    event_type,
    client_name,
    conversation_id,
    service_name,
    time_saved_minutes,
    raw_output: output.substring(0, 500), // truncated for notes column
  }
}];
