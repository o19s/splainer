'use strict';

angular.module('splain-app')
  .controller('DocRowCtrl', function DocRowCtrl($scope, $modal) {

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

  });
