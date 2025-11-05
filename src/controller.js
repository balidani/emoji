import { Effect } from './Effect.js';

const isObj = v => v && typeof v === 'object';
const isPhase = v => isObj(v) && typeof v.strategy === 'string' && Array.isArray(v.effects);
const isLeaf  = v => isObj(v) && typeof v.path === 'string';
const kindOf  = leaf => (isLeaf(leaf) ? leaf.path.split('.')[0] : null); // 'model' | 'view'
const isEmpty = v => !v || (isObj(v) && !isPhase(v) && !isLeaf(v));

function toNodeArray(out) {
  if (!out) return [];
  if (isLeaf(out) || isPhase(out)) return [out];
  if (Array.isArray(out)) return out.flatMap(toNodeArray);
  return []; // ignore unknowns
}

export class Controller {
  constructor(domains) {
    this.domains = domains;
  }
  async dispatch(ctx, plan) {
    // 1) Model pass: execute all model.* leaves, replace each with whatever it emits
    const viewOnlyPlan = this._modelPass(ctx, plan);
    // 2) View pass: run all view.* leaves respecting serial/parallel
    await this._viewPass(viewOnlyPlan);
  }
  _modelPass(ctx, node, inParallel = false) {
    if (isEmpty(node)) return null;

    if (Array.isArray(node)) {
      console.warn('Unexpected array node in model pass.');
      return null;
    }

    const asArray = r => {
      if (!r) return [];
      if (Array.isArray(r)) return r;
      if (isLeaf(r) || isPhase(r)) return [r];
      return []; // unknown → drop
    };

    if (isLeaf(node)) {
      if (kindOf(node) === 'model') {
        const repsRaw = this._handleModelEvent(ctx, node); // may be [] / leaf / phase
        const reps = asArray(repsRaw);

        const processed = reps
          .map(r => this._modelPass(ctx, r, inParallel))
          .filter(Boolean);

        if (inParallel && processed.length > 1) {
          // keep this branch as a single parallel lane
          return { strategy: 'serial', effects: processed };
        }
        if (processed.length === 0) return null;
        if (processed.length === 1) return processed[0]; // leaf or phase ok
        return { strategy: 'serial', effects: processed };
      }
      return node; // view leaf
    }

    if (isPhase(node)) {
      const { strategy } = node;
      // defensively normalize effects to an array
      const effects = Array.isArray(node.effects) ? node.effects : [node.effects];

      if (strategy === 'parallel') {
        const kids = effects
          .map(child => this._modelPass(ctx, child, /* inParallel */ true))
          .filter(Boolean);
        return kids.length ? { strategy: 'parallel', effects: kids } : null;
      }

      // strategy === 'serial'
      const out = [];
      for (const child of effects) {
        const n = this._modelPass(ctx, child, inParallel);
        if (!n) continue;
        if (!inParallel && isPhase(n) && n.strategy === 'serial') {
          out.push(...n.effects);
        } else {
          out.push(n);
        }
      }
      return out.length ? { strategy: 'serial', effects: out } : null;
    }

    return null; // unknown shape
  }
  async _viewPass(node) {
    if (isEmpty(node)) return;

    if (isLeaf(node)) {
      if (kindOf(node) !== 'view') return;
      await this._handleViewEvent(node);
      return;
    }

    if (isPhase(node)) {
      const { strategy, effects } = node;

      if (strategy === 'serial') {
        for (const child of effects) {
          await this._viewPass(child);
        }
        return;
      }

      // parallel
      await Promise.allSettled(effects.map(child => this._viewPass(child)));
      return;
    }
  }
  _handleModelEvent(ctx, effect) {
    const [, domain, action] = effect.path.split('.');
    const model = this.domains.model[domain];
    if (!model) {
      console.warn(`Unknown model domain: ${domain}`);
      return [];
    }
    if (typeof model[action] !== 'function') {
      console.warn(`Unknown model action: ${effect.path}`);
      return [];
    }
    return model[action]({ctx, ...effect.params}) ?? [];
  }
  async _handleViewEvent(effect) {
    const [, domain, action] = effect.path.split('.');
    const view = this.domains.view[domain];
    if (!view) {
      console.warn(`Unknown view domain: ${domain}`);
      return [];
    }
    if (typeof view[action] !== 'function') {
      console.warn(`Unknown view action: ${effect.path}`);
      return [];
    }
    return view[action](effect.params) ?? [];
  }
}
