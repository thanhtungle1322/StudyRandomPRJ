function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function calculateCoverCrop({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  previewWidth,
  previewHeight,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const dimensions = [sourceWidth, sourceHeight, targetWidth, targetHeight, previewWidth, previewHeight];
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Invalid crop dimensions');
  }

  const safeScale = Math.max(1, Number.isFinite(scale) ? scale : 1);
  const coverScale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) * safeScale;
  const drawWidth = sourceWidth * coverScale;
  const drawHeight = sourceHeight * coverScale;
  const maxOffsetX = Math.max(0, (drawWidth - targetWidth) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - targetHeight) / 2);
  const translatedOffsetX = clamp(offsetX * (targetWidth / previewWidth), -maxOffsetX, maxOffsetX);
  const translatedOffsetY = clamp(offsetY * (targetHeight / previewHeight), -maxOffsetY, maxOffsetY);

  return {
    x: (targetWidth - drawWidth) / 2 + translatedOffsetX,
    y: (targetHeight - drawHeight) / 2 + translatedOffsetY,
    width: drawWidth,
    height: drawHeight,
  };
}