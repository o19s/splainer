'use strict';

describe('searchResultsCtrl', function() {
  var createController = null;
  var scope = null;

  beforeEach(module('splain-app'));

  var testUrl = 'http://localhost:8983/solr/collection1/select';
  var testArgsStr = 'q=*:*&fq=blah&qq=blarg';
  var testFieldSpecStr = 'id field1';
  var mockSolrSettings = {solrUrl: testUrl, solrArgsStr: testArgsStr,
                          fieldSpecStr: testFieldSpecStr};
  var httpBackend = null;

  beforeEach(function() {
    var mockSolrSettingsSvc = {
      get: function() {
        return mockSolrSettings;
      }
    };
    
    module(function($provide) {
      $provide.value('settingsStoreSvc', mockSolrSettingsSvc);
    });
    
    inject(function($rootScope, $controller, $httpBackend) {
      httpBackend = $httpBackend;
      createController = function() {
        scope = $rootScope.$new();
        return $controller('SearchResultsCtrl', {'$scope': scope});
      };
    });
  });
  
  /* global urlContainsParams, mockExplain*/
  var mockSolrResp = {
    response: {
      numFound: 2,
      docs : [
        {id: 'doc1', field1: 'title1'},
        {id: 'doc2', field1: 'title2'},
      ]
    },
    debug: {
      explain: {
        'doc1': mockExplain,
        'doc2': mockExplain
      } 
    }

  };

  it('starts in NO_SEARCH', function() {
    createController();
    expect(scope.search.state).toBe(scope.search.NO_SEARCH);
  });

  it('goes to WAITING_FOR_SERACH -> DID_SEARCH on search execute', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(200, mockSolrResp);
    createController();
    scope.search.search();
    expect(scope.search.state).toBe(scope.search.WAITING_FOR_SEARCH);
    httpBackend.flush();
    expect(scope.search.state).toBe(scope.search.DID_SEARCH);
    httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('goes to WAITING_FOR_SEARCH -> ERROR on seasrch fail', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(404);
    createController();
    scope.search.search();
    expect(scope.search.state).toBe(scope.search.WAITING_FOR_SEARCH);
    httpBackend.flush();
    expect(scope.search.state).toBe(scope.search.IN_ERROR);
    httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('gets a list of docs', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(200, mockSolrResp);
    createController();
    scope.search.search();
    httpBackend.flush();
    expect(scope.search.docs.length).toEqual(mockSolrResp.response.docs.length);
    httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('resets list of docs on error', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(200, mockSolrResp);
    createController();
    scope.search.search();
    httpBackend.flush();
    expect(scope.search.docs.length).toEqual(mockSolrResp.response.docs.length);
    
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(404);
    scope.search.search();
    httpBackend.flush();
    expect(scope.search.docs.length).toEqual(0);
    httpBackend.verifyNoOutstandingExpectation();
  });
  


});
