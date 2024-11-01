/**
* Central event management system
* Provides a structured way to handle game events, replacing implicit event handling.
*/
class EventManager {
  constructor() {
    // Map of event types to arrays of handler functions
    this.eventListeners = new Map();
    
    // Map for single-use event listeners
    this.singleUseListeners = new Map();
  }
 
  /**
   * Register an event handler
   * @param {string} eventType - Name of the event to listen for
   * @param {Function} handler - Function to call when event occurs
   */
  addListener(eventType, handler) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(handler);
  }
 
  /**
   * Register a one-time event handler that removes itself after execution
   * @param {string} eventType - Name of the event to listen for
   * @param {Function} handler - Function to call when event occurs
   */
  addOneTimeListener(eventType, handler) {
    if (!this.singleUseListeners.has(eventType)) {
      this.singleUseListeners.set(eventType, []);
    }
    this.singleUseListeners.get(eventType).push(handler);
  }
 
  /**
   * Remove an event handler
   * @param {string} eventType - Name of the event to remove handler from
   * @param {Function} handler - Handler to remove
   */
  removeListener(eventType, handler) {
    if (!this.eventListeners.has(eventType)) return;
    
    const listenerCallbacks = this.eventListeners.get(eventType);
    const listenerIndex = listenerCallbacks.indexOf(handler);
    if (listenerIndex > -1) {
      listenerCallbacks.splice(listenerIndex, 1);
    }
 
    // Clean up single-use listeners too
    if (this.singleUseListeners.has(eventType)) {
      const singleUseCallbacks = this.singleUseListeners.get(eventType);
      const singleUseIndex = singleUseCallbacks.indexOf(handler);
      if (singleUseIndex > -1) {
        singleUseCallbacks.splice(singleUseIndex, 1);
      }
    }
  }
 
  /**
   * Dispatch an event with optional payload
   * @param {string} eventType - Name of the event to dispatch
   * @param {*} [eventData] - Optional data to pass to handlers
   */
  dispatch(eventType, eventData) {
    // Handle regular listeners
    if (this.eventListeners.has(eventType)) {
      this.eventListeners.get(eventType).forEach(handler => {
        try {
          handler(eventData);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
 
    // Handle single-use listeners
    if (this.singleUseListeners.has(eventType)) {
      const singleUseCallbacks = this.singleUseListeners.get(eventType);
      this.singleUseListeners.set(eventType, []);
      singleUseCallbacks.forEach(handler => {
        try {
          handler(eventData);
        } catch (error) {
          console.error(`Error in single-use handler for ${eventType}:`, error);
        }
      });
    }
  }
 
  /**
   * Remove all handlers for an event
   * @param {string} eventType - Name of the event to clear
   */
  removeAllListeners(eventType) {
    this.eventListeners.delete(eventType);
    this.singleUseListeners.delete(eventType);
  }
 }
 
 // Define standard event types used throughout the game
 export const GameEvents = {
  // Game State Events
  GAME_OVER: 'game:over',
  TURN_START: 'turn:start',
  TURN_END: 'turn:end',
 
  // Board Events
  SYMBOL_ADDED: 'symbol:added',
  SYMBOL_REMOVED: 'symbol:removed',
  BOARD_ROLLED: 'board:rolled',
  SYMBOL_EVALUATED: 'symbol:evaluated',
  SCORE_ADDED: 'score:added',
 
  // UI Events
  INVENTORY_UPDATED: 'inventory:updated',
  UI_UPDATED: 'ui:updated',
  INFO_TEXT_CHANGED: 'info:changed',
 
  // Shop Events
  SHOP_OPENED: 'shop:opened',
  SHOP_CLOSED: 'shop:closed',
  SHOP_REFRESHED: 'shop:refreshed',
  PURCHASE_MADE: 'purchase:made',
  REFRESH_COUNT_CHANGED: 'refresh:changed',
 
  // Animation Events
  ANIMATION_START: 'animation:start',
  ANIMATION_END: 'animation:end'
 };
 
 // Export a singleton instance
 export const eventManager = new EventManager();
 
 export default eventManager;