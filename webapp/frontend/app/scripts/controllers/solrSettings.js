'use strict';

angular.module('splain-app')
  .controller('SolrSettingsCtrl', function ($scope, solrSearchSvc, fieldSpecSvc, normalDocsSvc) {
    $scope.solrArgs = {solrUrl: '',
                       fieldSpecStr: '',
                       solrArgs: ''};

    $scope.solrArgs.publishSearcher = function() {
      console.log('publishing search');
      var fieldSpec = fieldSpecSvc.createFieldSpec(this.fieldSpecStr);
      var parsedArgs = solrSearchSvc.parseSolrArgs(this.solrArgs);
      $scope.main.solrSearcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(), this.solrUrl, parsedArgs, '');
      $scope.main.solrSearcher.search()
      .then(function() {
        $scope.main.docs.length = 0;
        angular.forEach($scope.main.solrSearcher.docs, function(doc) {
          $scope.main.docs.push(normalDocsSvc.createNormalDoc(fieldSpec, doc));
        });
      });
    };
    
  });
