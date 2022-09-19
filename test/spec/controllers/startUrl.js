'use strict';

describe('startUrlCtrl', function() {
  var createController = null;
  var scope = null;
  var httpBackend = null;
  var locationSvc = null;
  var localStorageSvc = null;

  beforeEach(module('splain-app'));

  beforeEach(function() {
    /* global MockLocationSvc*/
    /* global MockLocalStorageService*/
    locationSvc = new MockLocationSvc();
    localStorageSvc = new MockLocalStorageService();
    module(function($provide) {
      $provide.value('$location', locationSvc);
      $provide.value('localStorageService', localStorageSvc);
    });
    inject(function($rootScope, $controller, $httpBackend, $q) {
      httpBackend = $httpBackend;
      createController = function() {
        scope = $rootScope.$new();

        var search = function() {
          return $q.resolve();
        };

        scope.search = {'search': search};

        return $controller('StartUrlCtrl', {'$scope': scope});
      };
    });
  });

  beforeEach(function() {
    localStorageSvc.reset();
  });

  it('bootstraps if solr arg in URL', function() {
    locationSvc.lastParams = {solr: 'http://localhost:1234/solr/stuff?q=foo&fl=id banana'};
    createController();
    scope.$apply();
    expect(localStorageSvc.get('whichEngine')).toEqual('solr');
    expect(scope.start.solrSettings.startUrl).toBe(locationSvc.lastParams.solr);
    expect(localStorageSvc.get('solr_startUrl')).toEqual(scope.start.solrSettings.startUrl);
    expect(scope.start.solrSettings.searchArgsStr).toContain('q=foo');
    expect(localStorageSvc.get('solr_searchArgsStr')).toEqual('!' + scope.start.solrSettings.searchArgsStr);
    expect(scope.start.solrSettings.searchUrl).toBe('http://localhost:1234/solr/stuff');
    expect(localStorageSvc.get('solr_searchUrl')).toEqual(scope.start.solrSettings.searchUrl);
    expect(scope.start.solrSettings.fieldSpecStr).toBe('id banana');
    expect(localStorageSvc.get('solr_fieldSpecStr')).toEqual(scope.start.solrSettings.fieldSpecStr);
  });

  it('bootstraps if es args in URL', function() {
    locationSvc.lastParams = {esUrl: 'http://localhost:9200/tmdb/_search', esQuery: '{"match": "foo"}', fieldSpec: 'id banana'};
    createController();
    scope.$apply();
    expect(localStorageSvc.get('whichEngine')).toEqual('es');
    expect(scope.start.esSettings.startUrl).toBe('http://localhost:9200/tmdb/_search?stored_fields=id banana');
    expect(localStorageSvc.get('es_startUrl')).toEqual('http://localhost:9200/tmdb/_search?stored_fields=id banana');
    expect(scope.start.esSettings.searchArgsStr).toContain('match');
    expect(localStorageSvc.get('es_searchArgsStr')).toEqual('!' + locationSvc.lastParams.esQuery);
    expect(scope.start.esSettings.searchUrl).toBe('http://localhost:9200/tmdb/_search');
    expect(localStorageSvc.get('es_searchUrl')).toEqual(scope.start.esSettings.searchUrl);
    expect(scope.start.esSettings.fieldSpecStr).toBe('id banana');
    expect(localStorageSvc.get('es_fieldSpecStr')).toEqual(scope.start.esSettings.fieldSpecStr);
  });

  it('bootstraps fieldSpec arg in URL', function() {
    var overridingFieldSpec = 'id:banana f:id';
    locationSvc.lastParams = {solr: 'http://localhost:1234/solr/stuff?q=foo&fl=id banana', fieldSpec: overridingFieldSpec};
    createController();
    scope.$apply();
    expect(scope.start.solrSettings.startUrl).toBe(locationSvc.lastParams.solr);
    expect(localStorageSvc.get('solr_startUrl')).toEqual(scope.start.solrSettings.startUrl);
    expect(scope.start.solrSettings.searchArgsStr).toContain('q=foo');
    expect(localStorageSvc.get('solr_searchArgsStr')).toEqual('!' + scope.start.solrSettings.searchArgsStr);
    expect(scope.start.solrSettings.searchUrl).toBe('http://localhost:1234/solr/stuff');
    expect(localStorageSvc.get('solr_searchUrl')).toEqual(scope.start.solrSettings.searchUrl);
    expect(scope.start.solrSettings.fieldSpecStr).toBe(overridingFieldSpec);
    expect(localStorageSvc.get('solr_fieldSpecStr')).toEqual(scope.start.solrSettings.fieldSpecStr);
  });

  it('ignores fieldSpec w/o Solr URl', function() {
    var overridingFieldSpec = 'id:banana f:id';
    locationSvc.lastParams = {fieldSpec: overridingFieldSpec};
    createController();
    expect(scope.start.solrSettings.startUrl).toBe('');
    expect(scope.start.solrSettings.fieldSpecStr).not.toBe(overridingFieldSpec);
  });

  it('bootstraps submitted URL', function() {
    locationSvc.lastParams = {};
    createController();
    expect(scope.start.solrSettings.startUrl).toBeFalsy();
    scope.start.solrSettings.startUrl = 'http://localhost:1234/solr/stuff?q=foto&fl=id apple';
    scope.start.submitSolr();
    scope.$apply();
    expect(scope.start.solrSettings.startUrl).toBe(locationSvc.lastParams.solr);
    expect(localStorageSvc.get('solr_startUrl')).toEqual(scope.start.solrSettings.startUrl);
    expect(scope.start.solrSettings.searchArgsStr).toContain('q=foto');
    expect(localStorageSvc.get('solr_searchArgsStr')).toEqual('!' + scope.start.solrSettings.searchArgsStr);
    expect(scope.start.solrSettings.searchUrl).toBe('http://localhost:1234/solr/stuff');
    expect(localStorageSvc.get('solr_searchUrl')).toEqual(scope.start.solrSettings.searchUrl);
    expect(scope.start.solrSettings.fieldSpecStr).toBe('id apple');
    expect(localStorageSvc.get('solr_fieldSpecStr')).toEqual(scope.start.solrSettings.fieldSpecStr);

  });
});
