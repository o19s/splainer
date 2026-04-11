'use strict';

/*global ace */

(function () {
  // The old height of the element can be stale after DOM updates,
  // so we poll and re-query the element to get the current height.
  var element = document.getElementById('queryParams');
  var lastHeight = element ? element.offsetHeight : 0;
  function checkForChanges() {
    element = document.getElementById('queryParams');
    var currentHeight = element ? element.offsetHeight : 0;
    if (currentHeight !== lastHeight) {
      document.dispatchEvent(new CustomEvent('devSettingsHeightChange'));
      lastHeight = currentHeight;
    }

    setTimeout(checkForChanges, 500);
  }
  checkForChanges();

  function setHeightAll(selector, height) {
    var els = document.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) {
      els[i].style.height = height + 'px';
    }
  }

  function resizeAce() {
    var qp = document.getElementById('queryParams');
    var height = qp ? qp.offsetHeight : null;
    if (height === null) {
      setTimeout(function () {
        resizeAce();
      }, 200);
      return;
    }

    setHeightAll('.es-query-params', height - 400);

    // delay, because... computers!
    // if on another page (/cases, or /teams) and switch to case page,
    // then for some reason the height returns 100
    // when toggling the pane ON, and the right size when OFF!!!
    // a 100ms delay creates some weird behavior in the ace editor.
    // 200ms works just fine. GO FIGURE!
    setTimeout(function () {
      setHeightAll('.es-query-params', height - 400);

      // must repaint the editor, or else.... BOOM!
      var esEditor = document.getElementById('es-query-params-editor');
      if (esEditor) {
        ace.edit('es-query-params-editor').resize();
      }
    }, 200);

    setHeightAll('.os-query-params', height - 400);

    // delay, because... computers!
    setTimeout(function () {
      setHeightAll('.os-query-params', height - 400);

      // must repaint the editor, or else.... BOOM!
      var osEditor = document.getElementById('os-query-params-editor');
      if (osEditor) {
        ace.edit('os-query-params-editor').resize();
      }
    }, 200);
  }

  //set initially
  resizeAce();

  //listen for changes
  window.addEventListener('resize', resizeAce);
  document.addEventListener('toggleEast', resizeAce);
  document.addEventListener('devSettingsHeightChange', resizeAce);
})();
