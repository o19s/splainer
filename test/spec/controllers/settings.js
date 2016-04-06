'use strict';

describe('SettingsCtrl', function() {

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
        scope.search = {};
        scope.search.search = function() {
          var p = Promise.create(scope.search.search);
          p.complete();
          return p;
        };
        scope.search.searcher = null;
        scope.search.docs = [];
        return $controller('SettingsCtrl', {'$scope': scope});
      };
    });
  });

  beforeEach(function() {
    localStorage.reset();
  });

  it('initializes with default settings', function() {
    createController();
    expect(scope.whichEngine).toEqual('solr');
    expect(scope.searchSettings.searchUrl).toEqual('');
    expect(scope.searchSettings.fieldSpecStr).toEqual('');
    expect(scope.searchSettings.searchArgsStr).toEqual('');
  });

  describe('local storage init', function() {
    it('loads partial', function() {
      localStorage.isSupported = true;
      var  testUrl = 'http://localhost:8983/solr/collection1/select';
      localStorage.store.solr_searchUrl = testUrl;
      createController();
      expect(scope.searchSettings.searchUrl).toEqual(testUrl);
      expect(scope.searchSettings.fieldSpecStr).toEqual('');
      expect(scope.searchSettings.searchArgsStr).toEqual('');
    });

    it('loads all', function() {
      localStorage.isSupported = true;
      var testUrl = 'http://localhost:8983/solr/collection1/select';
      var testArgsStr = 'q=*:*&fq=blah&qq=blarg';
      localStorage.store.whichEngine = 'solr';
      localStorage.store.solr_searchUrl = testUrl;
      localStorage.store.solr_searchArgsStr = '!' + testArgsStr;
      createController();
      expect(scope.searchSettings.searchUrl).toEqual(testUrl);
      expect(scope.searchSettings.searchArgsStr).toEqual(testArgsStr);
    });

    it('loads es', function() {
      localStorage.isSupported = true;
      var testUrl = 'http://localhost:9200/tmdb/movies/_search';
      var testArgsStr = '{}';
      localStorage.store.whichEngine = 'es';
      localStorage.store.es_searchUrl = testUrl;
      localStorage.store.es_searchArgsStr = '!' + testArgsStr;
      createController();
      expect(scope.searchSettings.searchUrl).toEqual(testUrl);
      expect(scope.searchSettings.searchArgsStr).toEqual(testArgsStr);
    });

    it('gets ""s if unsupported', function() {
      localStorage.isSupported = false;
      createController();
      expect(scope.whichEngine).toEqual('solr');
      expect(scope.searchSettings.searchUrl).toEqual('');
      expect(scope.searchSettings.fieldSpecStr).toEqual('');
      expect(scope.searchSettings.searchArgsStr).toEqual('');
    });
  });

  describe('save settings', function() {

    describe('multiple setting input', function() {
      var testUrl = 'http://localhost:8983/solr/collection1/select';
      var testFieldSpec = 'field1';
      var testArgsStr = 'q=*:*';

      beforeEach(function() {
        createController();
        scope.whichEngine = 'solr';
        scope.searchSettings.searchUrl = testUrl;
        scope.searchSettings.searchArgsStr = testArgsStr;
        scope.searchSettings.fieldSpecStr = testFieldSpec;
        spyOn(scope.search, 'search').andCallThrough();
        scope.publishSearcher();
      });

      it('searches on submit', function() {
        expect(scope.search.search).toHaveBeenCalled();
      });

      it('saves settings in local storage', function() {
        expect(localStorage.get('solr_searchUrl')).toEqual(testUrl);
        expect(localStorage.get('solr_fieldSpecStr')).toEqual(testFieldSpec);
        expect(localStorage.get('solr_searchArgsStr').slice(1)).toEqual(testArgsStr);
      });
    });

    // someone just pastes in a big URL
    describe('just url input', function() {
      var testUserUrl = 'http://localhost:8983/solr/collection1/select?q=*:*&fl=field1';
      var testUrlEncodedUrl = 'http://localhost:8983/solr/collection1/select?q=choice%20of%20law&defType=edismax&qf=catch_line%20text&pf=catch_line&fl=catch_line%20text';
      var testUserUrlBase = 'http://localhost:8983/solr/collection1/select';

      beforeEach(function() {
      });

      it('sets inputs up', function() {
        createController();
        scope.searchSettings.whichEngine = 'solr';
        scope.searchSettings.searchUrl = testUserUrl;
        scope.publishSearcher();

        expect(scope.searchSettings.fieldSpecStr).toEqual('field1');
        expect(scope.searchSettings.searchArgsStr).toEqual('q=*:*');
        expect(scope.searchSettings.searchUrl).toEqual(testUserUrlBase);
      });

      it('url decodes URL', function() {
        createController();
        scope.searchSettings.whichEngine = 'solr';
        scope.searchSettings.searchUrl = testUrlEncodedUrl;
        scope.publishSearcher();

        expect(scope.searchSettings.fieldSpecStr).toEqual('catch_line text');
        expect(scope.searchSettings.searchArgsStr).toEqual('q=choice of law\n&defType=edismax\n&qf=catch_line text\n&pf=catch_line');
        expect(scope.searchSettings.searchUrl).toEqual(testUserUrlBase);
      });
    });

    describe('url and preexisting input', function() {
      var testNewUserUrl = 'http://localhost:8983/solr/collection1/select?q=field:foo&fl=field1';
      var testFieldSpecStr = 'field1';
      var testArgsStr = 'q=*:*';

      beforeEach(function() {
        localStorage.store.whichEngine = 'solr';
        localStorage.store.searchArgsStr = testArgsStr;
        localStorage.store.fieldSpecStr = testFieldSpecStr;
        createController();
      });

      it('sets params to new url', function() {
        scope.searchSettings.searchUrl = testNewUserUrl;
        scope.publishSearcher();
      });
    });
  });
});
