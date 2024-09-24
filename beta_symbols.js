import * as Util from "./util.js"
import { Symbol } from "./symbol.js"


export class FreeTurn extends Symbol {
    static name = '🎟️';
    constructor() {
        super();
        this.rarity = 0.03;
    }
    copy() { return new FreeTurn(); }
    async evaluate(game, x, y) {
        if (chance(game, 0.1, x, y)) {
            await Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15, 3);
            game.inventory.turns++;
            game.inventory.updateUi();
            await game.board.removeSymbol(game, x, y);
        }
    }
    description() {
        return '10% chance: one more ⏰, then disappears'
    }
    descriptionLong() {
        return 'this is a free turn ticket. it has a 10% chance to give you one more ⏰. if it succeeded, it disappears from your inventory.';
    }
}


export class Grave extends Symbol {
    static name = '🪦';
    constructor() {
        super();
        this.rarity = 0.06;
    }
    copy() { return new Grave(); }
    async evaluateProduce(game, x, y) {
        const coords = game.board.nextToEmpty(x, y);
        if (coords.length === 0) {
            return;
        }
        if (game.inventory.graveyard.length === 0) {
            return;
        }
        if (chance(game, 0.1, x, y)) {
            const [newX, newY] = Util.randomRemove(coords);
            const oldSymbol = Util.randomChoose(game.inventory.graveyard).copy();
            await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
            await game.board.addSymbol(game, oldSymbol, newX, newY);
        }
    }
    description() {
        return '10% chance: adds random symbol removed this game';
    }
    descriptionLong() {
        return 'this is a grave. it has a 10% chance to add a previously removed symbol to a nearby empty space';
    }
}