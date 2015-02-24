'use strict';

angular.module('splain-app')
  .service('searchSvc', function solrSettingsSvc(solrUrlSvc, fieldSpecSvc, solrSearchSvc, esSearchSvc, normalDocsSvc) {

    this.states = {
      NO_SEARCH: 0,
      DID_SEARCH: 1,
      WAITING_FOR_SEARCH: 2,
      IN_ERROR: 3      
    };

    this.engines = {
      SOLR: 0,
      ELASTICSEARCH: 1
    };

    var thisSvc = this;

    var createSearcher = function(fieldSpec, parsedArgs, searchSettings) {
      if (searchSettings.whichEngine === thisSvc.engines.ELASTICSEARCH) {
        try {
          parsedArgs = angular.fromJson(searchSettings.searchArgsStr); 
        } catch (SyntaxError) {
          parsedArgs = '';
        }
          
        return esSearchSvc.createSearcher(fieldSpec.fieldList(),
                                          searchSettings.searchUrl, parsedArgs, '');
        
      } else {
        parsedArgs = solrUrlSvc.parseSolrArgs(searchSettings.searchArgsStr);
        return solrSearchSvc.createSearcher(fieldSpec.fieldList(),
                                            searchSettings.searchUrl, parsedArgs, '');
      }
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

    this.createSearch = function(searchSettings, overridingExplains) {
      var search = new Search(searchSettings, overridingExplains);
      search.NO_SEARCH = this.states.NO_SEARCH;
      search.DID_SEARCH = this.states.DID_SEARCH;
      search.WAITING_FOR_SEARCH = this.states.WAITING_FOR_SEARCH;
      search.IN_ERROR = this.states.IN_ERROR;
      return search;
    };

    var Search = function(searchSettings, overridingExplains) {
      this.searcher = null;
      this.reset = function() {
        this.displayedResults = 0;
        this.numFound = 0;
        this.docs = [];
        this.grouped = {};
        this.maxScore = 0.0;
        this.linkUrl = '#';
        this.settings = {searchArgsStr: ''};
        this.paging = false;
        this.state = thisSvc.states.NO_SEARCH;
        this.overridingExplains = {};
        if (overridingExplains) {
          // we might not be explaining this search, but being used
          // in conjunction with explainOther
          this.overridingExplains = overridingExplains;
        }
      };

      this.reset();

      this.hasGrouped = function() {
        return Object.keys(this.grouped).length > 0;
      };
      this.moreResults = function() {
        return (this.displayedResults < this.numFound);
      };

      this.getOverridingExplain = function(doc, fieldSpec) {
        var idFieldName = fieldSpec.id;
        var id = doc[idFieldName];

        if (id && this.overridingExplains.hasOwnProperty(id)) {
          return this.overridingExplains[id];
        }
        return null;
      };

      this.search = function() {
        var promise = Promise.create(this.search);
        var fieldSpec = fieldSpecSvc.createFieldSpec(searchSettings.fieldSpecStr);
        var parsedArgs = null;
        this.searcher = createSearcher(fieldSpec, parsedArgs, searchSettings);
        this.reset();
        this.state = thisSvc.states.WAITING_FOR_SEARCH;
        this.settings = angular.copy(searchSettings);

        var thisSearch = this;
        this.searcher.search()
        .then(function() {
          thisSearch.linkUrl = thisSearch.searcher.linkUrl;
          thisSearch.numFound = thisSearch.searcher.numFound;
          if (thisSearch.searcher.inError) {
            thisSearch.state = thisSvc.states.IN_ERROR;
            return;
          }
          angular.forEach(thisSearch.searcher.docs, function(doc) {
            var overridingExpl = thisSearch.getOverridingExplain(doc, fieldSpec);
            var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, overridingExpl);
            if (normalDoc.score() > thisSearch.maxScore) {
              thisSearch.maxScore = normalDoc.score();
              console.log('new max score' + thisSearch.maxScore);
            }
            thisSearch.docs.push(normalDoc);
            thisSearch.displayedResults++;
          });

          thisSearch.grouped = angular.copy(thisSearch.searcher.grouped);
          groupedResultToNormalDocs(fieldSpec, thisSearch.grouped);
          thisSearch.state = thisSvc.states.DID_SEARCH;
          promise.complete();
        });

        return promise;
      };

      this.page = function() {
        var promise = Promise.create(this.page);
        var thisSearch = this;
        if (thisSearch.searcher === null) {
          return;
        }

        var fieldSpec = fieldSpecSvc.createFieldSpec(searchSettings.fieldSpecStr);
        thisSearch.searcher = thisSearch.searcher.pager();
        if (thisSearch.searcher) {
          thisSearch.paging = true;
          thisSearch.searcher.search()
          .then(function() {
            thisSearch.paging = false;
            if (thisSearch.searcher.inError) {
              thisSearch.state = thisSearch.IN_ERROR;
              return;
            }
            angular.forEach(thisSearch.searcher.docs, function(doc) {
                var overridingExpl = thisSearch.getOverridingExplain(doc, fieldSpec);
                var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, overridingExpl);
                thisSearch.docs.push(normalDoc);
                thisSearch.displayedResults++;
            });

            var grouped = angular.copy(thisSearch.searcher.grouped);
            groupedResultToNormalDocs(fieldSpec, grouped);
            angular.forEach(grouped, function(groupedBys, groupByKey) {
              if (thisSearch.grouped.hasOwnProperty(groupByKey)) {
                var groupByToAppend = thisSearch.grouped[groupByKey];
                groupByToAppend.push.apply(groupByToAppend, groupedBys);
              }
            });
          });
        }
        return promise;
      };

    };

  });
