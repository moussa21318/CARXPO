# CarXpo

A complete car dealership CRM for managing import and sales operations, with multilingual support and dark mode.

## Features

- **Car Management** — Add, edit, delete with role-based permissions
- **Stage Pipeline** — Request → Deposit → Purchase → Shipping Prep → Shipping
- **Fees & Expenses** — Track deposits, transport, parking and other costs
- **Attachments & Evidence** — Upload files and evidence images per stage
- **Role System** — Admin (full control) / Employee (limited)
- **Deletion Requests** — Employees request deletion, admin approves/rejects
- **Notifications** — Real-time updates on car changes
- **Excel Export** — Export car data with all details
- **i18n** — Arabic, English, French (RTL support)
- **Dark Mode** — Toggle between light and dark themes
- **Responsive** — Works on desktop, tablet and mobile

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS 4** (styling)
- **Supabase** (PostgreSQL + Storage)
- **i18next** + **react-i18next** (translation)
- **React Router v7** (routing)
- **Zustand** (state management)
- **SheetJS (xlsx)** (Excel export)

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### Setup

```bash
git clone https://github.com/moussa21318/CARXPO.git
cd carxpo
npm install
cp .env.example .env   # Fill in your Supabase URL and anon key
npm run dev
```

### Database

Run the SQL in `supabase/schema.sql` against your Supabase project's SQL editor to create all tables.

## Build

```bash
npm run build   # TypeScript check + Vite production build
```

## Deployment

The project includes a `vercel.json` — ready to deploy on **Vercel** with zero config.

## Project Structure

```
src/
├── auth/        # Authentication context
├── context/     # App-level contexts
├── db/          # Supabase client & queries
├── i18n/        # Translation JSON files
├── layouts/     # Layout components
├── pages/       # Page components
├── types/       # TypeScript types
└── utils/       # Utilities (format, upload, export)
supabase/
└── schema.sql   # Full database schema
```

## License

MIT
