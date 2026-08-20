#!/bin/bash
set -euo pipefail

GTFS_URL="https://www.opendata-oepnv.de/index.php?id=1384&tx_vrrkit_view%5Bsharing%5D=eyJkYXRhc2V0IjoiZGV1dHNjaGxhbmR3ZWl0ZS1zb2xsZmFocnBsYW5kYXRlbi1ndGZzIiwidXNlcklkIjo4OH0%3D&tx_vrrkit_view%5Baction%5D=download&tx_vrrkit_view%5Bcontroller%5D=View"
OSM_URL="https://download.geofabrik.de/europe/germany/sachsen-latest.osm.pbf"

# Download to $HOME (cached across CI runs) via a temp file, so an interrupted
# download never leaves a truncated file behind that would be reused forever.
download() {
  local url="$1" dest="$2"
  if [ -s "$dest" ]; then
    echo "$dest already there; not retrieving."
    return
  fi
  wget "$url" -O "$dest.tmp"
  mv "$dest.tmp" "$dest"
}

download "$GTFS_URL" "$HOME/GTFS.zip"
download "$OSM_URL" "$HOME/osm.pbf"

# -rf: docker creates an empty directory here when the bind mount source is
# missing, and a plain rm cannot remove that.
rm -rf osm.pbf GTFS.zip
ln -sfn "$HOME/osm.pbf" osm.pbf
ln -sfn "$HOME/GTFS.zip" GTFS.zip

docker compose up --exit-code-from motis-import motis-import
