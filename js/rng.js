(function (root) {
  "use strict";
  function RNG(seed) { this.state = seed >>> 0 || 0x9e3779b9; }
  RNG.prototype.next = function () {
    let value = this.state += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  RNG.prototype.int = function (min, max) { return Math.floor(this.next() * (max - min + 1)) + min; };
  RNG.prototype.pick = function (items) { return items[Math.floor(this.next() * items.length)]; };
  root.VZ.RNG = RNG;
})(window);
