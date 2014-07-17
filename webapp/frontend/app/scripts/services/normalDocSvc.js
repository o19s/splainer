'use strict';

// Deals with normalizing documents from solr
// into a canonical representation, ie
// each doc has an id, a title, possibly a thumbnail field
// and possibly a list of sub fields
angular.module('splain-app')
  .service('normalDocsSvc', function normalDocsSvc() {

    var assignSingleField = function(queryDoc, solrDoc, solrField, toProperty) {
      if (solrDoc.hasOwnProperty(solrField)) {
        queryDoc[toProperty] = solrDoc[solrField].slice(0, 200);
      }
    };

    var assignFields = function(queryDoc, solrDoc, fieldSpec) {
      assignSingleField(queryDoc, solrDoc, fieldSpec.id, 'id');
      assignSingleField(queryDoc, solrDoc, fieldSpec.title, 'title');
      assignSingleField(queryDoc, solrDoc, fieldSpec.thumb, 'thumb');
      queryDoc.subs = {};
      angular.forEach(fieldSpec.subs, function(subFieldName) {
        if (solrDoc.hasOwnProperty(subFieldName)) {
          queryDoc.subs[subFieldName] = solrDoc[subFieldName];
        }
      });
    };

    // A document within a query
    var NormalDoc = function(fieldSpec, doc) {
      this.solrDoc = doc;
      assignFields(this, doc, fieldSpec);
      var hasThumb = false;
      if (this.hasOwnProperty('thumb')) {
        hasThumb = true;
      }
      this.subsList = [];
      var that = this;
      angular.forEach(this.subs, function(subValue, subField) {
        if (typeof(subValue) === 'string') {
          subValue = subValue.slice(0,200);
        }
        var expanded = {field: subField, value: subValue};
        that.subsList.push(expanded);
      });

      this.hasThumb = function() {
        return hasThumb;
      };
      
      this.url = function() {
        return this.solrDoc.url(fieldSpec.id, this.id);
      };

      this.explain = function() {
        return this.solrDoc.explain(this.id);
      };
    };

    this.createNormalDoc = function(fieldSpec, doc) {
      return new NormalDoc(fieldSpec, doc);
    };

    // A stub, used to display a result that we expected 
    // to find in Solr, but isn't there
    this.createPlaceholderDoc = function(docId, stubTitle) {
      return {id: docId,
              title: stubTitle};
    };

  
  });
