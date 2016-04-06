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
    inject(function($rootScope, $controller, $httpBackend) {
      httpBackend = $httpBackend;
      createController = function() {
        scope = $rootScope.$new();

        var search = function() {
          var promise = Promise.create(this.search);
          promise.complete();
          return promise;
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
    expect(scope.start.solrSettings.startUrl).toBe(locationSvc.lastParams.solr);
    expect(localStorageSvc.get('solr_startUrl')).toEqual(scope.start.solrSettings.startUrl);
    expect(scope.start.solrSettings.searchArgsStr).toContain('q=foo');
    expect(localStorageSvc.get('solr_searchArgsStr')).toEqual('!' + scope.start.solrSettings.searchArgsStr);
    expect(scope.start.solrSettings.searchUrl).toBe('http://localhost:1234/solr/stuff');
    expect(localStorageSvc.get('solr_searchUrl')).toEqual(scope.start.solrSettings.searchUrl);
    expect(scope.start.solrSettings.fieldSpecStr).toBe('id banana');
    expect(localStorageSvc.get('solr_fieldSpecStr')).toEqual(scope.start.solrSettings.fieldSpecStr);
  });

  it('bootstraps fieldSpec arg in URL', function() {
    var overridingFieldSpec = 'id:banana f:id';
    locationSvc.lastParams = {solr: 'http://localhost:1234/solr/stuff?q=foo&fl=id banana', fieldSpec: overridingFieldSpec};
    createController();
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
