export type BrowserCoordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export function getCurrentCoordinates(): Promise<BrowserCoordinates> {
  if (!window.isSecureContext) {
    return Promise.reject(new Error("GPS requires a secure connection. Open the HTTPS version of PanditConnect and try again."));
  }
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Location is not supported by this browser. Enter the Puja address instead."));
  }

  const locate = (options: PositionOptions) => new Promise<BrowserCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      reject,
      options,
    );
  });

  return locate({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }).catch((firstError: GeolocationPositionError) => {
    if (firstError.code === firstError.PERMISSION_DENIED) {
      throw new Error("Location permission is blocked. Tap the lock or site-settings icon near the address bar, allow Location for PanditConnect, then try again.");
    }
    return locate({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }).catch((lastError: GeolocationPositionError) => {
      const message = lastError.code === lastError.TIMEOUT
        ? "Location took too long. Turn on device Location and Wi-Fi, then try again or enter the Puja address."
        : "Your device could not provide a location. Turn on device Location and try again or enter the Puja address.";
      throw new Error(message);
    });
  });
}
