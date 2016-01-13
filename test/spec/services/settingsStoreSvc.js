'use strict';

describe('Service: settingsStoreSvc', function () {

  // load the service's module
  beforeEach(module('splain-app'));

  var settingsStoreSvc = null;
  var localStorageSvc = null;
  var locationSvc = null;

  var setupSvc = null;

  beforeEach(function() {

    /* global MockLocalStorageService*/
    /* global MockLocationSvc*/
    localStorageSvc = new MockLocalStorageService();
    locationSvc = new MockLocationSvc();

    module(function($provide) {
      $provide.value('localStorageService', localStorageSvc);
      $provide.value('$location', locationSvc);
    });

    setupSvc = function() {
      inject(function (_settingsStoreSvc_) {
        settingsStoreSvc = _settingsStoreSvc_;
      });
    };
  });

  beforeEach(function() {
    localStorageSvc.reset();
  });

  it('initializes from nothing', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    expect(settings.startUrl).toEqual('');
    expect(settings.searchUrl).toEqual('');
    expect(settings.fieldSpecStr).toEqual('');
    expect(settings.searchArgsStr).toEqual('');
    expect(settings.whichEngine).toEqual('');
  });

  var testStartUrl = 'http://localhost:8983/solr?q=*:*';
  var testSearchUrl = 'http://localhost:8983/solr';
  var testFieldSpecStr = 'id:foo title:bar';
  var testWhichEngine = 0;
  var testSearchArgsStr = 'q=*:*';

  it('loads whats stored', function() {
    localStorageSvc.set('startUrl', testStartUrl);
    localStorageSvc.set('searchUrl', testSearchUrl);
    localStorageSvc.set('fieldSpecStr', testFieldSpecStr);
    localStorageSvc.set('searchArgsStr', '!' + testSearchArgsStr);
    localStorageSvc.set('whichEngine', testWhichEngine);
    setupSvc();
    var settings = settingsStoreSvc.settings;
    expect(settings.startUrl).toEqual(testStartUrl);
    expect(settings.searchUrl).toEqual(testSearchUrl);
    expect(settings.fieldSpecStr).toEqual(testFieldSpecStr);
    expect(settings.searchArgsStr).toEqual(testSearchArgsStr);
    expect(settings.whichEngine).toEqual(testWhichEngine);
  });

  it('saves updates', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    settings.startUrl = testStartUrl;
    settings.searchUrl = testSearchUrl;
    settings.fieldSpecStr = testFieldSpecStr;
    settings.whichEngine = testWhichEngine;
    settings.searchArgsStr = testSearchArgsStr;
    settingsStoreSvc.save();

    expect(localStorageSvc.get('startUrl')).toEqual(testStartUrl);
    expect(localStorageSvc.get('searchUrl')).toEqual(testSearchUrl);
    expect(localStorageSvc.get('fieldSpecStr')).toEqual(testFieldSpecStr);
    expect(localStorageSvc.get('searchArgsStr')).toEqual('!' + testSearchArgsStr);
    expect(localStorageSvc.get('whichEngine')).toEqual(testWhichEngine);
  });

  it('navigates on updates', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    settings.startUrl = testStartUrl;
    settings.searchUrl = testSearchUrl;
    settings.fieldSpecStr = testFieldSpecStr;
    settings.whichEngine = testWhichEngine;
    settings.searchArgsStr = testSearchArgsStr;
    settingsStoreSvc.save();
    expect(locationSvc.lastParams.solr).toEqual(testStartUrl);
    expect(locationSvc.lastParams.fieldSpec).toEqual(testFieldSpecStr);
  });

});
