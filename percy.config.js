/** @type {import('@percy/core').PercyConfig} */
module.exports = {
  version: 2,
  snapshot: {
    widths: [375, 1280],
    minHeight: 1024,
    percyCSS:
      "[data-qa='ad'], .ads, iframe { visibility: hidden !important; }",
  },
  discovery: {
    networkIdleTimeout: 750,
  },
};
