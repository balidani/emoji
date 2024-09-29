import { GameSettings } from "./game_settings.js";
import { loadSettings } from "./main.js";
import * as Util from "./util.js"

const tutorialLevelSettings = new GameSettings("Tutorial #1", 4, 4, 15, "🍒🍒🪨", ["./symbol.js"],
  { 100: '🥇' }, { 50: 'Welcome to the Tutorial!' });
const standardGameSettings = new GameSettings();

const CURRENT_VERSION = "0.1.2";
const CURRENT_VERSION_KEY = "CurrentVersion";
const PROGRESSION_LEVEL_DATA = "ProgressionLevelData";
const PROGRESSION_ACTIVE_LEVEL = "ProgressionActiveLevel";
const PROGRESSION_LEVEL_RESULTS = "ProgressionLevelResults"

export class LevelResult {
  constructor(highScore, reward) {
    this.highScore = highScore || Number.MIN_SAFE_INTEGER;
    this.reward = reward || "";
  }
}

export class Progression {
  constructor() {
    this.uiDiv = document.querySelector(".progression");
    this.levelData = [tutorialLevelSettings, standardGameSettings];
    this.activeLevel = 1;
    this.levelResults = new Map();
  }
  load() {
    if (!window.localStorage.getItem(CURRENT_VERSION_KEY)) {
      window.localStorage.clear();
      window.localStorage.setItem(CURRENT_VERSION_KEY, CURRENT_VERSION);
    }
    if (window.localStorage.getItem(CURRENT_VERSION_KEY) !== CURRENT_VERSION) {
      window.localStorage.clear();
    }
    const levelData = window.localStorage.getItem(PROGRESSION_LEVEL_DATA)
    if (levelData !== null) {
      this.levelData = JSON.parse(levelData);
    }
    const activeLevel = window.localStorage.getItem(PROGRESSION_ACTIVE_LEVEL)
    if (activeLevel !== null) {
      this.activeLevel = activeLevel;
    }
    const levelResults = window.localStorage.getItem(PROGRESSION_LEVEL_RESULTS)
    if (levelResults !== null) {
      this.levelResults = new Map(JSON.parse(levelResults));
    }
  }
  save() {
    window.localStorage.setItem(PROGRESSION_LEVEL_DATA, JSON.stringify(this.levelData));
    window.localStorage.setItem(PROGRESSION_ACTIVE_LEVEL, this.activeLevel);
    window.localStorage.setItem(PROGRESSION_LEVEL_RESULTS, JSON.stringify(Array.from(this.levelResults)));
  }
  postResultAndAdvance(score, result) {
    const aLD = this.levelData[this.activeLevel];
    let existingRecord = this.levelResults.get(aLD.name);
    if (!existingRecord || score > existingRecord.highScore) {
      this.levelResults.set(aLD.name, new LevelResult(score, result));
    }
    existingRecord = this.levelResults.get(aLD.name);
    if (existingRecord.reward && (this.activeLevel + 1 < this.levelData.length)) {
      this.activeLevel++;
    }
    this.save();
  }
  jumpTo(index) {
    this.activeLevel = index;
    this.save();
    loadSettings(this.levelData[index]);
  }
  updateUi() {
    this.uiDiv.replaceChildren();
    for (let i = 0; i < this.levelData.length; i++) {
      const levelName = this.levelData[i].name;
      const levelRecord = this.levelResults.get(levelName);
      const levelDiv = Util.createDiv(undefined, "level");
      levelDiv.appendChild(Util.createDiv(levelName, "level-name"));
      if (levelRecord == null) {
        levelDiv.classList.add("unbeaten");
      }
      else {
        levelDiv.appendChild(Util.createDiv(levelRecord.reward, "level-reward"));
        levelDiv.appendChild(Util.createDiv(`${levelRecord.highScore}`, "level-highscore"));
        levelDiv.classList.add("beaten");
        levelDiv.addEventListener('click', () => { this.jumpTo(i) })
      }

      if (i === this.activeLevel) {
        levelDiv.classList.add("active");
        levelDiv.addEventListener('click', () => { this.jumpTo(i) })
      }
      this.uiDiv.appendChild(levelDiv);
    }
    const wipeDiv = Util.createDiv("Wipe Progress", "wipe-button")
    wipeDiv.addEventListener('click', () => {
      window.localStorage.clear();
      window.location.reload();
    });
    this.uiDiv.appendChild(wipeDiv);
  }
}
