'use strict';

/**
 * Pure-JS Solr settings logic — no Angular dependency.
 *
 * Extracted from the Angular solrSettingsSvc (Phase 11b). The Angular
 * service file (solrSettingsSvc.js) is now a thin wrapper that delegates
 * to globalThis.SplainerServices.solrSettings.
 *
 * Both `fromStartUrl` and `fromTweakedSettings` accept `solrUrlSvc` and
 * `fieldSpecSvc` as leading parameters so this module has no dependency
 * on the Angular DI container. The Angular wrapper injects them and
 * passes them through.
 *
 * Exported functions mutate the `settings` object in place — same
 * contract as the original Angular service.
 */

function reconstructFullUrl(solrUrlSvc, fieldSpecSvc, userSettings) {
  var fieldSpec = fieldSpecSvc.createFieldSpec(userSettings.fieldSpecStr);
  var fl = null;
  if (fieldSpec.subs !== '*') {
    fl = [fieldSpec.title];
    fieldSpec.subs.forEach(function (subFieldName) {
      fl.push(subFieldName);
    });
    fl = [fl.join(' ')];
  }
  var parsedArgs = solrUrlSvc.parseSolrArgs(userSettings.searchArgsStr);
  if (fl !== null) {
    parsedArgs.fl = fl;
  }
  return solrUrlSvc.buildUrl(userSettings.searchUrl, parsedArgs);
}

function newlineSolrArgs(searchArgsStr) {
  return searchArgsStr.split('&').join('\n&');
}

function fromParsedUrl(solrUrlSvc, userSettings, parsedUrl, overrideFieldSpec) {
  var argsToUse = JSON.parse(JSON.stringify(parsedUrl.solrArgs));
  solrUrlSvc.removeUnsupported(argsToUse);
  userSettings.searchArgsStr = newlineSolrArgs(solrUrlSvc.formatSolrArgs(argsToUse));
  if (userSettings.searchArgsStr.trim().length === 0) {
    userSettings.searchArgsStr = 'q=*:*';
  }
  if (overrideFieldSpec) {
    userSettings.fieldSpecStr = overrideFieldSpec;
  } else if (Object.prototype.hasOwnProperty.call(parsedUrl.solrArgs, 'fl')) {
    var fl = parsedUrl.solrArgs.fl;
    userSettings.fieldSpecStr = fl[0];
  } else {
    userSettings.fieldSpecStr = 'title, *';
  }
  userSettings.searchUrl = parsedUrl.solrEndpoint();
}

/**
 * Create settings from a pasted-in user URL (from start screen).
 */
export function fromStartUrl(solrUrlSvc, fieldSpecSvc, newStartUrl, searchSettings, overrideFieldSpec) {
  searchSettings.whichEngine = 'solr';
  searchSettings.startUrl = newStartUrl;
  var parsedUrl = solrUrlSvc.parseSolrUrl(newStartUrl);
  if (parsedUrl !== null) {
    fromParsedUrl(solrUrlSvc, searchSettings, parsedUrl, overrideFieldSpec);
  }
  return searchSettings;
}

/**
 * Update/sanitize settings from user input when tweaking
 * (user updates Solr URL or search args, fields, etc).
 */
export function fromTweakedSettings(solrUrlSvc, fieldSpecSvc, searchSettings) {
  var parsedUrl = solrUrlSvc.parseSolrUrl(searchSettings.searchUrl);
  if (parsedUrl !== null && parsedUrl.solrArgs && Object.keys(parsedUrl.solrArgs).length > 0) {
    fromParsedUrl(solrUrlSvc, searchSettings, parsedUrl);
  }
  searchSettings.startUrl = reconstructFullUrl(solrUrlSvc, fieldSpecSvc, searchSettings);
  return searchSettings;
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerServices = globalThis.SplainerServices || {};
  globalThis.SplainerServices.solrSettings = { fromStartUrl, fromTweakedSettings };
}
