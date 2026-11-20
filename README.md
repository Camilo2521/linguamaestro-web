# LinguaMaestro

Aplicación web para aprender idiomas con niveles MCER (A1 → C2 → NATIVE):
onboarding con prueba de nivel, lecciones por nivel con avance automático,
repaso de vocabulario con repetición espaciada (SM-2) y una sección de
práctica con 7 modos. Idiomas: inglés, francés, portugués, español, japonés
y chino.

## Demo en línea

- **App:** _pendiente — URL de Vercel_
- **API:** _pendiente — URL de Render_ (`/health` responde `{"ok":true}`)

> El backend usa el plan gratuito de Render: si lleva un rato sin uso, la
> primera petición puede tardar ~1 minuto mientras el servidor despierta.

## Estructura

| Carpeta | Contenido | Tecnología |
|---|---|---|
| [`frontend/`](frontend) | Interfaz web | Next.js 15, React, TypeScript, Tailwind, Zustand |
| [`backend/`](backend) | API REST | Node.js, Express, TypeScript, Zod |
| [`backend/supabase/migrations/`](backend/supabase/migrations) | Esquema de base de datos | PostgreSQL (Supabase) |
| [`docs/`](docs) | Documentación técnica | — |

El frontend nunca habla directamente con Supabase: todo pasa por la API del
backend, que es el único que tiene las credenciales.

## Documentación

- [docs/README.md](docs/README.md): funcionalidades, instalación local, variables de entorno, despliegue
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): arquitectura
- [docs/API.md](docs/API.md): endpoints
- [docs/DATABASE.md](docs/DATABASE.md): base de datos y migraciones
- [docs/SECURITY.md](docs/SECURITY.md): seguridad

## Ejecutar localmente (resumen)

Requiere Node.js 20+ y un proyecto de Supabase con las migraciones aplicadas.

```bash
cd backend  && cp .env.example .env        && npm install && npm run dev   # http://localhost:4000
cd frontend && cp .env.example .env.local  && npm install && npm run dev   # http://localhost:3000
```

Detalles completos en [docs/README.md](docs/README.md).
