'use strict';

/**
 * Pure-JS Elasticsearch settings logic — no Angular dependency.
 *
 * Extracted from the Angular esSettingsSvc (Phase 11a). The Angular
 * service file (esSettingsSvc.js) is now a thin wrapper that delegates
 * to globalThis.SplainerServices.esSettings.
 *
 * Exported functions mutate the `settings` object in place — same
 * contract as the original Angular service.
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
  settings.whichEngine = 'es';
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
  globalThis.SplainerServices.esSettings = { fromStartUrl, fromTweakedSettings };
}
