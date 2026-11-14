/**
 * Device capability & mobile environment detection
 * Helps clamp pixel ratios, adjust framebuffer allocations,
 * and optimize shader passes on mobile devices.
 */

export function isMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
  const isTouchMac = /Macintosh/i.test(ua) && Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
  const isSmallScreen =
    typeof window.innerWidth === 'number' &&
    Math.min(window.innerWidth, window.innerHeight) <= 840;
  return isMobileUA || isTouchMac || (Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1) && isSmallScreen);
}

export function getOptimalPixelRatio(maxDesktop = 2.0, maxMobile = 1.25) {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const limit = isMobileDevice() ? maxMobile : maxDesktop;
  return Math.max(1, Math.min(dpr, limit));
}

export function getMobileShadowMapSize() {
  return isMobileDevice() ? 512 : 2048;
}

export function getMobileMaxAnisotropy(maxSupported = 16) {
  return isMobileDevice() ? Math.min(2, maxSupported) : Math.min(16, maxSupported);
}
