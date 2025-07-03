import NodeGeocoder from 'node-geocoder';

const geocoder = NodeGeocoder({
    provider:"google",
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    formatter: null,
});

