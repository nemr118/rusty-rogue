/**
 * @file game.js - Sanctuary: Diablo-Style Roguelike Web Engine
 * @description Pure client-side HTML5 Canvas & Web Audio roguelike engine.
 * Features 5 character classes, 20 dungeon floors, smart BFS monster flanking AI,
 * raycast FOV, skill trees, Diablo fluid globes, and responsive touch/keyboard controls.
 * @author nemr
 */

/**
 * Web Audio API procedural synthesizer for retro 8-bit sound effects.
 * Synthesizes hits, critical strikes, spells, heals, and footsteps without external audio assets.
 */
class SoundSynth {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
  }
  /** Initializes or resumes the AudioContext upon user gesture. */
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  /** Plays a sharp physical melee hit impact sound. */
  playHit() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }
  /** Plays a high-frequency critical strike impact sound. */
  playCrit() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(350, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }
  /** Plays an alarm/screamer sound when monsters alert. */
  playScream() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }
  /** Plays an arcane magical spellcasting sound. */
  playSpell() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }
  /** Plays a soothing chord when health or restorative elixirs are consumed. */
  playHeal() {
    this.init();
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C Major arpeggio
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.08);
      osc.stop(this.ctx.currentTime + i * 0.08 + 0.25);
    });
  }
  /** Plays a subtle subterranean footstep click. */
  playStep() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }
}

/** Global sound synthesizer singleton. */
const audio = new SoundSynth();

// --- Game Engine Constants & Tile IDs ---
const MAP_W = 56;
const MAP_H = 32;
const TILE_WALL = 0;
const TILE_FLOOR = 1;
const TILE_WATER = 2;
const TILE_STAIRS = 3;
const TILE_CHALLENGE = 4;
const TILE_RETURN = 5;
const TILE_SPIKE = 6;
const TILE_FIRE = 7;
const TILE_CHEST = 8;

/**
 * Master Game Engine controlling state, turns, rendering, audio, and player input.
 */
