'use strict';
// basic promise
(function() {
  var Promise = function(taskFn, taskThis, taskArgs) {
    // when taskFn signals done, do this
    this.$$myFn = taskFn;
    this.then = function(nextTaskFn, nextTaskThisOrArgs, nextTaskArgs) {
      if (nextTaskThisOrArgs instanceof Array) {
        nextTaskArgs = nextTaskThisOrArgs;
        nextTaskThisOrArgs = undefined;
      }
      this.next = new Promise(nextTaskFn, nextTaskThisOrArgs, nextTaskArgs);
      return this.next;
    };
    
    // Run the underlying task
    this.apply = function() {
      taskFn.promise = this; // somebody then(...) me!
      taskFn.apply(taskThis, taskArgs);
    };
    
    // We're done, the next thing can run
    this.completer = function() {
      if (this.next) {
        this.next.apply();
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
