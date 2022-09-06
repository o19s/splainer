'use strict';

angular.module('splain-app')
  .controller('DocRowCtrl', [
    '$scope',
    '$uibModal',
    'settingsStoreSvc',
    function DocRowCtrl($scope, $uibModal, settingsStoreSvc) {

      $scope.docRow = {};
      // TODO: In a future refactor just compute the snippets and store them out, don't use a function call in the template
      $scope.docRow.snippetCache = null;
      $scope.docRow.snippets = function(doc) {
        if (!$scope.docRow.snippetCache) {
          var snippets = doc.subSnippets('<em>', '</em>');
          angular.forEach(snippets, function(value, key){
            if ( angular.isArray(value) ) {
              snippets[key] = value.join(', ');
            }
          });
          $scope.docRow.snippetCache = snippets;
        }
        return $scope.docRow.snippetCache;
      };

      // Apply highlighting, no highlighting applied if you access doc.title directly
      $scope.docRow.title = $scope.doc.getHighlightedTitle('<em>', '</em>');

      $scope.doc.showDetailed = function() {
        $uibModal.open({
          templateUrl: 'views/detailedExplain.html',
          controller: 'DocExplainCtrl',
          size: 'lg',
          resolve: {
            doc: function() {
              return $scope.doc;
            },
            canExplainOther: function() {
              var allowedEngines = ['es', 'os', 'solr'];
              return allowedEngines.includes(settingsStoreSvc.settings.whichEngine);
            }
          }
        });
      };

      $scope.doc.showDoc = function() {
        $uibModal.open({
          templateUrl: 'views/detailedDoc.html',
          controller: 'DetailedDocCtrl',
          resolve: {
            doc: function() {
              return $scope.doc;
            }
          }
        });
      };
    }
  ]);
