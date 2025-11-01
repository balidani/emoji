class EffectBuilder {
  constructor(path) {
    this.path = path;
  }
  build() {
    return {path: this.path, params: this.params};
  }
  params(params) {
    this.params = params;
    return this.build();
  }
}

export class Effect {
  static parallel(...args) {
    return {'strategy': 'parallel', 'effects': args};
  }
  static serial(...args) {
    const filteredEffects = args.filter(e => e && Object.keys(e).length > 0);
    if (filteredEffects.length === 0) {
      return Effect.none();
    }
    return {'strategy': 'serial', 'effects': filteredEffects};
  }
  static viewOf(path) {
    return new EffectBuilder(`view.${path}`);
  }
  static modelOf(path) {
    return new EffectBuilder(`model.${path}`);
  }
  static none() {
    return {};
  }
  // Flatten all serials (outside of parallel), preserve parallels as barriers.
  static flattenSerial(plan) {
    // predicates
    const isObj = (v) => v && typeof v === 'object';
    const isPhase = (v) => isObj(v) && typeof v.strategy === 'string' && Array.isArray(v.effects);
    const isLeaf  = (v) => isObj(v) && typeof v.path === 'string';
    const isEmpty = (v) => !v || (isObj(v) && Object.keys(v).length === 0);
    function norm(node, inParallel = false) {
      if (isEmpty(node)) return null;
      if (isLeaf(node)) return node;
      if (isPhase(node)) {
        const { strategy, effects } = node;
        if (strategy === 'parallel') {
          // Inside parallel: normalize children, but DO NOT hoist any serials out
          const kids = effects.map(e => norm(e, /* inParallel */ true)).filter(Boolean);
          return kids.length ? { strategy: 'parallel', effects: kids } : null;
        }
        // strategy === 'serial'
        const out = [];
        for (const child of effects) {
          const n = norm(child, inParallel); // still not inside parallel
          if (!n) continue;

          // Only hoist serial children when we're NOT inside a parallel
          if (!inParallel && isPhase(n) && n.strategy === 'serial') {
            out.push(...n.effects);
          } else {
            out.push(n);
          }
        }
        return out.length ? { strategy: 'serial', effects: out } : null;
      }
      // Unknown shapes -> ignore
      return null;
    }

    // Ensure a single top-level serial phase as requested
    const root = norm(plan, false);
    if (!root) return { strategy: 'serial', effects: [] };

    if (isPhase(root) && root.strategy === 'serial') {
      return root;
    }
    // Root was a leaf or parallel -> wrap in one serial phase
    return { strategy: 'serial', effects: [root] };
  }
}

