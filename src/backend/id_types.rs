pub trait IdT {
    fn id(&self) -> i32;

    fn new(id: i32) -> Self;
}

pub trait IndexedIdT: IdT {
    fn as_idx(&self) -> usize;

    fn is_in_range(
        &self,
        lower_bound: i32,
        upper_bound: i32,
    ) -> bool;
}

#[derive(Debug, PartialEq, Eq, Clone, Hash, Copy)]
pub struct VehicleIdT {
    id: i32,
}

#[derive(Debug, PartialEq, Eq, Clone, Hash, Copy)]
pub struct CompanyIdT {
    id: i32,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct ZoneIdT {
    id: i32,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct TourIdT {
    id: i32,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy, Hash)]
pub struct UserIdT {
    id: i32,
}

#[derive(Debug, PartialEq, Eq, Clone, PartialOrd, Ord)]
pub struct EventIdT {
    id: i32,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AddressIdT {
    id: i32,
}

macro_rules! impl_IdT {
    (for $($t:ty),+) => {
        $(impl IdT for $t {
            fn id(&self) -> i32 {
                self.id
            }

            fn new(id: i32) -> Self {
                Self { id }
            }
        })*
    }
}
impl_IdT!(for VehicleIdT, CompanyIdT, ZoneIdT, AddressIdT, UserIdT, TourIdT, EventIdT );

macro_rules! impl_IndexedIdT {
    (for $($t:ty),+) => {
        $(impl IndexedIdT for $t {
            fn as_idx(&self) -> usize {
                assert!(self.id > 0);
                (self.id() - 1) as usize
            }

            fn is_in_range(
                &self,
                lower_bound: i32,
                upper_bound: i32,
            ) -> bool {
                assert!(lower_bound < upper_bound);
                lower_bound <= self.id && self.id <= upper_bound
            }
        })*
    }
}
impl_IndexedIdT!(for VehicleIdT,CompanyIdT,ZoneIdT,AddressIdT);

#[cfg(test)]
mod test {
    use std::any::Any;

    use crate::backend::id_types::IndexedIdT;

    use super::{CompanyIdT, IdT, VehicleIdT};

    #[test]
    fn test_id_types_are_different() {
        assert_ne!(CompanyIdT::new(1).type_id(), VehicleIdT::new(1).type_id());
        assert_eq!(CompanyIdT::new(1).type_id(), CompanyIdT::new(1).type_id());
    }

    #[should_panic]
    #[test]
    fn test_in_range_panic1() {
        let c_id = CompanyIdT::new(3);
        assert!(c_id.is_in_range(3, 3));
    }

    #[should_panic]
    #[test]
    fn test_in_range_panic2() {
        let c_id = CompanyIdT::new(3);
        assert!(c_id.is_in_range(4, 3));
    }

    #[test]
    fn test_in_range() {
        let c_id = CompanyIdT::new(3);
        assert!(c_id.is_in_range(3, 4));
        assert!(c_id.is_in_range(2, 3));

        assert!(!c_id.is_in_range(4, 5));
        assert!(!c_id.is_in_range(1, 2));
    }
}
