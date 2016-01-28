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
    expect(scope.start.settings.startUrl).toBe(locationSvc.lastParams.solr);
    expect(localStorageSvc.get('startUrl')).toEqual(scope.start.settings.startUrl);
    expect(scope.start.settings.searchArgsStr).toContain('q=foo');
    expect(localStorageSvc.get('searchArgsStr')).toEqual('!' + scope.start.settings.searchArgsStr);
    expect(scope.start.settings.searchUrl).toBe('http://localhost:1234/solr/stuff');
    expect(localStorageSvc.get('searchUrl')).toEqual(scope.start.settings.searchUrl);
    expect(scope.start.settings.fieldSpecStr).toBe('id banana');
    expect(localStorageSvc.get('fieldSpecStr')).toEqual(scope.start.settings.fieldSpecStr);
  });

  it('bootstraps fieldSpec arg in URL', function() {
    var overridingFieldSpec = 'id:banana f:id';
    locationSvc.lastParams = {solr: 'http://localhost:1234/solr/stuff?q=foo&fl=id banana', fieldSpec: overridingFieldSpec};
    createController();
    expect(scope.start.settings.startUrl).toBe(locationSvc.lastParams.solr);
    expect(localStorageSvc.get('startUrl')).toEqual(scope.start.settings.startUrl);
    expect(scope.start.settings.searchArgsStr).toContain('q=foo');
    expect(localStorageSvc.get('searchArgsStr')).toEqual('!' + scope.start.settings.searchArgsStr);
    expect(scope.start.settings.searchUrl).toBe('http://localhost:1234/solr/stuff');
    expect(localStorageSvc.get('searchUrl')).toEqual(scope.start.settings.searchUrl);
    expect(scope.start.settings.fieldSpecStr).toBe(overridingFieldSpec);
    expect(localStorageSvc.get('fieldSpecStr')).toEqual(scope.start.settings.fieldSpecStr);
  });

  it('ignores fieldSpec w/o Solr URl', function() {
    var overridingFieldSpec = 'id:banana f:id';
    locationSvc.lastParams = {fieldSpec: overridingFieldSpec};
    createController();
    expect(scope.start.settings.startUrl).toBe('');
    expect(scope.start.settings.fieldSpecStr).not.toBe(overridingFieldSpec);
  });

  it('bootstraps submitted URL', function() {
    locationSvc.lastParams = {};
    createController();
    expect(scope.start.settings.startUrl).toBeFalsy();
    scope.start.settings.startUrl = 'http://localhost:1234/solr/stuff?q=foto&fl=id apple';
    scope.start.submitSolr();
    expect(scope.start.settings.startUrl).toBe(locationSvc.lastParams.solr);
    expect(localStorageSvc.get('startUrl')).toEqual(scope.start.settings.startUrl);
    expect(scope.start.settings.searchArgsStr).toContain('q=foto');
    expect(localStorageSvc.get('searchArgsStr')).toEqual('!' + scope.start.settings.searchArgsStr);
    expect(scope.start.settings.searchUrl).toBe('http://localhost:1234/solr/stuff');
    expect(localStorageSvc.get('searchUrl')).toEqual(scope.start.settings.searchUrl);
    expect(scope.start.settings.fieldSpecStr).toBe('id apple');
    expect(localStorageSvc.get('fieldSpecStr')).toEqual(scope.start.settings.fieldSpecStr);

  });
});
