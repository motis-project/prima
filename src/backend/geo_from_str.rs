use crate::error;
use core::result::Result::Ok;
use geo::MultiPolygon;
use geojson::{GeoJson, Geometry};

pub fn multi_polygon_from_str(s: &str) -> Result<MultiPolygon, geojson::Error> {
    //only accepts multipolygon, no featurecollection or polygon allowed
    match s.parse::<GeoJson>() {
        Err(e) => Err(e),
        Ok(geo_json) => match Geometry::try_from(geo_json) {
            Err(e) => {
                error!("{}", e);
                return Err(e);
            }
            Ok(feature) => MultiPolygon::try_from(feature),
        },
    }
}

pub fn point_from_str(s: &str) -> Result<geo::Point, geojson::Error> {
    //only accepts points, no featurecollection allowed
    match s.parse::<GeoJson>() {
        Err(e) => {
            error!("{e:?}");
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

#[cfg(test)]
mod test {
    use crate::{
        backend::geo_from_str::point_from_str,
        constants::geojson_strings::{bautzen, bautzen_ost, bautzen_west, geo_points, gorlitz},
    };
    use geo::Contains;

    use super::multi_polygon_from_str;

    #[test]
    fn test_non_matching_geo_types() {
        assert!(multi_polygon_from_str(geo_points::P1_BAUTZEN_OST).is_err());
        assert!(point_from_str(bautzen::BAUTZEN).is_err());
        assert!(multi_polygon_from_str("").is_err());
        assert!(point_from_str("").is_err());
    }

    #[test]
    fn test_matching_geo_types() {
        assert!(point_from_str(geo_points::P1_BAUTZEN_OST).is_ok());
        assert!(point_from_str(geo_points::P2_BAUTZEN_OST).is_ok());
        assert!(point_from_str(geo_points::P3_BAUTZEN_OST).is_ok());
        assert!(point_from_str(geo_points::P4_BAUTZEN_OST).is_ok());
        assert!(point_from_str(geo_points::P1_BAUTZEN_WEST).is_ok());
        assert!(point_from_str(geo_points::P2_BAUTZEN_WEST).is_ok());
        assert!(point_from_str(geo_points::P3_BAUTZEN_WEST).is_ok());
        assert!(point_from_str(geo_points::P4_BAUTZEN_WEST).is_ok());
        assert!(point_from_str(geo_points::P1_GORLITZ).is_ok());
        assert!(point_from_str(geo_points::P2_GORLITZ).is_ok());
        assert!(point_from_str(geo_points::P3_GORLITZ).is_ok());
        assert!(point_from_str(geo_points::P4_GORLITZ).is_ok());
        assert!(point_from_str(geo_points::P1_OUTSIDE).is_ok());
        assert!(point_from_str(geo_points::P2_OUTSIDE).is_ok());
        assert!(point_from_str(geo_points::P3_OUTSIDE).is_ok());
        assert!(point_from_str(geo_points::P4_OUTSIDE).is_ok());

        assert!(multi_polygon_from_str(bautzen::BAUTZEN).is_ok());
        assert!(multi_polygon_from_str(bautzen_ost::BAUTZEN_OST).is_ok());
        assert!(multi_polygon_from_str(bautzen_west::BAUTZEN_WEST).is_ok());
        assert!(multi_polygon_from_str(gorlitz::GORLITZ).is_ok());
    }

    #[test]
    fn test_points_in_correct_zones() {
        let test_points = geo_points::TestPoints::new();
        let bautzen = multi_polygon_from_str(bautzen::BAUTZEN).unwrap();
        let bautzen_ost = multi_polygon_from_str(bautzen_ost::BAUTZEN_OST).unwrap();
        let bautzen_west = multi_polygon_from_str(bautzen_west::BAUTZEN_WEST).unwrap();
        let gorlitz = multi_polygon_from_str(gorlitz::GORLITZ).unwrap();
        for p in test_points.bautzen_ost {
            assert!(bautzen.contains(&p));
            assert!(bautzen_ost.contains(&p));
            assert!(!bautzen_west.contains(&p));
            assert!(!gorlitz.contains(&p));
        }
        for p in test_points.bautzen_west {
            assert!(bautzen.contains(&p));
            assert!(!bautzen_ost.contains(&p));
            assert!(bautzen_west.contains(&p));
            assert!(!gorlitz.contains(&p));
        }
        for p in test_points.gorlitz {
            assert!(!bautzen.contains(&p));
            assert!(!bautzen_ost.contains(&p));
            assert!(!bautzen_west.contains(&p));
            assert!(gorlitz.contains(&p));
        }
        for p in test_points.outside {
            assert!(!bautzen.contains(&p));
            assert!(!bautzen_ost.contains(&p));
            assert!(!bautzen_west.contains(&p));
            assert!(!gorlitz.contains(&p));
        }
    }
}
