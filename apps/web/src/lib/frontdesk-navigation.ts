type BackRouter = {
  back: () => void;
  push: (href: string) => void;
};

/**
 * Return to the previous in-app screen when one exists. Direct links and
 * refreshed tabs use the supplied frontdesk fallback instead of leaving the
 * application through the browser history.
 */
export function goBack(router: BackRouter, fallback: string) {
  if (typeof window === 'undefined') {
    router.push(fallback);
    return;
  }

  const referrerIsLocal = document.referrer
    ? new URL(document.referrer, window.location.href).origin === window.location.origin
    : false;

  if (window.history.length > 1 && referrerIsLocal) {
    router.back();
    return;
  }

  router.push(fallback);
}
