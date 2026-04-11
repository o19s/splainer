/*
 * Code for managing the fixed slide-out drawer.
 *
 * Exports openEast / closeEast / toggleEast so bootstrap logic can call
 * them directly instead of going through CustomEvent dispatch.
 */

var slider = document.getElementsByClassName('east-slider')[0];

var container = document.getElementsByClassName('pane_container')[0];
var east = document.getElementsByClassName('pane_east')[0];
var main = document.getElementsByClassName('pane_main')[0];

east.style.left = slider.style.left = container.offsetWidth - 20 + 'px';

/* Move the left edge of east to x */
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
/* Toggle the pull out, unhide the east slider east pane, then
 * bind to the slider's events for dragging */
export function toggleEast() {
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
}

export function openEast() {
  if (!toggled) {
    toggleEast();
  }
}

export function closeEast() {
  if (toggled) {
    toggleEast();
  }
}

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
