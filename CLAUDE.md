# Solscape — project context for Claude Code

RuneScape-style 3D combat game on Solana. Single-file client (`index.html`, three.js r128 via CDN), online adapter in `net.js` (Supabase), config in `config.js`.

- Design + tokenomics: `README.md`
- Backend build plan: `backend/AGENT_INSTRUCTIONS.md` — follow it phase by phase; each phase must leave the game playable
- Prototype DB schema: `backend/schema.sql`

Conventions
- Keep `index.html` self-contained; no build step for the client.
- Economy constants live in `ECON` at the top of `index.html`; the server must use the same values (extract to `shared/econ.json` in Phase 2).
- Never let the client be authoritative for balances or fight outcomes once Phase 2 lands.
- Never commit secrets. `.env` files are ignored.
- Test with two browsers to verify presence and chat.
