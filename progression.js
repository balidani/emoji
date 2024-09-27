import { GameSettings } from "./game_settings.js";

const tutorialLevelSettings = new GameSettings("Tutorial #1", 3, 3, 15, "🍒🍒🪨", ["./symbol.js"], 
  new Map(Object.entries({ 100: '🥇' })), new Map(Object.entries({ 50: 'Welcome to the Tutorial!' })));
const standardGameSettings = new GameSettings();

const PROGRESSION_LEVEL_DATA = "ProgressionLevelData";
const PROGRESSION_ACTIVE_LEVEL = "ProgressionActiveLevel";
const PROGRESSION_LEVEL_RESULTS = "ProgressionLevelResults"

export class LevelResult {
  constructor(highScore, reward) {
    this.highScore = highScore || Number.MIN_SAFE_INTEGER
    this.reward = reward || ""
  }
}

export class Progression {
  constructor() {
    this.levelData = [tutorialLevelSettings, standardGameSettings];
    this.activeLevel = 0;
    this.levelResults = new Map();
  }
  load() {
    const levelData = window.localStorage.getItem(PROGRESSION_LEVEL_DATA)
    if (levelData !== null) {
      this.levelData = new Array(JSON.parse(levelData));
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
    window.localStorage.setItem(PROGRESSION_LEVEL_DATA, JSON.stringify(Array.from(this.levelData)));
    window.localStorage.setItem(PROGRESSION_ACTIVE_LEVEL, this.activeLevel);
    window.localStorage.setItem(PROGRESSION_LEVEL_RESULTS, JSON.stringify(Array.from(this.levelResults)));
  }
  postResultAndAdvance(score, result) {
    const aLD = this.levelData[this.activeLevel];
    let existingRecord = this.levelResults.get(aLD.name);
    if (!existingRecord || score > existingRecord.highScore) {
      this.levelResults.set(aLD.name,new LevelResult(score, result));
    }
    existingRecord = this.levelResults.get(aLD.name);
    if (existingRecord.reward && (this.activeLevel < this.levelData.length)) {
      this.activeLevel++;
    }
    this.save();
  }

}