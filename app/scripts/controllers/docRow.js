'use strict';

angular.module('splain-app')
  .controller('DocRowCtrl', function DocRowCtrl($scope, $modal) {

    $scope.docRow = {};
    $scope.docRow.snippets = function(doc) {
      var snippets = doc.subSnippets('<em>', '</em>');
      angular.forEach(snippets, function(value, key){
        if ( angular.isArray(value) ) {
          snippets[key] = value.join('');
        }
      });
      return snippets;
    };

    $scope.doc.showDetailed = function() {
      $modal.open({
        templateUrl: 'views/detailedExplain.html',
        controller: 'DocExplainCtrl',
        size: 'lg',
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
