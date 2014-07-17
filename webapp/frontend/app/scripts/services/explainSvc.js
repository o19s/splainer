'use strict';

if (typeof String.prototype.startsWith !== 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) === 0;
  };
}

if (typeof String.prototype.startsWith !== 'hasSubstr') {
  String.prototype.hasSubstr = function(str) {
    return this.indexOf(str) !== -1;
  };
}

// Executes a solr search and returns
// a set of queryDocs
angular.module('splain-app')
  .service('explainSvc', function solrSearchSvc() {

    var tieRegex = /max plus ([0-9.]+) times/;
    var createExplain = function(explJson) {
      var base = new Explain(explJson);
      var description = explJson.description;
      var details = [];
      if (explJson.hasOwnProperty('details')) {
        details = explJson.details;
      }
      var tieMatch = description.match(tieRegex);
      if (description.startsWith('MatchAllDocsQuery')) {
        console.log('Match all docs query');
        MatchAllDocsExplain.prototype = base;
        return new MatchAllDocsExplain(explJson);
      }
      else if (description.startsWith('weight(')) {
        WeightExplain.prototype = base;
        console.log('weight');
        return new WeightExplain(explJson);
      }
      else if (tieMatch && tieMatch.length > 1) {
        console.log('dismax tie expl');
        var tie = parseFloat(tieMatch[1]);
        DismaxTieExplain.prototype = base;
        return new DismaxTieExplain(explJson, tie);
      }
      else if (description.hasSubstr('max of')) {
        console.log('dismax expl');
        DismaxExplain.prototype = base;
        return new DismaxExplain(explJson);
      }
      else if (description.hasSubstr('sum of')) {
        SumOrProductExplain.prototype = base;
        console.log('sum or product expl');
        return new SumOrProductExplain(explJson, 'sum_of');
      }
      else if (description.hasSubstr('product of')) {
        if (details.length === 2) {
          var coordExpl = null;
          angular.forEach(details, function(detail) {
            if (detail.description.startsWith('coord(')) {
              CoordExplain.prototype = base;
              coordExpl = new CoordExplain(explJson, parseFloat(detail.value));
            }
          });
          if (coordExpl !== null) {
            return coordExpl;
          } else {
            return new SumOrProductExplain(explJson, 'product_of');
          }
        }
        console.log('product expl');
      }
      else {
        console.log('regular explain');
      }
      return base;

    };

    var Explain = function(explJson) {
      var datExplain = this;
      this.realContribution = this.score = parseFloat(explJson.value);
      this.realExplanation = this.description = explJson.description;
      var details = [];
      if (explJson.hasOwnProperty('details')) {
        details = explJson.details;
      }
      this.children = [];
      angular.forEach(details, function(detail) {
        datExplain.children.push(createExplain(detail));
      });

      this.influencers = function() {
        return [];
      };

      this.contribution = function() {
        return this.realContribution;
      };

      this.explanation = function() {
        return this.realExplanation;
      };

      this.toStr = function(depth) {
        if (depth === undefined) {
          depth = 0;
        }
        var prefix = new Array(2 * depth).join('  ');
        var me = prefix + ' ' + this.contribution() + ' ' + this.explanation();
        var childStrs = [];
        angular.forEach(this.influencers(), function(child) {
          childStrs.push(child.toStr(depth+1));
        });
        return me + childStrs.join('\n');
      };
    };

    var MatchAllDocsExplain = function() {
      this.realExplanation = 'You queried *:* (all docs returned w/ score of 1)';
    };

    var WeightExplain = function(explJson) {
      var weightRegex = /weight\((.*?)\)/;
      var description = explJson.description;
      
      var match = description.match(weightRegex);
      if (match !== null && match.length > 1) {
        this.realExplanation = match[1];
      } else {
        this.realExplanation = 'Could not parse weight...';
      }
    };

    var CoordExplain = function(explJson, coordFactor) {
      if (coordFactor < 1.0) {
        this.realExplanation = 'Matches Punished by ' + coordFactor + ' (not all query terms matched)';

        this.influencers = function() {
          var infl = [];
          for (var i = 0; i < this.children.length; i++) {
            if (this.children[i].hasSubstr('coord')) {
              continue;
            } else {
              infl.push(this.children[i]);
            }
          }
          return infl;
        };
      }
    };

    var DismaxTieExplain = function(explJson, tie) {
      this.realExplanation = 'Dismax (max plus:' + tie + ' times others';

      this.influencers = function() {
        var infl = angular.copy(this.children);
        infl.sort(function(a, b) {return a.score - b.score;});
        return infl;
        
      };
    };


    var DismaxExplain = function() {
      this.realExplanation = 'Dismax (take winner of below)';
      
      this.influencers = function() {
        var infl = angular.copy(this.children);
        infl.sort(function(a, b) {return a.score - b.score;});
        return infl;
      };
    };

    var SumOrProductExplain = function(explJson, sumOrProduct) {
      this.sumOrProduct = sumOrProduct;
      if (sumOrProduct === 'sum_of') {
        this.realExplanation = 'Sum of the following:';
      } else if (sumOrProduct === 'product_of') {
        this.realExplanation = 'Product of following:';
      }

      this.isChildSame = function(child, sumOrProduct) {
        return (this.sumOrProduct === sumOrProduct &&
                child.hasOwnProperty('sumOrProduct') &&
                child.sumOrProduct === sumOrProduct);
      };

      this.influencers = function() {
        var infl = angular.copy(this.children);
        var children = this.children;
        if (children.length === 1 && this.isChildSame(children[0], this.sumOrProduct)) {
          // just use the children's info
          return children[0].influencers();
        } else {
          // sort children on score
          // If I'm a sum, and the child is the sum, just wrap child child here?
          infl.sort(function(a, b) {return a.score - b.score;});
          return infl;
        }
      };
      
    };

    this.createExplain = function(explJson) {
      return createExplain(explJson);
    };

  });
