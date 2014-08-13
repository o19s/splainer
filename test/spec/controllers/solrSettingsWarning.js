'use strict';

describe('solrSettingsWarningCtrl', function() {

  var createController = null;
  var scope = null;

  beforeEach(module('splain-app'));

  beforeEach(function() {
   
    
    
    inject(function($rootScope, $controller) {

      createController = function() {
        scope = $rootScope.$new();
        return $controller('SolrSettingsWarningCtrl', {'$scope': scope});
      };
    });
  });

  var expectArgs = function(condensed, arg) {
    var args = [];
    angular.forEach(condensed, function(cArgs) {
      angular.forEach(cArgs, function(arg) {
        args.push(arg);
      });
    });
    expect(args).toContain(arg);
  };

  it('no warnings reported when no warnings...', function() {
    createController();
    var condensedWarnings = scope.warnings.messages('q=*:*');
    expect(scope.warnings.shouldWarn('q=*:*&fq=blah')).toBeFalsy();
    expect(Object.keys(condensedWarnings).length).toEqual(0);
  });

  it('outputs single warnings', function() {
    createController();
    var condensedWarnings = scope.warnings.messages('group=true');
    var shouldWarn = scope.warnings.shouldWarn('group=true');
    expect(shouldWarn).toBe(true);
    expectArgs(condensedWarnings, 'group');
  });
  
  it('condenses warnings', function() {
    createController();
    var condensedWarnings = scope.warnings.messages('group=true&group.main=true');
    var shouldWarn = scope.warnings.shouldWarn('group=true&group.main=true');
    expect(shouldWarn).toBe(true);
    expectArgs(condensedWarnings, 'group');
    expectArgs(condensedWarnings, 'group.main');
  });
});

