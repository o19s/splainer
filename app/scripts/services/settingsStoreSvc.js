'use strict';

angular.module('splain-app')
  .service('settingsStoreSvc', function settingsStoreSvc(localStorageService, $location) {

    this.ENGINES = {};
    // these need to be angular values
    this.ENGINES.SOLR = 'solr';
    this.ENGINES.ELASTICSEARCH = 'es';
    this.ENGINES.OPENSEARCH = 'os';

    var defaultEsArgs = '!{\n' +
                        '  "query": {\n' +
                        '    "match_all": {}\n' +
                        '  }\n' +
                        '}    ';

    // Next is Local Storage
    var initSearchArgs = function() {
      var searchSettings = {
        solr: {
          customHeaders: '',
          headerType: 'None',
          searchUrl: '',
          fieldSpecStr: '',
          searchArgsStr: '',
          whichEngine: 'solr'
        },
        es: {
          customHeaders: '',
          headerType: 'Custom',
          searchUrl: '',
          fieldSpecStr: '',
          searchArgsStr: defaultEsArgs,
          whichEngine: 'es'
        },
        os: {
          customHeaders: '',
          headerType: 'None',
          searchUrl: '',
          fieldSpecStr: '',
          searchArgsStr: defaultEsArgs,
          whichEngine: 'os'
        },
        whichEngine: 'solr', // which engine was the last used
        searchUrl: function() {
          return this[this.whichEngine].searchUrl;
        },
        fieldSpecStr: function() {
          return this[this.whichEngine].fieldSpecStr;
        },
        searchArgsStr: function() {
          return this[this.whichEngine].searchArgsStr;
        }
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
        localStorageTryGet('customHeaders', 'solr');
        localStorageTryGet('searchUrl', 'solr');
        localStorageTryGet('startUrl', 'solr');
        localStorageTryGet('fieldSpecStr', 'solr');
        localStorageTryGet('searchArgsStr', 'solr');

        localStorageTryGet('customHeaders', 'es');
        localStorageTryGet('searchUrl', 'es');
        localStorageTryGet('startUrl', 'es');
        localStorageTryGet('fieldSpecStr', 'es');
        localStorageTryGet('searchArgsStr', 'es', defaultEsArgs);

        localStorageTryGet('customHeaders', 'os');
        localStorageTryGet('searchUrl', 'os');
        localStorageTryGet('startUrl', 'os');
        localStorageTryGet('fieldSpecStr', 'os');
        localStorageTryGet('searchArgsStr', 'os', defaultEsArgs);

        localStorageTryGet('whichEngine');

        if (!searchSettings.whichEngine) {
          searchSettings.whichEngine = 'solr';
        }
      }
      searchSettings.solr.searchArgsStr = searchSettings.solr.searchArgsStr.slice(1);
      searchSettings.es.searchArgsStr = searchSettings.es.searchArgsStr.slice(1);
      searchSettings.os.searchArgsStr = searchSettings.os.searchArgsStr.slice(1);
      return searchSettings;
    };

    var trySaveArgs= function(searchSettings) {
      if (localStorageService.isSupported) {
        localStorageService.set('solr_customHeaders', searchSettings.solr.customHeaders);
        localStorageService.set('solr_startUrl', searchSettings.solr.startUrl);
        localStorageService.set('solr_searchUrl', searchSettings.solr.searchUrl);
        localStorageService.set('solr_fieldSpecStr', searchSettings.solr.fieldSpecStr);
        localStorageService.set('solr_searchArgsStr', '!' + searchSettings.solr.searchArgsStr);

        localStorageService.set('es_customHeaders', searchSettings.es.customHeaders);
        localStorageService.set('es_startUrl', searchSettings.es.startUrl);
        localStorageService.set('es_searchUrl', searchSettings.es.searchUrl);
        localStorageService.set('es_fieldSpecStr', searchSettings.es.fieldSpecStr);
        localStorageService.set('es_searchArgsStr', '!' + searchSettings.es.searchArgsStr);

        localStorageService.set('os_customHeaders', searchSettings.os.customHeaders);
        localStorageService.set('os_startUrl', searchSettings.os.startUrl);
        localStorageService.set('os_searchUrl', searchSettings.os.searchUrl);
        localStorageService.set('os_fieldSpecStr', searchSettings.os.fieldSpecStr);
        localStorageService.set('os_searchArgsStr', '!' + searchSettings.os.searchArgsStr);

        localStorageService.set('whichEngine', searchSettings.whichEngine);
      }
      if (searchSettings.whichEngine === 'solr') {
        $location.search({'solr':  searchSettings.solr.startUrl, 'fieldSpec': searchSettings.solr.fieldSpecStr});
      } else if (searchSettings.whichEngine === 'es') {
        $location.search({'esUrl':  searchSettings.es.searchUrl,
                          'esQuery': searchSettings.es.searchArgsStr,
                          'fieldSpec': searchSettings.es.fieldSpecStr});
      } else if (searchSettings.whichEngine === 'os') {
        $location.search({'osUrl':  searchSettings.os.searchUrl,
                          'osQuery': searchSettings.os.searchArgsStr,
                          'fieldSpec': searchSettings.os.fieldSpecStr});
      }
    };

    // init from local storage if there
    this.settings = initSearchArgs();

    /*
     * save changes to settings
     * */
    this.save = function() {
      trySaveArgs(this.settings);
    };

  });
