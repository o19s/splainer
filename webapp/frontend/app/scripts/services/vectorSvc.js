'use strict';

/*
 * Basic vector operations used by explain svc
 *
 * */
angular.module('splain-app')
  .service('vectorSvc', function vectorSvc() {

    var SparseVector = function() {
      this.vecObj = {};

      this.set = function(key, value) {
        this.vecObj[key] = value;
      };

      this.get = function(key) {
        if (this.vecObj.hasOwnProperty(key)) {
          return this.vecObj[key];
        }
        return undefined;
      };

      this.toStr = function() {
        var rVal = '';
        // sort
        var sortedL = [];
        angular.forEach(this.vecObj, function(value, key) {
          sortedL.push([key, value]);
        });
        sortedL.sort(function(lhs, rhs) {return rhs[1] - lhs[1];});
        angular.forEach(sortedL, function(keyVal) {
          rVal += (keyVal[1] + ' ' + keyVal[0] + '\n');
        });
        return rVal;
      };

    };

    this.create = function() {
      return new SparseVector();
    };

    this.add = function(lhs, rhs) {
      var rVal = this.create();
      angular.forEach(lhs.vecObj, function(value, key) {
        rVal.set(key, value);
      });
      angular.forEach(rhs.vecObj, function(value, key) {
        rVal.set(key, value);
      });
      return rVal;
    };

    this.scale = function(lhs, scalar) {
      var rVal = this.create();
      angular.forEach(lhs.vecObj, function(value, key) {
        rVal.set(key, value * scalar);
      });
      return rVal;
    }; 

  });
