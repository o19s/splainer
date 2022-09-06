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
    expect(settings.es.startUrl).toEqual('');
    expect(settings.es.searchUrl).toEqual('');
    expect(settings.es.fieldSpecStr).toEqual('');
    expect(settings.es.searchArgsStr.indexOf('{')).toBeGreaterThan(-1);
    expect(settings.whichEngine).toEqual('solr');
  });

  it('initializes es query params to valid JSON', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    // if this throws, test fails which is what we expect
    JSON.parse(settings.es.searchArgsStr);
  });

  var testSolrStartUrl = 'http://localhost:8983/solr?q=*:*';
  var testSolrSearchUrl = 'http://localhost:8983/solr';
  var testSolrFielgcldSpecStr = 'id:foo title:bar';
  var testWhichEngine = 'solr';
  var testSolrSearchArgsStr = 'q=*:*';

  it('loads whats stored', function() {
    localStorageSvc.set('solr_startUrl', testSolrStartUrl);
    localStorageSvc.set('solr_searchUrl', testSolrSearchUrl);
    localStorageSvc.set('solr_fieldSpecStr', testSolrFielgcldSpecStr);
    localStorageSvc.set('solr_searchArgsStr', '!' + testSolrSearchArgsStr);
    localStorageSvc.set('whichEngine', testWhichEngine);
    setupSvc();
    var settings = settingsStoreSvc.settings;
    expect(settings.solr.startUrl).toEqual(testSolrStartUrl);
    expect(settings.solr.searchUrl).toEqual(testSolrSearchUrl);
    expect(settings.solr.fieldSpecStr).toEqual(testSolrFielgcldSpecStr);
    expect(settings.solr.searchArgsStr).toEqual(testSolrSearchArgsStr);
    expect(settings.whichEngine).toEqual(testWhichEngine);
  });

  it('saves updates', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    settings.solr.startUrl = testSolrStartUrl;
    settings.solr.searchUrl = testSolrSearchUrl;
    settings.solr.fieldSpecStr = testSolrFielgcldSpecStr;
    settings.whichEngine = testWhichEngine;
    settings.solr.searchArgsStr = testSolrSearchArgsStr;
    settingsStoreSvc.save();

    expect(localStorageSvc.get('solr_startUrl')).toEqual(testSolrStartUrl);
    expect(localStorageSvc.get('solr_searchUrl')).toEqual(testSolrSearchUrl);
    expect(localStorageSvc.get('solr_fieldSpecStr')).toEqual(testSolrFielgcldSpecStr);
    expect(localStorageSvc.get('solr_searchArgsStr')).toEqual('!' + testSolrSearchArgsStr);
    expect(localStorageSvc.get('whichEngine')).toEqual(testWhichEngine);
    expect(locationSvc.lastParams.solr).toEqual(testSolrStartUrl);
  });

  it('navigates on updates', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    settings.solr.startUrl = testSolrStartUrl;
    settings.solr.searchUrl = testSolrSearchUrl;
    settings.solr.fieldSpecStr = testSolrFielgcldSpecStr;
    settings.whichEngine = testWhichEngine;
    settings.solr.searchArgsStr = testSolrSearchArgsStr;
    settingsStoreSvc.save();
    expect(locationSvc.lastParams.solr).toEqual(testSolrStartUrl);
    expect(locationSvc.lastParams.fieldSpec).toEqual(testSolrFielgcldSpecStr);
  });

  var testEsStartUrl = 'http://localhost:9200/tmdb/_search';
  var testEsFieldSpecStr = testSolrFielgcldSpecStr;
  var testSearchArgsStr = '{"_match": "_all"}';

  it('navigates on es updates', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    settings.es.startUrl = testEsStartUrl;
    settings.es.searchUrl = testEsStartUrl;
    settings.es.fieldSpecStr = testEsFieldSpecStr;
    settings.whichEngine = 'es';
    settings.es.searchArgsStr = testSearchArgsStr;
    settingsStoreSvc.save();
    expect(locationSvc.lastParams.esUrl).toEqual(testEsStartUrl);
    expect(locationSvc.lastParams.esQuery).toEqual(testSearchArgsStr);
    expect(locationSvc.lastParams.fieldSpec).toEqual(testEsFieldSpecStr);

  });

  var testOsStartUrl = 'http://localhost:9200/tmdb/_search';
  var testOsFieldSpecStr = '*';
  var testOsSearchArgsStr = '{"_match": "_all"}';

  it('navigates on opensearch updates', function() {
    setupSvc();
    var settings = settingsStoreSvc.settings;
    settings.os.startUrl = testOsStartUrl;
    settings.os.searchUrl = testOsStartUrl;
    settings.os.fieldSpecStr = testOsFieldSpecStr;
    settings.whichEngine = 'os';
    settings.os.searchArgsStr = testOsSearchArgsStr;
    settingsStoreSvc.save();
    expect(locationSvc.lastParams.osUrl).toEqual(testOsStartUrl);
    expect(locationSvc.lastParams.osQuery).toEqual(testOsSearchArgsStr);
    expect(locationSvc.lastParams.fieldSpec).toEqual(testOsFieldSpecStr);

  });
});
