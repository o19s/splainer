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

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    const dlg = ref.current;
    if (!dlg) return undefined;

    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
    } else {
      // jsdom path.
      dlg.setAttribute('open', '');
    }

    function fireClose() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    const dlg = ref.current;
    if (dlg && dlg.open) dlg.close();
    const cb = onCloseRef.current;
    if (cb) cb();
  }

  return { ref, close };
}
