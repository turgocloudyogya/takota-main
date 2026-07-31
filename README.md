# Takota - Frontend Presensi & Absensi

Frontend untuk aplikasi presensi dan absensi Takota, dibangun dengan React, Vite, Tailwind CSS, Gravity UI, dan Hero UI.

## Tech Stack

- **Framework:** React 19
- **Build Tool:** Vite 8
- **Routing:** React Router 7
- **UI Library:** Gravity UI, Hero UI
- **Styling:** Tailwind CSS 4
- **Charts:** Recharts
- **PDF Export:** html2pdf.js

## Quick Start

**Prerequisites:** Node.js 18+

```bash
cd frontend
npm install
npm run dev
```

Akses aplikasi di `http://localhost:5173`.

## Scripts

```bash
npm run dev       # Jalankan dev server
npm run build     # Build produksi ke dist/
npm run preview   # Preview hasil build
npm run lint      # Jalankan ESLint
```

## Project Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
└── src/
    ├── main.jsx              # Entry point
    ├── App.jsx               # Konfigurasi routing
    ├── index.css             # Global styles (Tailwind)
    ├── components/           # Komponen UI bersama
    ├── pages/                # Halaman user (login, absensi, izin, dll)
    ├── admin/                # Halaman & komponen admin
    └── lib/                  # API client & utilities
```

## API Configuration

URL API backend dibaca dari `localStorage` key `api-base-url`. Kosongkan untuk menggunakan origin yang sama, atau set nilai seperti `http://localhost:8080`.
