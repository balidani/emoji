
export class Catalog {

    async updateSymbols() {
        this.symbols = new Map()
        for (let source of this.symbolSources) {
            console.log(`processing ${source}...`); 
            try {
                let symModule = await import(source)
                for (const [name, value] of Object.entries(symModule)) {
                    let sym = new value()
                    this.symbols.set(sym.name(), sym)
                    console.log(`${name} ==> sym.name()`)
                }
            }
            catch(error) {
                console.error(`Failed to load module ${source} : ${error}`);
            };
        }
        console.log('Catalog done processing all sources!');
    }

    constructor(symbolSources) {
        this.symbolSources = symbolSources || ['./symbol.js'];
    }

    symbol(emoji) {
        if (this.symbols.has(emoji)) {
            return this.symbols.get(emoji)
        }
        return null
    }

    generate_shop(count, luck) {
        const newCatalog = [];
        while (newCatalog.length < count) {
            for (const[_, item] of this.symbols) {
                if (Math.random() < item.rarity + luck) {
                    newCatalog.push(item);
                }
            }
        }
        return newCatalog
    }

    symbolsFromString(input) {
        const result = [];
        for (let e of input) {
            let s = this.symbol(e)
            if (s != null) {
                result.push(s)
            }
        }
        return result
    }

}