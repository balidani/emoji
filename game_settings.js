

export class GameSettings {
    
    // TODO: stub, make it editable.
    constructor() {
        // this.settingsDiv = document.querySelector('.game .settings');
        // this.isOpen = false;
        // NOT READY TO CHANGE
        this.boardX = 5;
        this.boardY = 5;
        // OK
        this.startingSet = "🍒🍒🍒🪙"
        this.symbolSources = ['./symbol.js', './extra_sym.js']
    }

    // async open(game) {
    //     if (this.isOpen) {
    //       return;
    //     }
    //     this.isOpen = true;
    // }

    // async close(game) {
    //     if (!this.isOpen) {
    //       return;
    //     }

    //     this.settingsDiv.replaceChildren();
    //     this.isOpen = false;
    // }
}

