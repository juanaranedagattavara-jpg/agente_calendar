# Julieta Dashboard — Araneda Office

Dashboard enterprise embebido en Chatwoot que muestra en tiempo real la actividad del agente Julieta.

## Estructura

```
sistema_agenda_chatwoot/
├── schema.sql                  # Crear tabla en PostgreSQL (una vez)
├── api/
│   ├── index.js                # Express API
│   ├── package.json
│   └── .env.example
├── dashboard/
│   └── index.html              # Dashboard (se embebe en Chatwoot)
├── n8n_log_classifier.js       # Code node para copiar en n8n
└── n8n_postgres_insert.sql     # Query para nodo Postgres en n8n
```

---

## Setup

### 1. Crear tabla en PostgreSQL

```bash
psql -U tu_usuario -d tu_base_de_datos -f schema.sql
```

### 2. Configurar y lanzar la API

```bash
cd api
npm install
cp .env.example .env
# Editar .env con tu DATABASE_URL y un API_KEY seguro
npm start
```

Verificar: `curl http://localhost:3001/health`

### 3. Configurar el dashboard

Editar `dashboard/index.html` — bloque CONFIG al final del archivo:

```js
const CONFIG = {
  API_URL: 'https://TU-SERVIDOR.com:3001',  // URL pública de tu API
  API_KEY: 'el_mismo_api_key_del_env',
  REFRESH_MS: 30_000,
};
```

### 4. Registrar en Chatwoot

1. Chatwoot → **Settings → Integrations → Dashboard Apps**
2. Click **"+ New Dashboard App"**
3. Name: `Julieta`
4. URL: `https://TU-SERVIDOR.com:3001/dashboard`
5. Guardar → aparece en el panel lateral de cada conversación

### 5. Configurar nodos en n8n

#### Nodo 1: Code node (Log Classifier)
- Agregar un nodo **Code** conectado desde el output de **orquestador** (en paralelo con Code3)
- Copiar el contenido de `n8n_log_classifier.js`
- Mode: "Run once for each item"

#### Nodo 2: Postgres node (Insert Event)
- Agregar un nodo **Postgres** después del Code node
- Credencial: las mismas que usa "Postgres Chat Memory"
- Operation: **Execute Query**
- Query: copiar de `n8n_postgres_insert.sql`
- Query Parameters: los 6 parámetros indicados en el archivo

---

## Datos que registra automáticamente

| Campo | Fuente |
|-------|--------|
| `event_type` | Clasificado por keywords en el output del agente |
| `client_name` | `$('Edit Fields').item.json.Nombre` |
| `conversation_id` | `$('Edit Fields').item.json.ID` |
| `service_name` | Extraído del texto del agente (best-effort) |
| `time_saved_minutes` | Booking: 6min, Reagendamiento: 7min, Cancelación: 3min, Consulta: 4min |

Para agregar precios y datos de servicio más precisos, usar el nodo `get_service_catalog` ya existente en n8n para enriquecer los datos antes del INSERT.

---

## Deploy en producción

La API necesita HTTPS para que Chatwoot (que corre en HTTPS) pueda embeber el iframe sin error de mixed-content.

**Opción rápida: Railway o Render**
1. Push este repositorio
2. Crear servicio en Railway/Render apuntando al directorio `/api`
3. Agregar variables de entorno (DATABASE_URL, API_KEY, PORT, ALLOWED_ORIGIN)
4. Usar la URL generada como API_URL en el dashboard

**Opción en el mismo servidor:**
```nginx
# Nginx reverse proxy
location /julieta-api/ {
    proxy_pass http://localhost:3001/;
}
```
