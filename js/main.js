(function (root) {
  "use strict";
  const params = new URLSearchParams(root.location.search);
  const seedParam = Number(params.get("seed"));
  const game = new root.VZ.Game({ seed: Number.isFinite(seedParam) && seedParam !== 0 ? seedParam : Date.now(), debug: params.get("debug") === "1" });
  const audio = new root.VZ.AudioEngine();
  const platform = new root.VZ.YandexPlatform();
  audio.setMuted(game.getSave().muted);
  const ui = new root.VZ.UI(game, audio);
  let platformPlaying = false;
  platform.init().then(syncPlatformGameplay);
  function syncPlatformGameplay() {
    const state = game.snapshot().state;
    const isPlaying = state === "PLAYING" || state === "EXCUSE_PICK";
    if (isPlaying && !platformPlaying) platform.gameplayStart();
    else if (!isPlaying && platformPlaying) platform.gameplayStop();
    platformPlaying = isPlaying;
  }
  let previousTime = 0;
  let animationFrame = 0;
  function frame(now) {
    if (!previousTime) previousTime = now;
    const dt = Math.min((now - previousTime) / 1000, root.VZ.CONFIG.fixedDtMax);
    previousTime = now;
    game.update(dt);
    ui.handleEvents();
    syncPlatformGameplay();
    animationFrame = root.requestAnimationFrame(frame);
  }
  animationFrame = root.requestAnimationFrame(frame);
  let autoPaused = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && (game.snapshot().state === "PLAYING" || game.snapshot().state === "EXCUSE_PICK")) {
      game.togglePause();
      autoPaused = true;
    } else if (!document.hidden && autoPaused) {
      game.resume();
      autoPaused = false;
    }
    ui.handleEvents();
  });
  root.addEventListener("beforeunload", () => root.cancelAnimationFrame(animationFrame));
})(window);
