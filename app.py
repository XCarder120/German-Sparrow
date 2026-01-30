from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

ORS_API_KEY = os.getenv("ORS_API_KEY")

MODES = {
    "Car": "driving-car",
    "Walking": "foot-walking",
    "Cycling": "cycling-regular"
}

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/route", methods=["POST"])
def route():
    if not ORS_API_KEY:
        return jsonify({"error": "ORS_API_KEY not configured"}), 500

    data = request.get_json()
    if not data or "coordinates" not in data:
        return jsonify({"error": "Invalid request body"}), 400

    coordinates = data["coordinates"]

    result = {}

    for mode_name, profile in MODES.items():
        try:
            response = requests.post(
                f"https://api.openrouteservice.org/v2/directions/{profile}/geojson",
                headers={
                    "Authorization": ORS_API_KEY,
                    "Content-Type": "application/json"
                },
                json={"coordinates": coordinates},
                timeout=10
            )

            response.raise_for_status()
            geojson_data = response.json()

            if "features" not in geojson_data or not geojson_data["features"]:
                raise ValueError("No route data returned")

            summary = geojson_data["features"][0]["properties"]["summary"]

            result[mode_name] = {
                "distance_km": round(summary["distance"] / 1000, 2),
                "time_min": round(summary["duration"] / 60, 1),
                "geojson": geojson_data
            }

        except Exception as e:
            result[mode_name] = {"error": str(e)}

    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)


# from flask import Flask, request, jsonify, render_template
# from flask_cors import CORS
# import requests

# app = Flask(__name__)
# CORS(app)

# ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjhiMDZmMzAzZDdhYjQ2ZjI5ZTAyMzYyY2RlMTkxNDI2IiwiaCI6Im11cm11cjY0In0="

# @app.route("/")
# def home():
#     return render_template("index.html")

# @app.route("/route", methods=["POST"])
# def route():
#     try:
#         data = request.json

#         response = requests.post(
#             "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
#             headers={
#                 "Authorization": ORS_API_KEY,
#                 "Content-Type": "application/json"
#             },
#             json=data
#         )

#         return jsonify(response.json())

#     except Exception as e:
#         return jsonify({"error": str(e)}), 500

# if __name__ == "__main__":
#     app.run(debug=True)
