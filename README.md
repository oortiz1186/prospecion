# Prospección IA

Sistema para convertir prospección comercial en un flujo repetible: registrar negocios, calificarlos con IA, generar mensajes y demos, dar seguimiento y medir ventas.

## Stack actual

- Next.js 14 + TypeScript
- PostgreSQL 16 propio
- Driver `pg`
- Docker Compose para desarrollo local
- Gemini para análisis comercial
- Dashboard con CRUD real de prospectos
- Demos dinámicas cargadas desde PostgreSQL

## 1. Actualizar dependencias

Después de hacer `git pull`:

```bash
npm install
```

## 2. Configurar variables

Crea `.env.local`:

```env
DATABASE_URL=postgresql://prospecion:prospecion_dev@localhost:5434/prospecion
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-2.0-flash
```

No subas `.env.local` ni claves reales al repositorio.

## 3. Levantar PostgreSQL

Requiere Docker Desktop instalado y ejecutándose.

```bash
docker compose up -d
```

El contenedor se llama `prospecion-postgres` y expone PostgreSQL en el puerto local `5434` para evitar conflictos con otras instalaciones de PostgreSQL.

El primer arranque ejecuta automáticamente `db/init.sql`, crea el esquema y carga cuatro prospectos de ejemplo.

Verificar:

```bash
docker compose ps
```

Entrar a PostgreSQL:

```bash
docker exec -it prospecion-postgres psql -U prospecion -d prospecion
```

Dentro de `psql`:

```sql
SELECT id, name, opportunity_score, status FROM prospects;
```

Salir con:

```text
\q
```

## 4. Ejecutar la aplicación

```bash
npm run dev
```

Abre `http://localhost:3000`.

## Flujo funcional actual

1. El dashboard carga prospectos desde PostgreSQL mediante `GET /api/prospects`.
2. `+ Agregar prospecto` crea registros reales mediante `POST /api/prospects`.
3. `Analizar con IA` consulta Gemini y persiste score, problema, oportunidad, headline, servicios y mensaje en PostgreSQL.
4. Un score >= 70 mueve un prospecto nuevo a `QUALIFIED`.
5. `Marcar contactado` persiste el estado `CONTACTED` y fecha de contacto.
6. `Ver demo` carga directamente el prospecto desde PostgreSQL.

## Pipeline

`NEW -> QUALIFIED -> DEMO_CREATED -> CONTACTED -> RESPONDED -> FOLLOWUP_1/FOLLOWUP_2 -> INTERESTED -> WON/LOST`

## Base de datos

Archivo inicial: `db/init.sql`.

Tabla principal: `prospects`.

Datos incluidos:

- identificación y contacto
- presencia web/WhatsApp
- rating y reseñas
- scoring
- análisis IA
- mensaje personalizado
- servicios sugeridos
- estado comercial
- fechas de contacto y seguimiento

El volumen Docker `prospecion_pgdata` conserva los datos aunque el contenedor se reinicie.

Para destruir completamente la BD local y volver a ejecutar el seed:

```bash
docker compose down -v
docker compose up -d
```

**Cuidado:** `down -v` elimina todos los datos locales.

## Próximas verticales

1. Importación CSV real.
2. Edición y eliminación de prospectos.
3. Generación de demos por plantilla/sector.
4. Búsqueda de negocios mediante fuentes y APIs permitidas.
5. Agenda automática de follow-ups.
6. Métricas de conversión e ingresos/MRR.
7. Autenticación y roles antes de desplegar públicamente.
8. Envíos únicamente mediante canales/proveedores compatibles con sus políticas; evitar spam masivo.

## Producción

En producción no uses la contraseña de desarrollo del `docker-compose.yml`. Crea credenciales distintas, limita el acceso de red a PostgreSQL y configura `DATABASE_URL` solo como secreto del servidor.
