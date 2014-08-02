'use strict';

angular.module('splain-app')
  .controller('DocRowCtrl', function DocRowCtrl($scope, $modal, solrSearchSvc) {

    $scope.doc.highlighted = function(val) {
      var hls = solrSearchSvc.markedUpFieldValue(val, '<b>', '</b>');
      return hls;
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

  });
