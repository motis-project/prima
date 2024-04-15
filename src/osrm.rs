use anyhow::{anyhow, Result};
use geo::Coord;
use serde::Serialize;
use serde_json::Value;
use tera::Tera;
pub enum Dir {
    Forward,
    Backward,
}

const FORWARD_REQUEST_TEMPLATE: &str = r#"{
    "destination":{
        "type":"Module",
        "target":"/osrm/one_to_many"
    },
    "content_type":"OSRMOneToManyRequest",
    "content":{
        "profile":"car",
        "direction":"Forward",
        "one":{
            "lat":{{ one.x }},
            "lng":{{ one.y }}
        },
        "many": {{ many }}
    }
}"#;

const BACKWARD_REQUEST_TEMPLATE: &str = r#"{
    "destination":{
        "type":"Module",
        "target":"/osrm/one_to_many"
    },
    "content_type":"OSRMOneToManyRequest",
    "content":{
        "profile":"car",
        "direction":"Backward",
        "one":{
            "lat":{{ one.x }},
            "lng":{{ one.y }}
        },
        "many": {{ many }}
    }
}"#;

#[derive(Serialize)]
pub struct Coordinate {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Copy, Clone)]
pub struct DistTime {
    pub dist: f64,
    pub time: f64,
}

pub struct OSRM {
    client: reqwest::Client,
    tera: tera::Tera,
}

impl OSRM {
    pub fn new() -> Self {
        let mut tera = Tera::default();
        tera.add_raw_template("x", FORWARD_REQUEST_TEMPLATE)
            .unwrap();
        let client = reqwest::Client::new();
        Self { tera, client }
    }

    pub async fn one_to_many(
        &self,
        one: Coord,
        many: Vec<Coord>,
        direction: Dir,
    ) -> Result<Vec<DistTime>> {
        let mut ctx = tera::Context::new();
        ctx.try_insert("one", &one)?;
        ctx.try_insert(
            "many",
            &serde_json::to_string(&many)
                .unwrap()
                .replace('x', "lat")
                .replace('y', "lng"),
        )?;

        println!(
            "request: {}  -  {}",
            &serde_json::to_string(&one).unwrap(),
            &serde_json::to_string(&many)
                .unwrap()
                .replace('x', "lat")
                .replace('y', "lng")
        );

        let request = self.tera.render("x", &ctx)?;
        let res = self
            .client
            .post("https://europe.motis-project.de/")
            .body(request)
            .send()
            .await?
            .text()
            .await?;

        let v: Value = serde_json::from_str(&res)?;
        Ok(v.get("content")
            .ok_or_else(|| anyhow!("MOTIS response had no content"))?
            .get("costs")
            .ok_or_else(|| anyhow!("MOTIS response had no costs"))?
            .as_array()
            .ok_or_else(|| anyhow!("MOTIS costs were not an array"))?
            .iter()
            .filter_map(|e| {
                Some(DistTime {
                    dist: e.get("distance")?.as_f64()?,
                    time: e.get("duration")?.as_f64()?,
                })
            })
            .collect())
    }
}

#[cfg(test)]
mod test {
    use crate::{
        constants::geo_points::TestPoints,
        osrm::{
            Coord,
            Dir::{Backward, Forward},
            OSRM,
        },
    };
    use anyhow::Result;

    #[tokio::test]
    async fn test() -> Result<()> {
        let osrm = OSRM::new();
        let result = osrm
            .one_to_many(
                Coord {
                    x: 49.87738029,
                    y: 8.64555359,
                },
                vec![
                    Coord {
                        x: 50.11485439,
                        y: 8.65791321,
                    },
                    Coord {
                        x: 49.39444062,
                        y: 8.6743927,
                    },
                ],
                Forward,
            )
            .await?;
        println!("result: {result:?}");
        Ok(())
    }

    #[tokio::test]
    async fn test2() -> Result<()> {
        let osrm = OSRM::new();
        let test_points = TestPoints::new();
        let result = osrm
            .one_to_many(
                Coord {
                    y: (test_points.bautzen_west[0].x() as f32) as f64,
                    x: (test_points.bautzen_west[0].y() as f32) as f64,
                },
                vec![
                    Coord {
                        y: (test_points.bautzen_west[1].x() as f32) as f64,
                        x: (test_points.bautzen_west[1].y() as f32) as f64,
                    },
                    Coord {
                        y: (test_points.bautzen_west[2].x() as f32) as f64,
                        x: (test_points.bautzen_west[2].y() as f32) as f64,
                    },
                ],
                Forward,
            )
            .await?;
        println!("result: {result:?}");
        Ok(())
    }
}
