'use strict';

window.MockLocationSvc = function() {

  this.lastParams = null;
  this.search = function(params) {
    if (params) {
      this.lastParams = params;
    }
    return this.lastParams;
  };
};
