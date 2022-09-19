'use strict';

/*global ace,$ */
/*ace.config.set('workerPath', '/assets/ace-builds/src-min-noconflict');
ace.config.set('themePath',  '/assets/ace-builds/src-min-noconflict');*/

$(function() {

  // For some reason when angular is in charge of refreshing the DOM,
  // the old height of the element is the one that's being returned.
  // So we need to tell it to "refetch" the element from the DOM to refresh
  // and get the new height.
  // WEIRD....
  var $element    = $('#queryParams');
  var lastHeight  = $element.height();
  function checkForChanges()
  {
    $element = $('#queryParams');
    if ($element.height() !== lastHeight)
    {
      $(document).trigger('devSettingsHeightChange');
      lastHeight = $element.height();
    }

    setTimeout(checkForChanges, 500);
  }
  checkForChanges();

  function resizeAce() {
    var height = $('#queryParams').height();
    if ( height === null ) {
      setTimeout(function () {
        resizeAce();
      }, 200);
      return;
    }

    $('.es-query-params').height(height - 400);

    // delay, because... computers!
    // if on another page (/cases, or /teams) and switch to case page,
    // then for some reason `$('#queryParams').height()` returns 100
    // when toggling the pane ON, and the right size when OFF!!!
    // a 100ms delay creates some weird behavior in the ace editor.
    // 200ms works just fine. GO FIGURE!
    setTimeout(function () {
      $('.es-query-params').height(height - 400);

      // must repaint the editor, or else.... BOOM!
      if ( $('#es-query-params-editor').length > 0 ) {
        var editor = ace.edit('es-query-params-editor');
        editor.resize();
      }
    }, 200);

    $('.os-query-params').height(height - 400);

    // delay, because... computers!
    // if on another page (/cases, or /teams) and switch to case page,
    // then for some reason `$('#queryParams').height()` returns 100
    // when toggling the pane ON, and the right size when OFF!!!
    // a 100ms delay creates some weird behavior in the ace editor.
    // 200ms works just fine. GO FIGURE!
    setTimeout(function () {
      $('.os-query-params').height(height - 400);

      // must repaint the editor, or else.... BOOM!
      if ( $('#os-query-params-editor').length > 0 ) {
        var editor = ace.edit('os-query-params-editor');
        editor.resize();
      }
    }, 200);
  }

  //set initially
  resizeAce();

  //listen for changes
  $(window).resize(resizeAce);
  $(document).on('toggleEast', resizeAce);
  $(document).on('devSettingsHeightChange', resizeAce);
});
