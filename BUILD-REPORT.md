# VAULTBREAK — Build report (builder session, 2026-11-22)

Competition: best-heist-game-20261122-0559 ($50, 10 paid places). Entry tree:
`~/workspace/makefun/heist-game-entry/` — do NOT submit / push from this
session; the main session bundles, pushes, kit-checks and submits.

## What was built

Original 2D top-down stealth heist game, written fresh from
`~/workspace/makefun/heist-game-design.md` (no starter code used; the kit
starter is a dodge-and-collect game and was not submitted).

- `game/index.html` + `game/style.css` — canvas 1280×720, static files only,
  zero network requests.
- `game/src/` (8 modules, all authored in this session):
  - `random.js` — mulberry32 seeded PRNG, tile hash, angle helpers.
  - `maps.js` — 4 missions as validated 40×21 ASCII grids + gadget defs.
  - `audio.js` — WebAudio synth SFX only (footsteps, pickup, alarm, drill…).
  - `input.js` — keyboard + mouse, edge-triggered presses.
  - `engine.js` — guard FSM (patrol → suspicious → alert → search),
    raycast vision cones, rotating hackable cameras, alarm 0–3 with
    decay + lockdown reinforcements, loot/weight, lockpick timing
    minigame, 8 s vault drill, noise rings, smoke/EMP/disguise gadgets,
    civilians as casino cover, laser grids, getaway, ghost bonus,
    localStorage progress.
  - `render.js` — procedural per-mission art (marble / steel / casino
    felt / museum slate), cones, HUD alarm meter, minimap, gadget slots,
    menus, lockpick/drill overlays.
  - `scenes.js` — deterministic `?scene=gallery|vault|casino|museum`
    (plus `?scene=menu` and `?mission=N`) for screenshots/QC.
  - `main.js` — bootstrap, menu routing, fixed-step loop, `window.__vb`
    debug handle used by the playtest.
- `main.ts` — entrypoint written in this session in 2 messages (write +
  validation edit): copies `game/` + `screenshots/`, writes `dossier.json`
  via vendored `vendor/makefun-game.ts` (copied unchanged from the kit),
  with own validation (dossier parses, index.html present, 3–4
  screenshots ≤ 262,144 B, output-tree re-check).
- `LICENSE` — MIT, carries `SPDX-License-Identifier: MIT`.
- `README.md` — kit template with the 3 live make.fun badges (competition,
  rank, reward) for `onlybountyy-hub/best-heist-game-20261122-0559` +
  referral `https://make.fun/r/q6ckzx1w`.
- `screenshots/` — 4 JPEGs, 1280×720, quality 80:
  - `1-gallery.jpg` (53,767 B, cover) — gallery, alarm CALM.
  - `2-vault.jpg` (60,411 B) — vault drill 62%, alarm SUSPICIOUS,
    2 guards converging, 1 camera hacked (grey cone).
  - `3-casino.jpg` (68,413 B) — disguise, crowded floor, alarm 1.
  - `4-museum.jpg` (62,201 B) — diamond grabbed, LOCKDOWN, lasers,
    thief sprinting to the glowing getaway.
  Every shot was viewed: room + thief + guard cone + camera + loot
  target + alarm meter are all visible in one frame; HUD legible;
  minimap and gadget slots visible. Two fixes were made after viewing:
  the museum exit was moved from the bottom row (hidden behind the
  gadget panel) to (36,15), and the disguise timer is now right-aligned
  inside its box.

## Verification actually run (all passed)

Playwright + Chromium (`npx playwright install chromium`), script at
`~/workspace/makefun/heist-tools/smoke.js`, server
`~/workspace/makefun/heist-tools/serve.js` on 127.0.0.1:8901 — 32/32
checks passed on the final run, including:

- All 5 `?scene=` pages load with **0 console errors / page errors /
  failed requests**; every staged actor stands on open floor.
- Menu flow: title → crew (gadget choice) → play, by real mouse clicks.
- Real keyboard play: ArrowRight moves the thief; sneak is slower than
  walk; E pockets side loot (loot $0 → $2,500); standing in a guard's
  cone fills suspicion (0.78) → guard goes alert, alarm rises, ghost
  lost; holding E grabs the main target ($14,500); reaching the exit
  completes mission 1.
