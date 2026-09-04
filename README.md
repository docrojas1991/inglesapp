# Fluencia — Entrenador de dominio del inglés

Sistema de aprendizaje de inglés (500 frases objetivo: 70% cotidiano, 30% médico, + módulo de inglés callejero) con repetición espaciada real (SM-2 modificado), 11 tipos de ejercicio, evaluación de pronunciación por micrófono, tutor IA integrable y progreso persistente por usuario.

## Despliegue en Dokploy

El proyecto incluye todo lo necesario (`Dockerfile` multi-stage → nginx, `nginx.conf` con fallback SPA, `docker-compose.yml`).

### Opción A — Dockerfile (recomendada)
1. En Dokploy: **Projects → Create → Application**.
2. Fuente: tu repositorio Git (o elige *Docker* como build type).
3. Configuración:
   - **Build Path / Dockerfile**: `Dockerfile` (raíz del repo)
   - **Port**: `80` (el contenedor expone el 80; Dokploy lo mapea al dominio)
4. Asigna un dominio y activa **HTTPS** (Let's Encrypt) desde el panel.

### Opción B — Docker Compose
1. **Projects → Create → Compose**.
2. Pega el contenido de `docker-compose.yml` o apunta al repo (compose path: `docker-compose.yml`).
3. El servicio escucha en `8080` → configúralo como puerto interno en el dominio de Dokploy.

### Verificación
- El build genera `dist/` (Vite). Nginx sirve el SPA con `try_files` y compresión gzip.
- Healthcheck incluido en la imagen (`wget /`).

### Notas de producción
- El estado vive en el navegador (localStorage por usuario). Es local-first por diseño: el esquema en `src/lib/types.ts` replica las tablas Postgres (`users`, `phrases`, `user_phrase_progress`, `exercise_attempts`, `study_sessions`…) y toda la app solo habla con `src/lib/db.ts`, pensado para sustituir por rutas de servidor + base de datos sin tocar las pantallas.
- **Cuentas de demo**: botón "Explorar con cuenta demo" en el login (progreso realista sembrado) o registro limpio con email + contraseña (hash SHA-256).

## Tutor IA

En **Settings → Inteligencia artificial**:
- **Tutor local**: funciona sin conexión (explica frases del curso, patrones, pronunciación).
- **Proveedor personalizado**: cualquier endpoint compatible con `/chat/completions`:
  - Groq: `https://api.groq.com/openai/v1`, modelo `llama-3.3-70b-versatile`
  - OpenAI: `https://api.openai.com/v1`, modelo `gpt-4o-mini`
  - Ollama local: `http://TU_IP:11434/v1`, modelo `llama3.1`
  - La clave se guarda solo en tu navegador; si el proveedor falla, el tutor local responde automáticamente.

## Contenido

- 11 módulos (60 frases semilla anotadas: traducción, patrón, pronunciación, escenario, errores comunes + 14 de inglés callejero).
- Importador JSON/CSV en Settings → crece a 500/1000/5000 frases sin cambios de código.

## Desarrollo

```bash
npm install
npm run dev      # desarrollo
npm run build    # producción → dist/
```
