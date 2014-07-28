'use strict';

describe('solrSettingsCtrl', function() {

  var createController = null;
  var scope = null;
  var localStorage = null;

  beforeEach(module('splain-app'));

  beforeEach(function() {
    /* global MockLocalStorageService*/
    localStorage = new MockLocalStorageService();
    
    module(function($provide) {
      $provide.value('localStorageService', localStorage);
    });
    
    
    inject(function($rootScope, $controller) {

      createController = function() {
        scope = $rootScope.$new();
        scope.main = {};
        scope.main.search = function() {
          var p = Promise.create(scope.main.search);
          p.complete();
          return p;
        };
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
      localStorage.isSupported = true;
      var  testUrl = 'http://localhost:8983/solr/collection1/select';
      localStorage.store.solrUrl = testUrl;
      createController();
      expect(scope.solrSettings.solrUrl).toEqual(testUrl);
      expect(scope.solrSettings.fieldSpecStr).toEqual('');
      expect(scope.solrSettings.solrArgsStr).toEqual('');
    });
    
    it('loads all', function() {
      localStorage.isSupported = true;
      var testUrl = 'http://localhost:8983/solr/collection1/select';
      var testArgsStr = 'q=*:*&fq=blah&qq=blarg';
      localStorage.store.solrUrl = testUrl;
      localStorage.store.solrArgsStr = testArgsStr;
      createController();
      expect(scope.solrSettings.solrUrl).toEqual(testUrl);
      expect(scope.solrSettings.solrArgsStr).toEqual(testArgsStr);
    });

    it('gets ""s if unsupported', function() {
      localStorage.isSupported = false;
      createController();
      expect(scope.solrSettings.solrUrl).toEqual('');
      expect(scope.solrSettings.fieldSpecStr).toEqual('');
      expect(scope.solrSettings.solrArgsStr).toEqual('');
    });
  });

  describe('save settings', function() {
    
    describe('multiple setting input', function() {
      var testUrl = 'http://localhost:8983/solr/collection1/select';
      var testFieldSpec = 'field1';
      var testArgsStr = 'q=*:*';

      /* global urlContainsParams*/
      beforeEach(function() {
        createController();
        scope.solrSettings.solrUrl = testUrl;
        scope.solrSettings.solrArgsStr = testArgsStr;
        scope.solrSettings.fieldSpecStr = testFieldSpec;
        spyOn(scope.main, 'search').andCallThrough();        
        scope.solrSettings.publishSearcher();
      });

      it('searches on submit', function() {
        expect(scope.main.search).toHaveBeenCalled();
      });

      it('saves settings in local storage', function() {
        expect(localStorage.get('solrUrl')).toEqual(testUrl);
        expect(localStorage.get('fieldSpecStr')).toEqual(testFieldSpec);
        expect(localStorage.get('solrArgsStr')).toEqual(testArgsStr);
      });
      
    });

    // someone just pastes in a big URL
    describe('just url input', function() {
      var testUserUrl = 'http://localhost:8983/solr/collection1/select?q=*:*&fl=field1';
      var testUrlEncodedUrl = 'http://localhost:8983/solr/collection1/select?q=choice%20of%20law&defType=edismax&qf=catch_line%20text&pf=catch_line&fl=catch_line%20text';
      var testUserUrlBase = 'http://localhost:8983/solr/collection1/select';
      
      /* global urlContainsParams*/
      beforeEach(function() {
      });

      it('sets inputs up', function() {
        createController();
        scope.solrSettings.solrUrl = testUserUrl;
        scope.solrSettings.publishSearcher();

        expect(scope.solrSettings.fieldSpecStr).toEqual('field1');
        expect(scope.solrSettings.solrArgsStr).toEqual('q=*:*');
        expect(scope.solrSettings.solrUrl).toEqual(testUserUrlBase);
      });

      it('url decodes URL', function() {
        createController();
        scope.solrSettings.solrUrl = testUrlEncodedUrl;
        scope.solrSettings.publishSearcher();

        expect(scope.solrSettings.fieldSpecStr).toEqual('catch_line text');
        expect(scope.solrSettings.solrArgsStr).toEqual('q=choice of law&defType=edismax&qf=catch_line text&pf=catch_line');
        expect(scope.solrSettings.solrUrl).toEqual(testUserUrlBase);

      });
      
    });
    
    describe('url and preexisting input', function() {
      var testNewUserUrl = 'http://localhost:8983/solr/collection1/select?q=field:foo&fl=field1';
      var testNewUserUrlBase = 'http://localhost:8983/solr/collection1/select';
      var testFieldSpecStr = 'field1';
      var testArgsStr = 'q=*:*';
      
      beforeEach(function() {
        localStorage.store.solrArgsStr = testArgsStr;
        localStorage.store.fieldSpecStr = testFieldSpecStr;
        createController();
      });

      it('sets params to new url', function() {
        scope.solrSettings.solrUrl = testNewUserUrl;
        scope.solrSettings.publishSearcher();
      });
      
    });


  });
  

});
