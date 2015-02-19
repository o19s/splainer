'use strict';

angular.module('splain-app')
  .controller('DocSelectorCtrl', function DocExplainCtrl($scope, searchSvc, settingsStoreSvc) {
    // this controller is a bit silly just because
    // modals need their own controller
    var searchSettings = settingsStoreSvc.settings;
    $scope.currSearch = searchSvc.createSearch(searchSettings);
    $scope.currSearch.search();

    $scope.selectDoc = function(doc) {
      console.log("selected: " + doc.id)
      $scope.docSelection = doc;
    };
  });
