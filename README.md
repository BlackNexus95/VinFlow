# FinFlow — Shared Web & Android Expense Tracker (EUR)

FinFlow is a self-hosted personal finance tracker with a **shared React + TypeScript + Capacitor codebase** for both Web and Android, backed by a **shared Node.js + Express + SQLite REST API**.

## Features

- **Overview Dashboard**: Net worth across all accounts, monthly income, expenses, net cash flow, savings rate, 6-month income vs. expenses chart, category spending donut chart, budget alerts, upcoming recurring items, and recent transactions.
- **Default Currency: EUR (€)**: European Euro formatting by default (changeable in Settings to USD, GBP, or CHF).
- **Multiple Accounts & Wallets**: Checking, Savings, Cash, Credit Card, and Investment accounts with live computed balances and account-to-account transfers.
- **Monthly Budgets**: Category spending limits (recurring every month or per-month overrides) with customizable warning thresholds.
- **Recurring Transactions**: Daily, weekly, biweekly, monthly, or yearly rules with automatic posting and one-click "Post Now".
- **CSV Import / Export & JSON Backup**: Supports both comma (`,`) and European semicolon (`;`) CSVs, `DD.MM.YYYY` dates, and European decimals (`42,50`), plus full JSON backup export.
- **Shared Backend Sync**: Web browser and Android app both connect to the same SQLite-backed REST API.

## Project Structure

- `backend/` — Express + SQLite (`better-sqlite3`) REST API & static web host (port `3001`)
- `frontend/` — Shared React + TypeScript + Vite + Tailwind + Capacitor UI (Web + Android)
- `release/finflow-debug.apk` — Compiled Android APK ready to install on your phone
- `vm/` — Dedicated Ubuntu 24.04 QEMU/KVM development VM scripts & configuration

## Docker Deployment (Recommended for Self-Hosting)

Everything (the React web app + Node.js REST API + SQLite database) is packaged into a single multi-arch (`linux/amd64`, `linux/arm64`) container automatically published to GitHub Container Registry (`ghcr.io/blacknexus95/vinflow:latest`) via [`.github/workflows/docker.yml`](.github/workflows/docker.yml).

### Quick Start with Docker Compose / OpenMediaVault

Paste `docker-compose.yml` into OpenMediaVault's **Compose → Files** plugin (or run locally):

```bash
docker compose pull
docker compose up -d
```

- **Web App & Shared API:** `http://<your-server-ip>:3001` (change host port with `FINFLOW_PORT=8080`)
- **Persistent Database:** Stored in the `finflow_data` Docker volume at `/data/finance.db` (survives container restarts and updates).
- **Android App:** Open **Settings → Shared Backend Server** in the Android app, enter `http://<your-server-ip>:3001`, and tap **Test & Save**.

### Or Build & Run Locally with Docker / Podman

```bash
docker build -t finflow:latest .
docker run -d \
  --name finflow \
  --restart unless-stopped \
  -p 3001:3001 \
  -e TZ=Europe/Berlin \
  -v finflow_data:/data \
  finflow:latest
```

*(With Podman on Fedora, substitute `podman` for `docker`—the exact same `Dockerfile` works out of the box.)*

## Development VM Commands

The dedicated KVM VM runs with 4 vCPUs, 3 GiB RAM (+ 2 GiB swap), Node.js 22, OpenJDK 21, and the Android SDK (API 35).

| Action | Command |
|---|---|
| Start VM | `./vm/start-vm.sh` |
| Stop VM gracefully | `./vm/stop-vm.sh` |
| Open SSH shell in VM | `./vm/ssh-vm.sh` |
| Sync code to VM | `./vm/sync-to-vm.sh` |
| Rebuild web, backend & Android APK | `./vm/ssh-vm.sh "bash /home/dev/finance/vm/build-all.sh"` |
| Copy built APK back to host | `./vm/fetch-apk.sh` |

Forwarded ports from the VM to your host:
- `127.0.0.1:2229` → VM SSH (`22`)
- `0.0.0.0:3001` → Shared Backend API + Production Web App (`3001`)
- `0.0.0.0:5173` → Vite Dev Server (`5173`, optional)

## Using the Web & Android Apps

1. **Web App**: Open [http://localhost:3001](http://localhost:3001) in your browser (starts automatically inside the VM via `finance-backend.service`).
2. **Android App**:
   - Transfer `release/finflow-debug.apk` to your Android phone and install it (or install via `adb install release/finflow-debug.apk`).
   - Open **Settings → Shared Backend Server** in the Android app.
   - Enter your computer's local Wi-Fi IP and port, e.g. `http://192.168.x.x:3001`, and tap **Test & Save**. (If testing in an Android emulator on the same host, `http://10.0.2.2:3001` is pre-configured.)
   - Make sure Fedora's firewall allows TCP port `3001` on your local network if your phone cannot reach it (`sudo firewall-cmd --add-port=3001/tcp --permanent && sudo firewall-cmd --reload`).
