'use strict';

describe('searchResultsCtrl', function() {
  var createController = null;
  var scope = null;

  beforeEach(module('splain-app'));

  var testUrl = 'http://localhost:8983/solr/collection1/select';
  var testArgsStr = 'q=*:*&fq=blah&qq=blarg';
  var testFieldSpecStr = 'id field1';
  var mockSearchSettings = {solr:  {searchUrl: testUrl, fieldSpecStr: testFieldSpecStr, searchArgsStr: testArgsStr, whichEngine: 'solr'},
                        es: {searchUrl: '', fieldSpecStr: '', searchArgsStr: '{}', whichEngine: 'es'},
                        whichEngine: 'solr', // which engine was the last used

                        searchUrl: function() {
                          return this[this.whichEngine].searchUrl;
                        },

                        fieldSpecStr: function() {
                          return this[this.whichEngine].fieldSpecStr;
                        },

                        searchArgsStr: function() {
                          return this[this.whichEngine].searchArgsStr;
                        },

                        };


  var httpBackend = null;

  beforeEach(function() {
    var mockSolrSettingsSvc = {
      ENGINES: {
        SOLR: 0,
        ELASTICSEARCH: 1
      },
      settings: mockSearchSettings
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

  var set = function(aList) {
    // this is a rather naive implementation as it casts everything to strings
    var aSet = {};
    angular.forEach(aList, function(element) {
      aSet['' + element] = true;
    });
    return Object.keys(aSet);
  };

  it('currSearch has states', function() {
    createController();
    var states = set([scope.currSearch.NO_SEARCH, scope.currSearch.WAITING_FOR_SEARCH,
                     scope.currSearch.DID_SEARCH, scope.currSearch.IN_ERROR]);
    expect(states.length).toBe(4);
  });

  it('starts in NO_SEARCH', function() {
    createController();
    expect(scope.currSearch.hasOwnProperty('state')).toBeTruthy();
    expect(scope.currSearch.state).toEqual(scope.currSearch.NO_SEARCH);
  });

  it('goes to WAITING_FOR_SERACH -> DID_SEARCH on search execute', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(200, mockSolrResp);
    createController();
    scope.search.search();
    expect(scope.currSearch.state).toBe(scope.currSearch.WAITING_FOR_SEARCH);
    httpBackend.flush();
    expect(scope.currSearch.state).toBe(scope.currSearch.DID_SEARCH);
    httpBackend.verifyNoOutstandingExpectation();
  });

  it('goes to WAITING_FOR_SEARCH -> ERROR on seasrch fail', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(404);
    createController();
    scope.search.search();
    expect(scope.currSearch.state).toBe(scope.currSearch.WAITING_FOR_SEARCH);
    httpBackend.flush();
    expect(scope.currSearch.state).toBe(scope.currSearch.IN_ERROR);
    httpBackend.verifyNoOutstandingExpectation();
  });

  it('gets a list of docs', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(200, mockSolrResp);
    createController();
    scope.search.search();
    httpBackend.flush();
    expect(scope.currSearch.docs.length).toEqual(mockSolrResp.response.docs.length);
    httpBackend.verifyNoOutstandingExpectation();
  });

  it('tracks max score', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(200, mockSolrResp);
    createController();
    scope.search.search();
    httpBackend.flush();
    expect(scope.currSearch.maxScore).toBeGreaterThan(0);
    httpBackend.verifyNoOutstandingExpectation();
  });

  it('resets list of docs on error', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(200, mockSolrResp);
    createController();
    scope.search.search();
    httpBackend.flush();
    expect(scope.currSearch.docs.length).toEqual(mockSolrResp.response.docs.length);

    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(404);
    scope.search.search();
    httpBackend.flush();
    expect(scope.currSearch.docs.length).toEqual(0);
    httpBackend.verifyNoOutstandingExpectation();
  });

  it('reports errors', function() {
    httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
               .respond(-1);
    createController();
    scope.search.search();
    httpBackend.flush();
    expect(scope.currSearch.docs.length).toEqual(0);
    expect(scope.currSearch.errorMsg.length).toBeGreaterThan(0);

    httpBackend.verifyNoOutstandingExpectation();
  });



});
