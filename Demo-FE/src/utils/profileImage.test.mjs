import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCoverCrop } from './profileImage.js';

test('banner crop always covers the target canvas', () => {
  const crop = calculateCoverCrop({
    sourceWidth: 800,
    sourceHeight: 1200,
    targetWidth: 600,
    targetHeight: 200,
    previewWidth: 300,
    previewHeight: 100,
    scale: 1,
  });

  assert.ok(crop.x <= 0);
  assert.ok(crop.y <= 0);
  assert.ok(crop.x + crop.width >= 600);
  assert.ok(crop.y + crop.height >= 200);
});

test('crop clamps extreme offsets so they cannot expose a black background', () => {
  const crop = calculateCoverCrop({
    sourceWidth: 1600,
    sourceHeight: 900,
    targetWidth: 600,
    targetHeight: 200,
    previewWidth: 300,
    previewHeight: 100,
    scale: 1.25,
    offsetX: 250,
    offsetY: -200,
  });

  assert.ok(crop.x <= 0);
  assert.ok(crop.y <= 0);
  assert.ok(crop.x + crop.width >= 600);
  assert.ok(crop.y + crop.height >= 200);
});

test('crop converts preview offsets to target-canvas coordinates', () => {
  const crop = calculateCoverCrop({
    sourceWidth: 1200,
    sourceHeight: 400,
    targetWidth: 600,
    targetHeight: 200,
    previewWidth: 300,
    previewHeight: 100,
    scale: 2,
    offsetX: 25,
    offsetY: 10,
  });

  assert.equal(crop.x, -250);
  assert.equal(crop.y, -80);
});