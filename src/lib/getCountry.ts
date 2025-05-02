/**
 * Simple function to get the user's country via browser geolocation
 * @returns Promise containing the country code (e.g., 'FR')
 */
export async function getCountry(): Promise<string> {
  // Default value if geolocation fails or is not available
  const defaultCountry = "FR";

  // Check if we are in the browser and if the geolocation API is available
  if (typeof window === "undefined" || !navigator.geolocation) {
    return defaultCountry;
  }

  try {
    // Get coordinates via the browser's geolocation API
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000, // 5-second timeout
          maximumAge: 3600000, // Accept cached results up to 1 hour old
        });
      },
    );

    // Use OpenStreetMap's simple reverse geocoding service
    const { latitude, longitude } = position.coords;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=3`,
    );

    if (!response.ok) {
      return defaultCountry;
    }

    const data = await response.json();

    // Extract the country code from the results
    const countryCode = data.address?.country_code?.toUpperCase();

    return countryCode || defaultCountry;
  } catch (error) {
    console.log("Geolocation error:", error);
    return defaultCountry;
  }
}
