#!/bin/bash

wget -nc "https://www.opendata-oepnv.de/index.php?id=1384&tx_vrrkit_view%5Bsharing%5D=eyJkYXRhc2V0IjoiZGV1dHNjaGxhbmR3ZWl0ZS1zb2xsZmFocnBsYW5kYXRlbi1ndGZzIiwidXNlcklkIjo4OH0%3D&tx_vrrkit_view%5Baction%5D=download&tx_vrrkit_view%5Bcontroller%5D=View" -O GTFS.zip
wget -nc "https://download.geofabrik.de/europe/germany/sachsen-latest.osm.pbf" -O osm.pbf

docker compose up motis-import