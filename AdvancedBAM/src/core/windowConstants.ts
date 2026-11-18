export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_WINDOW_RECT: WindowRect = {
  x: 110,
  y: 90,
  width: 1160,
  height: 680,
};

export const DEFAULT_WINDOW_RECT_JSON = JSON.stringify(DEFAULT_WINDOW_RECT);

export const MIN_WINDOW_WIDTH = 520;
export const MIN_WINDOW_HEIGHT = 340;
export const MAX_WINDOW_WIDTH = 2400;
export const MAX_WINDOW_HEIGHT = 1600;

