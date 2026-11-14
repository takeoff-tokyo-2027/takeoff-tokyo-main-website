const measurementId = 'G-Y1MHMNDZHN';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function initializeAnalytics() {
  if (
    !import.meta.env.PROD ||
    !['takeoff-tokyo.com', 'www.takeoff-tokyo.com'].includes(window.location.hostname)
  )
    return;
  if (document.getElementById('google-analytics')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params -- Google tag queues the arguments object.
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  const script = document.createElement('script');
  script.id = 'google-analytics';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}
