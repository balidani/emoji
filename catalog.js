
export class Catalog {
    constructor(symbolSources) {
        this.symbolSources = symbolSources || ['./symbol.js'];
    }
    async updateSymbols() {
        this.symbols = new Map();
        for (let source of this.symbolSources) {
            try {
                let symModule = await import(source);
                for (const [_, value] of Object.entries(symModule)) {
                    let sym = new value();
                    this.symbols.set(sym.name(), sym);
                }
            }
            catch(error) {
                console.error(`Failed to load module ${source} : ${error}`);
            };
        }
    }
    symbol(emoji) {
        if (this.symbols.has(emoji)) {
            return this.symbols.get(emoji);
        }
        throw new Error('Unknown symbol: ' + emoji);
    }
    generateShop(count, luck) {
        const newCatalog = [];
        while (newCatalog.length < count) {
            for (const[_, item] of this.symbols) {
                if ('⬛⬜🎟️🪦'.includes(item.name())) {
                    continue;
                }
                if (Math.random() < item.rarity + luck) {
                    newCatalog.push(item.copy());
                }
            }
        }
        return newCatalog;
    }
    // TODO: Rework, 🛍️ cannot be passed to this function.
    symbolsFromString(input) {
        const result = [];
        for (const e of input) {
            const sym = this.symbol(e);
            if (sym != null) {
                result.push(sym.copy());
            }
        }
        return result;
    }
    test() {
        for (let [n, s] of this.symbols) {
            try {
                s.copy();
                s.description();
                s.descriptionLong();
            }
            catch (e) {
                console.log(`error for ${n}: ${e}`)
            }
        }
    }
}
