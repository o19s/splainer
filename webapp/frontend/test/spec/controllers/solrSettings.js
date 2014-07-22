'use strict';

describe('solrSettingsCtrl', function() {

  var createController = null;
  var scope = null;
  var httpBackend = null;
  var localStorage = null;

  beforeEach(module('splain-app'));

  beforeEach(function() {
    /* global MockLocalStorageService*/
    localStorage = new MockLocalStorageService();
    
    module(function($provide) {
      $provide.value('localStorageService', localStorage);
    });
    
    
    inject(function($httpBackend, $rootScope, $controller) {
      httpBackend = $httpBackend;

      createController = function() {
        scope = $rootScope.$new();
        scope.main = {};
        scope.main.searcher = null;
        scope.main.docs = [];
        return $controller('SolrSettingsCtrl', {'$scope': scope});
      };
    });
  });

  beforeEach(function() {
    localStorage.reset();
  });

  it('initializes with default settings', function() {
    createController();
    expect(scope.solrSettings.solrUrl).toEqual('');
    expect(scope.solrSettings.fieldSpecStr).toEqual('');
    expect(scope.solrSettings.solrArgsStr).toEqual('');
  });

  describe('local storage init', function() {
    it('loads partial', function() {
      localStorage.isLocalStorageSupported = true;
      var  testUrl = 'http://localhost:8983/solr/collection1/select';
      localStorage.store.solrUrl = testUrl;
      createController();
      expect(scope.solrSettings.solrUrl).toEqual(testUrl);
      expect(scope.solrSettings.fieldSpecStr).toEqual('');
      expect(scope.solrSettings.solrArgsStr).toEqual('');
    });
    
    it('loads all', function() {
      localStorage.isLocalStorageSupported = true;
      var testUrl = 'http://localhost:8983/solr/collection1/select';
      var testArgsStr = 'q=*:*&fq=blah&qq=blarg';
      localStorage.store.solrUrl = testUrl;
      localStorage.store.solrArgsStr = testArgsStr;
      createController();
      expect(scope.solrSettings.solrUrl).toEqual(testUrl);
      expect(scope.solrSettings.solrArgsStr).toEqual(testArgsStr);
    });

    it('gets ""s if unsupported', function() {
      localStorage.isLocalStorageSupported = false;
      createController();
      expect(scope.solrSettings.solrUrl).toEqual('');
      expect(scope.solrSettings.fieldSpecStr).toEqual('');
      expect(scope.solrSettings.solrArgsStr).toEqual('');
    });
  });

  describe('save settings', function() {
    /*global mockExplain*/
    var mockSolrResp = {
      response: {
        numFound: 10,
        docs : [
          {id: 'doc1', field1: 'title1'},
          {id: 'doc2', field1: 'title2'},
          {id: 'doc3', field1: 'title3'},
          {id: 'doc4', field1: 'title4'},
          {id: 'doc5', field1: 'title5'},
          {id: 'doc6', field1: 'title6'},
          {id: 'doc7', field1: 'title7'},
          {id: 'doc8', field1: 'title8'},
          {id: 'doc9', field1: 'title9'},
          {id: 'doc10', field1: 'title10'}
        ]
      },
      debug: { explain: {
          'doc1': mockExplain,
          'doc2': mockExplain,
          'doc3': mockExplain,
          'doc4': mockExplain,
          'doc5': mockExplain,
          'doc6': mockExplain,
          'doc7': mockExplain,
          'doc8': mockExplain,
          'doc9': mockExplain,
          'doc10': mockExplain}
      }
    };

    describe('multiple setting input', function() {
      var testUrl = 'http://localhost:8983/solr/collection1/select';
      var testFieldSpec = 'field1';
      var testArgsStr = 'q=*:*';

      /* global urlContainsParams*/
      beforeEach(function() {
        httpBackend.expectJSONP(urlContainsParams(testUrl, {q: ['*:*']}))
                   .respond(200, mockSolrResp);
        createController();
        scope.solrSettings.solrUrl = testUrl;
        scope.solrSettings.solrArgsStr = testArgsStr;
        scope.solrSettings.fieldSpecStr = testFieldSpec;
        scope.solrSettings.publishSearcher();
        httpBackend.flush();
      });

      it('searches on submit', function() {
        expect(scope.main.docs.length).toEqual(mockSolrResp.response.docs.length);
        expect(scope.main.solrSearcher).not.toBe(null);
      });

      it('saves settings in local storage', function() {
        expect(localStorage.get('solrUrl')).toEqual(testUrl);
        expect(localStorage.get('fieldSpecStr')).toEqual(testFieldSpec);
        expect(localStorage.get('solrArgsStr')).toEqual(testArgsStr);
      });
      
      it('populates field spec', function() {
      });
      
      afterEach(function() {
        httpBackend.verifyNoOutstandingExpectation();
      });
    });

    // someone just pastes in a big URL
    describe('just url input', function() {
      var testUserUrl = 'http://localhost:8983/solr/collection1/select?q=*:*&fl=field1';
      var testUserUrlBase = 'http://localhost:8983/solr/collection1/select';
      
      /* global urlContainsParams*/
      beforeEach(function() {
        httpBackend.expectJSONP(urlContainsParams(testUserUrlBase, {q: ['*:*'], 'fl': ['id field1']}))
                   .respond(200, mockSolrResp);
        createController();
        scope.solrSettings.solrUrl = testUserUrl;
        scope.solrSettings.publishSearcher();
        httpBackend.flush();
      });

      it('sets inputs up', function() {
        expect(scope.solrSettings.fieldSpecStr).toEqual('field1');
        expect(scope.solrSettings.solrArgsStr).toEqual('q=*:*');
        expect(scope.solrSettings.solrUrl).toEqual(testUserUrlBase);
      });
      
      afterEach(function() {
        httpBackend.verifyNoOutstandingExpectation();
      });
    });


  });
  

});
