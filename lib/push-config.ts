// VAPID public keys are intentionally public and identify this application
// when a browser creates a push subscription. The private key stays in Vercel.
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim()
  || "BEdHj9gIT89sCMIH4y7gOcldRGLgsSbb0JKQyuLLEuPBwmAoSuW9IPa9PfOtcNSOFL4PbB4Ni9XaayUjPEOt12M";