class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.depth = 1;
    this.maxDepth = 20; // 20 Floor Campaign!
    this.fovRadius = 8;
    this.frameCount = 0;
    this.isAutoexploring = false;
    this.targetingAbilityId = null;
    this.targetCursor = { x: 0, y: 0 };
    this.particles = [];
    this.logs = [];
    this.state = 'char_creation';

    this.selectedClass = 'Druid';
    this.player = this.createPlayerTemplate("Eldrin", "Druid");

    this.monsters = [];
    this.items = [];
    this.map = [];
    this.stairsPos = { x: 0, y: 0 };
    this.stairsDiscovered = false;
    this.savedFloor = null;
    this.inChallengeVault = false;

    this.tileSize = 26;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.setupTouchAndClicks();
    this.setupKeyboard();

    this.lastAutoexploreStep = 0;
    setInterval(() => this.loop(), 35);
  }

  createPlayerTemplate(name, className) {
    let hp = 32, mp = 18, baseAtk = 5, baseDef = 2;
    let weaponName = "Oak Quarterstaff", weaponBonus = 2;
    let armorName = "Barkskin Vestment", armorBonus = 1;
    let abilities = [];
    let hotbar = [null, null, null, null];

    if (className === 'Druid') {
      abilities = [
        { id: "thorn_whip", name: "Thorn Whip", glyph: "🌿", desc: "Strikes a foe at distance up to 4 tiles for nature damage.", mpCost: 3, level: 1, maxLevel: 3, reqLvl: 1, targeted: true },
        { id: "bear_form", name: "Iron Bear Form", glyph: "🐻", desc: "Shapeshift: +8 DEF and heavy claw attacks (+5 ATK).", mpCost: 4, level: 0, maxLevel: 3, reqLvl: 2, targeted: false },
        { id: "poison_creeper", name: "Poison Creeper", glyph: "🌱", desc: "Summons creeping vines in a 360° burst around you.", mpCost: 4, level: 0, maxLevel: 3, reqLvl: 3, targeted: false },
        { id: "healing_bloom", name: "Healing Bloom", glyph: "🌸", desc: "Channels nature vigor, restoring +30 HP.", mpCost: 6, level: 0, maxLevel: 3, reqLvl: 4, targeted: false },
        { id: "hurricane", name: "Cataclysmic Storm", glyph: "🌀", desc: "Summons a 5x5 raging tempest shredding all enemies.", mpCost: 9, level: 0, maxLevel: 3, reqLvl: 5, targeted: true },
      ];
      hotbar[0] = "thorn_whip";
    } else if (className === 'Warrior') {
      hp = 38; mp = 12; baseAtk = 6; baseDef = 3;
      weaponName = "Broad Iron Sword"; armorName = "Chainmail Armor"; armorBonus = 2;
      abilities = [
        { id: "cleave", name: "Cleaving Strike", glyph: "⚔", desc: "Heavy slash that deals bonus damage to adjacent foes.", mpCost: 2, level: 1, maxLevel: 3, reqLvl: 1, targeted: false },
        { id: "whirlwind", name: "Whirlwind", glyph: "🌪", desc: "Spins in a full 360° circle, striking all 8 neighbours.", mpCost: 4, level: 0, maxLevel: 3, reqLvl: 2, targeted: false },
        { id: "war_cry", name: "Battle Cry", glyph: "📢", desc: "Roar with ferocity: +5 ATK bonus for next 10 turns.", mpCost: 3, level: 0, maxLevel: 3, reqLvl: 3, targeted: false },
        { id: "iron_skin", name: "Iron Will", glyph: "🛡", desc: "Fortify defense: +8 DEF and restores 18 HP.", mpCost: 5, level: 0, maxLevel: 3, reqLvl: 4, targeted: false },
        { id: "leap_slam", name: "Leap Slam", glyph: "💥", desc: "Leap across room up to 5 tiles and slam a 3x3 shockwave.", mpCost: 7, level: 0, maxLevel: 3, reqLvl: 5, targeted: true },
      ];
      hotbar[0] = "cleave";
    } else if (className === 'Sorceress') {
      hp = 24; mp = 25; baseAtk = 4; baseDef = 1;
      weaponName = "Arcane Crystal Wand"; armorName = "Silk Robe of Warding";
      abilities = [
        { id: "fire_dart", name: "Fire Dart", glyph: "🔥", desc: "Hurls a focused bolt of fiery flame up to 5 tiles.", mpCost: 2, level: 1, maxLevel: 3, reqLvl: 1, targeted: true },
        { id: "frost_nova", name: "Frost Nova", glyph: "❄", desc: "Detonates an icy ring freezing and damaging surrounding foes.", mpCost: 4, level: 0, maxLevel: 3, reqLvl: 2, targeted: false },
        { id: "fireball", name: "Fireball", glyph: "☼", desc: "Unleashes an explosive 3x3 fiery inferno.", mpCost: 6, level: 0, maxLevel: 3, reqLvl: 3, targeted: true },
        { id: "teleport", name: "Teleport", glyph: "⚡", desc: "Blink instantaneously to any explored tile in sight.", mpCost: 5, level: 0, maxLevel: 3, reqLvl: 4, targeted: true },
        { id: "meteor", name: "Meteor Swarm", glyph: "☄", desc: "Calls down apocalyptic meteors burning a 5x5 zone.", mpCost: 10, level: 0, maxLevel: 3, reqLvl: 5, targeted: true },
      ];
      hotbar[0] = "fire_dart";
    } else if (className === 'Rogue') {
      hp = 28; mp = 16; baseAtk = 5; baseDef = 2;
      weaponName = "Poisoned Stiletto"; armorName = "Shadow Leather Vest";
      abilities = [
        { id: "poison_blade", name: "Poison Dagger", glyph: "🗡", desc: "Deadly venom strike dealing bonus damage and poisoning target.", mpCost: 2, level: 1, maxLevel: 3, reqLvl: 1, targeted: false },
        { id: "shadow_dash", name: "Shadow Dash", glyph: "💨", desc: "Blink through shadows up to 4 tiles forward.", mpCost: 4, level: 0, maxLevel: 3, reqLvl: 2, targeted: true },
        { id: "fan_of_knives", name: "Fan of Knives", glyph: "🔪", desc: "Hurls razor blades in all directions at surrounding enemies.", mpCost: 5, level: 0, maxLevel: 3, reqLvl: 3, targeted: false },
        { id: "smoke_bomb", name: "Smoke Screen", glyph: "☁", desc: "Drop smoke: confuses enemies and restores +15 HP.", mpCost: 4, level: 0, maxLevel: 3, reqLvl: 4, targeted: false },
        { id: "assassinate", name: "Assassinate", glyph: "☠", desc: "Lethal strike dealing 350% critical damage to target.", mpCost: 8, level: 0, maxLevel: 3, reqLvl: 5, targeted: true },
      ];
      hotbar[0] = "poison_blade";
    } else if (className === 'Paladin') {
      hp = 34; mp = 16; baseAtk = 5; baseDef = 3;
      weaponName = "Blessed Mace"; armorName = "Crusader Plate"; armorBonus = 2;
      abilities = [
        { id: "smite", name: "Holy Smite", glyph: "✨", desc: "Strike infused with sacred light dealing bonus holy damage.", mpCost: 2, level: 1, maxLevel: 3, reqLvl: 1, targeted: false },
        { id: "holy_light", name: "Holy Radiance", glyph: "✦", desc: "Channel divine energy to restore +30 HP.", mpCost: 6, level: 0, maxLevel: 3, reqLvl: 2, targeted: false },
        { id: "blessed_hammer", name: "Blessed Hammer", glyph: "🔨", desc: "Summons spinning radiant hammer dealing 360° holy damage.", mpCost: 4, level: 0, maxLevel: 3, reqLvl: 3, targeted: false },
        { id: "divine_shield", name: "Divine Shield", glyph: "🛡", desc: "Surround in sacred light: +10 DEF and heals 15 HP.", mpCost: 5, level: 0, maxLevel: 3, reqLvl: 4, targeted: false },
        { id: "judgment", name: "Judgment", glyph: "⚡", desc: "Beams of radiant light strike down every monster in sight.", mpCost: 9, level: 0, maxLevel: 3, reqLvl: 5, targeted: false },
      ];
      hotbar[0] = "smite";
    }

    return {
      name,
      class: className,
      x: 0, y: 0,
      hp, maxHp: hp,
      mp, maxMp: mp,
      level: 1, xp: 0, xpToNext: 35,
      skillPoints: 0,
      baseAtk, weaponBonus, weaponName,
      baseDef, armorBonus, armorName,
      gold: 0, hpPotions: 1, mpPotions: 1, kills: 0,
      abilities,
      hotbar,
      isBearForm: false,
      warCryTurns: 0,
      warCryBonus: 0,
      divineShieldTurns: 0,
      divineShieldBonus: 0,
      poisonTurns: 0
    };
  }

  selectClass(className, el) {
    this.selectedClass = className;
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
    if (el) el.classList.add('selected');
  }

  confirmCharacterCreation() {
    const nameInput = document.getElementById('hero-name-input');
    const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : "Eldrin";
    this.player = this.createPlayerTemplate(name, this.selectedClass);
    document.getElementById('char-creation-modal').style.display = 'none';
    this.state = 'playing';

    this.depth = 1;
    this.initMap();
    this.updateUI();

    this.addLog(`⚔ Welcome, ${this.player.name} the ${this.player.class}! 20 Depths await.`, "#fbbf24");
    this.addLog(`Watch out: Monsters scream when noticing you, alerting nearby packs!`, "#f87171");
  }

  openSkillTree() {
    const modal = document.getElementById('skill-tree-modal');
    document.getElementById('tree-class-title').innerText = `⚜ ${this.player.class.toUpperCase()} SKILL TREE — ${this.player.name} ⚜`;
    document.getElementById('tree-sp-banner').innerText = `★ Available Skill Points: ${this.player.skillPoints} (Gain +1 per Level-Up)`;

    const list = document.getElementById('tree-skills-list');
    list.innerHTML = this.player.abilities.map((ab, idx) => {
      const isUnlocked = ab.level > 0;
      const meetsLvl = this.player.level >= ab.reqLvl;
      const canUpgrade = this.player.skillPoints > 0 && meetsLvl && ab.level < ab.maxLevel;

      let rankStr = isUnlocked ? `Rank ${ab.level}/${ab.maxLevel}` : (meetsLvl ? `Ready to Learn (Req Lv.${ab.reqLvl})` : `Locked (Req Lv.${ab.reqLvl})`);
      let hotbarSlot = this.player.hotbar.indexOf(ab.id);
      let hotbarTag = hotbarSlot !== -1 ? `<span style="color: #4ade80; font-weight: bold;">[Hotbar Slot ${hotbarSlot + 1}]</span>` : '';

      return `
        <div class="skill-row ${isUnlocked ? 'unlocked' : ''}">
          <div class="skill-head">
            <span class="skill-title">${ab.glyph} ${ab.name} ${hotbarTag}</span>
            <span class="skill-rank">${rankStr}</span>
          </div>
          <div class="skill-desc">Cost: ${ab.mpCost} MP | ${ab.desc}</div>
          <div style="font-size: 9.5px; color: #fbbf24; margin-top: 2px;">
            ${ab.level === 0 ? `Next Rank (1): Initial Unlock` : (ab.level === 1 ? `Next Rank (2): Massive +75% Damage / Buff Increase` : (ab.level === 2 ? `Next Rank (3 - MAX): MAXIMUM POWER + Wide AoE Radius` : `★ MAX RANK ACHIEVED`))}
          </div>
          <div class="skill-actions">
            <button class="btn-upgrade" ${canUpgrade ? '' : 'disabled'} onclick="game.upgradeSkill(${idx})">
              ${isUnlocked ? (ab.level >= ab.maxLevel ? 'MAXED' : 'UPGRADE (+1 RANK)') : 'LEARN ABILITY'}
            </button>
            ${isUnlocked ? `
              <span style="font-size: 10px; color: #94a3b8;">Assign:</span>
              <button class="btn-assign" onclick="game.assignHotbarSlot('${ab.id}', 0)">1</button>
              <button class="btn-assign" onclick="game.assignHotbarSlot('${ab.id}', 1)">2</button>
              <button class="btn-assign" onclick="game.assignHotbarSlot('${ab.id}', 2)">3</button>
              <button class="btn-assign" onclick="game.assignHotbarSlot('${ab.id}', 3)">4</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    modal.style.display = 'flex';
  }

  closeSkillTree() {
    document.getElementById('skill-tree-modal').style.display = 'none';
    this.updateUI();
  }

  openCharacterSheet() {
    const modal = document.getElementById('char-sheet-modal');
    if (!modal) return;

    document.getElementById('sheet-hero-name').innerText = `⚜ ${this.player.name.toUpperCase()} ⚜`;
    document.getElementById('sheet-title-badge').innerText = `${this.player.class} • ${this.player.class === 'Druid' ? 'Guardian of the Ancients' : (this.player.class === 'Warrior' ? 'Champion of the Iron Blade' : (this.player.class === 'Sorceress' ? 'Weaver of Arcane Storms' : (this.player.class === 'Rogue' ? 'Shadowblade Assassin' : 'Crusader of the Sacred Light')))}`;

    document.getElementById('sheet-lvl-xp').innerText = `LVL ${this.player.level} (${this.player.xp}/${this.player.xpToNext} XP)`;
    document.getElementById('sheet-sp').innerText = `${this.player.skillPoints} SP`;
    document.getElementById('sheet-hp').innerText = `${this.player.hp} / ${this.player.maxHp}`;
    document.getElementById('sheet-mp').innerText = `${this.player.mp} / ${this.player.maxMp}`;

    const bearAb = this.player.abilities.find(a => a.id === 'bear_form');
    const bearRank = bearAb ? bearAb.level : 1;
    const bearAtkVal = bearRank === 3 ? 20 : (bearRank === 2 ? 12 : 6);
    const bearDefVal = bearRank === 3 ? 26 : (bearRank === 2 ? 16 : 8);
    const bearAtk = this.player.isBearForm ? ` + Bear(+${bearAtkVal})` : '';
    const cryAtk = this.player.warCryTurns > 0 ? ` + Cry(+${this.player.warCryBonus})` : '';
    const totalAtk = this.player.baseAtk + this.player.weaponBonus + (this.player.isBearForm ? bearAtkVal : 0) + (this.player.warCryTurns > 0 ? this.player.warCryBonus : 0);
    document.getElementById('sheet-atk').innerText = `${totalAtk} ATK (Base ${this.player.baseAtk} + Wpn ${this.player.weaponBonus}${bearAtk}${cryAtk})`;

    const bearDef = this.player.isBearForm ? ` + Bear(+${bearDefVal})` : '';
    const shieldDef = this.player.divineShieldTurns > 0 ? ` + Shield(+${this.player.divineShieldBonus})` : '';
    const totalDef = this.player.baseDef + this.player.armorBonus + (this.player.isBearForm ? bearDefVal : 0) + (this.player.divineShieldTurns > 0 ? this.player.divineShieldBonus : 0);
    document.getElementById('sheet-def').innerText = `${totalDef} DEF (Base ${this.player.baseDef} + Arm ${this.player.armorBonus}${bearDef}${shieldDef})`;

    const buffs = [];
    if (this.player.isBearForm) buffs.push("🐻 Iron Bear Form");
    if (this.player.warCryTurns > 0) buffs.push(`📢 Battle Cry (+${this.player.warCryBonus} ATK, ${this.player.warCryTurns}t)`);
    if (this.player.divineShieldTurns > 0) buffs.push(`🛡 Divine Shield (+${this.player.divineShieldBonus} DEF, ${this.player.divineShieldTurns}t)`);
    if (this.player.poisonTurns > 0) buffs.push(`☣ POISONED (-1 HP/t, ${this.player.poisonTurns}t)`);
    const buffEl = document.getElementById('sheet-buffs');
    if (buffEl) {
      buffEl.innerHTML = buffs.length > 0 ? `✨ Status & Buffs: <span style="color: #fde047; font-weight: bold;">${buffs.join(' | ')}</span>` : `✨ Status & Buffs: <span style="color: #4ade80;">None (Healthy)</span>`;
    }

    document.getElementById('sheet-gold').innerText = `${this.player.gold} 💰`;
    document.getElementById('sheet-kills').innerText = `${this.player.kills} Kills`;

    document.getElementById('sheet-weapon').innerText = `⚔ Weapon: ${this.player.weaponName} (+${this.player.weaponBonus} ATK)`;
    document.getElementById('sheet-armor').innerText = `🛡 Armor: ${this.player.armorName} (+${this.player.armorBonus} DEF)`;

    const list = document.getElementById('sheet-abilities-list');
    list.innerHTML = this.player.abilities.map(ab => {
      const isUnlocked = ab.level > 0;
      const slot = this.player.hotbar.indexOf(ab.id);
      const slotStr = slot !== -1 ? `<span style="color: #4ade80; font-weight: bold;">[Hotbar Slot ${slot + 1}]</span>` : '';
      if (isUnlocked) {
        return `<div style="color: #86efac;">${ab.glyph} <strong>${ab.name}</strong> (Rank ${ab.level}/${ab.maxLevel}) — ${ab.mpCost} MP ${slotStr}</div>`;
      } else {
        return `<div style="color: #64748b;">${ab.glyph} ${ab.name} (Locked - Req Lv.${ab.reqLvl})</div>`;
      }
    }).join('');

    modal.style.display = 'flex';
  }

  closeCharacterSheet() {
    const modal = document.getElementById('char-sheet-modal');
    if (modal) modal.style.display = 'none';
  }

  upgradeSkill(idx) {
    if (this.player.skillPoints > 0 && idx < this.player.abilities.length) {
      const ab = this.player.abilities[idx];
      if (this.player.level >= ab.reqLvl && ab.level < ab.maxLevel) {
        ab.level++;
        this.player.skillPoints--;
        audio.playHeal();

        if (!this.player.hotbar.includes(ab.id)) {
          const emptyIdx = this.player.hotbar.indexOf(null);
          if (emptyIdx !== -1) {
            this.player.hotbar[emptyIdx] = ab.id;
          }
        }

        this.addLog(`⭐ Upgraded [${ab.name}] to Rank ${ab.level}! Power substantially increased!`, "#fde047");
        this.openSkillTree();
        this.updateUI();
      }
    }
  }

  assignHotbarSlot(abId, slot) {
    if (slot >= 0 && slot < 4) {
      for (let i = 0; i < 4; i++) {
        if (this.player.hotbar[i] === abId) {
          this.player.hotbar[i] = null;
        }
      }
      this.player.hotbar[slot] = abId;
      this.openSkillTree();
      this.updateUI();
    }
  }

  triggerHotbarSlot(slot) {
    if (slot >= 0 && slot < 4) {
      const abId = this.player.hotbar[slot];
      if (!abId) {
        this.addLog(`Slot ${slot + 1} is empty! Tap [SKILL TREE] to assign abilities.`, "#94a3b8");
        return;
      }
      const ab = this.player.abilities.find(a => a.id === abId);
      if (!ab || ab.level === 0) {
        this.addLog(`Ability is locked! Unlock it in the Skill Tree.`, "#ef4444");
        return;
      }
      if (this.player.mp < ab.mpCost) {
        this.addLog(`Not enough Mana! Needs ${ab.mpCost} MP.`, "#ef4444");
        return;
      }

      if (ab.targeted) {
        let closest = null;
        let closestDist = Infinity;
        for (const m of this.monsters) {
          if (this.map[m.y] && this.map[m.y][m.x] && this.map[m.y][m.x].visible) {
            const d = Math.hypot(m.x - this.player.x, m.y - this.player.y);
            if (d < closestDist) {
              closestDist = d;
              closest = m;
            }
          }
        }
        if (closest) {
          this.targetCursor = { x: closest.x, y: closest.y };
        } else {
          this.targetCursor = { x: this.player.x, y: this.player.y };
        }
        this.targetingAbilityId = abId;
        this.addLog(`🎯 Aiming [${ab.name}]: WASD/Arrows to aim, Enter/Space/Tap to fire, Tab to cycle targets, Esc to cancel.`, "#fde047");
      } else {
        this.castAbility(abId, this.player.x, this.player.y);
      }
    }
  }

  castAbility(abId, tx, ty) {
    const ab = this.player.abilities.find(a => a.id === abId);
    if (!ab || this.player.mp < ab.mpCost) return;

    this.player.mp -= ab.mpCost;
    audio.playSpell();
    const rank = ab.level;

    // === DRUID ===
    if (abId === 'thorn_whip') {
      const dmg = rank === 1 ? (18 + Math.floor(Math.random() * 4)) : (rank === 2 ? (32 + Math.floor(Math.random() * 6)) : (52 + Math.floor(Math.random() * 10)));
      this.addLog(`[Rank ${rank}] 🌿 Thorn Whip lashes out!`, "#4ade80");
      this.particles.push({ x: tx, y: ty, glyph: '🌿', color: '#4ade80', life: 10 });
      const m = this.monsters.find(m => m.x === tx && m.y === ty);
      if (m) {
        m.hp -= dmg;
        if (rank >= 2 && Math.random() < 0.5) {
          m.poisonTurns = 3;
          this.addLog(`🌿 Barbed thorns infected ${m.name} with venom! (-2 HP/turn)`, "#4ade80");
        }
        this.addLog(`🌿 Thorn Whip strikes ${m.name} for ${dmg} nature damage!`, "#86efac");
      }
    } else if (abId === 'bear_form') {
      this.player.isBearForm = !this.player.isBearForm;
      const atkBonus = rank === 1 ? 6 : (rank === 2 ? 12 : 20);
      const defBonus = rank === 1 ? 8 : (rank === 2 ? 16 : 26);
      if (this.player.isBearForm) {
        this.addLog(`[Rank ${rank}] 🐻 SHAPESHIFT: You transform into the Iron Bear! (+${atkBonus} ATK, +${defBonus} DEF)`, "#fbbf24");
        if (rank >= 3) {
          this.addLog("🐻 Terrifying Bear Roar shakes the dungeon!", "#fde047");
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const m = this.monsters.find(m => m.x === this.player.x + dx && m.y === this.player.y + dy);
              if (m) m.hp -= 20;
            }
          }
        }
      } else {
        this.addLog("🌿 You return to human form.", "#a7f3d0");
      }
      this.particles.push({ x: this.player.x, y: this.player.y, glyph: '🐻', color: '#fbbf24', life: 12 });
    } else if (abId === 'poison_creeper') {
      const radius = rank >= 3 ? 2 : 1;
      const dmg = rank === 1 ? 16 : (rank === 2 ? 30 : 50);
      this.addLog(`[Rank ${rank}] 🌱 Poison Creeper erupts across a ${radius}-tile zone!`, "#22c55e");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (dx === 0 && dy === 0) continue;
          const px = this.player.x + dx, py = this.player.y + dy;
          this.particles.push({ x: px, y: py, glyph: '🌱', color: '#22c55e', life: 8 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) {
            m.hp -= dmg;
            m.poisonTurns = 4;
            this.addLog(`🌱 Toxic thorns poisoned ${m.name}! (-2 HP/turn)`, "#4ade80");
          }
        }
      }
    } else if (abId === 'healing_bloom') {
      const heal = rank === 1 ? 35 : (rank === 2 ? 70 : 120);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      if (rank >= 3) this.player.mp = Math.min(this.player.maxMp, this.player.mp + 10);
      audio.playHeal();
      this.addLog(`[Rank ${rank}] 🌸 Healing Bloom restores +${heal} HP${rank >= 3 ? ' & +10 MP' : ''}!`, "#a7f3d0");
      this.particles.push({ x: this.player.x, y: this.player.y, glyph: '🌸', color: '#f472b6', life: 12 });
    } else if (abId === 'hurricane') {
      const radius = rank >= 3 ? 3 : 2;
      const dmg = rank === 1 ? (32 + Math.floor(Math.random() * 6)) : (rank === 2 ? (60 + Math.floor(Math.random() * 10)) : (100 + Math.floor(Math.random() * 15)));
      this.addLog(`[Rank ${rank}] 🌀 Cataclysmic Tempest devastates a ${radius}-tile storm!`, "#38bdf8");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const px = tx + dx, py = ty + dy;
          this.particles.push({ x: px, y: py, glyph: '※', color: '#60a5fa', life: 12 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }

    // === WARRIOR ===
    } else if (abId === 'cleave') {
      const bonus = rank === 1 ? 10 : (rank === 2 ? 22 : 38);
      const dmg = this.player.baseAtk + this.player.weaponBonus + bonus;
      this.addLog(`[Rank ${rank}] ⚔ Cleaving Strike sweeps adjacent foes for ${dmg} damage!`, "#f59e0b");
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const px = this.player.x + dx, py = this.player.y + dy;
          this.particles.push({ x: px, y: py, glyph: '⚔', color: '#f59e0b', life: 8 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }
    } else if (abId === 'whirlwind') {
      const radius = rank >= 3 ? 2 : 1;
      const bonus = rank === 1 ? 12 : (rank === 2 ? 26 : 45);
      const dmg = this.player.baseAtk + this.player.weaponBonus + bonus;
      this.addLog(`[Rank ${rank}] 🌪 Whirlwind spins across ${radius}-tile radius for ${dmg} damage!`, "#fde047");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (dx === 0 && dy === 0) continue;
          const px = this.player.x + dx, py = this.player.y + dy;
          this.particles.push({ x: px, y: py, glyph: '※', color: '#fde047', life: 8 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }
    } else if (abId === 'war_cry') {
      const heal = rank === 1 ? 15 : (rank === 2 ? 30 : 55);
      const sonic = rank === 1 ? 14 : (rank === 2 ? 28 : 48);
      const atkBuff = rank === 1 ? 6 : (rank === 2 ? 12 : 20);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.player.warCryTurns = 12;
      this.player.warCryBonus = atkBuff;
      this.addLog(`[Rank ${rank}] 📢 BATTLE CRY: You roar fiercely! Restored +${heal} HP, gained +${atkBuff} ATK for 12 turns, and dealt ${sonic} sonic damage!`, "#f97316");
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const px = this.player.x + dx, py = this.player.y + dy;
          this.particles.push({ x: px, y: py, glyph: '📢', color: '#f97316', life: 10 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= sonic;
        }
      }
    } else if (abId === 'iron_skin') {
      const heal = rank === 1 ? 25 : (rank === 2 ? 50 : 90);
      const defBuff = rank === 1 ? 8 : (rank === 2 ? 16 : 28);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.player.baseDef += defBuff;
      this.addLog(`[Rank ${rank}] 🛡 Iron Will fortifies you! Restored +${heal} HP and gained +${defBuff} DEF!`, "#60a5fa");
      this.particles.push({ x: this.player.x, y: this.player.y, glyph: '🛡', color: '#60a5fa', life: 12 });
    } else if (abId === 'leap_slam') {
      const radius = rank >= 3 ? 2 : 1;
      const dmg = rank === 1 ? 30 : (rank === 2 ? 55 : 95);
      if (this.isWalkable(tx, ty) && !this.monsters.some(m => m.x === tx && m.y === ty)) {
        this.player.x = tx;
        this.player.y = ty;
      }
      this.addLog(`[Rank ${rank}] 💥 LEAP SLAM crashes down for ${dmg} crushing damage!`, "#f97316");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const px = tx + dx, py = ty + dy;
          this.particles.push({ x: px, y: py, glyph: '💥', color: '#f97316', life: 10 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }

    // === SORCERESS ===
    } else if (abId === 'fire_dart') {
      const dmg = rank === 1 ? 20 : (rank === 2 ? 36 : 60);
      this.addLog(`[Rank ${rank}] 🔥 Searing Fire Dart incinerates target for ${dmg} damage!`, "#f97316");
      this.particles.push({ x: tx, y: ty, glyph: '🔥', color: '#f97316', life: 8 });
      const m = this.monsters.find(m => m.x === tx && m.y === ty);
      if (m) m.hp -= dmg;
    } else if (abId === 'frost_nova') {
      const radius = rank >= 3 ? 2 : 1;
      const dmg = rank === 1 ? 20 : (rank === 2 ? 38 : 65);
      this.addLog(`[Rank ${rank}] ❄ Frost Nova freezes a ${radius}-tile ring for ${dmg} damage!`, "#38bdf8");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (dx === 0 && dy === 0) continue;
          const px = this.player.x + dx, py = this.player.y + dy;
          this.particles.push({ x: px, y: py, glyph: '❄', color: '#38bdf8', life: 10 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }
    } else if (abId === 'fireball') {
      const radius = rank >= 3 ? 2 : 1;
      const dmg = rank === 1 ? 30 : (rank === 2 ? 58 : 95);
      this.addLog(`[Rank ${rank}] ☼ Fireball detonates a ${radius}-tile inferno for ${dmg} damage!`, "#f97316");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const px = tx + dx, py = ty + dy;
          this.particles.push({ x: px, y: py, glyph: '☼', color: '#f97316', life: 10 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }
    } else if (abId === 'teleport') {
      const shock = rank === 1 ? 16 : (rank === 2 ? 32 : 58);
      const heal = rank === 1 ? 0 : (rank === 2 ? 20 : 40);
      if (this.isWalkable(tx, ty) && !this.monsters.some(m => m.x === tx && m.y === ty)) {
        this.player.x = tx;
        this.player.y = ty;
        if (heal > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        if (rank >= 3) this.player.mp = Math.min(this.player.maxMp, this.player.mp + 15);
        this.addLog(`[Rank ${rank}] ⚡ Instant Teleport! Shocked area for ${shock} damage${heal > 0 ? ` & healed +${heal} HP` : ''}!`, "#c084fc");
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const px = tx + dx, py = ty + dy;
            this.particles.push({ x: px, y: py, glyph: '⚡', color: '#c084fc', life: 10 });
            const m = this.monsters.find(m => m.x === px && m.y === py);
            if (m) m.hp -= shock;
          }
        }
      }
    } else if (abId === 'meteor') {
      const radius = rank >= 3 ? 3 : 2;
      const dmg = rank === 1 ? 50 : (rank === 2 ? 90 : 150);
      this.addLog(`[Rank ${rank}] ☄ Meteor Swarm obliterates a ${radius}-tile zone for ${dmg} catastrophic damage!`, "#ef4444");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const px = tx + dx, py = ty + dy;
          this.particles.push({ x: px, y: py, glyph: '☄', color: '#ef4444', life: 14 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }

    // === ROGUE ===
    } else if (abId === 'poison_blade') {
      const bonus = rank === 1 ? 12 : (rank === 2 ? 26 : 48);
      const dmg = this.player.baseAtk + this.player.weaponBonus + bonus;
      this.addLog(`[Rank ${rank}] 🗡 Poison Blade thrusts for ${dmg} piercing venom damage!`, "#4ade80");
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const px = this.player.x + dx, py = this.player.y + dy;
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) {
            m.poisonTurns = 5;
            this.particles.push({ x: px, y: py, glyph: '🗡', color: '#4ade80', life: 8 });
            m.hp -= dmg;
            this.addLog(`🗡 Poison Blade poisoned ${m.name}! (-2 HP/turn)`, "#4ade80");
          }
        }
      }
    } else if (abId === 'shadow_dash') {
      const dmg = rank === 1 ? 16 : (rank === 2 ? 32 : 55);
      const heal = rank === 1 ? 0 : (rank === 2 ? 10 : 25);
      if (this.isWalkable(tx, ty) && !this.monsters.some(m => m.x === tx && m.y === ty)) {
        this.player.x = tx;
        this.player.y = ty;
        if (heal > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this.addLog(`[Rank ${rank}] 💨 Shadow Dash struck path for ${dmg} damage!`, "#c084fc");
        this.particles.push({ x: tx, y: ty, glyph: '◈', color: '#c084fc', life: 10 });
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const m = this.monsters.find(m => m.x === tx + dx && m.y === ty + dy);
            if (m) m.hp -= dmg;
          }
        }
      }
    } else if (abId === 'fan_of_knives') {
      const radius = rank >= 3 ? 2 : 1;
      const dmg = rank === 1 ? 22 : (rank === 2 ? 42 : 70);
      this.addLog(`[Rank ${rank}] 🔪 Fan of Knives sprays daggers in ${radius}-tile radius for ${dmg} damage!`, "#fb923c");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (dx === 0 && dy === 0) continue;
          const px = this.player.x + dx, py = this.player.y + dy;
          this.particles.push({ x: px, y: py, glyph: '🔪', color: '#fb923c', life: 8 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }
    } else if (abId === 'smoke_bomb') {
      const heal = rank === 1 ? 25 : (rank === 2 ? 50 : 90);
      const mp = rank === 1 ? 0 : (rank === 2 ? 8 : 18);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      if (mp > 0) this.player.mp = Math.min(this.player.maxMp, this.player.mp + mp);
      this.addLog(`[Rank ${rank}] ☁ Smoke Screen vanishes you! Restored +${heal} HP${mp > 0 ? ` & +${mp} MP` : ''}!`, "#e2e8f0");
      this.particles.push({ x: this.player.x, y: this.player.y, glyph: '☁', color: '#e2e8f0', life: 10 });
    } else if (abId === 'assassinate') {
      const dmg = rank === 1 ? 50 : (rank === 2 ? 100 : 180);
      this.addLog(`[Rank ${rank}] ☠ ASSASSINATE strikes target for ${dmg} LETHAL damage!`, "#ef4444");
      this.particles.push({ x: tx, y: ty, glyph: '☠', color: '#ef4444', life: 12 });
      const m = this.monsters.find(m => m.x === tx && m.y === ty);
      if (m) m.hp -= dmg;

    // === PALADIN ===
    } else if (abId === 'smite') {
      const bonus = rank === 1 ? 12 : (rank === 2 ? 26 : 45);
      const dmg = this.player.baseAtk + this.player.weaponBonus + bonus;
      this.addLog(`[Rank ${rank}] ✨ Holy Smite strikes for ${dmg} radiant damage!`, "#fde047");
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const px = this.player.x + dx, py = this.player.y + dy;
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) {
            this.particles.push({ x: px, y: py, glyph: '✨', color: '#fde047', life: 8 });
            m.hp -= dmg;
          }
        }
      }
    } else if (abId === 'holy_light') {
      const heal = rank === 1 ? 35 : (rank === 2 ? 75 : 130);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      if (rank >= 3) this.player.mp = Math.min(this.player.maxMp, this.player.mp + 12);
      audio.playHeal();
      this.addLog(`[Rank ${rank}] ✦ Holy Radiance heals +${heal} HP${rank >= 3 ? ' & +12 MP' : ''}!`, "#34d399");
      this.particles.push({ x: this.player.x, y: this.player.y, glyph: '✦', color: '#34d399', life: 12 });
    } else if (abId === 'blessed_hammer') {
      const radius = rank >= 3 ? 2 : 1;
      const dmg = rank === 1 ? 22 : (rank === 2 ? 42 : 72);
      this.addLog(`[Rank ${rank}] 🔨 Blessed Hammer spirals in ${radius}-tile ring for ${dmg} damage!`, "#fde047");
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (dx === 0 && dy === 0) continue;
          const px = this.player.x + dx, py = this.player.y + dy;
          this.particles.push({ x: px, y: py, glyph: '🔨', color: '#fde047', life: 10 });
          const m = this.monsters.find(m => m.x === px && m.y === py);
          if (m) m.hp -= dmg;
        }
      }
    } else if (abId === 'divine_shield') {
      const heal = rank === 1 ? 25 : (rank === 2 ? 55 : 100);
      const defBuff = rank === 1 ? 10 : (rank === 2 ? 20 : 32);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.player.divineShieldTurns = 12;
      this.player.divineShieldBonus = defBuff;
      this.addLog(`[Rank ${rank}] 🛡 Divine Shield manifests! Restored +${heal} HP and gained +${defBuff} DEF for 12 turns!`, "#fbbf24");
      this.particles.push({ x: this.player.x, y: this.player.y, glyph: '🛡', color: '#fbbf24', life: 12 });
    } else if (abId === 'judgment') {
      const dmg = rank === 1 ? 30 : (rank === 2 ? 60 : 105);
      this.addLog(`[Rank ${rank}] ⚡ DIVINE JUDGMENT strikes EVERY visible enemy for ${dmg} holy damage!`, "#fde047");
      for (const m of this.monsters) {
        if (this.map[m.y][m.x].visible) {
          m.hp -= dmg;
          this.particles.push({ x: m.x, y: m.y, glyph: '⚡', color: '#fde047', life: 12 });
        }
      }
    }

    // Clean dead monsters
    this.checkMonsterDeaths();

    this.targetingAbilityId = null;
    this.turnTick();
  }

  resizeCanvas() {
    const container = document.getElementById('game-container');
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.tileSize = this.canvas.width < 450 ? 26 : (this.canvas.width < 800 ? 28 : 30);
  }

  getCamera() {
    const viewCols = Math.ceil(this.canvas.width / this.tileSize);
    const viewRows = Math.ceil(this.canvas.height / this.tileSize);
    const camX = this.player.x - Math.floor(viewCols / 2);
    const camY = this.player.y - Math.floor(viewRows / 2);
    return { camX, camY, viewCols, viewRows };
  }

  initMap() {
    this.map = [];
    for (let y = 0; y < MAP_H; y++) {
      const row = [];
      for (let x = 0; x < MAP_W; x++) {
        row.push({ type: TILE_WALL, explored: false, visible: false, variation: Math.floor(Math.random() * 4) });
      }
      this.map.push(row);
    }

    const rooms = [];
    const maxRooms = 10 + Math.floor(this.depth / 2);
    for (let i = 0; i < maxRooms * 4; i++) {
      const w = 6 + Math.floor(Math.random() * 7);
      const h = 5 + Math.floor(Math.random() * 7);
      const x = 2 + Math.floor(Math.random() * (MAP_W - w - 4));
      const y = 2 + Math.floor(Math.random() * (MAP_H - h - 4));

      let intersects = false;
      for (const r of rooms) {
        if (x <= r.x + r.w && x + w >= r.x && y <= r.y + r.h && y + h >= r.y) {
          intersects = true;
          break;
        }
      }

      if (!intersects) {
        for (let ry = y + 1; ry < y + h; ry++) {
          for (let rx = x + 1; rx < x + w; rx++) {
            this.map[ry][rx].type = TILE_FLOOR;
          }
        }

        if (rooms.length > 0) {
          const prev = rooms[rooms.length - 1];
          const cx1 = Math.floor(x + w / 2), cy1 = Math.floor(y + h / 2);
          const cx2 = Math.floor(prev.x + prev.w / 2), cy2 = Math.floor(prev.y + prev.h / 2);
          for (let tx = Math.min(cx1, cx2); tx <= Math.max(cx1, cx2); tx++) this.map[cy1][tx].type = TILE_FLOOR;
          for (let ty = Math.min(cy1, cy2); ty <= Math.max(cy1, cy2); ty++) this.map[ty][cx2].type = TILE_FLOOR;
        }

        rooms.push({ x, y, w, h });
        if (rooms.length >= maxRooms) break;
      }
    }

    this.player.x = Math.floor(rooms[0].x + rooms[0].w / 2);
    this.player.y = Math.floor(rooms[0].y + rooms[0].h / 2);

    const lastRoom = rooms[rooms.length - 1];
    this.stairsPos = { x: Math.floor(lastRoom.x + lastRoom.w / 2), y: Math.floor(lastRoom.y + lastRoom.h / 2) };
    this.map[this.stairsPos.y][this.stairsPos.x].type = TILE_STAIRS;
    this.stairsDiscovered = false;

    // Challenge portal on even depths
    if (this.depth % 2 === 0 && rooms.length >= 3) {
      const midRoom = rooms[Math.floor(rooms.length / 2)];
      const px = midRoom.x + 2, py = midRoom.y + 2;
      this.map[py][px].type = TILE_CHALLENGE;
    }

    this.monsters = [];
    this.items = [];
    this.particles = [];

    rooms.forEach((r, idx) => {
      if (idx === 0) return;
      const isBossRoom = (this.depth % 5 === 0) && (idx === rooms.length - 1);
      const numM = isBossRoom ? 1 : 1 + Math.floor(Math.random() * (1 + this.depth / 4));
      for (let m = 0; m < numM; m++) {
        const mx = r.x + 1 + Math.floor(Math.random() * (r.w - 2));
        const my = r.y + 1 + Math.floor(Math.random() * (r.h - 2));
        if (this.isWalkable(mx, my) && !this.monsters.some(e => e.x === mx && e.y === my)) {
          this.monsters.push(this.createMonster(mx, my, isBossRoom));
        }
      }

      if (Math.random() < 0.75) {
        const ix = r.x + 1 + Math.floor(Math.random() * (r.w - 2));
        const iy = r.y + 1 + Math.floor(Math.random() * (r.h - 2));
        if (this.isWalkable(ix, iy)) this.items.push(this.createItem(ix, iy));
      }
    });

    this.computeFov();
    this.updateUI();
  }

  enterChallengeVault() {
    const vaultType = Math.floor(Math.random() * 2); // 0=Horde, 1=Champion
    this.savedFloor = {
      map: JSON.parse(JSON.stringify(this.map)),
      playerPos: { x: this.player.x, y: this.player.y },
      monsters: JSON.parse(JSON.stringify(this.monsters)),
      items: JSON.parse(JSON.stringify(this.items)),
      depth: this.depth
    };
    this.inChallengeVault = true;

    // Create Compact Arena Map (~1/4 size of map)
    this.map = [];
    const arenaX1 = 17, arenaY1 = 5, arenaW = 26, arenaH = 10;
    const arenaX2 = arenaX1 + arenaW, arenaY2 = arenaY1 + arenaH;

    for (let y = 0; y < MAP_H; y++) {
      const row = [];
      for (let x = 0; x < MAP_W; x++) {
        row.push({
          type: (x >= arenaX1 && x < arenaX2 && y >= arenaY1 && y < arenaY2) ? TILE_FLOOR : TILE_WALL,
          explored: false,
          visible: false,
          variation: 0
        });
      }
      this.map.push(row);
    }

    this.player.x = arenaX1 + 2;
    this.player.y = arenaY1 + Math.floor(arenaH / 2);

    this.monsters = [];
    this.items = [];
    this.particles = [];
    this.vaultCleared = false;

    if (vaultType === 0) {
      this.addLog("⚔ CHALLENGE VAULT: MONSTER HORDE ARENA! Defeat all beasts to summon the chest!", "#ef4444");
      for (let i = 0; i < 7; i++) {
        let mx, my, attempts = 0;
        do {
          mx = arenaX1 + 1 + Math.floor(Math.random() * (arenaW - 2));
          my = arenaY1 + 1 + Math.floor(Math.random() * (arenaH - 2));
          attempts++;
        } while (attempts < 50 && (Math.hypot(mx - this.player.x, my - this.player.y) < 3 || this.monsters.some(m => m.x === mx && m.y === my)));

        const m = this.createMonster(mx, my, false);
        m.hasAlerted = true;
        this.monsters.push(m);
      }
    } else {
      this.addLog("⚔ CHALLENGE VAULT: ELITE CHAMPION'S LAIR! Slay the champion to earn the chest!", "#fbbf24");
      let mx, my, attempts = 0;
      do {
        mx = arenaX1 + 1 + Math.floor(Math.random() * (arenaW - 2));
        my = arenaY1 + 1 + Math.floor(Math.random() * (arenaH - 2));
        attempts++;
      } while (attempts < 50 && Math.hypot(mx - this.player.x, my - this.player.y) < 4);

      const boss = this.createMonster(mx, my, false);
      boss.name = `CHAMPION ${boss.name.toUpperCase()}`;
      boss.hp = Math.floor(boss.hp * 2.2);
      boss.maxHp = boss.hp;
      boss.atk += 6;
      boss.hasAlerted = true;
      this.monsters.push(boss);
    }

    this.computeFov();
    this.updateUI();
  }

  checkMonsterDeaths() {
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (m.hp <= 0) {
        this.monsters.splice(i, 1);
        this.player.kills++;
        this.addLog(`☠ ${m.name} was defeated! (+${m.xp} XP)`, "#4ade80");
        this.gainXp(m.xp);
        if (m.isBoss && this.depth === 20) {
          this.state = 'victory';
          this.showModal("VICTORY!", "Malakor has fallen! Sanctuary is saved!", "#fbbf24");
        }
      }
    }

    if (this.inChallengeVault && !this.vaultCleared && this.monsters.length === 0) {
      this.vaultCleared = true;
      const cx = 30, cy = 10;
      this.map[cy][cx].type = TILE_CHEST;
      audio.playCrit();
      this.addLog("👑 CHALLENGE COMPLETE! A Legendary Treasure Chest (🎁) has appeared!", "#fbbf24");
      for (let i = 0; i < 8; i++) {
        this.particles.push({ x: cx + (Math.random() - 0.5) * 2, y: cy + (Math.random() - 0.5) * 2, glyph: '🎁', color: '#fbbf24', life: 20 });
      }
    }
  }

  returnFromChallengeVault() {
    if (this.savedFloor) {
      this.map = this.savedFloor.map;
      this.player.x = this.savedFloor.playerPos.x;
      this.player.y = this.savedFloor.playerPos.y;
      this.monsters = this.savedFloor.monsters;
      this.items = this.savedFloor.items;
      this.depth = this.savedFloor.depth;
      this.savedFloor = null;
      this.inChallengeVault = false;

      // Remove the challenge portal once completed!
      if (this.vaultCleared) {
        for (let y = 0; y < MAP_H; y++) {
          for (let x = 0; x < MAP_W; x++) {
            if (this.map[y][x].type === TILE_CHALLENGE) {
              this.map[y][x].type = TILE_FLOOR;
            }
          }
        }
      }

      this.computeFov();
      this.updateUI();
      this.addLog("❖ You stepped through the return rift back into the dungeon! The challenge portal has vanished.", "#38bdf8");
    }
  }

  createMonster(x, y, isBoss) {
    if (isBoss) {
      if (this.depth === 20) {
        return { x, y, name: "MALAKOR THE VOID TYRANT", glyph: 'M', color: '#ec4899', hp: 550, maxHp: 550, atk: 32, def: 12, xp: 250, isBoss: true, ability: 'void_nova', hasAlerted: false, poisonTurns: 0 };
      } else if (this.depth === 15) {
        return { x, y, name: "IGNIS THE PYRELORD", glyph: 'I', color: '#f97316', hp: 350, maxHp: 350, atk: 25, def: 9, xp: 150, isBoss: true, ability: 'fire_breath', hasAlerted: false, poisonTurns: 0 };
      } else if (this.depth === 10) {
        return { x, y, name: "THE HYDRA QUEEN", glyph: 'H', color: '#34d399', hp: 240, maxHp: 240, atk: 20, def: 7, xp: 100, isBoss: true, ability: 'poison_spit', hasAlerted: false, poisonTurns: 0 };
      } else {
        return { x, y, name: "THE BUTCHER", glyph: 'B', color: '#ef4444', hp: 160, maxHp: 160, atk: 17, def: 5, xp: 60, isBoss: true, ability: 'meat_hook', hasAlerted: false, poisonTurns: 0 };
      }
    }

    const statScale = 1.0 + (this.depth * 0.18);
    let roster = [];
    if (this.depth <= 4) {
      roster = [
        { name: "Acid Slime", glyph: 's', color: '#34d399', hp: 14, atk: 5, def: 1, xp: 4 },
        { name: "Goblin Scout", glyph: 'g', color: '#a3e635', hp: 16, atk: 6, def: 2, xp: 5 },
        { name: "Skeleton Guard", glyph: 'k', color: '#e2e8f0', hp: 22, atk: 8, def: 3, xp: 7 },
        { name: "Cave Spider", glyph: 'x', color: '#c084fc', hp: 18, atk: 7, def: 2, xp: 6 }
      ];
    } else if (this.depth <= 9) {
      roster = [
        { name: "Drowned Horror", glyph: 'z', color: '#38bdf8', hp: 28, atk: 10, def: 3, xp: 10 },
        { name: "Hydra Whelp", glyph: 'h', color: '#2dd4bf', hp: 32, atk: 12, def: 4, xp: 12 },
        { name: "Orc Berserker", glyph: 'O', color: '#f87171', hp: 38, atk: 14, def: 4, xp: 15 },
        { name: "Gargoyle", glyph: 'G', color: '#94a3b8', hp: 35, atk: 11, def: 6, xp: 14 }
      ];
    } else if (this.depth <= 14) {
      roster = [
        { name: "Fire Elemental", glyph: 'f', color: '#fb923c', hp: 45, atk: 16, def: 4, xp: 20 },
        { name: "Hellknight", glyph: 'K', color: '#f43f5e', hp: 55, atk: 18, def: 7, xp: 25 },
        { name: "Obsidian Golem", glyph: 'D', color: '#a8a29e', hp: 65, atk: 15, def: 9, xp: 27 },
        { name: "Shadow Assassin", glyph: 'S', color: '#c084fc', hp: 42, atk: 20, def: 4, xp: 24 }
      ];
    } else {
      roster = [
        { name: "Void Horror", glyph: 'V', color: '#a855f7', hp: 60, atk: 22, def: 6, xp: 32 },
        { name: "Blood Lich", glyph: 'L', color: '#f43f5e', hp: 55, atk: 24, def: 5, xp: 37 },
        { name: "Doom Reaper", glyph: 'R', color: '#f8fafc', hp: 70, atk: 26, def: 8, xp: 42 },
        { name: "Infernal Behemoth", glyph: 'B', color: '#ea580c', hp: 90, atk: 28, def: 10, xp: 50 }
      ];
    }

    const choice = roster[Math.floor(Math.random() * roster.length)];
    const hp = Math.floor(choice.hp * statScale);
    const atk = Math.floor(choice.atk * (1 + this.depth * 0.12));
    const def = Math.floor(choice.def * (1 + this.depth * 0.1));
    const xp = Math.floor(choice.xp * (1 + this.depth * 0.15));

    return { x, y, name: choice.name, glyph: choice.glyph, color: choice.color, hp, maxHp: hp, atk, def, xp, isBoss: false, hasAlerted: false, poisonTurns: 0 };
  }

  createItem(x, y) {
    const roll = Math.random();
    if (roll < 0.25) return { x, y, kind: 'hp', glyph: '♥', color: '#f87171', name: 'Health Elixir' };
    if (roll < 0.50) return { x, y, kind: 'mp', glyph: '✦', color: '#60a5fa', name: 'Mana Crystal' };
    if (roll < 0.75) {
      const amt = (15 + Math.floor(Math.random() * 25)) * this.depth;
      return { x, y, kind: 'gold', amt, glyph: '$', color: '#fbbf24', name: `${amt} Gold` };
    }
    const bonus = Math.floor(this.depth * 1.5) + 2;
    return { x, y, kind: 'wpn', bonus, glyph: '⚔', color: '#fb923c', name: `Rune Blade (+${bonus} ATK)` };
  }

  isWalkable(x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
    const t = this.map[y][x].type;
    return t !== TILE_WALL;
  }

  computeFov() {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) this.map[y][x].visible = false;
    }

    const numRays = 360;
    for (let i = 0; i < numRays; i++) {
      const angle = (i * Math.PI * 2) / numRays;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      let ox = this.player.x + 0.5, oy = this.player.y + 0.5;

      for (let step = 0; step < this.fovRadius * 2; step++) {
        const x = Math.floor(ox), y = Math.floor(oy);
        if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) break;

        const distSq = (x - this.player.x) ** 2 + (y - this.player.y) ** 2;
        if (distSq > this.fovRadius ** 2) break;

        this.map[y][x].visible = true;
        this.map[y][x].explored = true;

        if (this.map[y][x].type === TILE_STAIRS && !this.stairsDiscovered) {
          this.stairsDiscovered = true;
          this.addLog("✨ STAIRS DISCOVERED! A glowing staircase (▼) has been revealed!", "#ec4899");
        }

        if (this.map[y][x].type === TILE_WALL) break;
        ox += cos * 0.5;
        oy += sin * 0.5;
      }
    }

    // SCREAM & PACK ALERT SYSTEM:
    for (const m of this.monsters) {
      if (this.map[m.y][m.x].visible && !m.hasAlerted) {
        m.hasAlerted = true;
        audio.playScream();
        this.addLog(`📢 ${m.name.toUpperCase()} SCREAMS 'INTRUDER!' alerting all nearby beasts!`, "#ef4444");
        this.particles.push({ x: m.x, y: m.y, glyph: '📢', color: '#ef4444', life: 12 });

        // Alert all monsters in 14-tile radius
        for (const other of this.monsters) {
          const dist = Math.max(Math.abs(other.x - m.x), Math.abs(other.y - m.y));
          if (dist <= 14) other.hasAlerted = true;
        }
        break;
      }
    }
  }

  addLog(msg, color = "#e2e8f0") {
    this.logs.unshift({ msg, color, time: Date.now() });
    if (this.logs.length > 30) this.logs.pop();

    const overlay = document.getElementById('log-overlay');
    overlay.innerHTML = this.logs.slice(0, 3).map(l => 
      `<div class="log-entry" style="border-left-color: ${l.color}; color: ${l.color};">${l.msg}</div>`
    ).join('');
  }

  moveTargetCursor(dx, dy) {
    if (!this.targetCursor) this.targetCursor = { x: this.player.x, y: this.player.y };
    this.targetCursor.x = Math.max(0, Math.min(MAP_W - 1, this.targetCursor.x + dx));
    this.targetCursor.y = Math.max(0, Math.min(MAP_H - 1, this.targetCursor.y + dy));
  }

  cycleTargetMonster() {
    const visibleMonsters = this.monsters.filter(m => this.map[m.y] && this.map[m.y][m.x] && this.map[m.y][m.x].visible);
    if (visibleMonsters.length === 0) return;
    const currentIdx = visibleMonsters.findIndex(m => m.x === this.targetCursor.x && m.y === this.targetCursor.y);
    const nextIdx = (currentIdx + 1) % visibleMonsters.length;
    this.targetCursor = { x: visibleMonsters[nextIdx].x, y: visibleMonsters[nextIdx].y };
  }

  tryMovePlayer(dx, dy) {
    if (this.state !== 'playing') return;

    if (this.targetingAbilityId) {
      this.moveTargetCursor(dx, dy);
      return;
    }

    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    // Bump Attack Monster
    const mIdx = this.monsters.findIndex(m => m.x === nx && m.y === ny);
    if (mIdx !== -1) {
      this.isAutoexploring = false;
      const m = this.monsters[mIdx];

      let dmgMult = 1.0;
      if (m.name.includes("Skeleton") && Math.random() < 0.25) {
        dmgMult = 0.5;
        this.addLog(`🛡 ${m.name} raised its bone shield and blocked half the blow!`, "#93c5fd");
      }

      const isCrit = Math.random() < 0.15;
      const bearAb = this.player.abilities.find(a => a.id === 'bear_form');
      const bearRank = bearAb ? bearAb.level : 1;
      const bearAtkVal = this.player.isBearForm ? (bearRank === 3 ? 20 : (bearRank === 2 ? 12 : 6)) : 0;
      const totalAtk = this.player.baseAtk + this.player.weaponBonus + bearAtkVal + (this.player.warCryTurns > 0 ? this.player.warCryBonus : 0);
      let dmg = Math.max(1, (totalAtk + Math.floor(Math.random() * 3)) - m.def);
      if (isCrit) dmg = Math.floor(dmg * 1.75);
      dmg = Math.max(1, Math.floor(dmg * dmgMult));

      m.hp -= dmg;

      // Rogue poison chance on bump attack
      if (this.player.class === 'Rogue' && Math.random() < 0.35) {
        m.poisonTurns = 4;
        this.addLog(`🗡 Venom Strike! ${m.name} was poisoned (-2 HP/turn)!`, "#4ade80");
      }

      if (isCrit) {
        audio.playCrit();
        this.addLog(`★ CRITICAL HIT! You strike ${m.name} for ${dmg} damage!`, "#fbbf24");
      } else {
        audio.playHit();
        this.addLog(`⚔ You hit ${m.name} for ${dmg} damage.`, "#f8fafc");
      }

      this.checkMonsterDeaths();

      this.turnTick();
      return;
    }

    // Walk & Terrain Traps
    if (this.isWalkable(nx, ny)) {
      audio.playStep();
      this.player.x = nx;
      this.player.y = ny;

      const tileType = this.map[ny][nx].type;
      if (tileType === TILE_SPIKE) {
        this.player.hp = Math.max(0, this.player.hp - 12);
        this.addLog("💥 Snikt! Spike trap sprang beneath you for 12 damage!", "#ef4444");
      } else if (tileType === TILE_FIRE) {
        this.player.hp = Math.max(0, this.player.hp - 18);
        this.addLog("♨ Searing flame jet roasted you for 18 fire damage!", "#f97316");
      } else if (tileType === TILE_CHEST) {
        this.map[ny][nx].type = TILE_FLOOR;
        this.player.gold += 150;
        this.player.hpPotions += 2;
        this.player.mpPotions += 2;
        this.player.skillPoints += 1;
        this.player.weaponBonus += 3;
        audio.playHeal();
        this.addLog("🎁 OPENED LEGENDARY CHEST! +150 Gold, +2 Potions, +1 Skill Point, +3 Weapon ATK!", "#fbbf24");
        if (this.inChallengeVault) {
          this.addLog("✨ The chest's ancient magic swirls around you, teleporting you back to the dungeon!", "#38bdf8");
          this.returnFromChallengeVault();
          return;
        }
      } else if (tileType === TILE_CHALLENGE) {
        this.enterChallengeVault();
        return;
      }

      const itIdx = this.items.findIndex(it => it.x === nx && it.y === ny);
      if (itIdx !== -1) {
        const item = this.items.splice(itIdx, 1)[0];
        if (item.kind === 'hp') {
          this.player.hpPotions++;
          this.addLog("✦ Found a Health Elixir! (Tap Life Globe)", "#f87171");
        } else if (item.kind === 'mp') {
          this.player.mpPotions++;
          this.addLog("✦ Found a Mana Crystal! (Tap Mana Globe)", "#60a5fa");
        } else if (item.kind === 'gold') {
          this.player.gold += item.amt;
          this.addLog(`💰 Found ${item.amt} Gold!`, "#fbbf24");
        } else if (item.kind === 'wpn') {
          if (item.bonus > this.player.weaponBonus) {
            this.player.weaponBonus = item.bonus;
            this.player.weaponName = item.name;
            this.addLog(`⚔ EQUIPPED ${item.name}!`, "#fb923c");
          }
        }
      }

      this.turnTick();
    }
  }

  gainXp(amount) {
    this.player.xp += amount;
    while (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.skillPoints++;
      this.player.xpToNext = Math.floor(this.player.xpToNext * 1.6);
      this.player.maxHp += 6;
      this.player.hp = this.player.maxHp;
      this.player.maxMp += 4;
      this.player.mp = this.player.maxMp;
      this.player.baseAtk += 1;
      this.player.baseDef += 1;
      this.addLog(`⭐ LEVEL UP! Reached Level ${this.player.level}! (+1 Skill Point [SKILL TREE])`, "#fde047");
      audio.playHeal();
    }
  }

  nextFloor() {
    if (this.depth >= this.maxDepth) {
      this.state = 'victory';
      this.showModal("VICTORY!", "You cleared all 20 floors!", "#fbbf24");
      return;
    }
    this.depth++;
    this.isAutoexploring = false;
    this.initMap();
    this.addLog(`❖ You descend into Depth ${this.depth}/20...`, "#c084fc");
  }

  useHealthPotion() {
    if (this.player.hpPotions > 0) {
      this.player.hpPotions--;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
      if (this.player.poisonTurns > 0) {
        this.player.poisonTurns = 0;
        this.addLog("💖 The Health Elixir cleansed all poisons from your veins!", "#34d399");
      }
      audio.playHeal();
      this.addLog("💖 Drank Health Elixir! Restored +25 HP.", "#4ade80");
      this.turnTick();
    } else {
      this.addLog("No Health Elixirs left!", "#ef4444");
    }
  }

  useManaPotion() {
    if (this.player.mpPotions > 0) {
      this.player.mpPotions--;
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + 15);
      audio.playHeal();
      this.addLog("✦ Consumed Mana Crystal! Restored +15 MP.", "#60a5fa");
      this.turnTick();
    } else {
      this.addLog("No Mana Crystals left!", "#ef4444");
    }
  }

  startAutoexplore() {
    const monsterInSight = this.monsters.some(m => this.map[m.y][m.x].visible);
    if (monsterInSight) {
      this.addLog("⚔ Cannot auto-explore: Monster in sight!", "#ef4444");
      return;
    }
    this.isAutoexploring = true;
    this.addLog("🗺 Auto-exploring dungeon... (Tap anywhere to stop)", "#38bdf8");
  }

  stepAutoexplore() {
    if (!this.isAutoexploring || this.state !== 'playing') return;

    if (this.monsters.some(m => this.map[m.y][m.x].visible)) {
      this.isAutoexploring = false;
      this.addLog("⚔ Auto-explore stopped: Monster spotted!", "#ef4444");
      return;
    }

    if (this.map[this.player.y][this.player.x].type === TILE_STAIRS) {
      this.isAutoexploring = false;
      this.addLog("✨ Stairs reached! Press [DESCEND] to go down.", "#fbbf24");
      return;
    }

    const nextStep = this.findBfsStep();
    if (nextStep) {
      this.tryMovePlayer(nextStep.x - this.player.x, nextStep.y - this.player.y);
    } else {
      this.isAutoexploring = false;
      this.addLog("🗺 All reachable areas on this floor explored!", "#fbbf24");
    }
  }

  findBfsStep() {
    const start = { x: this.player.x, y: this.player.y };
    const queue = [start];
    const visited = Array(MAP_H).fill(0).map(() => Array(MAP_W).fill(false));
    const parent = Array(MAP_H).fill(0).map(() => Array(MAP_W).fill(null));
    visited[start.y][start.x] = true;
    let target = null;

    while (queue.length > 0) {
      const c = queue.shift();
      let isFrontier = false;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
          if (!this.map[ny][nx].explored) { isFrontier = true; break; }
        }
      }

      if (isFrontier && (c.x !== start.x || c.y !== start.y)) { target = c; break; }
      if ((c.x !== start.x || c.y !== start.y) && this.items.some(it => it.x === c.x && it.y === c.y)) { target = c; break; }

      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
          if (!visited[ny][nx] && this.isWalkable(nx, ny)) {
            visited[ny][nx] = true;
            parent[ny][nx] = c;
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }

    if (!target && this.stairsDiscovered) {
      if (visited[this.stairsPos.y][this.stairsPos.x] && (this.stairsPos.x !== start.x || this.stairsPos.y !== start.y)) {
        target = this.stairsPos;
      }
    }

    if (target) {
      let curr = target;
      while (parent[curr.y][curr.x]) {
        const prev = parent[curr.y][curr.x];
        if (prev.x === start.x && prev.y === start.y) return curr;
        curr = prev;
      }
    }
    return null;
  }

  turnTick() {
    this.computeFov();

    // Tick Player Buffs
    if (this.player.warCryTurns > 0) {
      this.player.warCryTurns--;
      if (this.player.warCryTurns === 0) this.addLog("📢 Battle Cry ATK bonus has faded.", "#94a3b8");
    }
    if (this.player.divineShieldTurns > 0) {
      this.player.divineShieldTurns--;
      if (this.player.divineShieldTurns === 0) this.addLog("🛡 Divine Shield DEF bonus has faded.", "#94a3b8");
    }

    // Tick Player Poison
    if (this.player.poisonTurns > 0) {
      this.player.poisonTurns--;
      this.player.hp = Math.max(0, this.player.hp - 1);
      this.addLog("☣ Poison deals 1 damage! (Drink a Health Elixir to cure)", "#4ade80");
      this.particles.push({ x: this.player.x, y: this.player.y, glyph: '☣', color: '#4ade80', life: 6 });
      if (this.player.hp <= 0) {
        this.player.hp = 0;
        this.state = 'gameover';
        this.showModal("YOU DIED", "Succumbed to deadly poison in Sanctuary...", "#ef4444");
        return;
      }
    }

    // Tick Monster Poison
    for (const m of this.monsters) {
      if (m.poisonTurns > 0) {
        m.poisonTurns--;
        m.hp -= 2;
        this.particles.push({ x: m.x, y: m.y, glyph: '☣', color: '#4ade80', life: 6 });
      }
    }
    this.checkMonsterDeaths();

    // Monster AI with Aggro Pathing and Boss Spells
    for (const m of this.monsters) {
      const dist = Math.max(Math.abs(this.player.x - m.x), Math.abs(this.player.y - m.y));
      if (m.hasAlerted || dist <= 8) {
        if (dist === 1) {
          this.isAutoexploring = false;
          const bearAb = this.player.abilities.find(a => a.id === 'bear_form');
          const bearRank = bearAb ? bearAb.level : 1;
          const bearDefVal = this.player.isBearForm ? (bearRank === 3 ? 26 : (bearRank === 2 ? 16 : 8)) : 0;
          const totalDef = this.player.baseDef + this.player.armorBonus + bearDefVal + (this.player.divineShieldTurns > 0 ? this.player.divineShieldBonus : 0);
          const dmg = Math.max(2, (m.atk + Math.floor(Math.random() * 3)) - totalDef);
          this.player.hp -= dmg;
          this.addLog(`💥 ${m.name} strikes you for ${dmg} damage!`, "#f87171");

          // Monster Poison chance on hit
          const poisonChance = m.name.includes("Acid Slime") ? 0.40 : (m.name.includes("Spider") ? 0.45 : (m.name.includes("Hydra") ? 0.40 : ((m.name.includes("Assassin") || m.name.includes("Lich")) ? 0.35 : 0)));
          if (poisonChance > 0 && Math.random() < poisonChance) {
            this.player.poisonTurns = 12;
            this.addLog(`☣ ${m.name} INFECTED YOU WITH DEADLY POISON! (-1 HP/turn - Drink a Health Elixir to cure)`, "#4ade80");
          }

          if (this.player.hp <= 0) {
            this.player.hp = 0;
            this.state = 'gameover';
            this.showModal("YOU DIED", "Slain in the darkness of Sanctuary...", "#ef4444");
          }
        } else if (dist <= 5 && m.isBoss && Math.random() < 0.3) {
          if (m.ability === 'meat_hook') {
            // Line of sight check: Butcher cannot hook through walls or into occupied tiles
            let hasLos = true;
            let x0 = m.x, y0 = m.y, x1 = this.player.x, y1 = this.player.y;
            let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
            let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            let err = dx + dy, cx = x0, cy = y0;
            while (cx !== x1 || cy !== y1) {
              let e2 = 2 * err;
              if (e2 >= dy) { err += dy; cx += sx; }
              if (e2 <= dx) { err += dx; cy += sy; }
              if (cx !== x1 || cy !== y1) {
                if (!this.map[cy] || !this.map[cy][cx] || this.map[cy][cx].type === TILE_WALL) {
                  hasLos = false;
                  break;
                }
              }
            }
            if (hasLos) {
              const hx = m.x + Math.sign(this.player.x - m.x);
              const hy = m.y + Math.sign(this.player.y - m.y);
              if (this.isWalkable(hx, hy) && !this.monsters.some(other => other.x === hx && other.y === hy)) {
                this.player.x = hx;
                this.player.y = hy;
                this.addLog("🍖 THE BUTCHER hurls a bloody Meat Hook, dragging you to him!", "#ef4444");
                this.particles.push({ x: hx, y: hy, glyph: '🍖', color: '#ef4444', life: 10 });
              }
            }
          } else if (m.ability === 'fire_breath') {
            this.player.hp = Math.max(0, this.player.hp - 24);
            this.addLog("🔥 IGNIS breathes a torrent of molten fire for 24 damage!", "#f97316");
          } else if (m.ability === 'poison_spit') {
            this.player.hp = Math.max(0, this.player.hp - 18);
            this.player.poisonTurns = 15;
            this.addLog("🐉 HYDRA QUEEN spits venomous bile for 18 poison damage and infects you!", "#34d399");
          } else if (m.ability === 'void_nova') {
            this.player.hp = Math.max(0, this.player.hp - 35);
            this.addLog("👑 MALAKOR unleashes VOID OBLIVION for 35 damage!", "#ec4899");
          }
        } else {
          const step = this.findMonsterStep(this.monsters.indexOf(m));
          if (step) {
            m.x = step.x;
            m.y = step.y;
          }
        }
      }
    }

    this.updateUI();
  }

  findMonsterStep(monsterIdx) {
    const m = this.monsters[monsterIdx];
    const px = this.player.x;
    const py = this.player.y;

    const dist = Math.max(Math.abs(px - m.x), Math.abs(py - m.y));
    if (dist <= 1) return null;

    const surroundOffsets = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
    ];

    const surroundTargets = [];
    for (const offset of surroundOffsets) {
      const tx = px + offset.dx;
      const ty = py + offset.dy;
      if (this.isWalkable(tx, ty)) {
        const isOccupied = this.monsters.some((other, idx) => idx !== monsterIdx && other.x === tx && other.y === ty);
        const d = Math.hypot(tx - m.x, ty - m.y);
        const score = isOccupied ? d + 20 : d;
        surroundTargets.push({ x: tx, y: ty, score });
      }
    }

    surroundTargets.sort((a, b) => a.score - b.score);

    for (const target of surroundTargets) {
      const step = this.bfsMonsterPath(m.x, m.y, target.x, target.y, monsterIdx);
      if (step) return step;
    }

    const directStep = this.bfsMonsterPath(m.x, m.y, px, py, monsterIdx);
    if (directStep) return directStep;

    // Fallback: Greedy step to closest valid neighbor
    let bestMove = null;
    let bestDist = Infinity;
    for (const offset of surroundOffsets) {
      const nx = m.x + offset.dx;
      const ny = m.y + offset.dy;
      if (this.isWalkable(nx, ny) && !(nx === px && ny === py) && !this.monsters.some((other, idx) => idx !== monsterIdx && other.x === nx && other.y === ny)) {
        const d = Math.hypot(nx - px, ny - py);
        if (d < bestDist) {
          bestDist = d;
          bestMove = { x: nx, y: ny };
        }
      }
    }
    return bestMove;
  }

  bfsMonsterPath(startX, startY, goalX, goalY, monsterIdx) {
    const visited = new Uint8Array(MAP_W * MAP_H);
    const queue = [];

    const neighborOffsets = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
    ];

    // Seed queue with valid first steps
    for (const offset of neighborOffsets) {
      const nx = startX + offset.dx;
      const ny = startY + offset.dy;
      if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
        if (this.isWalkable(nx, ny) && !this.monsters.some((other, idx) => idx !== monsterIdx && other.x === nx && other.y === ny)) {
          if (nx === goalX && ny === goalY) return { x: nx, y: ny };
          if (!(nx === this.player.x && ny === this.player.y)) {
            visited[ny * MAP_W + nx] = 1;
            queue.push({ x: nx, y: ny, firstStep: { x: nx, y: ny } });
          }
        }
      }
    }

    let nodesVisited = 0;
    while (queue.length > 0) {
      const { x: cx, y: cy, firstStep } = queue.shift();
      nodesVisited++;
      if (nodesVisited > 120) break;

      if (cx === goalX && cy === goalY) return firstStep;

      for (const offset of neighborOffsets) {
        const nx = cx + offset.dx;
        const ny = cy + offset.dy;
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
          const idx = ny * MAP_W + nx;
          if (!visited[idx] && this.isWalkable(nx, ny)) {
            if (nx === goalX && ny === goalY) return firstStep;
            if (!(nx === this.player.x && ny === this.player.y) && !this.monsters.some((other, i) => i !== monsterIdx && other.x === nx && other.y === ny)) {
              visited[idx] = 1;
              queue.push({ x: nx, y: ny, firstStep });
            }
          }
        }
      }
    }
    return null;
  }

  updateUI() {
    const lifeRatio = Math.max(0, this.player.hp / this.player.maxHp);
    const manaRatio = Math.max(0, this.player.mp / this.player.maxMp);

    const lifeVal = document.getElementById('life-val');
    if (lifeVal) lifeVal.innerText = `${String(this.player.hp).padStart(2, ' ')}/${String(this.player.maxHp).padEnd(2, ' ')}`;
    const lifeBar = document.getElementById('life-bar');
    if (lifeBar) {
      const filled = Math.round(lifeRatio * 6);
      lifeBar.innerText = '█'.repeat(filled) + '░'.repeat(6 - filled);
    }
    const lifeBot = document.getElementById('life-bot');
    if (lifeBot) {
      const filled = Math.round(lifeRatio * 4);
      lifeBot.innerText = '█'.repeat(filled) + '░'.repeat(4 - filled);
    }

    const manaVal = document.getElementById('mana-val');
    if (manaVal) manaVal.innerText = `${String(this.player.mp).padStart(2, ' ')}/${String(this.player.maxMp).padEnd(2, ' ')}`;
    const manaBar = document.getElementById('mana-bar');
    if (manaBar) {
      const filled = Math.round(manaRatio * 6);
      manaBar.innerText = '█'.repeat(filled) + '░'.repeat(6 - filled);
    }
    const manaBot = document.getElementById('mana-bot');
    if (manaBot) {
      const filled = Math.round(manaRatio * 4);
      manaBot.innerText = '█'.repeat(filled) + '░'.repeat(4 - filled);
    }

    const heroTitle = document.getElementById('hero-title');
    if (heroTitle) heroTitle.innerText = `${this.player.name.toUpperCase()} (${this.player.class.toUpperCase()})`;

    const wpn = document.getElementById('weapon-display');
    if (wpn) wpn.innerText = `⚔ ${this.player.weaponName} (+${this.player.weaponBonus})`;
    const arm = document.getElementById('armor-display');
    if (arm) arm.innerText = `🛡 ${this.player.armorName} (+${this.player.armorBonus})`;
    const xpDisp = document.getElementById('xp-display');
    if (xpDisp) xpDisp.innerText = `XP: ${this.player.xp}/${this.player.xpToNext}`;

    const lvlText = document.getElementById('lvl-text');
    if (lvlText) lvlText.innerText = `LVL ${this.player.level}`;

    const goldText = document.getElementById('gold-text');
    if (goldText) goldText.innerText = `${this.player.gold} 💰`;

    const floorBadge = document.getElementById('floor-badge');
    if (floorBadge) floorBadge.innerText = this.inChallengeVault ? `[CHALLENGE VAULT]` : `[DEPTH ${this.depth}/${this.maxDepth}]`;

    const hpPot = document.getElementById('hp-pot-count');
    if (hpPot) hpPot.innerText = this.player.hpPotions;
    const mpPot = document.getElementById('mp-pot-count');
    if (mpPot) mpPot.innerText = this.player.mpPotions;

    for (let slot = 0; slot < 4; slot++) {
      const abId = this.player.hotbar[slot];
      const iconEl = document.getElementById(`slot-${slot + 1}-icon`);
      const nameEl = document.getElementById(`slot-${slot + 1}-name`);
      if (abId) {
        const ab = this.player.abilities.find(a => a.id === abId);
        if (ab) {
          if (iconEl) iconEl.innerText = `${ab.glyph} ${ab.mpCost}MP`;
          if (nameEl) nameEl.innerText = ab.name.toUpperCase();
        }
      } else {
        if (iconEl) iconEl.innerText = '🔒';
        if (nameEl) nameEl.innerText = `SLOT ${slot + 1}`;
      }
    }

    const treeSpIcon = document.getElementById('tree-sp-icon');
    if (treeSpIcon) {
      treeSpIcon.innerText = this.player.skillPoints > 0 ? `★ SP: ${this.player.skillPoints}!` : `★ SP: 0`;
      treeSpIcon.style.color = this.player.skillPoints > 0 ? '#fde047' : '#fed7aa';
    }

    const tracker = document.getElementById('stairs-tracker');
    if (tracker) {
      if (this.stairsDiscovered) {
        const dx = this.stairsPos.x - this.player.x;
        const dy = this.stairsPos.y - this.player.y;
        const dirs = [];
        if (dy < 0) dirs.push(`${-dy}N`);
        if (dy > 0) dirs.push(`${dy}S`);
        if (dx > 0) dirs.push(`${dx}E`);
        if (dx < 0) dirs.push(`${-dx}W`);
        const rel = dirs.length === 0 ? "HERE!" : dirs.join(' ');
        tracker.innerText = `▼ Stairs: FOUND (${rel})`;
        tracker.style.color = '#ec4899';
      } else {
        tracker.innerText = `▼ Stairs: ?`;
        tracker.style.color = '#94a3b8';
      }
    }
  }

  showModal(title, msg, color) {
    const modal = document.getElementById('game-modal');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-title').style.color = color;
    document.getElementById('modal-msg').innerText = msg;
    modal.style.display = 'flex';
  }

  restart() {
    document.getElementById('game-modal').style.display = 'none';
    document.getElementById('char-creation-modal').style.display = 'flex';
    this.state = 'char_creation';
  }

  render() {
    this.ctx.fillStyle = '#050608';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const ts = this.tileSize;
    const { camX, camY, viewCols, viewRows } = this.getCamera();

    this.ctx.font = `${Math.floor(ts * 0.85)}px monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const startX = Math.max(0, camX);
    const endX = Math.min(MAP_W, camX + viewCols + 1);
    const startY = Math.max(0, camY);
    const endY = Math.min(MAP_H, camY + viewRows + 1);
    const fc = this.frameCount;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = this.map[y][x];
        const screenX = (x - camX) * ts + ts / 2;
        const screenY = (y - camY) * ts + ts / 2;

        if (!tile.explored) continue;

        const dist = Math.sqrt((x - this.player.x) ** 2 + (y - this.player.y) ** 2);
        const baseLight = tile.visible ? Math.max(0.2, 1.0 - (dist / (this.fovRadius + 1))) : 0.15;
        const flicker = ((Math.sin(fc * 0.18 + (x * 3 + y * 2) * 0.4) * 0.12) + (Math.cos(fc * 0.28 + x * 1.5) * 0.08)) * (tile.visible ? 1.0 : 0.0);
        const torchLight = Math.max(0.05, Math.min(1.0, baseLight + flicker));

        if (tile.type === TILE_WALL) {
          if (tile.visible) {
            const r = Math.min(255, Math.floor(210 * torchLight + 40));
            const g = Math.min(255, Math.floor(140 * (torchLight ** 1.3) + 25));
            const b = Math.min(255, Math.floor(50 * (torchLight ** 2.0) + 20));
            this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          } else {
            this.ctx.fillStyle = '#1e293b';
          }
          this.ctx.fillText(tile.variation % 2 === 0 ? '▓' : '█', screenX, screenY);
        } else if (tile.type === TILE_FLOOR) {
          if (tile.visible) {
            const r = Math.min(255, Math.floor(170 * torchLight + 25));
            const g = Math.min(255, Math.floor(140 * torchLight + 20));
            const b = Math.min(255, Math.floor(80 * (torchLight ** 1.5) + 15));
            this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          } else {
            this.ctx.fillStyle = '#0f172a';
          }
          this.ctx.fillText('·', screenX, screenY);
        } else if (tile.type === TILE_WATER) {
          const wave = Math.floor((fc / 4 + x * 2 + y * 3) % 4);
          const waterColors = ['#0ea5e9', '#38bdf8', '#06b6d4', '#0284c7'];
          this.ctx.fillStyle = tile.visible ? waterColors[wave] : '#0c2438';
          this.ctx.fillText(wave % 2 === 0 ? '≈' : '~', screenX, screenY);
        } else if (tile.type === TILE_STAIRS) {
          const pulse = Math.floor((fc / 3) % 3);
          const colors = ['#f472b6', '#ec4899', '#fde047'];
          this.ctx.fillStyle = colors[pulse];
          this.ctx.fillText('▼', screenX, screenY);
        } else if (tile.type === TILE_CHALLENGE) {
          this.ctx.fillStyle = (fc % 4 < 2) ? '#c084fc' : '#fde047';
          this.ctx.fillText('☗', screenX, screenY);
        } else if (tile.type === TILE_RETURN) {
          this.ctx.fillStyle = '#38bdf8';
          this.ctx.fillText('☗', screenX, screenY);
        } else if (tile.type === TILE_SPIKE) {
          this.ctx.fillStyle = '#94a3b8';
          this.ctx.fillText('^', screenX, screenY);
        } else if (tile.type === TILE_FIRE) {
          this.ctx.fillStyle = '#f97316';
          this.ctx.fillText('♨', screenX, screenY);
        } else if (tile.type === TILE_CHEST) {
          this.ctx.fillStyle = '#fbbf24';
          this.ctx.fillText('🎁', screenX, screenY);
        }
      }
    }

    // Draw Items
    for (const it of this.items) {
      if (this.map[it.y][it.x].visible) {
        this.ctx.fillStyle = it.color;
        this.ctx.fillText(it.glyph, (it.x - camX) * ts + ts / 2, (it.y - camY) * ts + ts / 2);
      }
    }

    // Draw Monsters
    for (const m of this.monsters) {
      if (this.map[m.y][m.x].visible) {
        const sx = (m.x - camX) * ts + ts / 2, sy = (m.y - camY) * ts + ts / 2;
        const mDist = Math.sqrt((m.x - this.player.x) ** 2 + (m.y - this.player.y) ** 2);
        const mLight = Math.max(0.3, 1.0 - (mDist / (this.fovRadius + 1)));
        const mShimmer = Math.sin(fc * 0.25 + m.x * 2 + m.y) * 0.18 * mLight;

        if (mLight > 0.4) {
          this.ctx.save();
          this.ctx.shadowColor = '#f97316';
          this.ctx.shadowBlur = Math.floor(4 + mShimmer * 6);
          this.ctx.fillStyle = m.color;
          this.ctx.fillText(m.glyph, sx, sy);
          this.ctx.restore();
        } else {
          this.ctx.fillStyle = m.color;
          this.ctx.fillText(m.glyph, sx, sy);
        }
      }
    }

    // Draw Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      this.ctx.fillStyle = p.color;
      this.ctx.fillText(p.glyph, (p.x - camX) * ts + ts / 2, (p.y - camY) * ts + ts / 2);
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Draw Hero Player
    const playerScreenX = (this.player.x - camX) * ts + ts / 2;
    const playerScreenY = (this.player.y - camY) * ts + ts / 2;
    this.ctx.save();
    this.ctx.shadowColor = '#fde047';
    this.ctx.shadowBlur = Math.floor(6 + Math.sin(fc * 0.2) * 3);
    this.ctx.fillStyle = '#fde047';
    this.ctx.fillText(this.player.isBearForm ? 'B' : '@', playerScreenX, playerScreenY);
    this.ctx.restore();

    // Targeting trajectory path and crosshair
    if (this.targetingAbilityId && this.targetCursor) {
      const linePoints = this.getLinePoints(this.player.x, this.player.y, this.targetCursor.x, this.targetCursor.y);
      
      this.ctx.save();
      // Glowing dashed line
      this.ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.moveTo(playerScreenX, playerScreenY);
      this.ctx.lineTo((this.targetCursor.x - camX) * ts + ts / 2, (this.targetCursor.y - camY) * ts + ts / 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Glowing trajectory points
      for (const pt of linePoints) {
        if (pt.x === this.player.x && pt.y === this.player.y) continue;
        if (pt.x === this.targetCursor.x && pt.y === this.targetCursor.y) continue;
        const px = (pt.x - camX) * ts + ts / 2;
        const py = (pt.y - camY) * ts + ts / 2;
        this.ctx.fillStyle = '#fde047';
        this.ctx.shadowColor = '#fde047';
        this.ctx.shadowBlur = 6;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Animated pulsing crosshair reticle
      const sx = (this.targetCursor.x - camX) * ts;
      const sy = (this.targetCursor.y - camY) * ts;
      const pulse = Math.sin(fc * 0.3) * 2;
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowColor = '#ef4444';
      this.ctx.shadowBlur = 8;
      this.ctx.strokeRect(sx + 2 - pulse, sy + 2 - pulse, ts - 4 + pulse * 2, ts - 4 + pulse * 2);

      // Inner cross marks
      this.ctx.beginPath();
      this.ctx.moveTo(sx + ts / 2, sy + 3);
      this.ctx.lineTo(sx + ts / 2, sy + ts - 3);
      this.ctx.moveTo(sx + 3, sy + ts / 2);
      this.ctx.lineTo(sx + ts - 3, sy + ts / 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  getLinePoints(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;

    while (true) {
      points.push({ x: cx, y: cy });
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
    return points;
  }

  loop() {
    this.frameCount++;

    if (this.frameCount % 7 === 0 && Math.random() < 0.65) {
      const dx = (Math.random() - 0.5) * 1.6, dy = (Math.random() - 0.5) * 1.6;
      this.particles.push({
        x: this.player.x + dx,
        y: this.player.y + dy,
        glyph: Math.random() < 0.5 ? '·' : '✦',
        color: Math.random() < 0.5 ? '#fde047' : '#fb923c',
        life: 5 + Math.floor(Math.random() * 5)
      });
    }

    if (this.isAutoexploring && Date.now() - this.lastAutoexploreStep > 85) {
      this.stepAutoexplore();
      this.lastAutoexploreStep = Date.now();
    }

    this.render();
  }

  setupTouchAndClicks() {
    this.canvas.addEventListener('pointerdown', (e) => {
      audio.init();
      const rect = this.canvas.getBoundingClientRect();
      const { camX, camY } = this.getCamera();
      const clickX = Math.floor((e.clientX - rect.left) / this.tileSize) + camX;
      const clickY = Math.floor((e.clientY - rect.top) / this.tileSize) + camY;

      if (this.targetingAbilityId) {
        this.castAbility(this.targetingAbilityId, clickX, clickY);
        return;
      }

      if (this.isWalkable(clickX, clickY) || this.monsters.some(m => m.x === clickX && m.y === clickY)) {
        const dx = Math.sign(clickX - this.player.x);
        const dy = Math.sign(clickY - this.player.y);
        this.tryMovePlayer(dx, dy);
      }
    });

    const bindBtn = (id, fn) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          audio.init();
          this.isAutoexploring = false;
          fn();
        });
      }
    };

    bindBtn('btn-up', () => this.tryMovePlayer(0, -1));
    bindBtn('btn-down', () => this.tryMovePlayer(0, 1));
    bindBtn('btn-left', () => this.tryMovePlayer(-1, 0));
    bindBtn('btn-right', () => this.tryMovePlayer(1, 0));
    bindBtn('btn-wait', () => {
      this.addLog("You wait a turn...", "#94a3b8");
      this.turnTick();
    });

    bindBtn('btn-hotbar-1', () => this.triggerHotbarSlot(0));
    bindBtn('btn-hotbar-2', () => this.triggerHotbarSlot(1));
    bindBtn('btn-hotbar-3', () => this.triggerHotbarSlot(2));
    bindBtn('btn-hotbar-4', () => this.triggerHotbarSlot(3));
    bindBtn('btn-skill-tree', () => this.openSkillTree());

    bindBtn('btn-auto', () => this.startAutoexplore());
    bindBtn('btn-life-globe', () => this.useHealthPotion());
    bindBtn('btn-mana-globe', () => this.useManaPotion());
    bindBtn('btn-stairs-down', () => {
      if (this.map[this.player.y][this.player.x].type === TILE_STAIRS) {
        this.nextFloor();
      } else {
        this.addLog("You are not standing on the stairs!", "#ef4444");
      }
    });
  }

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      audio.init();
      if (this.isAutoexploring) {
        this.isAutoexploring = false;
        if (e.key === 'o' || e.key === 'O') return;
      }

      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': case 'k': this.tryMovePlayer(0, -1); break;
        case 'ArrowDown': case 's': case 'S': case 'j': this.tryMovePlayer(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': case 'h': this.tryMovePlayer(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': case 'l': this.tryMovePlayer(1, 0); break;
        case 'Tab':
          if (this.targetingAbilityId) {
            e.preventDefault();
            this.cycleTargetMonster();
          }
          break;
        case 'c': case 'C':
          if (this.targetingAbilityId) {
            this.targetingAbilityId = null;
            this.addLog("Targeting cancelled.", "#94a3b8");
            break;
          }
          const charModal = document.getElementById('char-sheet-modal');
          if (charModal && charModal.style.display === 'flex') {
            this.closeCharacterSheet();
          } else {
            this.openCharacterSheet();
          }
          break;
        case 'Escape': case 'q': case 'Q':
          if (this.targetingAbilityId) {
            this.targetingAbilityId = null;
            this.addLog("Targeting cancelled.", "#94a3b8");
          } else {
            this.closeCharacterSheet();
            this.closeSkillTree();
          }
          break;
        case 'k': case 'K': case 't': case 'T': this.openSkillTree(); break;
        case 'o': case 'O': this.startAutoexplore(); break;
        case '1':
          if (this.targetingAbilityId) {
            this.castAbility(this.targetingAbilityId, this.targetCursor.x, this.targetCursor.y);
          } else {
            this.triggerHotbarSlot(0);
          }
          break;
        case '2':
          if (this.targetingAbilityId) {
            this.castAbility(this.targetingAbilityId, this.targetCursor.x, this.targetCursor.y);
          } else {
            this.triggerHotbarSlot(1);
          }
          break;
        case '3':
          if (this.targetingAbilityId) {
            this.castAbility(this.targetingAbilityId, this.targetCursor.x, this.targetCursor.y);
          } else {
            this.triggerHotbarSlot(2);
          }
          break;
        case '4':
          if (this.targetingAbilityId) {
            this.castAbility(this.targetingAbilityId, this.targetCursor.x, this.targetCursor.y);
          } else {
            this.triggerHotbarSlot(3);
          }
          break;
        case 'p': case 'P': this.useHealthPotion(); break;
        case 'm': case 'M': this.useManaPotion(); break;
        case ' ': case '.':
          if (this.targetingAbilityId) {
            this.castAbility(this.targetingAbilityId, this.targetCursor.x, this.targetCursor.y);
          } else if (this.map[this.player.y][this.player.x].type === TILE_STAIRS) {
            this.nextFloor();
          } else {
            this.addLog("You wait a turn...", "#94a3b8");
            this.turnTick();
          }
          break;
        case 'Enter':
          if (this.targetingAbilityId) {
            this.castAbility(this.targetingAbilityId, this.targetCursor.x, this.targetCursor.y);
          } else if (this.map[this.player.y][this.player.x].type === TILE_STAIRS) {
            this.nextFloor();
          }
          break;
      }
    });
  }
}

let game = null;
window.addEventListener('DOMContentLoaded', () => {
  game = new GameEngine();
});
