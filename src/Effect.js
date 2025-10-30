export class Effect {
  static parallel(...args) {
    return [args];
  }
  static serial(...args) {
    return args.map(e => [e]);
  }
}
