/*
 * Ace editor resize handler — side-effect module.
 *
 * Polls for height changes on #queryParams and resizes the Ace editors
 * in the ES/OS settings panels. Imported by main.js; runs on import.
 */

// Poll for #queryParams height changes (element is Preact-mounted).
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

  // 200ms delay: height can be stale immediately after pane toggle.
  setTimeout(function () {
    setHeightAll('.es-query-params', height - 400);

    var esEditor = document.getElementById('es-query-params-editor');
    if (esEditor) {
      window.ace.edit('es-query-params-editor').resize();
    }
  }, 200);

  setHeightAll('.os-query-params', height - 400);

  setTimeout(function () {
    setHeightAll('.os-query-params', height - 400);

    var osEditor = document.getElementById('os-query-params-editor');
    if (osEditor) {
      window.ace.edit('os-query-params-editor').resize();
    }
  }, 200);
}

resizeAce();
window.addEventListener('resize', resizeAce);
document.addEventListener('toggleEast', resizeAce);
document.addEventListener('devSettingsHeightChange', resizeAce);
