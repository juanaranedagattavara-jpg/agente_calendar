-- ═══════════════════════════════════════════════════════════════════════════
--  NODO: Postgres Execute Query
--  Posición: Después del "Log Classifier" (Code node)
--  Credencial: usar las MISMAS credenciales que "Postgres Chat Memory"
-- ═══════════════════════════════════════════════════════════════════════════
--
--  En n8n → Postgres node → Operation: Execute Query
--  Pegar esta query en el campo "Query":
--
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO julieta_events (
  event_type,
  client_name,
  service_name,
  conversation_id,
  time_saved_minutes,
  notes
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6::jsonb
)

-- ═══════════════════════════════════════════════════════════════════════════
--  Query Parameters (en la sección "Query Parameters" del nodo Postgres):
--
--  Param 1 (event_type):
--    {{ $json.event_type }}
--
--  Param 2 (client_name):
--    {{ $json.client_name }}
--
--  Param 3 (service_name):
--    {{ $json.service_name }}
--
--  Param 4 (conversation_id):
--    {{ $json.conversation_id }}
--
--  Param 5 (time_saved_minutes):
--    {{ $json.time_saved_minutes }}
--
--  Param 6 (notes JSON):
--    {{ JSON.stringify({ output: $json.raw_output, classified_at: new Date().toISOString() }) }}
-- ═══════════════════════════════════════════════════════════════════════════
