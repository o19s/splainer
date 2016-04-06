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
    expect(settings.solr.startUrl).toEqual('');
    expect(settings.solr.searchUrl).toEqual('');
    expect(settings.solr.fieldSpecStr).toEqual('');
    expect(settings.solr.searchArgsStr).toEqual('');
    expect(settings.whichEngine).toEqual('solr');
  });

  var testStartUrl = 'http://localhost:8983/solr?q=*:*';
  var testSearchUrl = 'http://localhost:8983/solr';
  var testFieldSpecStr = 'id:foo title:bar';
  var testWhichEngine = 'solr';
  var testSearchArgsStr = 'q=*:*';

  it('loads whats stored', function() {
    localStorageSvc.set('solr_startUrl', testStartUrl);
    localStorageSvc.set('solr_searchUrl', testSearchUrl);
    localStorageSvc.set('solr_fieldSpecStr', testFieldSpecStr);
    localStorageSvc.set('solr_searchArgsStr', '!' + testSearchArgsStr);
    localStorageSvc.set('whichEngine', testWhichEngine);
    setupSvc();
    var settings = settingsStoreSvc.settings;
    expect(settings.solr.startUrl).toEqual(testStartUrl);
    expect(settings.solr.searchUrl).toEqual(testSearchUrl);
    expect(settings.solr.fieldSpecStr).toEqual(testFieldSpecStr);
    expect(settings.solr.searchArgsStr).toEqual(testSearchArgsStr);
    expect(settings.whichEngine).toEqual(testWhichEngine);
  });

  it('saves updates', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    settings.solr.startUrl = testStartUrl;
    settings.solr.searchUrl = testSearchUrl;
    settings.solr.fieldSpecStr = testFieldSpecStr;
    settings.whichEngine = testWhichEngine;
    settings.solr.searchArgsStr = testSearchArgsStr;
    settingsStoreSvc.save();

    expect(localStorageSvc.get('solr_startUrl')).toEqual(testStartUrl);
    expect(localStorageSvc.get('solr_searchUrl')).toEqual(testSearchUrl);
    expect(localStorageSvc.get('solr_fieldSpecStr')).toEqual(testFieldSpecStr);
    expect(localStorageSvc.get('solr_searchArgsStr')).toEqual('!' + testSearchArgsStr);
    expect(localStorageSvc.get('whichEngine')).toEqual(testWhichEngine);
    expect(locationSvc.lastParams.solr).toEqual(testStartUrl);
  });

  it('navigates on updates', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    settings.solr.startUrl = testStartUrl;
    settings.solr.searchUrl = testSearchUrl;
    settings.solr.fieldSpecStr = testFieldSpecStr;
    settings.whichEngine = testWhichEngine;
    settings.solr.searchArgsStr = testSearchArgsStr;
    settingsStoreSvc.save();
    expect(locationSvc.lastParams.solr).toEqual(testStartUrl);
    expect(locationSvc.lastParams.fieldSpec).toEqual(testFieldSpecStr);
  });
});
