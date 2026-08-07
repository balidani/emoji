// Phase 2 (offline caching) + Phase 3 (reconnect UX) of OFFLINE_DESIGN.md.
// Browser-only and additive: every export here is safe to call even where
// its target DOM/API is missing (older browsers, the simulator page), and
// none of it ever touches gameplay state.

// Set only by the update-notice's own "Reload" click (see showUpdateNotice)
// -- the one legitimate reason to reload for the player. sw.js's activate
// handler calls clients.claim() so a *first-ever* registration also starts
// controlling the page that registered it as soon as it activates, which
// fires this same 'controllerchange' event with nothing the player asked
// for; without this guard that would reload every fresh install too.
let reloadRequested = false;

// Registers sw.js and wires up the non-blocking "Update available" prompt.
// Not awaited by its caller (main.js) -- this runs after the game is already
// interactive, and registration itself can take arbitrarily long (an update
// check hits the network) without blocking anything.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      watchForUpdate(registration);
    } catch (error) {
      // A cold first visit while offline (nothing cached yet) can fail
      // registration in some browsers -- cosmetic-only, so just log it
      // rather than surfacing anything to the player.
      console.error('Service worker registration failed:', error);
    }
  };
  // Deferred to 'load' so registration -- and the update check it triggers
  // -- never competes with the first paint/first game load for bandwidth or
  // main-thread time. By the time this runs, though, bootstrap()'s own
  // async work (catalog module loads) has often already outlasted 'load' --
  // an event listener added after the event already fired never runs, so
  // check readyState first instead of registering only on a future 'load'
  // that may never come.
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }

  // Reload once the new worker actually takes control, so the reload the
  // player asked for (see showUpdateNotice) picks up the fresh assets
  // instead of whatever is already loaded in memory.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadRequested) {
      return;
    }
    reloadRequested = false;
    window.location.reload();
  });
}

// A `waiting` worker already present at registration time means an update
// installed while the player was away (or in another tab) and is sitting
// ready -- show the prompt immediately. `updatefound` covers an update
// landing during this session. Either way, `navigator.serviceWorker
// .controller` being set is what distinguishes "this is an update" from
// "this is the very first install", which never needs a reload prompt --
// there is nothing running yet for a new worker to be newer than.
function watchForUpdate(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    showUpdateNotice(registration.waiting);
  }
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) {
      return;
    }
    installing.addEventListener('statechange', () => {
      if (
        installing.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        showUpdateNotice(installing);
      }
    });
  });
}

let noticeShown = false;
// Non-blocking banner in the mold of bootstrap.js's mode-select/bag-draft
// overlays -- never freezes the game underneath -- except this one doesn't
// even cover the screen: the current game keeps playing until the player
// chooses to reload.
function showUpdateNotice(waitingWorker) {
  if (noticeShown) {
    return;
  }
  noticeShown = true;
  const banner = document.createElement('div');
  banner.className = 'update-notice';
  const message = document.createElement('span');
  message.textContent = '🔄 Update available';
  banner.appendChild(message);
  const reloadButton = document.createElement('button');
  reloadButton.textContent = 'Reload';
  reloadButton.addEventListener('click', () => {
    reloadRequested = true;
    waitingWorker.postMessage('skipWaiting');
  });
  banner.appendChild(reloadButton);
  const dismissButton = document.createElement('button');
  dismissButton.textContent = '✕';
  dismissButton.className = 'update-notice-dismiss';
  dismissButton.addEventListener('click', () => banner.remove());
  banner.appendChild(dismissButton);
  document.body.appendChild(banner);
}
