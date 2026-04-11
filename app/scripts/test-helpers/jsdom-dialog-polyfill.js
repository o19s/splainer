/**
 * Polyfill jsdom's HTMLDialogElement with showModal/close stubs.
 *
 * jsdom defines HTMLDialogElement but omits showModal() and close(),
 * causing useDialogModal and any component that opens a <dialog> to
 * throw. This setup file patches the prototype so specs exercise the
 * real open/close branches instead of hitting "showModal is not a function".
 *
 * Loaded via vitest.config.js setupFiles — runs before every spec file.
 */
const proto = globalThis.HTMLDialogElement && globalThis.HTMLDialogElement.prototype;

if (proto) {
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function () {
      this.setAttribute('open', '');
      this.open = true;
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function () {
      this.removeAttribute('open');
      this.open = false;
    };
  }
}
