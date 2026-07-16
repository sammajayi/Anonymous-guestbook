// Shim for isomorphic-ws: export browser's native WebSocket as named export
const ws = typeof WebSocket !== 'undefined'
  ? WebSocket
  : typeof globalThis !== 'undefined' && typeof globalThis.WebSocket !== 'undefined'
    ? globalThis.WebSocket
    : null;

export default ws;
export { ws as WebSocket };
