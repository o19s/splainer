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


    inject(function($rootScope, $controller, $q) {
      createController = function() {
        scope = $rootScope.$new();
        scope.search = {};
        scope.search.search = function() {
          return $q.resolve();
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
    expect(scope.workingWhichEngine).toEqual('solr');
    expect(scope.workingSettings.searchUrl).toEqual('');
    expect(scope.workingSettings.fieldSpecStr).toEqual('');
    expect(scope.workingSettings.searchArgsStr).toEqual('');
  });

  describe('local storage init', function() {
    it('loads partial', function() {
      localStorage.isSupported = true;
      var  testUrl = 'http://localhost:8983/solr/collection1/select';
      /*jshint camelcase: false */
      localStorage.store.solr_searchUrl = testUrl;
      createController();
      expect(scope.workingSettings.searchUrl).toEqual(testUrl);
      expect(scope.workingSettings.fieldSpecStr).toEqual('');
      expect(scope.workingSettings.searchArgsStr).toEqual('');
    });

    it('loads all', function() {
      localStorage.isSupported = true;
      var testUrl = 'http://localhost:8983/solr/collection1/select';
      var testArgsStr = 'q=*:*&fq=blah&qq=blarg';
      /*jshint camelcase: false */
      localStorage.store.whichEngine = 'solr';
      localStorage.store.solr_searchUrl = testUrl;
      localStorage.store.solr_searchArgsStr = '!' + testArgsStr;
      createController();
      expect(scope.workingSettings.searchUrl).toEqual(testUrl);
      expect(scope.workingSettings.searchArgsStr).toEqual(testArgsStr);
    });

    it('loads es', function() {
      localStorage.isSupported = true;
      var testUrl = 'http://localhost:9200/tmdb/movies/_search';
      var testArgsStr = '{}';
      localStorage.store.whichEngine = 'es';
      /*jshint camelcase: false */
      localStorage.store.es_searchUrl = testUrl;
      localStorage.store.es_searchArgsStr = '!' + testArgsStr;
      createController();
      scope.$apply();
      expect(scope.workingSettings.searchUrl).toEqual(testUrl);
      expect(scope.workingSettings.searchArgsStr).toEqual(testArgsStr);
    });

    it('gets ""s if unsupported', function() {
      localStorage.isSupported = false;
      createController();
      expect(scope.workingWhichEngine).toEqual('solr');
      expect(scope.workingSettings.searchUrl).toEqual('');
      expect(scope.workingSettings.fieldSpecStr).toEqual('');
      expect(scope.workingSettings.searchArgsStr).toEqual('');
    });
  });

  describe('save settings', function() {

    describe('multiple setting input', function() {
      var testUrl = 'http://localhost:8983/solr/collection1/select';
      var testFieldSpec = 'field1';
      var testArgsStr = 'q=*:*';

      beforeEach(function() {
        createController();
        scope.workingWhichEngine = 'solr';
        scope.workingSettings.searchUrl = testUrl;
        scope.workingSettings.searchArgsStr = testArgsStr;
        scope.workingSettings.fieldSpecStr = testFieldSpec;
        spyOn(scope.search, 'search').and.callThrough();
        scope.publishSearcher();
        scope.$apply();
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
        scope.workingSettings.whichEngine = 'solr';
        scope.workingSettings.searchUrl = testUserUrl;
        scope.publishSearcher();

        expect(scope.workingSettings.fieldSpecStr).toEqual('field1');
        expect(scope.workingSettings.searchArgsStr).toEqual('q=*:*');
        expect(scope.workingSettings.searchUrl).toEqual(testUserUrlBase);
      });

      it('url decodes URL', function() {
        createController();
        scope.workingSettings.whichEngine = 'solr';
        scope.workingSettings.searchUrl = testUrlEncodedUrl;
        scope.publishSearcher();

        expect(scope.workingSettings.fieldSpecStr).toEqual('catch_line text');
        expect(scope.workingSettings.searchArgsStr).toEqual('q=choice of law\n&defType=edismax\n&qf=catch_line text\n&pf=catch_line');
        expect(scope.workingSettings.searchUrl).toEqual(testUserUrlBase);
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
        scope.workingSettings.searchUrl = testNewUserUrl;
        scope.publishSearcher();
      });
    });
  });
});
