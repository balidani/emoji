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
export const random = (lim) => (Math.random() * lim) | 0;
export const randomChoose = (arr) => arr[random(arr.length)];
export const randomRemove = (arr) => arr.splice(random(arr.length), 1)[0];
export const delay = (ms) => {
  if (!ANIMATION) {
    return;
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
};
export const animate = (element, animation, duration, repeat = 1) => {
  if (!ANIMATION) {
    return;
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
