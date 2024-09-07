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

const inBounds = (coord) => coord >= 0 && coord < BOARD_SIZE;
const onLeft = (cells, x, y, name) => inBounds(x - 1) 
  && cells[y][x - 1].name() === name;
const onRight = (cells, x, y, name) => inBounds(x + 1) 
  && cells[y][x + 1].name() === name;
const onTop = (cells, x, y, name) => inBounds(y - 1) 
  && cells[y - 1][x].name() === name;
const onBottom = (cells, x, y, name) => inBounds(y + 1) 
  && cells[y + 1][x].name() === name;
const onTopLeft = (cells, x, y, name) => inBounds(x - 1) && inBounds(y - 1)
  && cells[y - 1][x - 1].name() === name;
const onTopRight = (cells, x, y, name) => inBounds(x + 1) && inBounds(y - 1)
  && cells[y - 1][x + 1].name() === name;
const onBottomLeft = (cells, x, y, name) => inBounds(x - 1) && inBounds(y + 1)
  && cells[y + 1][x - 1].name() === name;
const onBottomRight = (cells, x, y, name) => inBounds(x + 1) && inBounds(y + 1)
  && cells[y + 1][x + 1].name() === name;
const nextTo = (cells, x, y, name) => 
  [onLeft, onRight, onTop, onBottom, 
    onTopLeft, onTopRight, onBottomLeft, onBottomRight].some((f) => f(cells, x, y, name));
export const nextToCoords = (cells, x, y) => {
  const coords = [];
  const add = (x, y) => {
    if (inBounds(x) && inBounds(y)) {
      coords.push([x, y]);
    }
  };
  add(x - 1, y);
  add(x + 1, y);
  add(x, y - 1);
  add(x, y + 1);
  add(x - 1, y - 1);
  add(x + 1, y - 1);
  add(x - 1, y + 1);
  add(x + 1, y + 1);
  return coords;
};
export const nextToSymbol = (cells, x, y, name) => {
  const coords = [];
  nextToCoords(cells, x, y).forEach((coord) => {
    const [neighborX, neighborY] = coord;
    if (cells[neighborY][neighborX].name() === name) {
      coords.push([neighborX, neighborY]);
    }
  });
  return coords;
};
export const nextToExpr = (cells, x, y, expr) => {
  const coords = [];
  nextToCoords(cells, x, y).forEach((coord) => {
    const [neighborX, neighborY] = coord;
    if (expr(cells[neighborY][neighborX])) {
      coords.push([neighborX, neighborY]);
    }
  });
  return coords;
};
