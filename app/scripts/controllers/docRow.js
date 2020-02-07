'use strict';

angular.module('splain-app')
  .controller('DocRowCtrl', [
    '$scope',
    '$uibModal',
    'settingsStoreSvc',
    function DocRowCtrl($scope, $uibModal, settingsStoreSvc) {

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
        $uibModal.open({
          templateUrl: 'views/detailedExplain.html',
          controller: 'DocExplainCtrl',
          size: 'lg',
          resolve: {
            doc: function() {
              return $scope.doc;
            },
            canExplainOther: function() {
              var allowedEngines = ['es', 'solr'];
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
