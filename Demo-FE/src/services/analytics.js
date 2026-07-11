import api from './api';

// Cache the measurement ID
let activeMeasurementId = null;
let firstPageTracked = false;
const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

/**
 * Dynamically inject Google Analytics scripts into the page
 * @param {string} measurementId - The GA4 Measurement ID (G-XXXXXXXXXX)
 */
export function initGA(measurementId) {
  if (!measurementId || typeof window === 'undefined') return;
  const normalizedMeasurementId = measurementId.trim().toUpperCase();
  if (!GA_MEASUREMENT_ID_PATTERN.test(normalizedMeasurementId)) {
    console.error('[Analytics] Invalid Google Analytics Measurement ID');
    return;
  }
  
  // Clean up existing scripts if ID changes or is re-initialized
  const existingScript1 = document.getElementById('google-analytics-script');
  if (existingScript1) existingScript1.remove();

  activeMeasurementId = normalizedMeasurementId;
  firstPageTracked = false; // reset flag on new init

  // 1. Inject gtag.js script
  const script1 = document.createElement('script');
  script1.id = 'google-analytics-script';
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${normalizedMeasurementId}`;
  document.head.appendChild(script1);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', normalizedMeasurementId);
  
  console.log(`[Google Analytics] Initialized with ID: ${normalizedMeasurementId}`);
}

/**
 * Log a page view manually to Google Analytics
 * @param {string} path - The relative URL path (e.g. '/lobby')
 */
export function logPageView(path) {
  if (typeof window !== 'undefined' && window.gtag && activeMeasurementId) {
    // Ngăn chặn trùng lặp view đầu tiên do lệnh config của GA đã tự động bắn 1 lần khi load trang.
    if (!firstPageTracked) {
      firstPageTracked = true;
      console.log(`[Google Analytics] Lượt xem trang đầu tiên được xử lý tự động bởi thẻ cấu hình: ${path}`);
      return;
    }

    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: document.title,
      page_location: window.location.href,
      send_to: activeMeasurementId
    });
    console.log(`[Google Analytics] Page view tracked: ${path}`);
  }
}

/**
 * Log a custom event to Google Analytics
 * @param {string} eventName - Name of the event (e.g., 'start_matchmaking')
 * @param {object} params - Event parameters
 */
export function logEvent(eventName, params = {}) {
  if (typeof window !== 'undefined' && window.gtag && activeMeasurementId) {
    window.gtag('event', eventName, {
      ...params,
      send_to: activeMeasurementId
    });
    console.log(`[Google Analytics] Event tracked: ${eventName}`, params);
  }
}

/**
 * Fetch GA config from BE and initialize
 */
export async function setupAnalytics() {
  try {
    const { data } = await api.get('/settings/ga-id');
    if (data && data.success && data.gaMeasurementId) {
      initGA(data.gaMeasurementId);
    }
  } catch (error) {
    console.error('[Analytics] Failed to load GA ID from backend:', error);
    // Try environment fallback in FE (Vite style)
    const envGaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (envGaId) {
      initGA(envGaId);
    }
  }
}
