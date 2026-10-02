# Solscape

**A RuneScape-style combat MMO on Solana where the reward pool pays the fighters.**

Version 0.1 · September 2026 · Working draft

---

## 1. Concept

Solscape is a browser-based, low-poly 3D fantasy world in the spirit of RuneScape. Players train combat skills, fight bosses cooperatively, and duel each other for wagers. The prize money comes from a reward pool that is funded by fees on every buy and sell of the game's token, SCAPE. Trading activity and gameplay are the same economy: the more the token trades, the more there is to win, and the more there is to win, the more people play.

## 2. The game

### 2.1 Progression

Six skills on the classic RuneScape XP curve: Attack, Strength, Defence, Hitpoints, Ranged, Magic. Combat level is derived from them using the RuneScape formula, so levels mean what players already expect.

Players pick one of three combat styles. The combat triangle applies with a 25% swing in accuracy and damage:

- Melee beats Ranged
- Ranged beats Magic
- Magic beats Melee

### 2.2 Training (the free loop)

Players explore the world, fight goblins on the 600 ms game tick, and gain XP. Kills drop small amounts of SCAPE. A new player can earn their first raid stake without buying anything, which is the on-ramp into the paid loops below.

### 2.3 Boss raids (PvE, cooperative)

- Party of 2 to 4 players enters the lair.
- Every player stakes **50 SCAPE**.
- Boss health scales with party size and combat level.
- **Win:** the party claims **4% of the reward pool** plus all stakes, split evenly.
- **Wipe:** all stakes go into the reward pool.
- Food (bought with SCAPE) heals mid-fight, making survival a resource decision.

### 2.4 Duels (PvP, wagered)

- Player sets a wager: **100 SCAPE minimum, no maximum**.
- Matched against an opponent near their combat level.
- **Winner takes the pot** minus a **3% arena fee** that returns to the reward pool.
- The house never takes the loser's wager; it goes to the winner.

### 2.5 World and systems

- Solbridge spawn town, dirt road, lake, forest, duel arena (stone circle), boss lair (cave), Grand Exchange (gold coin).
- Grand Exchange: buy and sell SCAPE in-game.
- Persistent character save, floating health bars, hitsplats, orbit camera, click-to-walk.

## 3. Tokenomics

| Item | Value |
|---|---|
| Token | SCAPE ("Solscape Gold") |
| Standard | SPL, Solana |
| Supply | 1,000,000,000 fixed |
| Launch | Bonding-curve launchpad (StonkFun / Raydium LaunchLab), graduating to a Raydium pool |
| Trade fee | 5% on every buy and sell |

### 3.1 Fee split

- **3.5% → Reward pool** (on-chain vault PDA). The only source of new value paid to players.
- **1.5% → Treasury** for servers, development, marketing.

Launchpad tokens cannot carry a transfer tax natively. In practice the fee is the creator-fee share from the curve and the liquidity pool, routed by a small Anchor program into the vault. The percentages above are the target; the exact achievable split depends on the launchpad's creator-fee terms at launch.

### 3.2 Money flows

| Source | Destination |
|---|---|
| Buy/sell fees | 70% reward pool, 30% treasury |
| Raid stakes (party wins) | Back to the winning party |
| Raid stakes (party wipes) | Reward pool |
| Duel pot | Winner, minus 3% to reward pool |
| In-game shop (food, later gear) | Treasury, or burned |

### 3.3 Sustainability

The pool cannot pay out more than it holds. A winning raid takes a fixed percentage (4%) of the current balance, so payouts shrink automatically when trading slows and grow when it picks up. Duels are player-to-player and net-positive for the pool through the rake. Raids are the only drain, and wipes refill it.

Three levers control pool health: the raid claim percentage, the stake size, and boss difficulty. If the pool empties too fast, tighten any one of them.

**Worked example.** 500 SOL of daily volume at 3.5% adds 17.5 SOL per day to the pool. At a 4% claim per win, that supports roughly 25 winning raids per day paying about 0.7 SOL each before the pool begins to shrink.

### 3.4 Why hold SCAPE

SCAPE is required to stake in raids, wager in duels, and buy consumables. Trading volume funds the prize pool, so speculators and players are the same customer base rather than competing ones.

## 4. Technical architecture

- **Client:** browser, three.js, wallet connection via Phantom / wallet-adapter.
- **Game server:** authoritative combat simulation (Solana cannot cheaply tick a fight every 600 ms). Outcomes are signed and submitted for settlement. Each fight publishes its random seed and log so payouts are auditable.
- **On-chain program (Anchor):** reward vault PDA with instructions `enter_raid`, `settle_raid`, `open_duel`, `settle_duel`, plus a settle-timeout that refunds stuck fights.
- **Token:** standard SPL, launched on the launchpad, fees routed to the vault.

## 5. Roadmap

**Now:** playable 3D prototype with simulated chain (training, raids, duels, exchange).

**Next:** wallet connection, Anchor vault program on devnet, authoritative game server.

**Then:** gear tiers, additional bosses, bank, non-combat skills, leaderboards, seasonal pool bonuses.

## 6. Open risks

**Legal.** Winner-takes-all wagering with a real token is treated as gambling under most US state law, including Georgia. The cooperative PvE raid is on firmer ground (skill-based, no player-versus-player stake). A gaming/crypto attorney's opinion is required before launch. Candidate structures: geofence the US, skill-only duels with cosmetic stakes, or reframe wagers as tournament entry fees.

**Founder compliance.** Founders holding securities licenses must treat this as an outside business activity requiring disclosure and firm approval before any on-chain activity.

**Launchpad graduation.** Most bonding-curve launches never graduate. The game must be playable and a community must exist on day one; launch is a marketing event for a finished product, not a funding round for an unbuilt one.

**Server trust.** The game server is the trust bottleneck. Verifiable fight logs and a public audit of the settlement program mitigate this.

---

*This document is a working design draft and does not constitute legal, financial, or compliance advice.*

---

## Running this repo

**Offline (no setup):** open `index.html` in a browser, or push to GitHub with Pages enabled (the included workflow deploys `main` automatically). Saves stay in the browser.

**Online (cloud saves, shared pool, live players, chat, leaderboard):**
1. Create a free project at supabase.com.
2. SQL Editor → paste and run `backend/schema.sql`.
3. Authentication → Providers → enable **Anonymous** sign-ins.
4. Project Settings → API → copy the URL and anon key into `config.js`.
5. Commit and push. Open the site in two browsers to see each other.

## Files

| Path | What |
|---|---|
| `index.html` | The whole game (three.js, self-contained) |
| `net.js` | Online adapter (Supabase). Swap this file to change backends. |
| `config.js` | Your Supabase URL + anon key |
| `backend/schema.sql` | Prototype database schema and row-level security |
| `backend/AGENT_INSTRUCTIONS.md` | Step-by-step brief for an AI coding agent to build the real backend |
| `CLAUDE.md` | Project context for Claude Code |
| `.github/workflows/pages.yml` | Auto-deploy to GitHub Pages |
