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
export const random = (lim) => Math.random() * lim | 0;
export const randomChoose = (arr) => arr[random(arr.length)];
export const randomRemove = (arr) => arr.splice(random(arr.length), 1)[0];
export const delay = (ms) => {
  if (!ANIMATION) {
    return;
  }
  return new Promise(resolve => setTimeout(resolve, ms));
}
export const animate = (element, animation, duration, repeat = 1) => {
  if (!ANIMATION) {
    return;
  }
  return new Promise((resolve) => {
    element.style.animation = 'none';
    element.offsetWidth;  // lmao
    element.style.animation = `${animation} ${duration}s linear ${repeat}`;
    element.addEventListener('animationend', resolve, { once: true });
  });
};
export const deleteText = (element) => {
  element.textContent = '';
};
export const drawText = async (element, text) => {
  if (!ANIMATION) {
    element.textContent = text;
    return;
  }
  if (element.textContent.length > 0) {
    deleteText(element);
  }
  // Ugly hack.
  element.cancelled = true;
  await delay(31);
  element.cancelled = false;
  for (let char of text) {
    if (element.cancelled) {
      break;
    }
    element.textContent += char;
    await delay(30);
  }
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
}
export const createButton = (text, onClick) => {
  const button = document.createElement('button');
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}
