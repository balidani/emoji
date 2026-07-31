import { GameSettings } from './game_settings.js';

const tutorialLevelSettings = new GameSettings(
  'Tutorial #1',
  4,
  4,
  15,
  '🍒🍒🪙',
  ['./symbols/tutorial.js'],
  { 100: '🥇' },
  { 50: 'Welcome to the Tutorial!' }
);
const standardGameSettings = new GameSettings();

const CURRENT_VERSION = '1.0.3';
const CURRENT_VERSION_KEY = 'CurrentVersion';
const PROGRESSION_LEVEL_DATA = 'ProgressionLevelData';
const PROGRESSION_ACTIVE_LEVEL = 'ProgressionActiveLevel';
const PROGRESSION_LEVEL_RESULTS = 'ProgressionLevelResults';

export class LevelResult {
  constructor(highScore, reward) {
    this.highScore = highScore || Number.MIN_SAFE_INTEGER;
    this.reward = reward || '';
  }
}

export class Progression {
  constructor(progressionView, settingsView, reload) {
    this.view = progressionView;
    this.reload = reload;
    this.levelData = [tutorialLevelSettings, standardGameSettings];
    for (const settings of this.levelData) {
      settings.attachView(settingsView, this.reload);
    }
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
    const levelData = window.localStorage.getItem(PROGRESSION_LEVEL_DATA);
    if (levelData !== null) {
      this.levelData = JSON.parse(levelData);
    }
    const activeLevel = window.localStorage.getItem(PROGRESSION_ACTIVE_LEVEL);
    if (activeLevel !== null) {
      this.activeLevel = activeLevel;
    }
    const levelResults = window.localStorage.getItem(PROGRESSION_LEVEL_RESULTS);
    if (levelResults !== null) {
      this.levelResults = new Map(JSON.parse(levelResults));
    }
  }
  save() {
    window.localStorage.setItem(
      PROGRESSION_LEVEL_DATA,
      JSON.stringify(this.levelData)
    );
    window.localStorage.setItem(PROGRESSION_ACTIVE_LEVEL, this.activeLevel);
    window.localStorage.setItem(
      PROGRESSION_LEVEL_RESULTS,
      JSON.stringify(Array.from(this.levelResults))
    );
  }
  postResultAndAdvance(score, result) {
    const aLD = this.levelData[this.activeLevel];
    let existingRecord = this.levelResults.get(aLD.name);
    if (!existingRecord || score > existingRecord.highScore) {
      this.levelResults.set(aLD.name, new LevelResult(score, result));
    }
    existingRecord = this.levelResults.get(aLD.name);
    if (existingRecord.reward && this.activeLevel + 1 < this.levelData.length) {
      this.activeLevel++;
    }
    this.save();
  }
  jumpTo(index) {
    this.activeLevel = index;
    this.save();
    this.reload(this.levelData[index]);
  }
  updateUi() {
    const levels = this.levelData.map((data, i) => {
      const record = this.levelResults.get(data.name);
      return {
        name: data.name,
        beaten: record != null,
        reward: record ? record.reward : undefined,
        highScore: record ? record.highScore : undefined,
        active: i === this.activeLevel,
      };
    });
    this.view.render(levels, {
      onJumpTo: (i) => this.jumpTo(i),
      onWipe: () => {
        window.localStorage.clear();
        window.location.reload();
      },
    });
  }
}
