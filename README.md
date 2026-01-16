# Astrodeck Web (Next.js) + Backend (Express)

Este bundle contém:
- `astrodeck-web/` (Next.js) — frontend web
- `astrodeck-backend/` (Express) — API + imagens `/static/tarot/*`

## Rodar local (dev)

### 1) Backend
```bash
cd astrodeck-backend
cp .env.example .env
npm install
npm run dev
```

Por padrão roda em `http://localhost:3000`.

### 2) Frontend
Em outro terminal:
```bash
cd astrodeck-web
cp .env.local.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3001`.

## Observações
- O frontend chama o backend usando `NEXT_PUBLIC_API_BASE_URL`.
- As imagens das cartas são servidas pelo backend em `/static/tarot/...`.
