# TaskFlow API

_A REST API for task management — built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices._

> Work in progress — currently in Phase 1 (Core CRUD)

## Tech Stack
- Node.js, Express, TypeScript
- MongoDB (Atlas) + Mongoose

## Setup
1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your own values
4. `node --env-file=.env src/server.ts` (or your dev script)

## Known Issues / Troubleshooting
- **Node fails to resolve `mongodb+srv://` SRV DNS records on some Windows setups**, even when the OS itself resolves them fine (confirmed via `nslookup`). Root cause not fully isolated — suspected firewall/antivirus interference with Node's DNS layer, unconfirmed. Workaround: use the non-SRV connection string format (Atlas Dashboard → Connect → Drivers → older driver version) instead of `+srv`.

## Design Decisions
_(fill in as each phase lands — e.g. why Zod, why centralized error handling, etc.)_

## Progress Log
- [x] Phase 1.1–1.3: Project init, folder structure, DB connection
- [ ] Phase 1.4: Core CRUD (Task model done, controller/routes in progress)