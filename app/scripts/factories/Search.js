'use strict';

angular.module('splain-app')
  .factory('Search', [
    '$q',
    'solrUrlSvc',
    'fieldSpecSvc',
    'searchSvc',
    'normalDocsSvc',
    function (
      $q,
      solrUrlSvc,
      fieldSpecSvc,
      searchSvc,
      normalDocsSvc
    ) {
      var Search = function(searchSettings, overridingExplains, states, engines) {
        var self = this;

        // Attributes
        self.searcher = null;

        // Functions
        self.reset                = reset;
        self.hasGroup             = hasGroup;
        self.moreResults          = moreResults;
        self.getOverridingExplain = getOverridingExplain;
        self.search               = search;
        self.page                 = page;

        // This logic I think is an old artifact, and doesn't matter,
        // but tests need updating.
        if (searchSettings.hasOwnProperty('whichEngine')) {
          self.engine               = searchSettings.whichEngine;
        } else {
          self.engine = 'solr';
        }

        // Bootstrap
        self.reset();

        var createSearcher = function(fieldSpec, parsedArgs, searchSettings) {
          var activeSettings = searchSettings[searchSettings.whichEngine];

          if (searchSettings.whichEngine === engines.ELASTICSEARCH) {
            try {
              parsedArgs = angular.fromJson(searchSettings.es.searchArgsStr);
            } catch (SyntaxError) {
              parsedArgs = '';
              console.error(SyntaxError);
            }
          } else if (searchSettings.whichEngine === engines.OPENSEARCH) {
            try {
              parsedArgs = angular.fromJson(searchSettings.os.searchArgsStr);
            } catch (SyntaxError) {
              parsedArgs = '';
              console.error(SyntaxError);
            }
          } else {
            parsedArgs = solrUrlSvc.parseSolrArgs(searchSettings.solr.searchArgsStr);
          }

          return searchSvc.createSearcher(
            fieldSpec,
            searchSettings.searchUrl(),
            parsedArgs,
            '',
            {
              customHeaders: activeSettings.customHeaders
            },
            searchSettings.whichEngine
          );
        };

        var groupedResultToNormalDocs = function(fieldSpec, groupedByResp) {
          angular.forEach(groupedByResp, function(groupedBys) {
            angular.forEach(groupedBys, function(group) {
              for (var i = 0; i < group.docs.length; i++) {
                group.docs[i] = normalDocsSvc.createNormalDoc(fieldSpec, group.docs[i]);
              }
            });
          });
        };

        function reset() {
          self.displayedResults   = 0;
          self.numFound           = 0;
          self.docs               = [];
          self.grouped            = {};
          self.maxScore           = 0.0;
          self.linkUrl            = '#';
          self.settings           = {searchArgsStr: function() {return '';}};
          self.paging             = false;
          self.state              = states.NO_SEARCH;
          self.overridingExplains = {};
          self.errorMsg           = '';

          if (overridingExplains) {
            // we might not be explaining this search, but being used
            // in conjunction with explainOther
            self.overridingExplains = overridingExplains;
          }
        }

        function hasGroup() {
          return Object.keys(self.grouped).length > 0;
        }

        function moreResults() {
          return (self.displayedResults < self.numFound);
        }

        function getOverridingExplain(doc, fieldSpec) {
          var idFieldName = fieldSpec.id;
          var id          = doc[idFieldName];

          if (id && self.overridingExplains.hasOwnProperty(id)) {
            return self.overridingExplains[id];
          }
          return null;
        }

        function search() {
          var deferred    = $q.defer();
          var fieldSpec   = fieldSpecSvc.createFieldSpec(searchSettings.fieldSpecStr());
          var parsedArgs  = null;

          self.searcher = createSearcher(fieldSpec, parsedArgs, searchSettings);
          self.reset();
          self.state    = states.WAITING_FOR_SEARCH;
          self.errorMsg = '';
          self.settings = angular.copy(searchSettings);

          self.searcher.search()
            .then(function success() {
              self.linkUrl  = self.searcher.linkUrl;
              self.numFound = self.searcher.numFound;

              angular.forEach(self.searcher.docs, function(doc) {
                var overridingExpl  = self.getOverridingExplain(doc, fieldSpec);
                var normalDoc       = normalDocsSvc.createNormalDoc(fieldSpec, doc, overridingExpl);

                if (normalDoc.score() > self.maxScore) {
                  self.maxScore = normalDoc.score();
                  console.log('new max score' + self.maxScore);
                }

                self.docs.push(normalDoc);
                self.displayedResults++;
              });

              self.grouped = angular.copy(self.searcher.grouped);
              groupedResultToNormalDocs(fieldSpec, self.grouped);

              self.state = states.DID_SEARCH;
              deferred.resolve();
            }, function searchFailure(msg) {
              self.state    = states.IN_ERROR;
              self.linkUrl  = self.searcher.linkUrl;
              self.errorMsg = msg.searchError;
              deferred.resolve(); // TODO: Should be reject here but something else is expecting happy days upstream
            });

          return deferred.promise;
        }

        function page() {
          var deferred = $q.defer();

          if (self.searcher === null) {
            return;
          }

          var fieldSpec = fieldSpecSvc.createFieldSpec(searchSettings.fieldSpecStr());
          self.searcher = self.searcher.pager();

          if (self.searcher) {
            self.paging = true;

            self.searcher.search()
              .then(function() {
                self.paging = false;

                if (self.searcher.inError) {
                  self.state = self.IN_ERROR;
                  return;
                }

                angular.forEach(self.searcher.docs, function(doc) {
                    var overridingExpl  = self.getOverridingExplain(doc, fieldSpec);
                    var normalDoc       = normalDocsSvc.createNormalDoc(fieldSpec, doc, overridingExpl);

                    self.docs.push(normalDoc);
                    self.displayedResults++;
                });

                var grouped = angular.copy(self.searcher.grouped);
                groupedResultToNormalDocs(fieldSpec, grouped);

                angular.forEach(grouped, function(groupedBys, groupByKey) {
                  if (self.grouped.hasOwnProperty(groupByKey)) {
                    var groupByToAppend = self.grouped[groupByKey];
                    groupByToAppend.push.apply(groupByToAppend, groupedBys);
                  }
                });

                deferred.resolve();
              });
          }

          return deferred.promise;
        }
      };

      return Search;
    }
  ]);
