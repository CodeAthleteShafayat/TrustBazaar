# TrustBazaar

A trust-first marketplace MVP: buy, sell, and rent items with money held in escrow, a Trust Score that moves with every completed deal, and dispute resolution when things go wrong.

**Read [`PRODUCT_UPDATE.md`](./PRODUCT_UPDATE.md) first** — it has the current engineering status, known gotchas, and a couple of non-obvious bugs that were fixed and must not be reintroduced. `PRD.md` and `DEV_CONTRACT.md` are the original product/engineering spec.

## Stack

- **Frontend:** React + TypeScript + Vite, Tailwind, React Router, TanStack Query, Zustand — `frontend/`
- **Backend:** Flask + Flask-JWT-Extended — `backend/`
- **Database/Auth:** Supabase (Postgres + Supabase Auth)

## Running locally

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real Supabase credentials — ask the project owner, don't commit real values
python run.py           # serves on :5001

# Frontend
cd frontend
npm install
npm run dev              # serves on :5173, proxies /api to :5001
```

Demo accounts (password `demo1234` for all): `buyer@demo.com`, `seller@demo.com`, `renter@demo.com`, `admin@demo.com`.

## Secrets

`backend/.env` and `frontend/.env` are gitignored and must never be committed — they hold live Supabase keys and DB credentials. Use the `.env.example` files as templates and get real values directly from the project owner.
