'use strict';

describe('Service: esSettingsSvc', function () {

  // load the service's module
  beforeEach(module('splain-app'));

  var esSettingsSvc;

  beforeEach(inject(function (_esSettingsSvc_) {
    esSettingsSvc = _esSettingsSvc_;
  }));

  var stubSettings = function() {
    return {
      startUrl:       '',
      whichEngine:    '',
      searchUrl:      '',
      fieldSpecStr:   '',
      searchArgsStr:  ''
    };
  };

  it('parses start URL -> URL + args', function() {
    var settings = stubSettings();
    settings.startUrl = 'http://localhost:9200/statedecoded/_search?stored_fields=title catch_line';
    esSettingsSvc.fromStartUrl(settings);

    expect(settings.searchUrl).toEqual('http://localhost:9200/statedecoded/_search');
    expect(settings.fieldSpecStr).toEqual('title catch_line');
    expect(settings.searchArgsStr).toEqual('{ "match_all": {} }');
    expect(settings.whichEngine).toEqual('es');
  });

  it('uses default (*) fieldspec when no fields specified', function() {
    var settings = stubSettings();
    settings.startUrl = 'http://localhost:9200/statedecoded/_search';
    esSettingsSvc.fromStartUrl(settings);

    expect(settings.searchUrl).toEqual('http://localhost:9200/statedecoded/_search');
    expect(settings.fieldSpecStr).toEqual('title, *');
    expect(settings.searchArgsStr).toEqual('{ "match_all": {} }');
    expect(settings.whichEngine).toEqual('es');
  });

  it('uses the args string if set', function() {
    var settings = stubSettings();
    settings.startUrl = 'http://localhost:9200/statedecoded/_search';
    settings.searchArgsStr = '{ "query": { "match": { "_all": "deer" } } }';
    esSettingsSvc.fromStartUrl(settings);

    expect(settings.searchUrl).toEqual('http://localhost:9200/statedecoded/_search');
    expect(settings.fieldSpecStr).toEqual('title, *');
    expect(settings.searchArgsStr).toEqual('{ "query": { "match": { "_all": "deer" } } }');
    expect(settings.whichEngine).toEqual('es');
  });

  it('updates start URL from args updates', function() {
    var settings = stubSettings();
    settings.startUrl = 'http://localhost:9200/statedecoded/_search?stored_fields=title catch_line';
    esSettingsSvc.fromStartUrl(settings);

    settings.fieldSpecStr = 'catch_line';
    esSettingsSvc.fromTweakedSettings(settings);

    expect(settings.startUrl.indexOf('title')).toEqual(-1);
  });
});
