'use strict';

window.MockLocalStorageService = function() {

  this.set = function(key, value) {
    this.store[key] = value;
  };

  this.get = function(key) {
    if (!Object.prototype.hasOwnProperty.call(this.store, key)) {
      return null;
    }
    return this.store[key];
  };

  this.isSupported = true; 

  this.reset = function() {
    this.store = {};
    this.isSupported = true;
  };

  this.reset();
};
