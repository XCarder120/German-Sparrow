// ---------------- MAP SETUP ----------------
let map = L.map("map").setView([28.6139, 77.2090], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

let routeLayer = null;       // Current displayed route
let storedRoutes = {};       // Stores GeoJSON + summary for all modes
let coordinates = null;      // Current source/destination coordinates

// ---------------- GEOCODING ----------------
async function geocode(place) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${place}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data || data.length === 0) throw new Error("Place not found: " + place);

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon)
  };
}

// ---------------- FIND PLACES ----------------
async function findPlaces() {
  const source = document.getElementById("source").value.trim();
  const destination = document.getElementById("destination").value.trim();

  if (!source || !destination) {
    alert("Please enter both source and destination");
    return;
  }

  try {
    const src = await geocode(source);
    const dest = await geocode(destination);

    coordinates = [
      [src.lon, src.lat],
      [dest.lon, dest.lat]
    ];

    // Fetch all modes once
    const response = await fetch("/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates })
    });

    storedRoutes = await response.json();

    // Draw default mode: Car
    drawRoute("Car");

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// ---------------- DRAW ROUTE ----------------
function drawRoute(modeName) {
  if (!storedRoutes[modeName]) {
    console.log("No data for mode:", modeName, storedRoutes);
    alert("Route data not available for " + modeName);
    return;
  }

  const data = storedRoutes[modeName];

  // Remove old route if exists
  if (routeLayer) {
    map.removeLayer(routeLayer);
  }

  // Draw new route
  routeLayer = L.geoJSON(data.geojson).addTo(map);
  map.fitBounds(routeLayer.getBounds());

  // Update info box
  document.getElementById("info").innerHTML = `
    <b>Mode:</b> ${modeName}<br>
    🛣 Distance: ${data.distance_km} km<br>
    ⏱ Estimated Time: ${data.time_min} minutes
  `;
}

// ---------------- MODE BUTTONS ----------------
function setMode(modeName) {
  drawRoute(modeName);
}
