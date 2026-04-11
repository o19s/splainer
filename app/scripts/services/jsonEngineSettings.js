/**
 * Shared settings logic for JSON-based search engines (Elasticsearch, OpenSearch).
 *
 * Both engines parse URLs identically and differ only in the `whichEngine`
 * constant. This factory eliminates the duplication that previously existed
 * between esSettings.js and osSettings.js.
 *
 * Usage:
 *   import { createJsonEngineSettings } from './jsonEngineSettings.js';
 *   const { fromStartUrl, fromTweakedSettings } = createJsonEngineSettings('es');
 */

export function parseUrl(url) {
  var parser = document.createElement('a');
  parser.href = url;

  var uri = parser.protocol + '//';
  if (parser.username && parser.password) {
    uri += parser.username + ':' + parser.password + '@';
  }

  uri += parser.host + parser.pathname;
  var result = { url: uri };

  if (parser.search.length > 0) {
    var searchString = parser.search.slice(1);
    var queries = searchString.split('&');

    queries.forEach(function (query) {
      var nameAndValue = query.split(/=(.*)/);
      result[nameAndValue[0]] = decodeURIComponent(nameAndValue[1]);
    });
  }

  return result;
}

export function createJsonEngineSettings(engine) {
  function fromStartUrl(settings) {
    settings.whichEngine = engine;
    var parsedUrl = parseUrl(settings.startUrl);

    if (settings.searchArgsStr.trim().length === 0) {
      settings.searchArgsStr = '{ "match_all": {} }';
    }
    if (!(settings.fieldSpecStr && typeof settings.fieldSpecStr === 'string')) {
      if (parsedUrl.stored_fields !== undefined) {
        settings.fieldSpecStr = parsedUrl.stored_fields;
      } else {
        settings.fieldSpecStr = 'title, *';
      }
    }

    if (parsedUrl.stored_fields === undefined) {
      settings.startUrl = parsedUrl.url + '?stored_fields=' + settings.fieldSpecStr;
    }

    settings.searchUrl = parsedUrl.url;
  }

  function fromTweakedSettings(settings) {
    settings.startUrl = settings.searchUrl;

    if (settings.fieldSpecStr !== undefined && settings.fieldSpecStr.length > 0) {
      settings.startUrl += '?stored_fields=' + settings.fieldSpecStr;
    }
  }

  return { fromStartUrl, fromTweakedSettings };
}
