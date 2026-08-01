// localStorage load/save for the unlocked-achievement set and ProfileStats
// (see ACHIEVEMENTS_DESIGN.md, section 8). Two keys, separate from the
// existing progression keys so a version-bump wipe can preserve them.

const K_ACH = 'Achievements';
const K_PROFILE = 'ProfileStats';

export function loadUnlocked() {
  try {
    return new Set(JSON.parse(localStorage.getItem(K_ACH)) ?? []);
  } catch {
    return new Set();
  }
}
export function saveUnlocked(set) {
  localStorage.setItem(K_ACH, JSON.stringify([...set]));
}
export function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(K_PROFILE)) ?? {};
  } catch {
    return {};
  }
}
export function saveProfile(profile) {
  localStorage.setItem(K_PROFILE, JSON.stringify(profile.toJSON()));
}
