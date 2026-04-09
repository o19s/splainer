'use strict';

angular.module('splain-app').service('osSettingsSvc', [
  function osSettingsSvc() {
    var self = this;

    // Function
    self.fromStartUrl = fromStartUrl;
    self.fromTweakedSettings = fromTweakedSettings;

    var parseUrl = function (url) {
      var parser = document.createElement('a');
      parser.href = url;

      var uri = parser.protocol + '//';
      if (parser.username && parser.password) {
        uri += parser.username + ':' + parser.password + '@';
      }

      uri += parser.host + parser.pathname;
      var result = {
        url: uri,
      };

      if (parser.search.length > 0) {
        var searchString = parser.search.substr(1);
        var queries = searchString.split('&');

        angular.forEach(queries, function (query) {
          var nameAndValue = query.split(/=(.*)/);
          result[nameAndValue[0]] = decodeURIComponent(nameAndValue[1]);
        });
      }

      return result;
    };

    function fromStartUrl(settings) {
      settings.whichEngine = 'os';
      var parsedUrl = parseUrl(settings.startUrl);

      if (settings.searchArgsStr.trim().length === 0) {
        settings.searchArgsStr = '{ "match_all": {} }';
      }
      // Keep a user-provided string; otherwise take stored_fields from the URL or default.
      if (!(settings.fieldSpecStr && angular.isString(settings.fieldSpecStr))) {
        if (angular.isDefined(parsedUrl.stored_fields)) {
          settings.fieldSpecStr = parsedUrl.stored_fields;
        } else {
          settings.fieldSpecStr = 'title, *';
        }
      }

      if (!angular.isDefined(parsedUrl.stored_fields)) {
        settings.startUrl = parsedUrl.url + '?stored_fields=' + settings.fieldSpecStr;
      }

      settings.searchUrl = parsedUrl.url;
    }

    function fromTweakedSettings(settings) {
      settings.startUrl = settings.searchUrl;

      if (angular.isDefined(settings.fieldSpecStr) && settings.fieldSpecStr.length > 0) {
        settings.startUrl += '?stored_fields=' + settings.fieldSpecStr;
      }
    }
  },
]);
