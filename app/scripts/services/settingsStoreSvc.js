'use strict';

angular.module('splain-app')
  .service('settingsStoreSvc', function settingsStoreSvc(localStorageService, $location) {

    this.ENGINES = {};
    // these need to be angular values
    this.ENGINES.SOLR = 'solr';
    this.ENGINES.ELASTICSEARCH = 'es';

    // Next is Local Storage
    var initSearchArgs = function() {
      var searchSettings = {searchUrl: '', fieldSpecStr: '', searchArgsStr: ''};
      var localStorageTryGet = function(key) {
        var val;
        try {
          val = localStorageService.get(key);
        } catch (SyntaxError) {
          val = null;
        }

        if (val !== null) {
          searchSettings[key] = val;
        } else {
          searchSettings[key] = '';
        }
      };
      if (localStorageService.isSupported) {
        localStorageTryGet('searchUrl');
        localStorageTryGet('startUrl');
        localStorageTryGet('fieldSpecStr');
        localStorageTryGet('searchArgsStr');
        localStorageTryGet('whichEngine');
      }
      searchSettings.searchArgsStr = searchSettings.searchArgsStr.slice(1);
      return searchSettings;
    };

    var trySaveSolrArgs= function(searchSettings) {
      if (localStorageService.isSupported) {
        localStorageService.set('startUrl', searchSettings.startUrl);
        localStorageService.set('searchUrl', searchSettings.searchUrl);
        localStorageService.set('fieldSpecStr', searchSettings.fieldSpecStr);
        localStorageService.set('searchArgsStr', '!' + searchSettings.searchArgsStr);
        localStorageService.set('whichEngine', searchSettings.whichEngine);
      }
      if (searchSettings.whichEngine === 'solr') {
        $location.search({'solr':  searchSettings.startUrl, 'fieldSpec': searchSettings.fieldSpecStr});
      } else {
        $location.search({'esUrl':  searchSettings.searchUrl,
                          'esQuery': searchSettings.searchArgsStr});

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
