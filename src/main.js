import * as Util from './util.js';
import { bootstrap, renderBootErrorPanel } from './app/bootstrap.js';
import { installSimulationHarness } from './sim/harness.js';
import { registerServiceWorker } from './app/offline.js';

// bootstrap() already guards the one failure it can anticipate (an unusable
// catalog -- see catalogIsUsable in bootstrap.js) with the same panel this
// catches. This is the backstop for everything else that could go wrong
// during boot, so an unhandled rejection here becomes a visible, retryable
// message instead of a blank, frozen tab (see OFFLINE_DESIGN.md Phase 1).
try {
  await bootstrap();
} catch (error) {
  console.error('Boot failed:', error);
  renderBootErrorPanel(document.querySelector('.game'));
}
installSimulationHarness();

// After the game is already up, not before: registration is what actually
// warms the offline cache (see sw.js), and must never sit on the boot path
// (OFFLINE_DESIGN.md Phase 2).
registerServiceWorker();

// Kept in scope for the commented-out debug calls below to reference as a
// bare identifier.
// eslint-disable-next-line no-unused-vars
const simulate = window.simulate;
Util.toggleAnimation();

// await simulate(/*buyAlways=*/'❎🪙', /*buyOnce=*/'🐛💰🔮🪄🏦🏦🏦');
// await simulate(/*buyAlways=*/'❎💎🪨', /*buyOnce=*/'🐛👷🌋🔮🪄🎯');
// await simulate(/*buyAlways=*/'🍾❎', /*buyOnce=*/'🍹🔮🔮🧊🧊🧊🍍🍍🍍🌳🌳');
// await simulate(/*buyAlways=*/'❎🐉🎲', /*buyOnce=*/'🐛🪄🪄🎯🎯🔮🔮');
// await simulate(/*buyAlways=*/'❎', /*buyOnce=*/'📀🐛🎯🪄🔮🔮🥁🥁🔔🔔🚀');
// await simulate(/*buyAlways=*/'❎💳🕳️🪄', /*buyOnce=*/'🐛🎯🎯🎯🔮🔮🔮');
// await simulate(/*buyAlways=*/'❎🥚🐉🦊', /*buyOnce=*/'🐛🪄🎯🎯🎯🔮🔮');
// await simulate(/*buyAlways=*/'❎💼🕳️🪄🎯🔮', /*buyOnce=*/'🐛🐉🐉🐉');
// await simulate(/*buyAlways=*/'❎🌝🚀', /*buyOnce=*/'🐛🔮🪄🎯');
// await simulate(/*buyAlways=*/'❎🧈🍿', /*buyOnce=*/'🔮🔮🪄🌽🌽🌽🧊🧊🧊🎯🎯');

// All emoji except for tools.
// const allEmoji = '🎈🏦🔔💼🐛🎯🧈🍾🍒🐣🐔🍀🍹🪙🌽💳🔮💃💎🎲🐉🥁🥚💸🥠🦊🧊🫙🪄💰🌝❎🍍🍿📀🔀🪨🚀🎰🧵🌳🌋👷📮';
// await simulate(/*buyAlways=*/'🔮🎰', allEmoji, 100);

// Find seed
// #olibvcin

// const settings = GameSettings.instance();
// const catalog = new Catalog(settings.symbolSources);
// await catalog.updateSymbols();
// let maxCount = 0;
// let bestPhrase = '';
// for (let k = 0; k < 1000000; ++k) {
//   const phrase = await Util.setRandomSeed();

//   let counter = 0;
//   let box = 0;
//   let nextBox = 0;
//   for (let k = 0; k < 12; ++k) {
//     const selection = catalog.generateShop(3 + box, 1, false);
//     box += nextBox;
//     nextBox = 0;
//     for (let i = 0; i < 3 + box; ++i) {
//       const sym = Util.randomRemove(selection, /* shop= */ true);
//       if ('🛍️🔮🎰📮'.includes(sym.emoji())) {
//         counter++;
//       }
//       if (sym.emoji() === '📮') {
//         nextBox++;
//       }
//     }
//   }
//   if (counter > maxCount) {
//     maxCount = counter;
//     bestPhrase = phrase;
//     console.log(`new best ${bestPhrase} with ${maxCount}`);
//   }
//   if (k % 10000 === 0) {
//     console.log(`tried ${k} phrases`);
//   }
// }
