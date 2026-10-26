import '@testing-library/jest-dom/vitest';

// jsdom 没有 matchMedia / scrollTo，组件里若用到给出最小实现，避免测试环境报错
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!window.scrollTo) {
  window.scrollTo = (() => {}) as unknown as typeof window.scrollTo;
}
