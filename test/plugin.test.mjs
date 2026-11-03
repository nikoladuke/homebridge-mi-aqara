import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import initializer from '../index.mjs';

const require = createRequire(import.meta.url);

test('CommonJS implementation remains loadable', () => {
  assert.equal(typeof require('../index.js'), 'function');
});

test('ESM initializer registers the dynamic platform with the package identifier', () => {
  const registrations = [];
  const api = {
    platformAccessory: class PlatformAccessory {},
    hap: {
      Accessory: class Accessory {},
      Service: class Service {},
      Characteristic: class Characteristic {},
      uuid: { generate: () => 'test-uuid' },
    },
    registerPlatform(...args) {
      registrations.push(args);
    },
  };

  initializer(api);

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0][0], 'homebridge-mi-aqara-ng');
  assert.equal(registrations[0][1], 'MiAqaraPlatform');
  assert.equal(typeof registrations[0][2], 'function');
});
