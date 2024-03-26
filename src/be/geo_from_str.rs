use crate::error;
use core::result::Result::Ok;
use geo::MultiPolygon;
use geojson::{GeoJson, Geometry};

pub fn multi_polygon_from_str(s: &str) -> Result<MultiPolygon, geojson::Error> {
    match s.parse::<GeoJson>() {
        Err(e) => Err(e),
        Ok(geo_json) => match Geometry::try_from(geo_json) {
            Err(e) => Err(e),
            Ok(feature) => MultiPolygon::try_from(feature),
        },
    }
}

pub fn point_from_str(s: &str) -> Result<geo::Point, geojson::Error> {
    match s.parse::<GeoJson>() {
        Err(e) => {
            error!("{}", e);
            return Err(e);
        }
        Ok(geojson) => match Geometry::try_from(geojson) {
            Err(e) => {
                error!("{}", e);
                return Err(e);
            }
            Ok(feature) => geo::Point::try_from(feature),
        },
    }
}
