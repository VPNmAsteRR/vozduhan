(function (root) {
  "use strict";
  const VZ = root.VZ;
  const CONFIG = VZ.CONFIG;
  const REACTIONS = ["nod", "wow", "laugh", "sad"];
  const ITEM_POOL = ["headphones", "fakeCall", "coffee"];
  const ITEM_NAMES = { headphones: "Наушник", fakeCall: "Фейковый звонок", coffee: "Кофе" };

  function readSave() {
    try {
      const parsed = JSON.parse(root.localStorage.getItem("vozduhan-save") || "{}");
      return {
        best: Number(parsed.best) || 0,
        unlocked: Math.max(1, Math.min(VZ.DATA.locations.length + 1, Number(parsed.unlocked) || 1)),
        stars: Array.from({ length: VZ.DATA.locations.length }, (_, index) => Number(parsed.stars && parsed.stars[index]) || 0),
        muted: Boolean(parsed.muted)
      };
    } catch (error) {
      return { best: 0, unlocked: 1, stars: Array(VZ.DATA.locations.length).fill(0), muted: false };
    }
  }
  function writeSave(save) {
    try { root.localStorage.setItem("vozduhan-save", JSON.stringify(save)); }
    catch (error) { /* Storage may be disabled for file:// pages. */ }
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function Game(options) {
    options = options || {};
    this.rng = new VZ.RNG(options.seed || Date.now());
    this.debug = Boolean(options.debug);
    this.save = readSave();
    this.save.muted = options.muted === undefined ? this.save.muted : options.muted;
    this.state = "MENU";
    this.events = [];
    this.levelIndex = 0;
    this.endless = false;
    this.levelNumber = 1;
    this.level = null;
    this.topic = null;
    this.phase = "IDLE";
    this.phaseTimer = 0;
    this.monologueDuration = 0;
    this.monologue = "";
    this.monologueIndex = 0;
    this.nextHookAt = 0;
    this.hookInterval = 4;
    this.hooks = [];
    this.pickTimer = 0;
    this.excuseChoices = [];
    this.excuseUsedThisInhale = false;
    this.usedExcuses = [];
    this.patience = CONFIG.patienceStart;
    this.suspicion = CONFIG.suspicionStart;
    this.escape = CONFIG.escapeStart;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.inventory = [];
    this.elapsed = 0;
    this.epic = false;
    this.epicTimer = 0;
    this.restsUsed = [];
    this.headphonesTimer = 0;
    this.fakeCallArmed = false;
    this._failedBonus = false;
    this.bossPhase = 0;
    this.toast = "";
    this.toastTimer = 0;
    this.result = null;
    this.lastResultLevel = 0;
    this.hookWindow = CONFIG.hookWindow;
  }
  Game.prototype.emit = function (name, detail) { this.events.push({ name, detail: detail || {} }); };
  Game.prototype.consumeEvents = function () { const events = this.events; this.events = []; return events; };
  Game.prototype.getSave = function () { return this.save; };
  Game.prototype.setToast = function (text, duration) {
    this.toast = text;
    this.toastTimer = duration || 1.7;
    this.emit("toast", { text });
  };
  Game.prototype.openIntro = function (index) {
    this.levelIndex = index;
    this.endless = index >= VZ.DATA.locations.length;
    this.levelNumber = this.endless ? index + 1 : index + 1;
    this.level = this.endless ? this.makeEndlessLocation() : VZ.DATA.locations[index];
    this.topic = VZ.DATA.topics[this.level.topic];
    this.state = "LEVEL_INTRO";
    this.events.length = 0;
    this.emit("screen", { state: this.state });
  };
  Game.prototype.makeEndlessLocation = function () {
    const base = this.rng.pick(VZ.DATA.locations);
    return Object.assign({}, base, {
      id: base.id + "-endless",
      duration: base.id === "elevator" ? 60 : 80,
      name: base.name + " · бесконечно"
    });
  };
  Game.prototype.start = function () {
    this.state = "MENU";
    this.emit("screen", { state: this.state });
  };
  Game.prototype.startLevel = function () {
    this.state = "PLAYING";
    this.phase = "MONOLOGUE";
    this.phaseTimer = 0;
    this.monologueDuration = 0;
    this.monologue = "";
    this.monologueIndex = 0;
    this.nextHookAt = this.rng.int(CONFIG.hookMin, CONFIG.hookMax);
    this.hookInterval = this.getHookInterval();
    this.hooks = [];
    this.pickTimer = 0;
    this.excuseChoices = [];
    this.excuseUsedThisInhale = false;
    this.usedExcuses = [];
    this.patience = CONFIG.patienceStart;
    this.suspicion = CONFIG.suspicionStart;
    this.escape = CONFIG.escapeStart;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.inventory = [];
    this.elapsed = 0;
    this.epic = false;
    this.epicTimer = 0;
    this.restsUsed = [];
    this.headphonesTimer = 0;
    this.fakeCallArmed = false;
    this._failedBonus = false;
    this.bossPhase = 0;
    this.result = null;
    this.lastResultLevel = this.levelIndex + 1;
    this.setMonologue();
    this.emit("screen", { state: this.state });
    this.emit("level-start");
  };
  Game.prototype.getHookInterval = function () {
    const difficulty = Math.max(1, this.levelNumber);
    let interval = this.rng.int(CONFIG.hookMin, CONFIG.hookMax) - (difficulty - 1) * CONFIG.hookIntervalPerLevel;
    if (this.level.id === "elevator") interval = Math.max(CONFIG.elevatorHookMin, CONFIG.elevatorHookInterval - difficulty * CONFIG.elevatorHookPerLevel);
    if (this.level.id === "train" && this.elapsed >= CONFIG.bossPhaseDuration * 2) interval = CONFIG.bossFinalHookInterval;
    if (this.epic) interval *= CONFIG.epicHookIntervalScale;
    return interval;
  };
  Game.prototype.setMonologue = function () {
    this.monologue = this.rng.pick(this.topic.monologues);
    this.monologueIndex = 0;
    this.monologueDuration = this.rng.int(CONFIG.monologueMin, CONFIG.monologueMax);
    if (this._failedBonus) {
      this.monologueDuration += CONFIG.failedExcuseMonologueBonus;
      this._failedBonus = false;
    }
    this.phase = this.epic ? "EPIC" : "MONOLOGUE";
    this.phaseTimer = this.epic ? this.epicTimer : this.monologueDuration;
    this.hookInterval = this.getHookInterval();
    this.nextHookAt = this.hookInterval;
    this.emit("phase", { phase: this.phase });
  };
  Game.prototype.makeHook = function (type) {
    const types = this.levelIndex === 0 && !this.endless ? this.level.hooks : REACTIONS;
    const kind = type || this.rng.pick(types);
    const speaker = this.level.id === "wedding" && this.rng.next() > 0.5 ? "Тётя" : (this.level.id === "train" ? "Воздухан-Мастер" : "Воздухан");
    return {
      id: this.rng.next().toString(36).slice(2),
      type: kind,
      text: this.rng.pick(this.topic.hooks[kind]),
      speaker: speaker,
      remaining: this.hookWindow,
      total: this.hookWindow
    };
  };
  Game.prototype.spawnHook = function () {
    const lateBoss = this.level.id === "train" && this.elapsed >= CONFIG.bossPhaseDuration * 2;
    if (lateBoss && this.rng.next() > 0.55) {
      this.hooks.push(this.makeHook(), this.makeHook());
      this.emit("hook", { count: 2 });
    } else {
      this.hooks.push(this.makeHook());
      this.emit("hook", { count: 1 });
    }
    this.hookInterval = this.getHookInterval();
    this.nextHookAt = Math.max(1, this.hookInterval);
  };
  Game.prototype.changePatience = function (amount) { this.patience = clamp(this.patience + amount, 0, 100); };
  Game.prototype.changeSuspicion = function (amount) {
    this.suspicion = clamp(this.suspicion + amount, 0, 100);
    if (this.suspicion >= 100 && !this.epic && (this.state === "PLAYING" || this.state === "EXCUSE_PICK")) {
      if (this.state === "EXCUSE_PICK") {
        this.state = "PLAYING";
        this.excuseChoices = [];
        this.fakeCallArmed = false;
        this.emit("screen", { state: this.state });
      }
      this.epic = true;
      this.epicTimer = CONFIG.epicDuration;
      this.phase = "EPIC";
      this.phaseTimer = this.epicTimer;
      this.nextHookAt = 0;
      this.hooks = [];
      this.emit("phase", { phase: "EPIC" });
      this.emit("epic");
      this.setToast("Воздухан обиделся! Эпичный рассказ!", 2.4);
    }
  };
  Game.prototype.update = function (delta) {
    const frameDt = clamp(delta, 0, CONFIG.fixedDtMax);
    if (this.toastTimer > 0) this.toastTimer = Math.max(0, this.toastTimer - frameDt);
    const pickingExcuse = this.state === "EXCUSE_PICK";
    if (pickingExcuse) {
      this.pickTimer -= delta;
      if (this.pickTimer <= 0) this.finishPickTimeout();
    }
    if (this.state !== "PLAYING" && this.state !== "EXCUSE_PICK") return;
    if (this.phase === "IDLE") return;
    const dt = clamp(delta, 0, CONFIG.fixedDtMax) * (this.state === "EXCUSE_PICK" ? CONFIG.excuseSlowScale : 1);
    this.elapsed += dt;
    this.hookWindow = Math.max(CONFIG.hookWindowMin, CONFIG.hookWindow - (this.levelNumber - 1) * CONFIG.hookWindowPerLevel);
    if (this.level.id === "train") {
      const phase = Math.min(3, Math.floor((this.elapsed + CONFIG.timeBoundaryEpsilon) / CONFIG.bossPhaseDuration) + 1);
      if (phase !== this.bossPhase) {
        this.bossPhase = phase;
        this.emit("boss-phase", { phase });
      }
    }
    if (this.level.id === "elevator") this.updateElevator(dt);
    if (this.phase === "MONOLOGUE" || this.phase === "EPIC") {
      const headphonesActive = this.headphonesTimer > 0;
      if ((this.phase === "MONOLOGUE" || this.phase === "EPIC") && !headphonesActive) {
        const drain = CONFIG.patienceDrain * (1 + CONFIG.levelDrainMultiplier * (this.levelNumber - 1)) * (this.endless ? 1 + (this.levelNumber - 5) * CONFIG.endlessDrainIncrease : 1);
        this.changePatience(-drain * (this.phase === "EPIC" ? CONFIG.epicDrainMultiplier : 1) * dt);
      }
      if (headphonesActive) {
        this.headphonesTimer = Math.max(0, this.headphonesTimer - dt);
        this.changeSuspicion(CONFIG.correctSuspicion * CONFIG.headphonesSuspicionMultiplier * dt / Math.max(this.hookWindow, 1));
      }
      this.phaseTimer -= dt;
      this.monologueIndex = clamp(Math.floor((this.monologueDuration - this.phaseTimer) * CONFIG.typewriterCharsPerSecond), 0, this.monologue.length);
      this.hooks.forEach((hook) => { hook.remaining -= dt; });
      this.resolveMissedHooks();
      this.nextHookAt -= dt;
      if (this.nextHookAt <= 0) this.spawnHook();
      if (this.phase === "EPIC") {
        this.epicTimer = this.phaseTimer;
        if (this.phaseTimer <= 0) {
          this.epic = false;
          this.suspicion = CONFIG.epicSuspicionReset;
          this.setToast("Воздухан выдохся. Пока что.", 2);
          this.phase = "MONOLOGUE";
          this.phaseTimer = Math.max(1, this.monologueDuration);
          this.nextHookAt = this.rng.int(2, 3);
          this.emit("phase", { phase: this.phase });
        }
      } else if (this.phaseTimer <= 0) {
        this.phase = "INHALE";
        this.phaseTimer = CONFIG.inhaleDuration;
        this.excuseUsedThisInhale = false;
        this.nextHookAt = Infinity;
        this.emit("phase", { phase: this.phase });
        this.emit("sound", { name: "inhale" });
      }
    } else if (this.phase === "INHALE") {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.setMonologue();
    }
    if (this.level.id === "train" && this.elapsed >= this.level.duration) {
      this.escape = 100;
      this.win();
    } else if (this.level.id === "elevator" && this.elapsed >= this.level.duration) {
      this.escape = 100;
      this.win();
    } else if (this.patience <= 0) {
      this.lose();
    }
  };
  Game.prototype.updateElevator = function () {
    const elapsed = Math.min(this.elapsed, this.level.duration);
    const interval = CONFIG.elevatorRestEvery;
    const stopNumber = Math.floor((elapsed + CONFIG.timeBoundaryEpsilon) / interval);
    const stopOffset = elapsed - stopNumber * interval;
    const atStop = stopNumber > 0 && stopOffset >= -CONFIG.timeBoundaryEpsilon && stopOffset < CONFIG.elevatorRestDuration;
    if (atStop && !this.restsUsed.includes(stopNumber)) {
      this.restsUsed.push(stopNumber);
      this.changePatience(CONFIG.elevatorRestPatience);
      this.setToast("Лифт остановился — выдохни! Терпение +15", 2.5);
      this.emit("sound", { name: "success" });
    }
  };
  Game.prototype.resolveMissedHooks = function () {
    const missed = this.hooks.filter((hook) => hook.remaining <= 0);
    if (!missed.length) return;
    this.hooks = this.hooks.filter((hook) => hook.remaining > 0);
    this.changeSuspicion(CONFIG.missedSuspicion * missed.length);
    this.combo = 0;
    this.emit("miss", { count: missed.length });
  };
  Game.prototype.react = function (type) {
    if (this.state !== "PLAYING" || !REACTIONS.includes(type)) return;
    const index = this.hooks.findIndex((hook) => hook.type === type);
    if (index < 0) {
      if (this.hooks.length) this.hooks.shift();
      this.changeSuspicion(CONFIG.wrongSuspicion);
      this.changePatience(-CONFIG.wrongPatience);
      this.combo = 0;
      this.emit("wrong");
      this.setToast("Не та реакция!", 1.2);
      return;
    }
    this.hooks.splice(index, 1);
    this.changeSuspicion(-CONFIG.correctSuspicion);
    this.escape = clamp(this.escape + CONFIG.correctEscape, 0, 100);
    this.changePatience(CONFIG.correctPatience);
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += 100 + this.combo * 10;
    this.emit("success", { combo: this.combo });
    this.rewardCombo();
    if (this.escape >= CONFIG.escapeTarget) this.win();
  };
  Game.prototype.rewardCombo = function () {
    if (this.combo > 0 && this.combo % CONFIG.itemCombo === 0 && this.inventory.length < CONFIG.itemCapacity) {
      const item = this.rng.pick(ITEM_POOL);
      this.inventory.push(item);
      this.emit("item-reward", { item, name: ITEM_NAMES[item] });
      this.setToast("Комбо ×" + this.combo + "! Получен предмет: " + ITEM_NAMES[item], 2);
    }
  };
  Game.prototype.tryExcuse = function () {
    if (this.state !== "PLAYING") return;
    if (this.phase !== "INHALE" || this.epic) {
      this.changeSuspicion(CONFIG.interruptSuspicion);
      this.setToast("Не перебивай!", 1.5);
      this.emit("wrong");
      return;
    }
    if (this.excuseUsedThisInhale) {
      this.setToast("Это окно для побега уже использовано.", 1.4);
      return;
    }
    this.excuseUsedThisInhale = true;
    if (this.level.id === "elevator") {
      this.setToast("В лифте остаётся только ждать остановки.", 1.8);
      return;
    }
    this.state = "EXCUSE_PICK";
    this.pickTimer = CONFIG.excuseRealDuration;
    const available = VZ.DATA.excuses.filter((excuse) => (this.level.excuseMult[excuse.id] || 0) > 0);
    this.excuseChoices = this.rng.shuffle ? this.rng.shuffle(available).slice(0, 3) : this.shuffle(available).slice(0, 3);
    this.emit("screen", { state: this.state });
  };
  Game.prototype.shuffle = function (items) {
    const shuffled = items.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = this.rng.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  Game.prototype.chooseExcuse = function (id) {
    if (this.state !== "EXCUSE_PICK") return;
    const excuse = this.excuseChoices.find((item) => item.id === id);
    if (!excuse) return;
    this.state = "PLAYING";
    this.excuseChoices = [];
    const fakeCall = this.fakeCallArmed;
    if (this.usedExcuses.includes(id) && !fakeCall) {
      this.changeSuspicion(CONFIG.usedExcuseSuspicion);
      this.setToast("Ты уже так говорил!", 1.8);
      this.emit("wrong");
      return;
    }
    if (!this.usedExcuses.includes(id)) this.usedExcuses.push(id);
    if (excuse.cat) this.emit("cat");
    if (excuse.funny) this.emit("funny-excuse");
    const locationMultiplier = this.level.excuseMult[id] || 0;
    const confidence = excuse.strength * locationMultiplier * (1 - this.suspicion / 200);
    const successChance = clamp(CONFIG.excuseSuccessBase + confidence * CONFIG.excuseSuccessScale, 0.6, 0.98);
    const succeeds = fakeCall || this.rng.next() <= successChance;
    if (fakeCall) this.inventory.splice(this.inventory.indexOf("fakeCall"), 1);
    this.fakeCallArmed = false;
    if (succeeds) {
      const gain = fakeCall ? CONFIG.fakeCallEscape : CONFIG.excuseEscapeBase * excuse.strength * locationMultiplier * (1 - this.suspicion / 200);
      this.escape = clamp(this.escape + gain, 0, 100);
      this.score += Math.round(gain * 12);
      this.emit("excuse-success", { text: excuse.text, gain: Math.round(gain), fakeCall });
      if (this.escape >= CONFIG.escapeTarget) this.win();
    } else {
      this.changeSuspicion(12);
      this._failedBonus = true;
      this.setToast("Подожди, я ещё не договорил!", 2);
      this.emit("excuse-fail");
    }
  };
  Game.prototype.finishPickTimeout = function () {
    this.state = "PLAYING";
    this.excuseChoices = [];
    this.changeSuspicion(CONFIG.pickTimeoutSuspicion);
    this.setToast("Время вышло — отмазка не придумалась!", 2);
    this.emit("wrong");
  };
  Game.prototype.cancelPick = function () {
    if (this.state !== "EXCUSE_PICK") return;
    this.state = "PLAYING";
    this.excuseChoices = [];
    this.emit("screen", { state: this.state });
  };
  Game.prototype.useItem = function (item) {
    if (!this.inventory.includes(item)) {
      this.setToast("Такого предмета пока нет.", 1.3);
      return;
    }
    if (item === "fakeCall" && (this.phase !== "INHALE" || this.state !== "PLAYING")) {
      this.setToast("Фейковый звонок пригодится только на вдохе.", 1.5);
      return;
    }
    if (item === "headphones") {
      this.inventory.splice(this.inventory.indexOf(item), 1);
      this.headphonesTimer = CONFIG.headphonesDuration;
      this.setToast("Наушник включён: терпение не падает, но подозрение растёт быстрее.", 2.2);
    } else if (item === "fakeCall") {
      this.fakeCallArmed = true;
      this.tryExcuse();
      if (this.state === "EXCUSE_PICK") this.excuseChoices = [{ id: "call", text: "📞 Срочный звонок! Гарантированный побег", strength: 1 }];
      else this.fakeCallArmed = false;
    } else if (item === "coffee") {
      this.inventory.splice(this.inventory.indexOf(item), 1);
      this.changePatience(CONFIG.coffeePatience);
      this.setToast("Кофе помог. Терпение +25", 1.7);
    }
    this.emit("sound", { name: "item" });
  };
  Game.prototype.togglePause = function () {
    if (this.state === "PLAYING" || this.state === "EXCUSE_PICK") {
      this.pausedFrom = this.state;
      this.state = "PAUSED";
      this.emit("screen", { state: this.state });
    } else if (this.state === "PAUSED") this.resume();
  };
  Game.prototype.resume = function () {
    if (this.state !== "PAUSED") return;
    this.state = this.pausedFrom || "PLAYING";
    this.pausedFrom = null;
    this.emit("screen", { state: this.state });
  };
  Game.prototype.win = function () {
    if (this.state === "LEVEL_END" || this.state === "GAME_OVER") return;
    this.state = "LEVEL_END";
    this.phase = "RESULT";
    this.result = { won: true, stars: this.calculateStars() };
    this.save.best = Math.max(this.save.best, this.score);
    if (!this.endless) {
      this.save.stars[this.levelIndex] = Math.max(this.save.stars[this.levelIndex] || 0, this.result.stars);
      this.save.unlocked = Math.max(this.save.unlocked, Math.min(VZ.DATA.locations.length + 1, this.levelIndex + 2));
    }
    writeSave(this.save);
    this.emit("sound", { name: "win" });
    this.emit("result", this.result);
    this.emit("screen", { state: this.state });
  };
  Game.prototype.calculateStars = function () {
    let stars = 1;
    if (this.patience > CONFIG.starsPatienceTwo) stars = 2;
    if (this.patience > CONFIG.starsPatienceThree && this.maxCombo >= CONFIG.starsComboThree) stars = 3;
    return stars;
  };
  Game.prototype.lose = function () {
    if (this.state === "GAME_OVER" || this.state === "LEVEL_END") return;
    this.state = "GAME_OVER";
    this.phase = "RESULT";
    this.result = { won: false, stars: 0 };
    this.save.best = Math.max(this.save.best, this.score);
    writeSave(this.save);
    this.emit("sound", { name: "lose" });
    this.emit("result", this.result);
    this.emit("screen", { state: this.state });
  };
  Game.prototype.continueAfterResult = function () {
    if (this.state !== "LEVEL_END") return;
    if (this.endless) this.openIntro(this.levelIndex + 1);
    else if (this.levelIndex < VZ.DATA.locations.length - 1) this.openIntro(this.levelIndex + 1);
    else this.openIntro(VZ.DATA.locations.length);
  };
  Game.prototype.retry = function () { this.openIntro(this.levelIndex); };
  Game.prototype.setMuted = function (muted) {
    this.save.muted = muted;
    writeSave(this.save);
  };
  Game.prototype.resetSave = function () {
    this.save = { best: 0, unlocked: 1, stars: Array(VZ.DATA.locations.length).fill(0), muted: this.save.muted };
    writeSave(this.save);
    this.setToast("Прогресс сброшен.", 1.4);
  };
  Game.prototype.debugSet = function (key, value) {
    if (!this.debug) return;
    if (key === "patience") this.patience = clamp(value, 0, 100);
    if (key === "suspicion") this.changeSuspicion(value);
    if (key === "escape") {
      this.escape = clamp(value, 0, 100);
      if (this.escape >= CONFIG.escapeTarget && this.state === "PLAYING") this.win();
    }
  };
  Game.prototype.snapshot = function () {
    const activeHook = this.hooks.length ? this.hooks[0] : null;
    let floor = 6;
    if (this.level && this.level.id === "elevator") floor = Math.max(1, 6 - Math.floor((this.elapsed + CONFIG.timeBoundaryEpsilon) / 12));
    const elevatorStopNumber = Math.floor((this.elapsed + CONFIG.timeBoundaryEpsilon) / CONFIG.elevatorRestEvery);
    const elevatorStopOffset = this.elapsed - elevatorStopNumber * CONFIG.elevatorRestEvery;
    return {
      state: this.state, phase: this.phase, level: this.level, levelIndex: this.levelIndex,
      levelNumber: this.levelNumber, endless: this.endless, topicName: this.level ? (VZ.DATA.topicNames[this.level.topic] || this.level.topic) : "",
      patience: this.patience, suspicion: this.suspicion, escape: this.escape,
      combo: this.combo, maxCombo: this.maxCombo, score: this.score, inventory: this.inventory.slice(),
      hooks: this.hooks.map((hook) => Object.assign({}, hook)), hook: activeHook && Object.assign({}, activeHook),
      monologue: this.monologue.slice(0, this.monologueIndex), fullMonologue: this.monologue,
      phaseTimer: this.phaseTimer, phaseDuration: this.monologueDuration, pickTimer: this.pickTimer,
      excuseChoices: this.excuseChoices.slice(), usedExcuses: this.usedExcuses.slice(), elapsed: this.elapsed, floor: floor,
      epic: this.epic, bossPhase: this.bossPhase || 1, headphonesTimer: this.headphonesTimer,
      toast: this.toastTimer > 0 ? this.toast : "", result: this.result, save: this.save,
      debug: this.debug, hookWindow: this.hookWindow, hookInterval: this.hookInterval,
      restWindow: Boolean(this.level && this.level.id === "elevator" && elevatorStopNumber > 0 && elevatorStopOffset >= -CONFIG.timeBoundaryEpsilon && elevatorStopOffset < CONFIG.elevatorRestDuration)
    };
  };
  VZ.Game = Game;
})(window);
