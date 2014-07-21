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

  describe('local storage', function() {
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
  

});
