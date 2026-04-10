'use strict';

/**
 * Pure-JS OpenSearch settings logic — no Angular dependency.
 *
 * Extracted from the Angular osSettingsSvc (Phase 11a). Near-identical
 * to esSettings.js (the only difference is whichEngine = 'os').
 *
 * Exported functions mutate the `settings` object in place.
 */

function parseUrl(url) {
  var parser = document.createElement('a');
  parser.href = url;

  var uri = parser.protocol + '//';
  if (parser.username && parser.password) {
    uri += parser.username + ':' + parser.password + '@';
  }

  uri += parser.host + parser.pathname;
  var result = { url: uri };

  if (parser.search.length > 0) {
    var searchString = parser.search.substr(1);
    var queries = searchString.split('&');

    queries.forEach(function (query) {
      var nameAndValue = query.split(/=(.*)/);
      result[nameAndValue[0]] = decodeURIComponent(nameAndValue[1]);
    });
  }

  return result;
}

export function fromStartUrl(settings) {
  settings.whichEngine = 'os';
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

export function fromTweakedSettings(settings) {
  settings.startUrl = settings.searchUrl;

  if (settings.fieldSpecStr !== undefined && settings.fieldSpecStr.length > 0) {
    settings.startUrl += '?stored_fields=' + settings.fieldSpecStr;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerServices = globalThis.SplainerServices || {};
  globalThis.SplainerServices.osSettings = { fromStartUrl, fromTweakedSettings };
}
