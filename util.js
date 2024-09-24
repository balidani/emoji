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
export const BOARD_SIZE = 5;
export const random = (lim) => Math.random() * lim | 0;
export const randomChoose = (arr) => arr[random(arr.length)];
export const randomRemove = (arr) => arr.splice(random(arr.length), 1)[0];
export const delay = (ms) => {
  if (!ANIMATION) {
    return;
  }
  return new Promise(resolve => setTimeout(resolve, ms));
}
export const animate = (element, animation, duration, repeat=1) => {
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
export const deleteText = async (element) => {
  element.addingText = false;
  let text = [...element.textContent];
  while (text.length > 0) {
    text.splice(text.length - 1, 1);
    element.textContent = text.join('');
    await delay(10);
  }
};
export const drawText = async (element, text) => {
  if (!ANIMATION) {
    element.textContent = text;
    return;
  }
  if (element.textContent.length > 0) {
    await deleteText(element);
  }
  element.addingText = true;
  for (let char of text) {
    if (!element.addingText) {
      break;
    }
    element.textContent += char;
    await delay(30);
  }
  element.addingText = false;
};
