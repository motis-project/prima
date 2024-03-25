use geo::Point;

use crate::be::geo_from_str::point_from_str;

pub const P1_BAUTZEN_OST: &str = r#"{
    "type": "Point",
      "coordinates": [
        14.388424281729897,
        51.34271309395561
      ]
  }"#;

pub const P1_BAUTZEN_WEST: &str = r#"{
    "coordinates": [
      14.025081097762154,
      51.195075641827316
    ],
    "type": "Point"
  }"#;

pub const P1_GORLITZ: &str = r#"{
    "coordinates": [
      14.841968625266304,
      51.262332903493416
    ],
    "type": "Point"
  }"#;

//Lisbon
pub const P1_OUTSIDE: &str = r#"{
    "coordinates": [
      -9.133796076538431,
      38.713133100650225
    ],
    "type": "Point"
  }"#;

//USA
pub const P2_OUTSIDE: &str = r#"{
      "coordinates": [
        -113.85522390635406,
        45.75338601832158
      ],
      "type": "Point"
    }"#;

//Frankfurt
pub const P3_OUTSIDE: &str = r#"{
        "coordinates": [
          8.710410671890173,
          50.10046771409128
        ],
        "type": "Point"
      }"#;

pub struct TestPoints {
    pub outside: Vec<Point>,
    pub bautzen_ost: Vec<Point>,
    pub bautzen_west: Vec<Point>,
    pub gorlitz: Vec<Point>,
}

impl TestPoints {
    pub fn new() -> Self {
        Self {
            gorlitz: vec![point_from_str(P1_GORLITZ).unwrap()],
            bautzen_ost: vec![point_from_str(P1_BAUTZEN_OST).unwrap()],
            bautzen_west: vec![point_from_str(P1_BAUTZEN_WEST).unwrap()],
            outside: vec![
                point_from_str(P1_OUTSIDE).unwrap(),
                point_from_str(P2_OUTSIDE).unwrap(),
                point_from_str(P3_OUTSIDE).unwrap(),
            ],
        }
    }
}
