import { Symbol } from "./symbol.js";
import * as Util from "./util.js";

export class Monorail extends Symbol {
    static name = '🚝';
    constructor() {
        super();
        this.rarity = 0.9;
    }
    copy() { return new Monorail(); }
    description() {
        return 'Developer Cheat Item';
    }
    descriptionLong() {
        return 'Developer Cheat Item worth 10 per spin'
    }
    async score(game, x, y) {
        await Promise.all([
            Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.5),
            this.addMoney(game, 10, x, y)]);
    }
}