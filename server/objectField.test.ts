/**
 * Tests for the 'object' field type in dataset type schemas.
 * Validates that:
 * 1. DatasetTypeField supports the 'object' type with nested fields
 * 2. The catalog FORM_DATA entry includes object fields
 * 3. Object values can be serialized/deserialized correctly
 */
import { describe, it, expect } from 'vitest';
import type { DatasetTypeField } from '../client/src/types';
import { DATASET_TYPE_CATALOG } from '../client/src/config/datasetTypeCatalog';

describe('DatasetTypeField object type', () => {
  it('should allow "object" as a valid field type', () => {
    const field: DatasetTypeField = {
      name: 'user_info',
      type: 'object',
      required: true,
      description: 'User information',
      nested: [
        { name: 'firstName', type: 'string', required: true, description: 'First name', example: 'Jean' },
        { name: 'lastName', type: 'string', required: true, description: 'Last name', example: 'Kouassi' },
      ],
    };
    expect(field.type).toBe('object');
    expect(field.nested).toBeDefined();
    expect(field.nested!.length).toBe(2);
    expect(field.nested![0].name).toBe('firstName');
    expect(field.nested![1].name).toBe('lastName');
  });

  it('should support nested fields without further nesting (1 level deep)', () => {
    const field: DatasetTypeField = {
      name: 'address',
      type: 'object',
      required: false,
      description: 'Address',
      nested: [
        { name: 'street', type: 'string', required: true, description: 'Street' },
        { name: 'city', type: 'string', required: true, description: 'City' },
        { name: 'zipCode', type: 'string', required: false, description: 'Zip code' },
        { name: 'country', type: 'string', required: true, description: 'Country' },
      ],
    };
    expect(field.nested!.length).toBe(4);
    // Nested fields should not have 'nested' themselves (1 level deep)
    field.nested!.forEach(nf => {
      expect(nf.type).not.toBe('object');
    });
  });

  it('should allow object field without nested (empty nested array)', () => {
    const field: DatasetTypeField = {
      name: 'metadata',
      type: 'object',
      required: false,
      description: 'Metadata',
      nested: [],
    };
    expect(field.nested).toEqual([]);
  });

  it('should allow object field without nested property (undefined)', () => {
    const field: DatasetTypeField = {
      name: 'raw_data',
      type: 'object',
      required: false,
      description: 'Raw data',
    };
    expect(field.nested).toBeUndefined();
  });
});

describe('DATASET_TYPE_CATALOG form_data', () => {
  const formData = DATASET_TYPE_CATALOG.find(dt => dt.dataset_type_id === 'form_data');

  it('should exist in the catalog', () => {
    expect(formData).toBeDefined();
  });

  it('should have 7 schema fields (5 scalar + 2 object)', () => {
    expect(formData!.schema_fields.length).toBe(7);
  });

  it('should contain user_info as an object field', () => {
    const userInfo = formData!.schema_fields.find(f => f.name === 'user_info');
    expect(userInfo).toBeDefined();
    expect(userInfo!.type).toBe('object');
    expect(userInfo!.required).toBe(true);
    expect(userInfo!.nested).toBeDefined();
    expect(userInfo!.nested!.length).toBe(4);
    
    const nestedNames = userInfo!.nested!.map(n => n.name);
    expect(nestedNames).toContain('firstName');
    expect(nestedNames).toContain('lastName');
    expect(nestedNames).toContain('email');
    expect(nestedNames).toContain('phone');
  });

  it('should contain address as an object field', () => {
    const address = formData!.schema_fields.find(f => f.name === 'address');
    expect(address).toBeDefined();
    expect(address!.type).toBe('object');
    expect(address!.required).toBe(false);
    expect(address!.nested).toBeDefined();
    expect(address!.nested!.length).toBe(4);
    
    const nestedNames = address!.nested!.map(n => n.name);
    expect(nestedNames).toContain('street');
    expect(nestedNames).toContain('city');
    expect(nestedNames).toContain('zipCode');
    expect(nestedNames).toContain('country');
  });

  it('should still have scalar fields intact', () => {
    const scalarFields = formData!.schema_fields.filter(f => f.type !== 'object');
    expect(scalarFields.length).toBe(5);
    const names = scalarFields.map(f => f.name);
    expect(names).toContain('field_name');
    expect(names).toContain('field_value');
    expect(names).toContain('field_type');
    expect(names).toContain('is_required');
    expect(names).toContain('validation_regex');
  });
});

describe('Object field value serialization', () => {
  it('should serialize object values correctly in JSON', () => {
    const valuesJson: Record<string, any> = {
      field_name: 'nom_complet',
      field_value: 'Jean Kouassi',
      user_info: {
        firstName: 'Jean',
        lastName: 'Kouassi',
        email: 'jean@example.com',
        phone: '+225 07 01 02 03 04',
      },
      address: {
        street: '123 Rue de la Paix',
        city: 'Abidjan',
        zipCode: '01 BP 1234',
        country: "Côte d'Ivoire",
      },
    };

    const serialized = JSON.stringify(valuesJson);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.user_info).toEqual(valuesJson.user_info);
    expect(deserialized.address).toEqual(valuesJson.address);
    expect(typeof deserialized.user_info).toBe('object');
    expect(typeof deserialized.address).toBe('object');
    expect(deserialized.user_info.firstName).toBe('Jean');
    expect(deserialized.address.country).toBe("Côte d'Ivoire");
  });

  it('should handle empty object values', () => {
    const valuesJson: Record<string, any> = {
      field_name: 'test',
      user_info: {},
    };

    const serialized = JSON.stringify(valuesJson);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.user_info).toEqual({});
    expect(Object.keys(deserialized.user_info).length).toBe(0);
  });

  it('should handle handleFieldChange for object fields', () => {
    // Simulate the handleFieldChange behavior
    let state: Record<string, any> = {
      field_name: 'test',
      user_info: { firstName: 'Jean', lastName: 'Kouassi' },
    };

    // Simulate updating a nested field
    const handleFieldChange = (fieldName: string, value: string | Record<string, any>) => {
      state = { ...state, [fieldName]: value };
    };

    // Update a nested field in user_info
    const currentObj = state.user_info;
    const newObj = { ...currentObj, firstName: 'Marie' };
    handleFieldChange('user_info', newObj);

    expect(state.user_info.firstName).toBe('Marie');
    expect(state.user_info.lastName).toBe('Kouassi');
    expect(state.field_name).toBe('test');
  });
});
