# Prospección IA

Sistema de prospección comercial con descubrimiento de negocios, scoring objetivo, análisis con IA, demos y seguimiento sobre PostgreSQL propio.

## Stack

- Next.js + TypeScript
- PostgreSQL 16 propio
- Docker Compose
- Gemini 2.5 Flash-Lite para análisis comercial
- OpenStreetMap/Overpass como descubrimiento gratuito
- Google Places opcional para descubrimiento y enriquecimiento

## Configuración

`.env.local`:

```env
DATABASE_URL=postgresql://prospecion:prospecion_dev@localhost:5434/prospecion
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-2.5-flash-lite

# auto | osm | google
DISCOVERY_PROVIDER=auto
GOOGLE_PLACES_API_KEY=
```

`DISCOVERY_PROVIDER=auto` usa Google Places cuando hay una API key configurada; si no, usa OpenStreetMap.

## Desarrollo

```bash
npm install
docker compose up -d
npm run dev
```

Aplicación: `http://localhost:3000`.

## Scoring objetivo

El score no lo decide Gemini. Se calcula con datos verificables:

- sin sitio web: +40
- sin WhatsApp visible: +15
- teléfono disponible: +10
- sector de alto valor: +15
- rating >= 4: +10
- 30+ reseñas: +5
- 100+ reseñas: +5

Los prospectos con score menor a 60 no consumen Gemini en el análisis masivo. Los de 70 o más pueden generar demo automáticamente.

## Descubrimiento

`POST /api/prospects/discover`

Busca negocios por ciudad/categoría, deduplica contra PostgreSQL y los guarda con score calculado desde el inicio.

Con Google Places configurado puede obtener teléfono, sitio web, rating y número de reseñas. Sin clave continúa funcionando con OpenStreetMap.

## Enriquecimiento de registros existentes

`POST /api/prospects/enrich-batch`

Requiere `GOOGLE_PLACES_API_KEY` y procesa hasta 10 prospectos por lote. Completa datos faltantes y `updateProspect` recalcula automáticamente el score sin volver a gastar Gemini.

Ejemplo PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/prospects/enrich-batch" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"limit":5,"minScore":0}'
```

## Recalcular scores sin IA

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/prospects/recalculate-scores" `
  -Method POST
```

## Pipeline

`NEW -> QUALIFIED -> DEMO_CREATED -> CONTACTED -> RESPONDED -> FOLLOWUP_1/FOLLOWUP_2 -> INTERESTED -> WON/LOST`

## Flujo recomendado

1. Buscar negocios.
2. Calcular score objetivo sin IA.
3. Enriquecer datos cuando Google Places esté disponible.
4. Analizar con Gemini únicamente candidatos con score >= 60.
5. Generar demo automática para score >= 70.
6. Contactar y registrar seguimiento.

## Seguridad

- Nunca subas `.env.local` ni API keys.
- En producción usa credenciales PostgreSQL distintas a las de desarrollo.
- Limita PostgreSQL a red privada.
- Usa únicamente proveedores y canales compatibles con sus políticas y evita mensajería masiva no solicitada.
