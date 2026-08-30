# ⚜ Sanctuary: Diablo-Style Web Roguelike ⚜

A modern, responsive, zero-dependency HTML5 Canvas & Web Audio roguelike dungeon crawler built for browsers, mobile phones, and desktop PWAs.

---

## 🌐 Live Web Deployment

* **Official Live URL:** [https://nemr118.github.io/rusty-rogue/](https://nemr118.github.io/rusty-rogue/)
* **Hosted on:** GitHub Pages (SSL secured, global CDN distribution).

---

## 🗡️ Key Gameplay Features

* **5 Distinct Hero Archetypes:**
  * 🌿 **Druid:** Nature magic, Iron Bear shapeshifting (+DEF & heavy claw attacks), Poison Creeper, and Cataclysmic Storms.
  * ⚔️ **Warrior:** Frontline powerhouse with Cleaving Strikes, 360° Whirlwind, Battle Cry (+ATK), and Leap Slam.
  * 🔮 **Sorceress:** Pyromancy & Cryomancy (Fire Dart, Frost Nova, Fireball AoE, Teleport, Meteor Swarm).
  * 🗡️ **Rogue:** Stealth skirmisher with venomous blade strikes, Shadow Dash, Fan of Knives, and 350% Assassinate crits.
  * 🛡️ **Paladin:** Holy crusader with Smite, Holy Radiance healing, spinning Blessed Hammers, and Divine Shield.
* **Diablo-Style Fluid HUD:** Real-time rendered Life and Mana globes with fluid levels and bubble animations.
* **5-Tier Interactive Skill Trees (`[K]`):** Earn Skill Points on level-up to unlock and rank up abilities up to Rank 3. Assign abilities to your 4 hotbar slots.
* **RPG Character Overview Sheet (`[C]`):** Detailed stat breakdown displaying Base & Total ATK/DEF, weapon/armor gear, poison status, active buff durations, kills, and gold.
* **Smart Monster Flanking & Surrounding AI:** Monsters coordinate in packs, running Breadth-First Search (BFS) pathfinding around allies to encircle and flank the player.
* **Intelligent Skill Targeting & Trajectory Raycasting:** Auto-locks onto the closest visible enemy when a skill is pressed. Move the crosshair with `WASD` / Arrows, cycle targets with `Tab`, and trace the highlighted glowing raycast beam.
* **Compact Challenge Vaults:** Discover glowing portals (`§`) leading into intense 26×10 tactical arenas. Slay monster hordes or elite champions to spawn the Legendary Reward Chest (`🎁`).
* **20 Procedural Dungeon Depths:** Explore 4 distinct biomes with major boss battles at Depths 5, 10, 15, and 20:
  * **Floor 5:** The Butcher (Meat Hook drag)
  * **Floor 10:** The Hydra Queen (Venomous bile spit)
  * **Floor 15:** Ignis the Pyrelord (Molten magma breath)
  * **Floor 20:** Malakor the Void Tyrant (Void Oblivion nova)
* **One-Key Auto-Explore (`[O]`):** BFS-based exploration that reveals unseen areas, tracks descending stairs (`▼`), and gathers loot while pausing instantly upon spotting danger.
* **Web Audio Procedural Sound Synthesizer:** Real-time synthesized 8-bit sound effects (slashes, crits, spells, footsteps) without external audio files.
* **Mobile & Desktop PWA Support:** Touchscreen on-screen D-pad and responsive UI that scales cleanly to any screen size.

---

## 🎮 Desktop & Mobile Controls

### Keyboard (Desktop)
| Key | Action |
|---|---|
| `WASD` / `Arrow Keys` / `HJKL` | Move Hero & Bump Attack |
| `1`, `2`, `3`, `4` | Trigger Hotbar Skill Slots |
| `WASD` / `Arrows` (in Aiming) | Steer Skill Targeting Reticle |
| `Tab` (in Aiming) | Cycle Target Reticle between Visible Enemies |
| `Enter` / `Space` / `1-4` (in Aiming) | Confirm & Fire Targeted Skill |
| `Esc` / `Q` (in Aiming) | Cancel Targeting |
| `K` / `T` | Open Interactive **Skill Tree** |
| `C` | Open RPG **Character Sheet** & Buff Overview |
| `O` | **Auto-Explore** (Auto-path to unexplored tiles & loot) |
| `P` | Drink **Health Elixir** (Restores HP & cures Poison) |
| `M` | Use **Mana Crystal** (Restores MP) |
| `Space` / `.` | Wait / Pass Turn |
| `Enter` (on `▼` stairs) | Descend to the Next Dungeon Depth |

### Touch / Mobile
* On-screen D-pad buttons: `▲`, `▼`, `◄`, `►`
* Touch action bar: Hotbar slots `[1]`, `[2]`, `[3]`, `[4]`, Skill Tree `[K]`, Auto-Explore `[AUTO]`, Descend Stairs `[▼]`.
* Interactive tap on Diablo Life globe (Health potion) and Mana globe (Mana crystal).

---

## 🏗️ Architecture & File Layout

```
rusty_rogue_web/
├── index.html       # Responsive game container, Diablo globes, HUD, and modal dialogs
├── game.js          # Pure client-side game engine, Web Audio synth, canvas renderer, BFS AI
├── manifest.json    # Progressive Web App (PWA) manifest for standalone installation
└── README.md        # Documentation and deployment guide
```

---

## 🚀 Local Development

To run the web version locally without an internet connection:

```bash
cd /home/nemr/Work/rusty_rogue_web
python3 -m http.server 8080
```
Open `http://localhost:8080` in your web browser.
