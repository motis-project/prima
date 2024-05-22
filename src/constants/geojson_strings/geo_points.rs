use geo::Point;

use crate::backend::geo_from_str::point_from_str;

pub const P1_BAUTZEN_OST: &str = r#"{
  "type": "Point",
    "coordinates": [
      14.388424281729897,
      51.34271309395561
    ]
}"#;

pub const P2_BAUTZEN_OST: &str = r#"{
  "coordinates": [
    14.359163546182856,
    51.421657386809926
  ],
  "type": "Point"
}"#;

pub const P3_BAUTZEN_OST: &str = r#"{
  "coordinates": [
    14.554516781670685,
    51.173339659283414
  ],
  "type": "Point"
}"#;

pub const P4_BAUTZEN_OST: &str = r#"{
  "coordinates": [
    14.187381947096696,
    51.157929675768486
  ],
  "type": "Point"
}"#;

pub const P1_BAUTZEN_WEST: &str = r#"{
  "coordinates": [
    14.025081097762154,
    51.195075641827316
  ],
  "type": "Point"
}"#;

pub const P2_BAUTZEN_WEST: &str = r#"{
  "coordinates": [
    14.19340286403866,
    51.440220511859906
  ],
  "type": "Point"
}"#;

pub const P3_BAUTZEN_WEST: &str = r#"{
  "coordinates": [
    13.9528292197908,
    51.347601960830275
  ],
  "type": "Point"
}"#;

pub const P4_BAUTZEN_WEST: &str = r#"{
  "coordinates": [
    13.903059630285287,
    51.221411427881804
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

pub const P2_GORLITZ: &str = r#"{
  "coordinates": [
    14.739116792582934,
    51.0057564482201
  ],
  "type": "Point"
}"#;

pub const P3_GORLITZ: &str = r#"{
  "coordinates": [
    14.867460483919075,
    51.36480653062725
  ],
  "type": "Point"
}"#;

pub const P4_GORLITZ: &str = r#"{
  "coordinates": [
    14.621498570053717,
    51.4342088690766
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

//in sea in Görlitz (negative area of multipolygon)
pub const P4_OUTSIDE: &str = r#"{
  "coordinates": [
    14.95627654769305,
    51.084602306508486
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
                //point_from_str(P4_OUTSIDE).unwrap(),
            ],
        }
    }
}
