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

const sfc32 = (a, b, c, d) => {
  return function() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
};
let sfc32Instance = null;
let sfc32ShopInstance = null;
const setSeed = async (phrase) => {
  const sha1 = (str) => {
    const buffer = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-1", buffer);
  };
  const convertSeed = async (phrase, shop=false) => {
    const buf = await sha1(phrase);
    const arr = new Uint32Array(buf);
    if (shop) {
      sfc32ShopInstance = sfc32(...arr);
    } else {
      sfc32Instance = sfc32(...arr);
    }
  }
  await convertSeed(phrase);
  await convertSeed(phrase + 'shop', /* shop= */ true);
};
export const setRandomSeed = async () => {
  seedPhrase = Array.from({ length: 8 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
  // window.location.hash = seedPhrase;
  await setSeed(seedPhrase);
  return seedPhrase;
};
let seedPhrase = window.location.hash.substr(1);
if (seedPhrase) {
  await setSeed(seedPhrase);
} else {
  await setRandomSeed();
}

export const randomFloat = (shop=false) => {
  if (shop) {
    return sfc32ShopInstance();
  }
  return sfc32Instance();
};
export const random = (lim, shop=false) => (randomFloat(shop) * lim) | 0;
export const randomChoose = (arr, shop=false) => arr[random(arr.length, shop)];
export const randomRemove = (arr, shop=false) => arr.splice(random(arr.length, shop), 1)[0];
export const delay = (ms) => {
  if (!ANIMATION) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
};
export const animate = (element, animation, duration, repeat = 1) => {
  if (element === null) {
    return Promise.resolve();
  }
  if (!ANIMATION) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    element.style.animation = 'none';
    element.offsetWidth; // lmao
    element.style.animation = `${animation} ${duration}s linear ${repeat}`;
    element.addEventListener('animationend', resolve, { once: true });
  });
};
export const deleteText = (element) => {
  element.textContent = '';
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

export const parseEmojiString = (str) => {
  const seg = new Intl.Segmenter('en', {
    granularity: 'grapheme',
  });
  const graphemeSegments = seg.segment(str);
  return Array.from(graphemeSegments).map((x) => x.segment);
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

export const createInteractiveDescription = (description, emoji = null) => {
  const segments = parseEmojiString(description);
  let result = '';
  if (emoji) {
    result = `${emoji}: `;
  }
  for (const segment of segments) {
    if (segment.match(/\p{Emoji}/u) && !segment.match(/^\d+$/)) {
      result += `<span class="interactive-emoji" data-emoji="${segment}">${segment}</span>`;
    } else {
      result += segment;
    }
  }
  return result;
};

export const drawText = async (element, text, isHtml = false) => {
  if (!ANIMATION) {
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
