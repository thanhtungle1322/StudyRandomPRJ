export function findVideoSender(peerConnection) {
  const senderWithTrack = peerConnection
    ?.getSenders?.()
    .find((sender) => sender.track?.kind === 'video');

  if (senderWithTrack) return senderWithTrack;

  return peerConnection
    ?.getTransceivers?.()
    .find((transceiver) => transceiver.sender && transceiver.receiver?.track?.kind === 'video')
    ?.sender || null;
}

export function getActiveVideoSource(screenStream, cameraStream) {
  const screenTrack = screenStream?.getVideoTracks?.()[0];
  if (screenTrack) return { stream: screenStream, track: screenTrack };

  const cameraTrack = cameraStream?.getVideoTracks?.()[0];
  if (cameraTrack) return { stream: cameraStream, track: cameraTrack };

  return { stream: null, track: null };
}

export function shouldShowVideoFallback(cameraOff, screenSharing, hasVideo = true) {
  return !hasVideo || (cameraOff && !screenSharing);
}