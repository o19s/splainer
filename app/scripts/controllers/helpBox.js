'use strict';

angular.module('splain-app')
  .controller('HelpBoxCtrl', function ($scope) {
    $scope.help = {};
    $scope.help.toggle = false;
    var whoRand = Math.floor((Math.random() * 3));
    var msgRand = Math.floor((Math.random() * 2));
    console.log('Who?' + whoRand);
    $scope.help.who = whoRand;
    $scope.help.whichMsg = msgRand;
  });
