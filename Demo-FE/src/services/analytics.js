import api from './api';

// Cache the measurement ID
let activeMeasurementId = null;

/**
 * Dynamically inject Google Analytics scripts into the page
 * @param {string} measurementId - The GA4 Measurement ID (G-XXXXXXXXXX)
 */
export function initGA(measurementId) {
  if (!measurementId || typeof window === 'undefined') return;
  
  // Clean up existing scripts if ID changes or is re-initialized
  const existingScript1 = document.getElementById('google-analytics-script');
  const existingScript2 = document.getElementById('google-analytics-init');
  if (existingScript1) existingScript1.remove();
  if (existingScript2) existingScript2.remove();

  activeMeasurementId = measurementId;

  // 1. Inject gtag.js script
  const script1 = document.createElement('script');
  script1.id = 'google-analytics-script';
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  // 2. Initialize dataLayer and gtag function
  const script2 = document.createElement('script');
  script2.id = 'google-analytics-init';
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){window.dataLayer.push(arguments);}
    window.gtag('js', new Date());
    window.gtag('config', '${measurementId}', {
      send_page_view: false // We will track page views manually on route changes
    });
  `;
  document.head.appendChild(script2);
  
  console.log(`[Google Analytics] Initialized with ID: ${measurementId}`);
}

/**
 * Log a page view manually to Google Analytics
 * @param {string} path - The relative URL path (e.g. '/lobby')
 */
export function logPageView(path) {
  if (typeof window !== 'undefined' && window.gtag && activeMeasurementId) {
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
