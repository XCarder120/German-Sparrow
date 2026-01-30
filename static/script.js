// ---------------- MAP SETUP ----------------
let map = L.map("map", {
  zoomControl: false
}).setView([28.6139, 77.2090], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

L.control.zoom({
  position: "topright"
}).addTo(map);


let routeLayer = null;
let storedRoutes = {};
let coordinates = null;

// ---------------- AUTOCOMPLETE ----------------
async function fetchSuggestions(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`;
  const res = await fetch(url);
  return await res.json();
}

function setupAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  const box = document.createElement("div");
  box.className = "suggestions";
  input.parentNode.appendChild(box);

  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 3) {
        box.style.display = "none";
        return;
      }

      const results = await fetchSuggestions(q);
      box.innerHTML = "";
      box.style.display = "block";

      results.forEach(place => {
        const item = document.createElement("div");
        item.innerText = place.display_name;

        item.onclick = () => {
          input.value = place.display_name;
          input.dataset.lat = place.lat;
          input.dataset.lon = place.lon;
          box.style.display = "none";
        };

        box.appendChild(item);
      });
    }, 300); // debounce (important!)
  });

  document.addEventListener("click", e => {
    if (!box.contains(e.target) && e.target !== input) {
      box.style.display = "none";
    }
  });
}

// Attach to inputs
setupAutocomplete("source");
setupAutocomplete("destination");


// ---------------- FIND ROUTE ----------------
async function findPlaces() {
  const sourceInput = document.getElementById("source");
  const destinationInput = document.getElementById("destination");

  // ✅ Ensure user selected from suggestions
  if (!sourceInput.dataset.lat || !destinationInput.dataset.lat) {
    alert("Please select locations from suggestions");
    return;
  }

  // ✅ ADD THESE CONSTANTS HERE
  const src = [
    parseFloat(sourceInput.dataset.lon),
    parseFloat(sourceInput.dataset.lat)
  ];

  const dest = [
    parseFloat(destinationInput.dataset.lon),
    parseFloat(destinationInput.dataset.lat)
  ];

  // ✅ Coordinates format expected by your Flask API
  const coordinates = [src, dest];

  try {
    const response = await fetch("/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates })
    });

    storedRoutes = await response.json();

    // Default mode
    setMode("Car");

  } catch (err) {
    console.error(err);
    alert("Failed to fetch route");
  }
}

async function useMyLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      // Save coordinates for routing
      const sourceInput = document.getElementById("source");
      sourceInput.dataset.lat = lat;
      sourceInput.dataset.lon = lon;

      // Center map like Google Maps
      map.setView([lat, lon], 14);
      L.marker([lat, lon]).addTo(map).bindPopup("You are here").openPopup();

      // Reverse geocode to get place name
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      const res = await fetch(url);
      const data = await res.json();

      sourceInput.value = data.display_name || "My Location";
    },
    error => {
      alert("Location permission denied");
    }
  );
}

// ---------------- DRAW ROUTE ----------------
function drawRoute(modeName) {
  const data = storedRoutes[modeName];
  if (!data || data.error) return;

  if (routeLayer) map.removeLayer(routeLayer);

  routeLayer = L.geoJSON(data.geojson, {
    style: { weight: 5 }
  }).addTo(map);

  map.fitBounds(routeLayer.getBounds());

  document.getElementById("info").innerHTML = `
    <b>${modeName}</b><br>
    🛣 ${data.distance_km} km<br>
    ⏱ ${data.time_min} min
  `;
}

// ---------------- MODE BUTTONS ----------------
function setMode(modeName) {
  document.querySelectorAll(".modes button").forEach(btn =>
    btn.classList.remove("active")
  );

  const btn = [...document.querySelectorAll(".modes button")]
    .find(b => b.innerText.includes(modeName[0]));

  if (btn) btn.classList.add("active");

  drawRoute(modeName);
}
