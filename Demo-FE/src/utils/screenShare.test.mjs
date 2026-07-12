import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findVideoSender,
  getActiveVideoSource,
  shouldShowVideoFallback,
} from './screenShare.js';

function createStream(videoTrack) {
  return {
    getVideoTracks: () => videoTrack ? [videoTrack] : [],
  };
}

test('findVideoSender returns the sender carrying a video track', () => {
  const audioSender = { track: { kind: 'audio' } };
  const videoSender = { track: { kind: 'video' } };
  const peerConnection = {
    getSenders: () => [audioSender, videoSender],
    getTransceivers: () => [],
  };

  assert.equal(findVideoSender(peerConnection), videoSender);
});

test('findVideoSender finds a reserved transceiver when the user has no camera', () => {
  const reservedSender = { track: null };
  const peerConnection = {
    getSenders: () => [reservedSender],
    getTransceivers: () => [{
      sender: reservedSender,
      receiver: { track: { kind: 'video' } },
    }],
  };

  assert.equal(findVideoSender(peerConnection), reservedSender);
});

test('getActiveVideoSource prefers screen capture and falls back to camera', () => {
  const screenTrack = { kind: 'video', source: 'screen' };
  const cameraTrack = { kind: 'video', source: 'camera' };
  const screenStream = createStream(screenTrack);
  const cameraStream = createStream(cameraTrack);

  assert.deepEqual(
    getActiveVideoSource(screenStream, cameraStream),
    { stream: screenStream, track: screenTrack },
  );
  assert.deepEqual(
    getActiveVideoSource(null, cameraStream),
    { stream: cameraStream, track: cameraTrack },
  );
  assert.deepEqual(
    getActiveVideoSource(null, createStream(null)),
    { stream: null, track: null },
  );
});

test('video fallback stays hidden while a screen is shared with camera off', () => {
  assert.equal(shouldShowVideoFallback(true, true, true), false);
  assert.equal(shouldShowVideoFallback(true, false, true), true);
  assert.equal(shouldShowVideoFallback(false, false, true), false);
  assert.equal(shouldShowVideoFallback(false, true, false), true);
});