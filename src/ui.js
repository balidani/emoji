export class Ui {
  constructor(views) {
    this.boardView = views.boardView;
    this.inventoryView = views.inventoryView;
    this.shopView = views.shopView;
  }
  async dispatchEffect(effect) {
    // Split effect.type into <component>.<action>
    const [component, _action] = effect.type.split('.');
    switch (component) {
      case 'board':
        await this.boardView.handleViewEvent(effect);
        break;
      case 'inventory':
        await this.inventoryView.handleViewEvent(effect);
        break;
      case 'shop':
        await this.shopView.handleViewEvent(effect);
        break;
      default:
        console.warn(`Unknown effect component: ${component}`);
    }
  }
  async dispatchParallelEffects(effects) {
    await Promise.all(effects.map(this.dispatchEffect.bind(this)));
  }
  async dispatchSequentialEffects(effects) {
    for (const effect of effects) {
      await this.dispatchEffect(effect);
    }
  }
}
