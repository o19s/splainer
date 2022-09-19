'use strict';
// basic promise
// This file used to be shipped as part of splainer-search, along with bind.js
// It is unclear if we need it...  Appears it is required by splainer.  But adding
// to splainer didn't work.
(function() {
  var Promise = function(taskFn, taskThis, taskArgs) {
    this.completed = false;
    // when taskFn signals done, do this
    this.$$myFn = taskFn;
    this.then = function(nextTaskFn, nextTaskThisOrArgs, nextTaskArgs) {
      if (nextTaskThisOrArgs instanceof Array) {
        nextTaskArgs = nextTaskThisOrArgs;
        nextTaskThisOrArgs = undefined;
      }
      this.next = new Promise(nextTaskFn, nextTaskThisOrArgs, nextTaskArgs);
      if (this.completed) {
        this.completer();
      }
      return this.next;
    };

    // Run the underlying task
    this.apply = function() {
      taskFn.promise = this; // somebody then(...) me!
      taskFn.apply(taskThis, taskArgs);
    };

    // We're done, the next thing can run
    this.completer = function() {
      this.completed = true;
      if (this.next) {
        this.next.apply();
        this.completed = false;
      }
    };
    this.complete = this.completer.bind(this);
  };

  Promise.create = function(func) {
    if (func.hasOwnProperty('promise')) {
      // I already have a stub promise waiting for
      // somebody to call then on
      return func.promise;
    } else {
      var firstPromise = new Promise();
      return firstPromise;
    }
  };
  window.Promise = Promise;
}());

// I have an easier time thinking as an implementor
// in terms of a sequence of asynchronous tasks to be
// chained
