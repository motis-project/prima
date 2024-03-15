use crate::be::backend::CapacityKey;
use crate::be::interval::Interval;
use crate::{error, info};
use crate::{AppState, State};
use sea_orm::{ActiveValue, DeleteResult, EntityTrait};
use std::collections::HashMap;

pub struct Capacities {
    pub capacities: HashMap<CapacityKey, i32>,
    pub do_not_insert: bool,
    pub mark_delete: Vec<CapacityKey>,
    pub to_insert_keys: Vec<CapacityKey>,
    pub to_insert_amounts: Vec<i32>,
    pub to_insert_ids: Vec<i32>,
}
impl Capacities {
    async fn insert_into_db(
        &self,
        State(s): State<AppState>,
        key: &CapacityKey,
        new_amount: i32,
    ) -> i32 {
        let active_m = capacity::ActiveModel {
            id: ActiveValue::NotSet,
            company: ActiveValue::Set(key.company),
            amount: ActiveValue::Set(new_amount),
            vehicle_specifics: ActiveValue::Set(key.vehicle_specs_id),
            start_time: ActiveValue::Set(key.interval.start_time),
            end_time: ActiveValue::Set(key.interval.end_time),
        };
        let result = Capacity::insert(active_m.clone())
            .exec(s.clone().db())
            .await;

        match result {
            Ok(_) => {
                info!("Capacity created");
                return result.unwrap().last_insert_id;
            }
            Err(e) => error!("Error creating capacity: {e:?}"),
        }
        -1
    }

    async fn insert_new_capacity(
        &mut self,
        State(s): State<AppState>,
        vehicle_specs: i32,
        new_company: i32,
        new_interval: &mut Interval,
        new_amount: i32,
    ) {
        let mut overlap_found = false;
        for (key, old_amount) in self.capacities.iter() {
            let old_interval = key.interval;
            if key.company != new_company
                || key.vehicle_specs_id != vehicle_specs
                || !old_interval.touches(new_interval)
            {
                continue;
            }
            if new_interval.contains(&old_interval) {
                println!(
                    "delete==============================================={} contains {}",
                    new_interval, old_interval
                );
                self.mark_delete.push(*key);
                continue;
            }
            if *old_amount == new_amount {
                if old_interval.contains(&new_interval) {
                    println!(
                        "do nothing==============================================={}",
                        new_interval
                    );
                    self.do_not_insert = true;
                    break;
                }
                if new_interval.overlaps(&old_interval) {
                    println!(
                        "merge==============================================={} and {}",
                        old_interval, new_interval
                    );
                    new_interval.merge(&old_interval);
                    self.mark_delete.push(*key);
                    if overlap_found {
                        break;
                    }
                    overlap_found = true;
                    continue;
                }
            } else {
                if old_interval.contains(new_interval) {
                    let (left, right) = old_interval.split(&new_interval);
                    println!("split==============================================={} split by{} => {}, {}",old_interval,new_interval, left, right);
                    self.to_insert_keys.push(CapacityKey {
                        interval: left,
                        vehicle_specs_id: key.vehicle_specs_id,
                        company: key.company,
                        id: -1,
                    });
                    self.to_insert_keys.push(CapacityKey {
                        interval: right,
                        vehicle_specs_id: key.vehicle_specs_id,
                        company: key.company,
                        id: -1,
                    });
                    self.to_insert_amounts.push(*old_amount);
                    self.to_insert_amounts.push(*old_amount);
                    self.mark_delete.push(*key);
                    break;
                }
                if new_interval.overlaps(&old_interval) {
                    println!(
                        "cut==============================================={} by {} => {}",
                        old_interval,
                        new_interval,
                        new_interval.cut(&old_interval)
                    );
                    self.to_insert_keys.push(CapacityKey {
                        interval: new_interval.cut(&old_interval),
                        vehicle_specs_id: key.vehicle_specs_id,
                        company: key.company,
                        id: -1,
                    });
                    self.to_insert_amounts.push(*old_amount);
                    println!(
                        "__________________________ keys to insert#: {} amounts to insert#:{}",
                        self.to_insert_keys.len(),
                        self.to_insert_amounts.len()
                    );
                    self.mark_delete.push(*key);
                    println!(
                        "__________________________ keys to delete#: {}",
                        self.mark_delete.len()
                    );
                    if overlap_found {
                        break;
                    }
                    overlap_found = true;
                    continue;
                }
            }
        }
        if !self.do_not_insert {
            let new_id: i32 = self
                .insert_into_db(
                    State(s),
                    &CapacityKey {
                        vehicle_specs_id: vehicle_specs,
                        company: new_company,
                        interval: *new_interval,
                        id: -1,
                    },
                    new_amount,
                )
                .await;
            self.capacities.insert(
                CapacityKey {
                    vehicle_specs_id: vehicle_specs,
                    company: new_company,
                    interval: *new_interval,
                    id: new_id,
                },
                new_amount,
            );
            println!("__________________inserted interval: {}", new_interval);
        }
        self.do_not_insert = false;
    }
    async fn delete_marked(
        &mut self,
        State(s): State<AppState>,
    ) {
        println!("___________________delete_marked___________");
        for key in self.mark_delete.clone() {
            println!(
                "__________________start deleting interval: {}",
                key.interval
            );
            let res: Result<DeleteResult, migration::DbErr> =
                Capacity::delete_by_id(key.id).exec(s.clone().db()).await;

            match res {
                Ok(_) => {
                    info!("Interval {} deleted from db", key.interval)
                }
                Err(e) => error!("Error deleting interval: {e:?}"),
            }

            self.capacities.remove(&key);
            println!("__________________deleted interval: {}", key.interval);
        }
        self.mark_delete.clear();
    }
    async fn insert_collected_into_db(
        &mut self,
        State(s): State<AppState>,
    ) {
        println!(
            "______insert collected into db________ keys to insert#: {} amounts to insert#:{}",
            self.to_insert_keys.len(),
            self.to_insert_amounts.len()
        );
        for (pos, key) in self.to_insert_keys.iter().enumerate() {
            println!(
                "__________________start inserting interval into db: {}",
                key.interval
            );
            let new_id: i32 = self
                .insert_into_db(State(s.clone()), key, self.to_insert_amounts[pos])
                .await;
            self.to_insert_ids.push(new_id);
            println!(
                "__________________inserted interval into db: {}",
                key.interval
            );
        }
    }

    fn insert_collected(&mut self) {
        println!(
            "______insert collected________ keys to insert#: {} amounts to insert#:{}",
            self.to_insert_keys.len(),
            self.to_insert_amounts.len()
        );
        for (pos, key) in self.to_insert_keys.iter_mut().enumerate() {
            key.id = self.to_insert_ids[pos];
            self.capacities.insert(*key, self.to_insert_amounts[pos]);
            println!("__________________inserted interval: {}", key.interval);
        }
        self.to_insert_amounts.clear();
        self.to_insert_keys.clear();
    }

    pub async fn insert(
        &mut self,
        State(s): State<AppState>,
        vehicle_specs: i32,
        new_company: i32,
        new_interval: &mut Interval,
        new_amount: i32,
    ) {
        self.insert_new_capacity(
            State(s.clone()),
            vehicle_specs,
            new_company,
            new_interval,
            new_amount,
        )
        .await;
        println!("________________________________insert_new_capcity is done");
        self.insert_collected_into_db(State(s.clone())).await;
        self.insert_collected();
        self.delete_marked(State(s)).await;
    }
}
