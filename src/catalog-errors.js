// Split out from catalog.js so it can be imported without pulling in the
// whole Catalog (mirrors replay-errors.js). Thrown when generateShop() can't
// fill the bag because no symbol in the catalog is offered -- an empty or
// fully-filtered catalog, typically from a failed offline module load (see
// Catalog.loadSymbolSource) -- rather than spinning its while loop forever.
export class CatalogUnusableError extends Error {}
