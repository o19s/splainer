'use strict';

window.MockLocalStorageService = function() {

  this.set = function(key, value) {
    this.store[key] = value;
  };

  this.get = function(key) {
    if (!this.store.hasOwnProperty(key)) {
      return null;
    }
    return this.store[key];
  };

  this.isSupported = function() {
    return this.isLocalStorageSupported;
  };

  this.reset = function() {
    this.store = {};
    this.isLocalStorageSupported = true;
  };

  this.reset();
};
