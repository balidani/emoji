// Animation + DOM helpers. The ANIMATION flag lives here, since this is the
// one place that governs whether animations play.

let ANIMATION = true;
export const toggleAnimation = () => {
  ANIMATION = !ANIMATION;
};
export const animationOff = () => {
  ANIMATION = false;
};
export const animationOn = () => {
  ANIMATION = true;
};

export const delay = (ms) => {
  if (!ANIMATION) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
};
export const animate = (
  element,
  animation,
  duration,
  repeat = 1,
  vars = {}
) => {
  if (!element || !ANIMATION) {
    if (element) {
      // Cancel any animation still in flight from before ANIMATION was
      // turned off (e.g. skipping mid-roll while the shop's previous
      // open/close animation hasn't finished yet) -- otherwise it keeps
      // playing out its original timeline on top of the new content.
      element.style.animation = '';
      element.style.willChange = '';
    }
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    element.style.willChange = 'transform, opacity';
    element.style.animation = 'none';
    element.offsetWidth; // Force reflow
    for (const [key, value] of Object.entries(vars)) {
      element.style.setProperty(`--${key}`, value);
    }
    element.style.animation = `${animation} ${duration}s linear ${repeat}`;

    let done = false;
    const cleanup = () => {
      if (done) {
        return;
      }
      done = true;
      element.style.animation = '';
      element.style.willChange = '';
      element.removeEventListener('animationend', cleanup);
      element.removeEventListener('animationcancel', cleanup);
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(cleanup, duration * repeat * 1000 + 100);
    element.addEventListener('animationend', cleanup, { once: true });
    element.addEventListener('animationcancel', cleanup, { once: true });
    if (!element.isConnected) {
      clearTimeout(timeout);
      cleanup();
    }
  });
};
export const animateOverlay = async (
  element,
  animation,
  duration,
  repeat = 1,
  vars = {}
) => {
  if (!element) return;
  if (!ANIMATION) return;

  const getCurrentScaleFor = (el) => {
    const root = el.closest('.grid-scaler-content');
    if (!root) return 1;
    const cs = getComputedStyle(root);
    const varS = parseFloat(cs.getPropertyValue('--s'));
    if (!Number.isNaN(varS) && varS > 0) {
      return varS;
    }
    const tr = cs.transform;
    if (tr && tr !== 'none') {
      const m = tr.match(/matrix\(([^)]+)\)/);
      if (m) {
        const a = parseFloat(m[1].split(',')[0]);
        if (!Number.isNaN(a) && a > 0) return a;
      }
    }
    return 1;
  };

  const overlay = document.querySelector('.grid-overlay') || document.body;
  const elRect = element.getBoundingClientRect();
  const ovRect = overlay.getBoundingClientRect();
  const s = getCurrentScaleFor(element);
  const localLeft = (elRect.left - ovRect.left) / s;
  const localTop = (elRect.top - ovRect.top) / s;
  const localWidth = elRect.width / s;
  const localHeight = elRect.height / s;
  const clone = element.cloneNode(true);
  const cs = getComputedStyle(element);

  // Hide the original
  const prevVis = element.style.visibility;
  element.style.visibility = 'hidden';

  Object.assign(clone.style, {
    position: 'absolute',
    left: `${localLeft}px`,
    top: `${localTop}px`,
    width: `${localWidth}px`,
    height: `${localHeight}px`,
    margin: 0,
    pointerEvents: 'none',
    transform: 'none',
    transformOrigin: 'top left',
    font: cs.font,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textTransform: cs.textTransform,
    boxSizing: cs.boxSizing,
    padding: cs.padding,
    border: cs.border,
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
    willChange: 'transform, opacity',
    zIndex: '1',
  });

  overlay.appendChild(clone);
  const cleanup = () => {
    clone.remove();
    element.style.visibility = prevVis;
  };
  clone.addEventListener('animationend', cleanup, { once: true });
  clone.addEventListener('transitionend', cleanup, { once: true });

  await animate(clone, animation, duration, repeat, vars);
  // In case animationend didn't fire for some reason (e.g., display change)
  cleanup();
};
export const deleteText = (element) => {
  element.textContent = '';
  element.classList.add('hidden');
};

export const createInput = (labelText, type, dV) => {
  const label = document.createElement('label');
  label.textContent = labelText;

  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
  } else {
    input = document.createElement('input');
    input.type = type;
  }
  input.defaultValue = dV;

  return { label, input };
};
export const createButton = (text, onClick) => {
  const button = document.createElement('button');
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
};

export const createDiv = (innerText, ...classes) => {
  const div = document.createElement('div');
  if (innerText) {
    div.textContent = innerText;
  }
  for (const c of classes) {
    div.classList.add(c);
  }
  return div;
};

export const createSpan = (innerText, ...classes) => {
  const span = document.createElement('span');
  if (innerText) {
    span.textContent = innerText;
  }
  for (const c of classes) {
    span.classList.add(c);
  }
  return span;
};

export const drawText = async (element, text, isHtml = false) => {
  if (!ANIMATION) {
    element.classList.remove('hidden');
    if (isHtml) {
      element.innerHTML = text;
    } else {
      element.textContent = text;
    }
    return;
  }

  if (isHtml) {
    if (element.innerHTML.length > 0) {
      deleteText(element);
    }
  } else {
    if (element.textContent.length > 0) {
      deleteText(element);
    }
  }
  element.classList.remove('hidden');

  element.cancelled = true;
  await delay(31);
  element.cancelled = false;

  if (isHtml) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const nodes = Array.from(tempDiv.childNodes);

    for (const node of nodes) {
      if (element.cancelled) break;

      if (node.nodeType === Node.TEXT_NODE) {
        for (const char of node.textContent) {
          if (element.cancelled) break;
          element.insertAdjacentText('beforeend', char);
          await delay(30);
        }
      } else {
        const clone = node.cloneNode(true);
        element.appendChild(clone);
        await delay(30);
      }
    }
  } else {
    for (const char of text) {
      if (element.cancelled) break;
      element.textContent += char;
      await delay(30);
    }
  }
};
