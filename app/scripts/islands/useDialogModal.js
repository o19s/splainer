/**
 * useDialogModal — Preact hook wrapping a native <dialog>. Returns
 * { ref, close }; the dialog opens via showModal() in a layout effect.
 * onClose fires on ESC (cancel event), backdrop click (event target ===
 * dialog), or programmatic close().
 */
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';

export function useDialogModal(onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  const closedRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    const dlg = ref.current;
    if (!dlg) return undefined;

    closedRef.current = false;

    // Stryker disable next-line all: jsdom lacks HTMLDialogElement.showModal; real-browser path in e2e/smoke.spec.js.
    if (typeof dlg.showModal === 'function') {
      // Stryker disable next-line all: unreachable under jsdom (see above).
      dlg.showModal();
    } else {
      // jsdom path.
      dlg.setAttribute('open', '');
    }

    function fireClose() {
      if (closedRef.current) return;
      closedRef.current = true;
      const cb = onCloseRef.current;
      if (cb) cb();
    }

    function handleCancel(e) {
      e.preventDefault();
      fireClose();
    }

    function handleClick(e) {
      if (e.target === dlg) fireClose();
    }

    dlg.addEventListener('cancel', handleCancel);
    dlg.addEventListener('click', handleClick);

    return () => {
      dlg.removeEventListener('cancel', handleCancel);
      dlg.removeEventListener('click', handleClick);
      if (dlg.open) dlg.close();
    };
  }, []);

  function close() {
    const dlg = ref.current;
    if (dlg && dlg.open) dlg.close();
    if (closedRef.current) return;
    closedRef.current = true;
    const cb = onCloseRef.current;
    if (cb) cb();
  }

  return { ref, close };
}
