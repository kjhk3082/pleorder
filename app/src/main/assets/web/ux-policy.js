(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PleorderUx = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const flags = Object.freeze({
    NO_DIALPAD: 1, NO_FILTERING: 2, LIMIT_STRING_LENGTH: 4,
    NO_KEYBOARD: 8, NO_VIDEO: 16, LIMIT_CONTENT: 32,
    NO_SETUP: 64, NO_TEXT_MESSAGE: 128, NO_VOICE_TRANSCRIPTION: 256,
    FULLY_RESTRICTED: 511,
  });
  function fromEvent(event = {}) {
    const requiresDo = event.requiresDo === true;
    const known = event.known !== false && Number.isInteger(event.activeRestrictions);
    const mask = requiresDo ? (known ? event.activeRestrictions & 511 : 511) : 0;
    const has = (flag) => (mask & flag) !== 0;
    return Object.freeze({
      requiresDo, known, mask,
      blockAll: requiresDo && (!known || mask === flags.FULLY_RESTRICTED),
      keyboard: !has(flags.NO_KEYBOARD), filtering: !has(flags.NO_FILTERING),
      setup: !has(flags.NO_SETUP), messages: !has(flags.NO_TEXT_MESSAGE),
      transcription: !has(flags.NO_VOICE_TRANSCRIPTION), video: !has(flags.NO_VIDEO),
      limitedContent: has(flags.LIMIT_CONTENT),
      maxString: has(flags.LIMIT_STRING_LENGTH) ? Math.max(1, Number(event.maxStringLength) || 120) : Infinity,
      maxItems: has(flags.LIMIT_CONTENT) ? Math.max(1, Number(event.maxContentItems) || 1) : Infinity,
      reduceMotion: requiresDo,
    });
  }
  return { flags, fromEvent };
});
