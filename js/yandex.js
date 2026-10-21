(function (root) {
  "use strict";
  function YandexPlatform() {
    this.sdk = null;
    this.language = "ru";
    this.sdkLoad = null;
  }
  YandexPlatform.prototype.loadSDK = function () {
    if (this.sdkLoad) return this.sdkLoad;
    this.sdkLoad = new Promise((resolve, reject) => {
      if (root.YaGames) {
        resolve(root.YaGames);
        return;
      }
      const script = document.createElement("script");
      script.src = "/sdk.js";
      script.async = true;
      script.onload = () => root.YaGames ? resolve(root.YaGames) : reject(new Error("SDK script loaded without YaGames"));
      script.onerror = () => reject(new Error("Unable to load Yandex Games SDK from /sdk.js"));
      document.head.append(script);
    });
    return this.sdkLoad;
  };
  YandexPlatform.prototype.init = async function () {
    if (root.location.protocol === "file:") return false;
    try {
      const YaGames = await this.loadSDK();
      this.sdk = await YaGames.init();
      this.language = this.sdk.environment && this.sdk.environment.i18n ? this.sdk.environment.i18n.lang || "ru" : "ru";
      if (this.sdk.features && this.sdk.features.LoadingAPI) this.sdk.features.LoadingAPI.ready();
      return true;
    } catch (error) {
      console.warn("Yandex Games SDK is unavailable; running without platform integration.", error);
      return false;
    }
  };
  YandexPlatform.prototype.gameplayStart = function () {
    if (this.sdk && this.sdk.features && this.sdk.features.GameplayAPI) this.sdk.features.GameplayAPI.start();
  };
  YandexPlatform.prototype.gameplayStop = function () {
    if (this.sdk && this.sdk.features && this.sdk.features.GameplayAPI) this.sdk.features.GameplayAPI.stop();
  };
  root.VZ = root.VZ || {};
  root.VZ.YandexPlatform = YandexPlatform;
})(window);
