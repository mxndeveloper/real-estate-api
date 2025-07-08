import axios from "axios";

export const geocodeAddress = async (address) => {
  try {
    // Validate input
    if (!address || typeof address !== "string" || address.trim().length < 3) {
      throw new Error("Please enter a valid suburb or city");
    }

    // Call the new Geocoding API with POST
    const response = await axios.post(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: address.trim(),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
        },
      }
    );

    // Handle response
    if (!response.data?.places?.length) {
      throw new Error("No results found for this address");
    }

    const firstResult = response.data.places[0];
    
    if (!firstResult.location?.latitude || !firstResult.location?.longitude) {
      throw new Error("Invalid location data received");
    }

    return {
      location: {
        type: "Point",
        coordinates: [
          firstResult.location.longitude,
          firstResult.location.latitude,
        ],
      },
      googleMap: {
        formattedAddress: firstResult.formattedAddress,
        displayName: firstResult.displayName?.text || address,
      },
    };
  } catch (err) {
    console.error("Geocoding Error:", err);
    
    // Handle specific API errors
    if (err.response?.data?.error?.message) {
      throw new Error(`Google API Error: ${err.response.data.error.message}`);
    }
    
    throw new Error(
      err.message || "Error in geocoding address. Please try again."
    );
  }
};