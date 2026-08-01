import * as Util from './util.js';
import { bootstrap } from './app/bootstrap.js';
import { installSimulationHarness } from './sim/harness.js';

await bootstrap();
installSimulationHarness();

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
