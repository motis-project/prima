#!/bin/bash

curl -X POST --header "Content-Type: application/json" --data '{
  "destination": {
    "type": "Module",
    "target": "/osrm/one_to_many"
  },
  "content_type": "OSRMOneToManyRequest",
  "content": {
    "profile": "car",
    "direction": "Forward",
    "one": { "lat": 49.87738029, "lng": 8.64555359 },
    "many": [
      { "lat": 50.11485439, "lng": 8.65791321 },
      { "lat": 49.39444062, "lng": 8.6743927 }
    ]
  }
}' https://europe.motis-project.de/