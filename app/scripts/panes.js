'use strict';
/*
 * Code for managing the fixed slide-out drawer
 * */

(function () {
  var slider = document.getElementsByClassName('east-slider')[0];

  var container = document.getElementsByClassName('pane_container')[0];
  var east = document.getElementsByClassName('pane_east')[0];
  var main = document.getElementsByClassName('pane_main')[0];

  east.style.left = slider.style.left = container.offsetWidth - 20 + 'px';

  /* Move the left edge of east to x
   * */
  var moveEastTo = function (x) {
    slider.style.left = x + 'px';
    east.style.left = 6 + x + 'px';
    main.style.width = x + 'px';
    east.style.width = container.offsetWidth - x + 'px';
  };

  var dragElement = function (evt) {
    moveEastTo(evt.clientX);
  };

  var grabSlider = function () {
    document.onmousemove = dragElement;
    east.style.display = 'block';
    return false;
  };

  var releaseSlider = function () {
    document.onmousemove = null;
  };

  slider.onmousedown = grabSlider;
  document.onmouseup = releaseSlider;

  var toggled = false;
  /* Toggle the pull out, unhide the
   * east slider east pane, then
   * bind to the slider's events for dragging
   * */
  var toggleEast = function () {
    toggled = !toggled;
    if (toggled) {
      slider.onmousedown = grabSlider;
      document.onmouseup = releaseSlider;
      moveEastTo(container.offsetWidth - 300);
      slider.style.display = 'block';
      east.style.display = 'block';
    } else {
      slider.onmousedown = null;
      document.onmouseup = null;
      slider.style.display = 'none';
      east.style.display = 'none';
      moveEastTo(container.offsetWidth);
    }
  };

  var openEast = function () {
    if (!toggled) {
      toggleEast();
    }
  };

  var closeEast = function () {
    if (toggled) {
      toggleEast();
    }
  };

  window.addEventListener('resize', function () {
    if (toggled) {
      moveEastTo(container.offsetWidth - 300);
    } else {
      moveEastTo(container.offsetWidth);
    }
  });

  document.addEventListener('toggleEast', toggleEast);
  document.addEventListener('openEast', openEast);
  document.addEventListener('closeEast', closeEast);
})();
