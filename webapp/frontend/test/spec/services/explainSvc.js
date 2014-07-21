'use strict';
/* global urlContainsParams*/
describe('Service: explainSvc', function () {

  // load the service's module
  beforeEach(module('splain-app'));

  var explainSvc = null;
  beforeEach(inject(function (_explainSvc_) {
    explainSvc = _explainSvc_;
  }));

  it('parses mockData1', function() {
    var expl = explainSvc.createExplain(mockExplain);
  });
});
