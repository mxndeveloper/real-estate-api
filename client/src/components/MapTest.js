// client/src/components/MapTest.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "400px",
};

const defaultCenter = {
  lat: 40.7118,  // Changed to New York coordinates for better test data
  lng: -74.0060,
};

function MapTest() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [center, setCenter] = useState(defaultCenter);

  // Fetch nearby places
  useEffect(() => {
    const fetchNearbyPlaces = async () => {
      try {
        const response = await axios.get("/api/maps/nearby", {
          params: {
            latitude: center.lat,
            longitude: center.lng,
            radius: 1500,
          },
        });
        
        // Transform data to match expected format
        const formattedPlaces = response.data.places.map(place => ({
          ...place,
          place_id: place.id || place.formattedAddress, // Create unique ID
          geometry: {
            location: {
              lat: place.location.latitude,
              lng: place.location.longitude
            }
          },
          name: place.displayName.text
        }));
        
        setPlaces(formattedPlaces);
        setError(null);
      } catch (error) {
        console.error("API Error:", error);
        setError("Failed to load places. Please try again.");
        setPlaces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyPlaces();
  }, [center]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Google Maps API Test</h2>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      <LoadScript 
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
        loadingElement={<div style={{ height: '100%' }} />}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={14}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
          }}
        >
          {places.map((place) => (
            <Marker
              key={place.place_id}
              position={{
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
              }}
              onClick={() => setSelectedPlace(place)}
            />
          ))}
          
          {selectedPlace && (
            <InfoWindow
              position={{
                lat: selectedPlace.geometry.location.lat,
                lng: selectedPlace.geometry.location.lng,
              }}
              onCloseClick={() => setSelectedPlace(null)}
            >
              <div>
                <h4>{selectedPlace.name}</h4>
                <p>{selectedPlace.formattedAddress}</p>
                <p>Types: {selectedPlace.types?.join(', ') || 'N/A'}</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>

      {loading ? (
        <p>Loading places...</p>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <h3>Nearby Places:</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {places.map((place) => (
              <li 
                key={place.place_id} 
                style={{ 
                  margin: '10px 0', 
                  padding: '10px', 
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setCenter({
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng
                  });
                  setSelectedPlace(place);
                }}
              >
                <strong>{place.name}</strong>
                <div>{place.formattedAddress}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MapTest;