// ---------------- MAP SETUP ----------------
let map = L.map("map").setView([28.6139, 77.2090], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

let routeLayer = null;
let storedRoutes = {};
let coordinates = null;

// ---------------- AUTOCOMPLETE ----------------
async function getSuggestions(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`;
  const res = await fetch(url);
  return await res.json();
}

function attachAutocomplete(inputId) {
  const input = document.getElementById(inputId);

  const box = document.createElement("div");
  box.className = "suggestions";
  input.parentNode.appendChild(box);

  let timeout;

  input.addEventListener("input", () => {
    clearTimeout(timeout);

    timeout = setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 3) {
        box.style.display = "none";
        return;
      }

      const results = await getSuggestions(q);
      box.innerHTML = "";
      box.style.display = "block";

      results.forEach(place => {
        const div = document.createElement("div");
        div.innerText = place.display_name;

        div.onclick = () => {
          input.value = place.display_name;
          input.dataset.lat = place.lat;
          input.dataset.lon = place.lon;
          box.style.display = "none";
        };

        box.appendChild(div);
      });
    }, 300);
  });

  document.addEventListener("click", e => {
    if (!box.contains(e.target) && e.target !== input) {
      box.style.display = "none";
    }
  });
}

// Attach autocomplete
attachAutocomplete("source");
attachAutocomplete("destination");

// ---------------- FIND ROUTE ----------------
async function findPlaces() {
  const srcInput = document.getElementById("source");
  const destInput = document.getElementById("destination");

  if (!srcInput.dataset.lat || !destInput.dataset.lat) {
    alert("Please select locations from suggestions");
    return;
  }

  coordinates = [
    [parseFloat(srcInput.dataset.lon), parseFloat(srcInput.dataset.lat)],
    [parseFloat(destInput.dataset.lon), parseFloat(destInput.dataset.lat)]
  ];

  try {
    const response = await fetch("/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates })
    });

    storedRoutes = await response.json();
    setMode("Car");

  } catch (err) {
    alert("Failed to fetch route");
    console.error(err);
  }
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
