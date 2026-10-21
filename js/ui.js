(function (root) {
  "use strict";
  const VZ = root.VZ;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const ICONS = { nod: "👍", wow: "😮", laugh: "😂", sad: "😔" };
  const HOWTO = [
    { title: "Лови интонацию", icon: "👂", text: "На крючок отвечай подходящей реакцией: вопрос — кивни, невероятный факт — удивись, шутка — посмейся, грустная история — посочувствуй. Ошибки повышают подозрение." },
    { title: "Побег — на вдохе", icon: "💨", text: "Когда Воздухан набирает воздух, нажми «Отмазка» и выбери повод уйти до окончания таймера. Каждую отмазку можно использовать один раз за уровень." },
    { title: "Береги терпение", icon: "🧠", text: "Следи за тремя шкалами, собирай комбо и используй предметы. Подозрение на максимуме запускает эпичный рассказ. В лифте нужно продержаться до первого этажа." },
    { title: "Управление на ПК", icon: "⌨️", text: "1–4 — реакции · Пробел — попросить отмазку\n1–3 — выбрать отмазку\nQ — наушник · W — фейковый звонок · E — кофе\nP или Esc — пауза\nФейковый звонок и отмазка доступны на вдохе." }
  ];
  function UI(game, audio) {
    this.game = game;
    this.audio = audio;
    this.howtoIndex = 0;
    this.previousState = "";
    this.bind();
    this.renderMenu();
    this.render();
  }
  UI.prototype.bind = function () {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.action) this.action(button.dataset.action);
      else if (button.dataset.reaction) this.game.react(button.dataset.reaction);
      else if (button.dataset.item) this.game.useItem(button.dataset.item);
      else if (button.dataset.excuse) this.game.chooseExcuse(button.dataset.excuse);
      else if (button.dataset.level) this.game.openIntro(Number(button.dataset.level));
      this.audio.unlock();
      this.handleEvents();
    });
    document.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      const snapshot = this.game.snapshot();
      if (key === "p" || key === "escape") {
        if (snapshot.state === "HOWTO") this.showScreen("MENU");
        else this.game.togglePause();
      } else if (snapshot.state === "EXCUSE_PICK") {
        if (key === "1" && snapshot.excuseChoices[0]) this.game.chooseExcuse(snapshot.excuseChoices[0].id);
        if (key === "2" && snapshot.excuseChoices[1]) this.game.chooseExcuse(snapshot.excuseChoices[1].id);
        if (key === "3" && snapshot.excuseChoices[2]) this.game.chooseExcuse(snapshot.excuseChoices[2].id);
      } else if (snapshot.state === "PLAYING") {
        const reaction = { "1": "nod", "2": "wow", "3": "laugh", "4": "sad" }[key];
        const item = { q: "headphones", w: "fakeCall", e: "coffee" }[key];
        if (reaction) this.game.react(reaction);
        else if (key === " " || key === "spacebar") { event.preventDefault(); this.game.tryExcuse(); }
        else if (item) this.game.useItem(item);
        else if (this.game.debug && key === "7") this.game.debugSet("patience", 100);
        else if (this.game.debug && key === "8") this.game.debugSet("suspicion", 100);
        else if (this.game.debug && key === "9") this.game.debugSet("escape", 100);
      }
      this.handleEvents();
    });
  };
  UI.prototype.action = function (action) {
    if (action === "start") this.game.openIntro(0);
    else if (action === "howto") { this.howtoIndex = 0; this.renderHowto(); this.showScreen("HOWTO"); }
    else if (action === "howto-next") {
      if (this.howtoIndex < HOWTO.length - 1) { this.howtoIndex += 1; this.renderHowto(); }
      else this.showScreen("MENU");
    } else if (action === "howto-back") {
      if (this.howtoIndex > 0) { this.howtoIndex -= 1; this.renderHowto(); }
      else this.showScreen("MENU");
    } else if (action === "play") this.game.startLevel();
    else if (action === "pause") this.game.togglePause();
    else if (action === "resume") this.game.resume();
    else if (action === "menu") { this.audio.setAmbient(false); this.showScreen("MENU"); }
    else if (action === "excuse") this.game.tryExcuse();
    else if (action === "cancel-pick") this.game.cancelPick();
    else if (action === "continue") this.game.continueAfterResult();
    else if (action === "retry") this.game.retry();
    else if (action === "mute") this.toggleMute();
    else if (action === "reset") {
      if (root.confirm("Сбросить рекорд, открытые уровни и звёзды?")) {
        this.game.resetSave();
        this.renderMenu();
      }
    }
    this.handleEvents();
  };
  UI.prototype.toggleMute = function () {
    const muted = !this.game.getSave().muted;
    this.game.setMuted(muted);
    this.audio.setMuted(muted);
    this.updateMuteButton();
  };
  UI.prototype.updateMuteButton = function () {
    const muted = this.game.getSave().muted;
    $$('[data-action="mute"]').forEach((button) => {
      button.textContent = muted ? "🔇" : "🔊";
      button.setAttribute("aria-label", muted ? "Включить звук" : "Выключить звук");
    });
    $("#sound-label").textContent = muted ? "Звук выключен" : "Звук включён";
  };
  UI.prototype.renderMenu = function () {
    const save = this.game.getSave();
    $("#menu-record").textContent = "Рекорд: " + save.best;
    const grid = $("#level-grid");
    grid.replaceChildren();
    VZ.DATA.locations.forEach((level, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level-chip";
      button.textContent = (index + 1) + " · " + level.name + (save.stars[index] ? " " + "⭐".repeat(save.stars[index]) : "");
      button.disabled = index + 1 > save.unlocked;
      button.dataset.level = String(index);
      button.setAttribute("aria-label", "Начать уровень " + (index + 1) + ": " + level.name);
      grid.append(button);
    });
    if (save.unlocked >= VZ.DATA.locations.length + 1) {
      const endless = document.createElement("button");
      endless.type = "button";
      endless.className = "level-chip endless-chip";
      endless.textContent = "∞ · Бесконечно";
      endless.dataset.level = String(VZ.DATA.locations.length);
      grid.append(endless);
    }
    this.updateMuteButton();
  };
  UI.prototype.renderHowto = function () {
    const slide = HOWTO[this.howtoIndex];
    $("#howto-title").textContent = slide.title;
    $("#howto-icon").textContent = slide.icon;
    $("#howto-copy").textContent = slide.text;
    const dots = $("#slide-dots");
    dots.replaceChildren();
    HOWTO.forEach((item, index) => {
      const dot = document.createElement("span");
      dot.className = index === this.howtoIndex ? "active" : "";
      dot.setAttribute("aria-hidden", "true");
      dots.append(dot);
    });
    dots.setAttribute("aria-label", "Слайд " + (this.howtoIndex + 1) + " из " + HOWTO.length);
    const next = $('[data-action="howto-next"]');
    next.textContent = this.howtoIndex === HOWTO.length - 1 ? "Понятно" : "Дальше";
    $('[data-action="howto-back"]').textContent = this.howtoIndex === 0 ? "В меню" : "Назад";
  };
  UI.prototype.showScreen = function (state) {
    const mapping = { MENU: "menu-screen", HOWTO: "howto-screen", LEVEL_INTRO: "intro-screen", PLAYING: "game-screen", EXCUSE_PICK: "game-screen", PAUSED: "game-screen", LEVEL_END: "result-screen", GAME_OVER: "result-screen" };
    const target = mapping[state];
    Array.from(new Set(Object.values(mapping))).forEach((id) => { $("#" + id).hidden = id !== target; });
    $("#pause-overlay").hidden = state !== "PAUSED";
    $("#pick-overlay").hidden = state !== "EXCUSE_PICK";
    if (state === "MENU") this.renderMenu();
    if (state === "LEVEL_INTRO") this.renderIntro();
    if (state === "LEVEL_END" || state === "GAME_OVER") this.renderResult();
    if (state === "PAUSED" || state === "EXCUSE_PICK") this.previousState = state;
  };
  UI.prototype.renderIntro = function () {
    const snapshot = this.game.snapshot();
    const level = snapshot.level;
    $("#intro-level").textContent = snapshot.endless ? "БЕСКОНЕЧНЫЙ РЕЖИМ · ЗАБЕГ " + snapshot.levelNumber : level.intro;
    $("#intro-name").textContent = level.name;
    $("#intro-description").textContent = level.description;
    $("#intro-screen").style.setProperty("--scene-a", level.color[0]);
    $("#intro-screen").style.setProperty("--scene-b", level.color[1]);
  };
  UI.prototype.renderResult = function () {
    const snapshot = this.game.snapshot();
    const won = snapshot.state === "LEVEL_END";
    const captionList = won ? VZ.DATA.victoryCaptions : VZ.DATA.defeatCaptions;
    const caption = captionList[this.game.rng.int(0, captionList.length - 1)];
    $("#result-icon").textContent = won ? "🎉" : "😵";
    $("#result-eyebrow").textContent = won ? "ПОБЕДА" : "ПОРАЖЕНИЕ";
    $("#result-title").textContent = won ? "Свобода!" : "Ты сломался.";
    $("#result-copy").textContent = won ? "Ты вышел подышать воздухом." : "Теперь ты знаешь всё про «" + snapshot.topicName + "». Навсегда.";
    $("#result-stars").textContent = won ? "⭐".repeat(snapshot.result.stars) : "—";
    $("#result-caption").textContent = caption;
    $('[data-action="continue"]').hidden = !won;
    $('[data-action="retry"]').textContent = won ? "Сыграть ещё раз" : "Попробовать снова";
  };
  UI.prototype.handleEvents = function () {
    this.game.consumeEvents().forEach((event) => {
      if (event.name === "sound") this.audio.play(event.detail.name);
      else if (event.name === "success") this.audio.play("success");
      else if (event.name === "wrong" || event.name === "miss") {
        this.audio.play("error");
        this.flash("error");
      } else if (event.name === "excuse-success") {
        this.audio.play("success");
        this.game.setToast("Вежливый побег! +" + event.detail.gain, 1.5);
        this.flash("success");
      } else if (event.name === "excuse-fail") this.audio.play("error");
      else if (event.name === "cat") this.game.setToast("Кот 🐈 уже ждёт дома!", 1.8);
      else if (event.name === "funny-excuse") this.game.setToast("Утюг явно умеет выбирать момент.", 1.8);
      else if (event.name === "screen") {
        this.showScreen(event.detail.state);
        if (event.detail.state === "MENU" || event.detail.state === "LEVEL_END" || event.detail.state === "GAME_OVER") this.audio.setAmbient(false);
      }
      else if (event.name === "level-start") {
        this.audio.setAmbient(this.game.snapshot().level.id === "party");
        this.flash("start");
      }
    });
    this.render();
  };
  UI.prototype.flash = function (kind) {
    const stage = $("#stage");
    stage.classList.remove("flash-error", "flash-success", "shake");
    void stage.offsetWidth;
    if (kind === "error") stage.classList.add("flash-error", "shake");
    if (kind === "success") stage.classList.add("flash-success");
  };
  UI.prototype.renderHooks = function (snapshot) {
    const card = $("#hook-card");
    card.replaceChildren();
    card.hidden = !snapshot.hooks.length;
    snapshot.hooks.forEach((hook, index) => {
      const item = document.createElement("div");
      item.className = "hook-item";
      const speaker = document.createElement("div");
      speaker.className = "hook-speaker";
      speaker.textContent = hook.speaker + (snapshot.hooks.length > 1 ? " · " + (index + 1) : "");
      const line = document.createElement("div");
      line.className = "hook-line";
      line.textContent = hook.text;
      const timer = document.createElement("div");
      timer.className = "hook-timer";
      const fill = document.createElement("div");
      fill.style.transform = "scaleX(" + Math.max(0, hook.remaining / hook.total) + ")";
      timer.append(fill);
      const cue = document.createElement("span");
      cue.className = "hook-cue";
      cue.textContent = ICONS[hook.type] + " · " + ({ nod: "Кивни", wow: "Ого!", laugh: "Смех", sad: "Понимаю" }[hook.type]);
      item.append(speaker, line, cue, timer);
      card.append(item);
    });
  };
  UI.prototype.render = function () {
    const s = this.game.snapshot();
    $("#pause-overlay").hidden = s.state !== "PAUSED";
    $("#pick-overlay").hidden = s.state !== "EXCUSE_PICK";
    if (s.level && (s.state === "PLAYING" || s.state === "EXCUSE_PICK" || s.state === "PAUSED")) {
      const shell = $("#app");
      shell.style.setProperty("--scene-top", s.level.color[0]);
      shell.style.setProperty("--scene-mid", s.level.color[1]);
      shell.style.setProperty("--scene-bottom", s.level.color[2]);
      shell.style.setProperty("--airman-color", s.level.dress);
      shell.dataset.location = s.level.id;
      $("#hud-level").textContent = s.endless ? "∞" : String(s.levelIndex + 1);
      $("#hud-location").textContent = s.level.name;
      [["patience", s.patience], ["suspicion", s.suspicion], ["escape", s.escape]].forEach(([name, value]) => {
        $("#" + name + "-fill").style.width = value + "%";
        $("#" + name + "-value").textContent = Math.round(value);
      });
      $("#score-label").textContent = "Счёт: " + s.score;
      $("#combo-label").textContent = "Комбо ×" + s.combo + (s.maxCombo >= 10 ? " 🔥" : "");
      $("#inventory-label").textContent = "Предметы: " + s.inventory.length + "/2";
      $("#talk-bubble").textContent = s.monologue;
      $("#talk-bubble").classList.toggle("is-talking", s.phase === "MONOLOGUE" || s.phase === "EPIC");
      $("#airman").classList.toggle("is-talking", (s.phase === "MONOLOGUE" || s.phase === "EPIC") && !!s.monologue);
      $("#airman").classList.toggle("is-inhaling", s.phase === "INHALE");
      $("#airman").classList.toggle("is-offended", s.epic);
      $("#breath-indicator").hidden = s.phase !== "INHALE";
      $("#guest-b").hidden = s.level.id !== "wedding";
      $("#guest-a").classList.toggle("highlighted", s.hooks[0] && s.hooks[0].speaker !== "Тётя");
      $("#guest-b").classList.toggle("highlighted", s.hooks.some((hook) => hook.speaker === "Тётя"));
      $("#airman-name").textContent = s.level.id === "train" ? "Воздухан-Мастер" : "Воздухан";
      $("#elevator-board").hidden = s.level.id !== "elevator";
      $("#elevator-floor").textContent = String(s.floor);
      $("#stage").classList.toggle("is-resting", Boolean(s.restWindow));
      $("#player").textContent = s.patience > 70 ? "🧑‍🦱😊" : s.patience > 45 ? "🧑‍🦱😐" : s.patience > 20 ? "🧑‍🦱😑" : "🧑‍🦱😵";
      $("#stage").classList.toggle("is-epic", s.epic);
      $("#toast").textContent = s.toast;
      $("#toast").classList.toggle("visible", Boolean(s.toast));
      this.renderHooks(s);
      this.renderItems(s.inventory);
      $("#reaction-grid").classList.toggle("tutorial", s.levelIndex === 0 && !s.endless);
      $("#tutorial-hint").hidden = !(s.levelIndex === 0 && !s.endless);
      $$(".reaction-button").forEach((button) => {
        button.disabled = s.levelIndex === 0 && !s.endless && !["nod", "wow"].includes(button.dataset.reaction);
        button.classList.toggle("correct-cue", s.hooks.some((hook) => hook.type === button.dataset.reaction));
      });
      $("#debug-panel").hidden = !s.debug;
      if (s.debug) $("#debug-panel").textContent = "state " + s.state + " · phase " + s.phase + " · hooks " + s.hooks.length + " · " + s.elapsed.toFixed(1) + "s · P" + Math.round(s.patience) + " / S" + Math.round(s.suspicion) + " / E" + Math.round(s.escape) + " · окно " + s.hookWindow.toFixed(1);
      if (s.state === "EXCUSE_PICK") this.renderPick(s);
      $("#pick-timer").textContent = Math.max(0, s.pickTimer).toFixed(1);
      this.audio.update(0.016, s.state === "PLAYING" && (s.phase === "MONOLOGUE" || s.phase === "EPIC"));
    }
    this.updateMuteButton();
  };
  UI.prototype.renderItems = function (inventory) {
    const names = { headphones: "Наушник", fakeCall: "Фейковый звонок", coffee: "Кофе" };
    $$(".item-button").forEach((button) => {
      const count = inventory.filter((item) => item === button.dataset.item).length;
      button.classList.toggle("has-item", count > 0);
      button.dataset.count = count ? "×" + count : "";
      button.setAttribute("aria-label", names[button.dataset.item] + (count ? ", в инвентаре " + count : ", нет в инвентаре"));
    });
  };
  UI.prototype.renderPick = function (snapshot) {
    const holder = $("#excuse-options");
    const signature = snapshot.excuseChoices.map((item) => item.id + (snapshot.usedExcuses.includes(item.id) ? "!" : "")).join(",");
    if (holder.dataset.forState === signature) return;
    holder.dataset.forState = signature;
    holder.replaceChildren();
    snapshot.excuseChoices.forEach((excuse, index) => {
      const button = document.createElement("button");
      button.type = "button";
      const used = snapshot.usedExcuses.includes(excuse.id);
      button.className = "excuse-option" + (used ? " excuse-used" : "");
      button.dataset.excuse = excuse.id;
      button.textContent = (index + 1) + ". " + (used ? "⚠ Уже говорил: " : "") + excuse.text;
      holder.append(button);
    });
  };
  VZ.UI = UI;
})(window);
