'use strict';

describe('Service: solrSettingsSvc', function () {

  // load the service's module
  beforeEach(module('splain-app'));

  var solrSettingsSvc = null;
  var solrUrlSvc = null;
  beforeEach(inject(function (_solrSettingsSvc_, _solrUrlSvc_) {
    solrSettingsSvc = _solrSettingsSvc_;
    solrUrlSvc = _solrUrlSvc_;
  }));

  var stubSettings = function() {
    return {
      startUrl: '',
      whichEngine: '',
      searchUrl: '',
      fieldSpecStr: '',
      searchArgsStr: ''
    };
  };

  it('parses start URL -> URL + args', function() {
    var settings = stubSettings();
    var startUrl = 'http://localhost:8983/solr/example?q=*:*&fl=title catch_line';
    solrSettingsSvc.fromStartUrl(startUrl, settings);
    expect(settings.searchUrl).toEqual('http://localhost:8983/solr/example');
    expect(settings.fieldSpecStr).toEqual('title catch_line');
    expect(settings.searchArgsStr).toEqual('q=*:*');
    expect(settings.whichEngine).toEqual('solr');
    expect(settings.startUrl).toEqual('http://localhost:8983/solr/example?q=*:*&fl=title catch_line');
  });

  it('uses default (*) fieldspec when no fl specified', function() {
    var settings = stubSettings();
    var startUrl = 'http://localhost:8983/solr/example?q=*:*';
    solrSettingsSvc.fromStartUrl(startUrl, settings);
    expect(settings.searchUrl).toEqual('http://localhost:8983/solr/example');
    expect(settings.fieldSpecStr).toEqual('title, *');
    expect(settings.searchArgsStr).toEqual('q=*:*');
    expect(settings.whichEngine).toEqual('solr');
    expect(settings.startUrl).toEqual('http://localhost:8983/solr/example?q=*:*');
  });

  it('uses start URL even with no args', function() {
    var settings = stubSettings();
    var startUrl = 'http://localhost:8983/solr/example';
    solrSettingsSvc.fromStartUrl(startUrl, settings);
    expect(settings.searchUrl).toEqual('http://localhost:8983/solr/example');
    expect(settings.fieldSpecStr).toEqual('title, *');
    expect(settings.searchArgsStr).toEqual('q=*:*');
    expect(settings.whichEngine).toEqual('solr');
    expect(settings.startUrl).toEqual('http://localhost:8983/solr/example');
  });

  it('updates start URL from args updates', function() {
    var settings = stubSettings();
    var startUrl = 'http://localhost:8983/solr/example?q=*:*&fl=title catch_line';
    solrSettingsSvc.fromStartUrl(startUrl, settings);

    settings.searchArgsStr = 'q=*:*\n&fq=blah';
    solrSettingsSvc.fromTweakedSettings(settings);

    expect(settings.startUrl.indexOf('blah')).not.toEqual(-1);
  });

  it('updates start URL from args updates, empty fl', function() {
    var settings = stubSettings();
    var startUrl = 'http://localhost:8983/solr/example?q=*:*';
    solrSettingsSvc.fromStartUrl(startUrl, settings);

    settings.searchArgsStr = 'q=*:*\n&fq=blah';
    solrSettingsSvc.fromTweakedSettings(settings);

    expect(settings.startUrl.indexOf('blah')).not.toEqual(-1);
    expect(settings.startUrl.indexOf('fl')).toEqual(-1);
    console.log(settings.startUrl);
  });

  it('adds newlines to ampersands from startUrl', function() {
    var settings = stubSettings();
    var startUrl = 'http://localhost:8983/solr/example?q=*:*&fq=cat:meow&fl=title catch_line';
    solrSettingsSvc.fromStartUrl(startUrl, settings);
    expect(settings.searchUrl).toEqual('http://localhost:8983/solr/example');
    expect(settings.fieldSpecStr).toEqual('title catch_line');
    expect(settings.searchArgsStr).toEqual('q=*:*\n&fq=cat:meow');
    expect(settings.whichEngine).toEqual('solr');
    expect(settings.startUrl).toEqual('http://localhost:8983/solr/example?q=*:*&fq=cat:meow&fl=title catch_line');
  });

  it('updates start URL with only title & sub field', function() {
    var settings = stubSettings();
    settings.searchUrl = 'http://localhost:8983/solr/example';
    settings.fieldSpecStr = 'title sub1 sub2';
    solrSettingsSvc.fromTweakedSettings(settings);
    var startArgs = solrUrlSvc.parseSolrUrl(settings.startUrl).solrArgs;
    expect(startArgs.fl).toEqual(['title sub1 sub2']);
  });

  describe('startURL with fieldSpec', function() {
    it('fieldSpec no fl', function() {
      var settings = stubSettings();
      var startUrl = 'http://localhost:8983/solr/example?q=*:*&fq=cat:meow';
      var fieldSpec = 'id:banana f:happy';
      solrSettingsSvc.fromStartUrl(startUrl, settings, fieldSpec);
      expect(settings.fieldSpecStr).toEqual(fieldSpec);
      expect(settings.searchUrl).toEqual('http://localhost:8983/solr/example');
      expect(settings.searchArgsStr).toEqual('q=*:*\n&fq=cat:meow');
    });

    it('fieldSpec overrides fl', function() {
      var settings = stubSettings();
      var startUrl = 'http://localhost:8983/solr/example?q=*:*&fq=cat:meow&fl=title catch_line';
      var fieldSpec = 'id:banana f:happy';
      solrSettingsSvc.fromStartUrl(startUrl, settings, fieldSpec);
      expect(settings.searchUrl).toEqual('http://localhost:8983/solr/example');
      expect(settings.fieldSpecStr).toEqual(fieldSpec);
      expect(settings.searchArgsStr).toEqual('q=*:*\n&fq=cat:meow');
    });
  });

});
