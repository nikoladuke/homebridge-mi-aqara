import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const attachIdentifyHandler = require('../lib/IdentifyHandler.js');
const LockParser = require('../parser/LockParser.js');

test('identify handler completes the Homebridge identify callback when provided', () => {
  const listeners = {};
  const accessory = {
    displayName: 'Test accessory',
    on(event, listener) {
      listeners[event] = listener;
    },
  };
  const messages = [];
  let callbackCalled = false;

  attachIdentifyHandler(accessory, { debug: message => messages.push(message) });
  listeners.identify(false, () => {
    callbackCalled = true;
  });

  assert.equal(callbackCalled, true);
  assert.deepEqual(messages, ['Test accessory Identify!!!']);
});

test('identify handler tolerates the callback-free identify event signature', () => {
  const listeners = {};
  const accessory = {
    displayName: 'Test accessory',
    on(event, listener) {
      listeners[event] = listener;
    },
  };

  attachIdentifyHandler(accessory, { debug() {} });
  assert.doesNotThrow(() => listeners.identify());
});

test('lock parser resolves motion services by HAP service constructor and subtype', t => {
  t.mock.method(globalThis, 'setTimeout', () => 0);

  class MotionSensor {}
  const Service = { MotionSensor };
  const Characteristic = { MotionDetected: class MotionDetected {} };
  const calls = [];
  const updates = [];
  const characteristic = {
    updateValue(value) {
      updates.push(value);
    },
  };
  const service = {
    getCharacteristic(name) {
      assert.equal(name, Characteristic.MotionDetected);
      return characteristic;
    },
  };
  const accessory = {
    getServiceById(uuid, subtype) {
      calls.push([uuid, subtype]);
      return service;
    },
  };
  const platform = {
    Accessory: {},
    PlatformAccessory: class PlatformAccessory {},
    Service,
    Characteristic,
    UUIDGen: { generate: value => value },
    ConfigUtil: {
      getAccessoryName(_sid, type) {
        return type;
      },
    },
    AccessoryUtil: {
      getByUUID() {
        return accessory;
      },
    },
    log: { debug() {} },
  };

  const parser = new LockParser(platform).accessoriesParsers.Lock_MotionSensor;
  parser.getMotionDetectedCharacteristicValue = () => 'finger';
  parser.parserBatteryService = () => {};

  parser.parserAccessories({ sid: 'lock-sid' });

  assert.deepEqual(calls, [
    [MotionSensor, 'main'],
    [MotionSensor, 'finger'],
  ]);
  assert.deepEqual(updates, [true, true]);
});

test('Homebridge v2 migration does not reintroduce removed or obsolete accessory APIs', async () => {
  const [lockParser, accessoryParser] = await Promise.all([
    readFile(new URL('../parser/LockParser.js', import.meta.url), 'utf8'),
    readFile(new URL('../parser/AccessoryParser.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(lockParser, /getServiceByUUIDAndSubType/);
  assert.doesNotMatch(accessoryParser, /accessory\.reachable\s*=/);
});
