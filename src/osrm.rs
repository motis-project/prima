use anyhow::{anyhow, Result};
use serde::Serialize;
use serde_json::Value;
use tera::Tera;

const REQUEST_TEMPLATE: &str = r#"{
    "destination":{
        "type":"Module",
        "target":"/osrm/one_to_many"
    },
    "content_type":"OSRMOneToManyRequest",
    "content":{
        "profile":"car",
        "direction":"Forward",
        "one":{
            "lat":{{ one.lat }},
            "lng":{{ one.lng }}
        },
        "many": {{ many }}
    }
}"#;

#[derive(Serialize)]
pub struct Coordinate {
    lat: f64,
    lng: f64,
}

#[derive(Debug)]
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
        tera.add_raw_template("x", &REQUEST_TEMPLATE).unwrap();
        let client = reqwest::Client::new();
        Self { tera, client }
    }

    pub async fn one_to_many(
        &self,
        one: Coordinate,
        many: Vec<Coordinate>,
    ) -> Result<Vec<DistTime>> {
        let mut ctx = tera::Context::new();
        ctx.try_insert("one", &one)?;
        ctx.try_insert("many", &serde_json::to_string(&many).unwrap())?;

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
    use crate::osrm::{Coordinate, OSRM};
    use anyhow::Result;

    #[tokio::test]
    async fn test() -> Result<()> {
        let osrm = OSRM::new();
        let result = osrm
            .one_to_many(
                Coordinate {
                    lat: 49.87738029,
                    lng: 8.64555359,
                },
                vec![
                    Coordinate {
                        lat: 50.11485439,
                        lng: 8.65791321,
                    },
                    Coordinate {
                        lat: 49.39444062,
                        lng: 8.6743927,
                    },
                ],
            )
            .await?;
        println!("result: {result:?}");
        Ok(())
    }
}
