export class Controller {
  constructor(views) {
    this.boardView = views.boardView;
    this.inventoryView = views.inventoryView;
    this.shopView = views.shopView;
  }
  async handleViewEvent(effect) {
    // Split effect.component into <handler>.<action>
    const [handler, _action] = effect.component.split('.');
    switch (handler) {
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
        console.warn(`Unknown effect component: ${handler}`);
    }
  }
  handleModelEvent(effect) {
    const [handler, _action] = effect.component.split('.');
    switch (handler) {
      case 'board':
        return this.boardView.handleModelEvent(effect);
      case 'inventory':
        return this.inventoryView.handleModelEvent(effect);
      case 'shop':
        return this.shopView.handleModelEvent(effect);
      default:
        console.warn(`Unknown model event component: ${handler}`);
        return [];
    }
  }
  async dispatch(effects) {
    console.log(effects);
  }
  async dispatchAll(phases) {
    const queue = [...phases];
    while (queue.length > 0) {
      const group = queue.shift();
      const emitted = [];

      for (const effect of group) {
        if (effect.type !== 'model') {
          continue;
        }
        emitted.push(...this.handleModelEvent(effect));
      }
      const viewPromises = [];
      for (const effect of group) {
        if (effect.type !== 'view') {
          continue;
        }
        viewPromises.push(Promise.resolve(this.handleViewEvent(effect)));
      }
      // await Promise.allSettled(viewPromises);
      await Promise.all(viewPromises);
      queue.push(...emitted);
    }
  }
}
