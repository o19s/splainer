'use strict';

angular.module('splain-app')
  .controller('DocRowCtrl', function DocRowCtrl($scope, $modal) {

    $scope.docRow = {};
    $scope.docRow.snippets = function(doc) {
      return doc.subSnippets('<em>', '</em>');
    };

    $scope.doc.showDetailed = function() {
      $modal.open({
        templateUrl: 'views/detailedExplain.html',
        controller: 'DocExplainCtrl',
        resolve: {
          doc: function() {
            return $scope.doc;
          }
        }
      });
    };

    $scope.doc.showDoc = function() {
      $modal.open({
        templateUrl: 'views/detailedDoc.html',
        controller: 'DetailedDocCtrl',
        resolve: {
          doc: function() {
            return $scope.doc;
          }
        }
      });
    };

  });
