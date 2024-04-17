use geo::Point;

use crate::backend::geo_from_str::point_from_str;

#[allow(dead_code)]
pub const P1_BAUTZEN_OST: &str = r#"{
  "coordinates": [
    14.378378034923514,
    51.344226544488095
  ],
  "type": "Point"
}"#;

#[allow(dead_code)]
pub const P2_BAUTZEN_OST: &str = r#"{
  "coordinates": [
    14.331422107936675,
    51.347412537500446
  ],
  "type": "Point"
}"#;

#[allow(dead_code)]
pub const P3_BAUTZEN_OST: &str = r#"{
  "coordinates": [
    14.564385235549707,
    51.17845730664959
  ],
  "type": "Point"
}"#;

#[allow(dead_code)]
pub const P4_BAUTZEN_OST: &str = r#"{
  "coordinates": [
    14.169587948391865,
    51.14995235819626
  ],
  "type": "Point"
}"#;

#[allow(dead_code)]
pub const P1_BAUTZEN_WEST: &str = r#"{
    "coordinates": [
      14.229077809354123,
      51.4448380558822
    ],
    "type": "Point"
  }"#;

#[allow(dead_code)]
pub const P2_BAUTZEN_WEST: &str = r#"{
    "coordinates": [
      14.105962686913898,
      51.44691344809769
    ],
    "type": "Point"
}"#;

#[allow(dead_code)]
pub const P3_BAUTZEN_WEST: &str = r#"{
  "coordinates": [
    13.96519847594351,
    51.34745819293906
  ],
  "type": "Point"
}"#;

#[allow(dead_code)]
pub const P4_BAUTZEN_WEST: &str = r#"{
    "coordinates": [
      13.853059630285287,
      51.221411427881804
    ],
    "type": "Point"
}"#;

#[allow(dead_code)]
pub const P1_GORLITZ: &str = r#"{
    "coordinates": [
      14.841968625266304,
      51.262332903493416
    ],
    "type": "Point"
  }"#;

#[allow(dead_code)]
pub const P2_GORLITZ: &str = r#"{
  "coordinates": [
    14.739116792582934,
    51.0057564482201
  ],
  "type": "Point"
}"#;

#[allow(dead_code)]
pub const P3_GORLITZ: &str = r#"{
  "coordinates": [
    14.867460483919075,
    51.36480653062725
  ],
  "type": "Point"
}"#;

#[allow(dead_code)]
pub const P4_GORLITZ: &str = r#"{
  "coordinates": [
    14.621498570053717,
    51.4342088690766
  ],
  "type": "Point"
}"#;

//Lisbon
#[allow(dead_code)]
pub const P1_OUTSIDE: &str = r#"{
    "coordinates": [
      -9.133796076538431,
      38.713133100650225
    ],
    "type": "Point"
  }"#;

//USA
#[allow(dead_code)]
pub const P2_OUTSIDE: &str = r#"{
      "coordinates": [
        -113.85522390635406,
        45.75338601832158
      ],
      "type": "Point"
    }"#;

//Frankfurt
#[allow(dead_code)]
pub const P3_OUTSIDE: &str = r#"{
        "coordinates": [
          8.710410671890173,
          50.10046771409128
        ],
        "type": "Point"
      }"#;

//in sea in Görlitz (negative area of multipolygon)
#[allow(dead_code)]
pub const P4_OUTSIDE: &str = r#"{
  "coordinates": [
    14.95627654769305,
    51.084602306508486
  ],
  "type": "Point"
}"#;

#[allow(dead_code)]
pub struct TestPoints {
    pub outside: Vec<Point>,
    pub bautzen_ost: Vec<Point>,
    pub bautzen_west: Vec<Point>,
    pub gorlitz: Vec<Point>,
}

impl TestPoints {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            gorlitz: vec![
                point_from_str(P1_GORLITZ).unwrap(),
                point_from_str(P2_GORLITZ).unwrap(),
                point_from_str(P3_GORLITZ).unwrap(),
                point_from_str(P4_GORLITZ).unwrap(),
            ],
            bautzen_ost: vec![
                point_from_str(P1_BAUTZEN_OST).unwrap(),
                point_from_str(P2_BAUTZEN_OST).unwrap(),
                point_from_str(P3_BAUTZEN_OST).unwrap(),
                point_from_str(P4_BAUTZEN_OST).unwrap(),
            ],
            bautzen_west: vec![
                point_from_str(P1_BAUTZEN_WEST).unwrap(),
                point_from_str(P2_BAUTZEN_WEST).unwrap(),
                point_from_str(P3_BAUTZEN_WEST).unwrap(),
                point_from_str(P4_BAUTZEN_WEST).unwrap(),
            ],
            outside: vec![
                point_from_str(P1_OUTSIDE).unwrap(),
                point_from_str(P2_OUTSIDE).unwrap(),
                point_from_str(P3_OUTSIDE).unwrap(),
                point_from_str(P4_OUTSIDE).unwrap(),
            ],
        }
    }
}
