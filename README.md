# Prospección IA

Sistema base para convertir prospección comercial en un flujo repetible: importar negocios, calificarlos, generar mensajes y demos, dar seguimiento y medir ventas.

## Incluido

- Next.js + TypeScript
- Dashboard de pipeline
- Scoring de oportunidad
- Estados comerciales
- Demos dinámicas por prospecto
- Endpoint `/api/analyze` para análisis con Gemini
- Esquema PostgreSQL/Supabase
- Variables de entorno de ejemplo

## Ejecutar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`.

## Configurar Gemini

En `.env.local`:

```env
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-2.0-flash
```

Nunca subas `.env.local` ni claves reales al repositorio.

## Configurar Supabase

1. Crea un proyecto Supabase.
2. Ejecuta `supabase/schema.sql` desde SQL Editor.
3. Agrega las variables de `.env.example`.

La UI inicial todavía usa datos demo; el esquema ya está preparado para conectar persistencia real en la siguiente vertical.

## Pipeline

`NEW -> QUALIFIED -> DEMO_CREATED -> CONTACTED -> RESPONDED -> FOLLOWUP_1/FOLLOWUP_2 -> INTERESTED -> WON/LOST`

## Próximas verticales recomendadas

1. CRUD real de prospectos usando Supabase.
2. Importación CSV.
3. Descubrimiento de negocios mediante fuentes permitidas/APIs.
4. Botón Analizar con IA conectado a `/api/analyze`.
5. Generación persistente de demos por slug.
6. Agenda de follow-ups.
7. Métricas de conversión e ingresos/MRR.
8. Integración de envío solo mediante canales y proveedores compatibles con sus políticas; evitar spam masivo.

## Seguridad

- Las claves de Gemini y Service Role solo deben usarse en servidor.
- No pongas secretos en variables `NEXT_PUBLIC_*` salvo valores expresamente públicos.
- No automatices scraping o mensajería violando términos de servicio de terceros.
