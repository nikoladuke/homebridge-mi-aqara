import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const attachIdentifyHandler = require('../lib/IdentifyHandler.js');
const LockParser = require('../parser/LockParser.js');
const GatewayParser = require('../parser/GatewayParser.js');

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

test('Homebridge v2 migration does not reintroduce deprecated or obsolete accessory APIs', async () => {
  const [lockParser, accessoryParser] = await Promise.all([
    readFile(new URL('../parser/LockParser.js', import.meta.url), 'utf8'),
    readFile(new URL('../parser/AccessoryParser.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(lockParser, /getServiceByUUIDAndSubType/);
  assert.doesNotMatch(accessoryParser, /accessory\.reachable\s*=/);
});


test('gateway parsers resolve accessory categories from the separately exported HAP categories', () => {
  const categories = { LIGHTBULB: 5, SENSOR: 10, SWITCH: 8 };
  const platform = {
    Accessory: class Accessory {},
    Categories: categories,
  };

  const parser = new GatewayParser(platform);

  assert.equal(parser.accessoriesParsers.Gateway_Lightbulb.getAccessoryCategory('light'), categories.LIGHTBULB);
  assert.equal(parser.accessoriesParsers.Gateway_LightSensor.getAccessoryCategory('sensor'), categories.SENSOR);
  assert.equal(parser.accessoriesParsers.Gateway_Switch_JoinPermission.getAccessoryCategory('switch'), categories.SWITCH);
  assert.equal(parser.accessoriesParsers.Gateway_Ringtone.getAccessoryCategory('ringtone'), categories.SWITCH);
});

test('gateway parsers retain compatibility with HAP versions exposing Accessory.Categories', () => {
  const categories = { LIGHTBULB: 5, SENSOR: 10, SWITCH: 8 };
  class Accessory {}
  Accessory.Categories = categories;

  const parser = new GatewayParser({ Accessory });

  assert.equal(parser.accessoriesParsers.Gateway_Lightbulb.getAccessoryCategory('light'), categories.LIGHTBULB);
  assert.equal(parser.accessoriesParsers.Gateway_LightSensor.getAccessoryCategory('sensor'), categories.SENSOR);
});


test('duplicate accessory UUIDs are registered only once', () => {
  const filterNewAccessories = require('../lib/filterNewAccessories.js');
  const first = { UUID: 'device-1' };
  const duplicate = { UUID: 'device-1' };
  const second = { UUID: 'device-2' };
  const accessoryUtil = {
    getByUUID(uuid) {
      return uuid === 'device-2' ? second : null;
    },
  };

  assert.deepEqual(
    filterNewAccessories([first, duplicate, second], accessoryUtil),
    [first],
  );
});

test('duplicate accessory filter handles missing and empty batches', () => {
  const filterNewAccessories = require('../lib/filterNewAccessories.js');
  const accessoryUtil = { getByUUID: () => null };

  assert.deepEqual(filterNewAccessories([], accessoryUtil), []);
  assert.deepEqual(filterNewAccessories(null, accessoryUtil), []);
  assert.deepEqual(filterNewAccessories([null, {}, { UUID: 'device-1' }], accessoryUtil), [
    { UUID: 'device-1' },
  ]);
});
