'use strict';

angular.module('splain-app')
  .service('esSettingsSvc', [
    function esSettingsSvc() {
      var self = this;

      // Function
      self.fromStartUrl         = fromStartUrl;
      self.fromTweakedSettings  = fromTweakedSettings;

      var parseUrl = function(url) {
        var parser  = document.createElement('a');
        parser.href = url;

        var uri = parser.protocol + '//' + parser.host + parser.pathname;
        var result = {
          url: uri
        };

        if ( parser.search.length > 0 ) {
          var searchString = parser.search.substr(1);
          var queries = searchString.split('&');

          angular.forEach(queries, function(query) {
            var nameAndValue = query.split(/=(.*)/);
            result[nameAndValue[0]] = decodeURIComponent(nameAndValue[1]);
          });
        }

        return result;
      };

      function fromStartUrl(settings) {
        settings.whichEngine = 'es';
        var parsedUrl = parseUrl(settings.startUrl);

        if (settings.searchArgsStr.trim().length === 0) {
          settings.searchArgsStr = '{ "match_all": {} }';
        }
        if (settings.fieldSpecStr && angular.isString(settings.fieldSpecStr)) {
          settings.fieldSpecStr = settings.fieldSpecStr;
        } else if ( angular.isDefined(parsedUrl.fields) ) {
          settings.fieldSpecStr = parsedUrl.fields;
        }
        else {
          settings.fieldSpecStr = '*';
        }

        settings.searchUrl = parsedUrl.url;
      }

      function fromTweakedSettings (settings) {
        settings.startUrl = settings.searchUrl;

        if ( angular.isDefined(settings.fieldSpecStr) && settings.fieldSpecStr.length > 0) {
          settings.startUrl += '?fields=' + settings.fieldSpecStr;
        }
      }
    }
  ]);