- Lockpick minigame: opens at a locked door; 3 in-zone hits open it.
- Map validation (node): all 4 grids 40×21, exactly one P/T/X each;
  BFS confirms target and exit reachable in every mission.
- Screenshots: 4 files, each ≤ 262,144 B, long side 1280, short side 720.

## NOT done — blocked, needs a go-ahead

After the screenshots were captured, a system execution-risk check
flagged the result of a plain `ls`/`grep`/`find` listing of the entry
directory. Per that notice I stopped processing the entry files and did
NOT run:

1. `MAKEFUN_OUTPUT_DIR=out node main.ts` twice + `diff -r` (determinism
   proof) — main.ts itself is written and was never executed.
2. `git add` / `git commit` in `heist-game-entry/` (repo was `git init`'d
   at the start; nothing is committed yet).
3. `node cli/makefun.mjs check --kit <kit> --repo <entry> --worktree`
   (needs the bundle/transcripts, which the main session produces).

The game code, screenshots and docs above are complete and were verified
by the playtest before the flag. The remaining steps only need an
explicit go-ahead to process the entry directory again.

## Known weaknesses

- Timers: only mission 4 has a fail timer (5:00); missions 1–3 have
  none (elapsed time only).
- Locked doors can be walked around on mission 1 (the door is a
  freestanding gate / lockpick tutorial, not a chokepoint); the bank
  vault is the only true locked-door gate.
- Casino chip decor is scattered single dots; reads as chips but is
  simple.
- Guard pathing is straight-line steering with wall sliding (no A*);
  guards can take a moment to route around long wall blocks when
  chasing.
- No glass-break noise source; noise comes from sprinting, failed
  picks and the drill only.
- The vault scene's drill is shown as a compact floating bar (the
  full-screen drill modal would hide the room in a frozen frame).

## FINISHER (2026-11-22 ~13:19 WIB, after go-ahead)

1. **Determinism — PASS (byte-identical).** `main.ts` run twice with
   different `MAKEFUN_OUTPUT_DIR` values (`/tmp/vb-out1`, `/tmp/vb-out2`);
   `diff -r` clean, no differences. Both runs printed
   "VAULTBREAK handed in: 4 screenshots, dossier 429244 B".
   Dossier 429,244 B ≤ 1.5 MiB cap. (Node v24.22.1 on this VM; the
   grader runs Node 22.23.4, which also strips types natively.)
2. **Git commit — done, local only, no push.** Root commit
   `e1693289b9380dad1eacc6ce797c1bdb942529af` — 19 files, 4,248
   insertions. No remote configured; nothing pushed. This FINISHER
   section was appended after that commit and committed separately
   (see git log, second commit).
3. **Kit check — 4 passed, 1 expected fail, rest skipped/at-submission.**
   `MAKEFUN_OFFLINE=1 node cli/makefun.mjs check --kit . --repo
   heist-game-entry --worktree` (kit verified 24 files; repo 19 entries,
   413,725 B):
   - PASS: competition_open (now within 05:59Z–17:59Z window),
     snapshot (within intake caps), license_osi (SPDX MIT),
     entrypoint (main.ts → node22).
   - FAIL: transcripts_present — no transcripts uploaded yet; EXPECTED,
     the main session bundles them (builder + finisher sessions) before
     submitting. All other transcript-gate checks skipped for the same
     reason (nothing to read yet).
   - 5 checks deferred to submission (repo_public, repo_owner,
     repo_created_after_open, commit_in_repo, duplicate_snapshot) —
     satisfied when the main session pushes to GitHub
     onlybountyy-hub/best-heist-game-20261122-0559 and submits.
   - Note: RULES.txt confirms there is NO local grade for this
     competition — the server grades every entry; `check` is the only
     local gate available.

Ready for the main session to bundle (with usage rows), push, and
submit before the deadline Mon 2026-11-23 00:59 WIB. Do NOT submit or
push from this finisher session.
