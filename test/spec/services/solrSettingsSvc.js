'use strict';

describe('Service: solrSettingsSvc', function () {

  // load the service's module
  beforeEach(module('splain-app'));
  
  var solrSettingsSvc = null;
  beforeEach(inject(function (_solrSettingsSvc_) {
    solrSettingsSvc = _solrSettingsSvc_;
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
    expect(settings.whichEngine).toEqual(0);
    expect(settings.startUrl).toEqual('http://localhost:8983/solr/example?q=*:*&fl=title catch_line');
  });
  
  it('updates start URL from args updates', function() {
    var settings = stubSettings();
    var startUrl = 'http://localhost:8983/solr/example?q=*:*&fl=title catch_line';
    solrSettingsSvc.fromStartUrl(startUrl, settings);

    settings.searchArgsStr = 'q=*:*&fq=blah';
    solrSettingsSvc.fromTweakedSettings(settings);

    console.log(settings.startUrl);
    expect(settings.startUrl.indexOf('blah')).not.toEqual(-1);
  });
});
