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

function useMyLocation() {
  console.log("Location button clicked");

  if (!navigator.geolocation) {
    alert("Geolocation not supported by this browser");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      console.log("Permission granted");

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      const sourceInput = document.getElementById("source");
      sourceInput.dataset.lat = lat;
      sourceInput.dataset.lon = lon;

      map.setView([lat, lon], 14);
      L.marker([lat, lon]).addTo(map).bindPopup("You are here").openPopup();

      sourceInput.value = "My Location";
    },
    error => {
      console.error("Geolocation error:", error);

      if (error.code === 1) alert("Location permission denied");
      if (error.code === 2) alert("Position unavailable");
      if (error.code === 3) alert("Location request timed out");
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

const tourSteps = [
  {
    element: "#source",
    text: "Start by choosing your starting point. Type and select a place from suggestions."
  },
  {
    element: ".loc-btn",
    text: "Click here to use your current location as the starting point."
  },
  {
    element: "#destination",
    text: "Now choose your destination from the suggestions."
  },
  {
    element: ".route-btn",
    text: "Click here to calculate the best route."
  },
  {
    element: ".modes",
    text: "Switch between Car, Cycling, and Walking routes."
  },
  {
    element: "#map",
    text: "This map shows your route. Zoom and drag to explore."
  }
];

let currentStep = 0;

function startTour() {
  document.getElementById("tour-overlay").style.display = "block";
  document.getElementById("tour-tooltip").style.display = "block";
  showStep();
}

function showStep() {
  const step = tourSteps[currentStep];
  const el = document.querySelector(step.element);

  if (!el) return;

  const rect = el.getBoundingClientRect();
  const tooltip = document.getElementById("tour-tooltip");
  const text = document.getElementById("tour-text");

  text.innerText = step.text;

  tooltip.style.top = rect.bottom + window.scrollY + 10 + "px";
  tooltip.style.left = rect.left + window.scrollX + "px";
  tooltip.className = "tooltip-bottom";

  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function nextStep() {
  currentStep++;
  if (currentStep >= tourSteps.length) {
    endTour();
  } else {
    showStep();
  }
}

function endTour() {
  document.getElementById("tour-overlay").style.display = "none";
  document.getElementById("tour-tooltip").style.display = "none";
  localStorage.setItem("tourDone", "yes");
}
