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
}
