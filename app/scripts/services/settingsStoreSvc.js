'use strict';

angular.module('splain-app')
  .service('settingsStoreSvc', function settingsStoreSvc(localStorageService, $location) {

    this.ENGINES = {};
    // these need to be angular values
    this.ENGINES.SOLR = 'solr';
    this.ENGINES.ELASTICSEARCH = 'es';

    var defaultEsArgs = '!{\n' +
                        '  "query": {\n' +
                        '    "match_all": {}\n' +
                        '  }\n' +
                        '}    ';

    // Next is Local Storage
    var initSearchArgs = function() {
      var searchSettings = {solr:  {searchUrl: '', fieldSpecStr: '', searchArgsStr: '', whichEngine: 'solr'},
                            es: {searchUrl: '', fieldSpecStr: '', searchArgsStr: defaultEsArgs, whichEngine: 'es'},
                            whichEngine: 'solr', // which engine was the last used

                            searchUrl: function() {
                              return this[this.whichEngine].searchUrl;
                            },

                            fieldSpecStr: function() {
                              return this[this.whichEngine].fieldSpecStr;
                            },

                            searchArgsStr: function() {
                              return this[this.whichEngine].searchArgsStr;
                            },

                            };
      var localStorageTryGet = function(key, engine, def) {
        var val;
        var prefix = '';
        var settings = searchSettings;
        if (!def) {
          def = '';
        }
        if (engine) {
          settings = searchSettings[engine];
          prefix = engine + '_';
        }
        try {
          val = localStorageService.get(prefix + key);
        } catch (SyntaxError) {
          val = null;
        }

        if (val !== null) {
          settings[key] = val;
        } else {
          settings[key] = def;
        }
      };
      if (localStorageService.isSupported) {
        localStorageTryGet('searchUrl', 'solr');
        localStorageTryGet('startUrl', 'solr');
        localStorageTryGet('fieldSpecStr', 'solr');
        localStorageTryGet('searchArgsStr', 'solr');
        localStorageTryGet('searchUrl', 'es');
        localStorageTryGet('startUrl', 'es');
        localStorageTryGet('fieldSpecStr', 'es');
        localStorageTryGet('searchArgsStr', 'es', defaultEsArgs);
        localStorageTryGet('whichEngine');
        if (!searchSettings.whichEngine) {
          searchSettings.whichEngine = 'solr';
        }
      }
      searchSettings.solr.searchArgsStr = searchSettings.solr.searchArgsStr.slice(1);
      searchSettings.es.searchArgsStr = searchSettings.es.searchArgsStr.slice(1);
      return searchSettings;
    };

    var trySaveSolrArgs= function(searchSettings) {
      if (localStorageService.isSupported) {
        localStorageService.set('solr_startUrl', searchSettings.solr.startUrl);
        localStorageService.set('solr_searchUrl', searchSettings.solr.searchUrl);
        localStorageService.set('solr_fieldSpecStr', searchSettings.solr.fieldSpecStr);
        localStorageService.set('solr_searchArgsStr', '!' + searchSettings.solr.searchArgsStr);
        localStorageService.set('es_startUrl', searchSettings.es.startUrl);
        localStorageService.set('es_searchUrl', searchSettings.es.searchUrl);
        localStorageService.set('es_fieldSpecStr', searchSettings.es.fieldSpecStr);
        localStorageService.set('es_searchArgsStr', '!' + searchSettings.es.searchArgsStr);
        localStorageService.set('whichEngine', searchSettings.whichEngine);
      }
      if (searchSettings.whichEngine === 'solr') {
        $location.search({'solr':  searchSettings.solr.startUrl, 'fieldSpec': searchSettings.solr.fieldSpecStr});
      } else {
        $location.search({'esUrl':  searchSettings.es.searchUrl,
                          'esQuery': searchSettings.es.searchArgsStr,
                          'fieldSpec': searchSettings.es.fieldSpecStr});

      }
    };

    // init from local storage if there
    this.settings = initSearchArgs();

    /*
     * save changes to settings
     * */
    this.save = function() {
      trySaveSolrArgs(this.settings);
    };

  });
