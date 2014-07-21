'use strict';

describe('Service: normalDocsSvc', function () {

  // load the service's module
  beforeEach(module('splain-app'));
 
  /*jshint camelcase: false */
  var normalDocsSvc = null;
  beforeEach(inject(function (_normalDocsSvc_) {
    normalDocsSvc = _normalDocsSvc_;
  }));

  describe('attached url tests', function() {
    var solrDoc = null;
    var normalDoc = null;
    var lastFieldName = null;
    var lastFieldValue = null;
    beforeEach(function() {
      solrDoc = {'id_field': '1234',
                 'title_field': 'a title',
                 url: function(fieldName, fieldValue) {
                    lastFieldName = fieldName;
                    lastFieldValue = fieldValue;
                  },
                 explain: function() {return mockExplain;} };
      var fieldSpec = {id: 'id_field', title: 'title_field'};
      normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
    });

    it('requests url correctly', function() {
      normalDoc.url();
      expect(lastFieldName).toEqual('id_field');
      expect(lastFieldValue).toEqual('1234');
    });

  });

});
