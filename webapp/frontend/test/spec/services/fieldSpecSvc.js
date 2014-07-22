'use strict';

describe('Service: fieldSpecSvc', function () {

  // load the service's module
  beforeEach(module('splain-app'));

  // instantiate service
  var fieldSpecSvc;
  beforeEach(inject(function (_fieldSpecSvc_) {
    fieldSpecSvc = _fieldSpecSvc_;
  }));

  it('default id is id', function () {
    var fieldSpec = fieldSpecSvc.createFieldSpec('');
    expect(fieldSpec.id).toEqual('id');
  });

  it('first field is title field', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('atitlefield');
    expect(fieldSpec.title).toEqual('atitlefield');
  });
  
  it('extra fields are subfields', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('atitlefield subfield1 subfield2');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });
  
  it('id fields specified', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });
  
  it('second specs ignored', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });

  it('extracts a thumb property', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id thumb:foo_img');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.thumb).toEqual('foo_img');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });

  it('gets plain field list', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id thumb:foo_img');
    expect(fieldSpec.fields).toContain('foo_id');
    expect(fieldSpec.fields).toContain('atitlefield');
    expect(fieldSpec.fields).toContain('subfield1');
    expect(fieldSpec.fields).toContain('subfield2');
    expect(fieldSpec.fields).toContain('foo_img');
  });

  it('fields has id when no id specified', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('atitlefield');
    expect(fieldSpec.fields).toContain('id');
  });
  
  it('iterates all non-id fields', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id thumb:foo_img');
    var fieldsIterated = [];
    fieldSpec.forEachField(function(fieldName) {
      fieldsIterated.push(fieldName);
    });
    expect(fieldsIterated).toContain('atitlefield');
    expect(fieldsIterated).toContain('subfield1');
    expect(fieldsIterated).toContain('subfield2');
    expect(fieldsIterated).toContain('foo_img');
    expect(fieldsIterated).toNotContain('foo_id');
  });

  it('returns field list', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('atitlefield');
    var fieldList = fieldSpec.fieldList();
    expect(fieldList).toContain('atitlefield');
    expect(fieldList).toContain('id');
  });

});
