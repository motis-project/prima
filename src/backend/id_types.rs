pub trait IdT {
    fn id(&self) -> i32;

    fn new(id: i32) -> Self;
}

pub trait IndexedIdT: IdT {
    fn as_idx(&self) -> usize {
        assert!(self.id() > 0);
        (self.id() - 1) as usize
    }

    fn is_in_range(
        &self,
        lower_bound: i32,
        upper_bound: i32,
    ) -> bool {
        assert!(lower_bound < upper_bound);
        lower_bound <= self.id() && self.id() <= upper_bound
    }
}

#[derive(PartialEq, Eq, Clone, Hash, Copy)]
pub struct VehicleIdT {
    id: i32,
}

#[derive(PartialEq, Eq, Clone, Debug, Hash, Copy)]
pub struct CompanyIdT {
    id: i32,
}

#[derive(PartialEq, Eq, Clone)]
pub struct ZoneIdT {
    id: i32,
}

#[derive(PartialEq, Eq, Clone, Copy)]
pub struct TourIdT {
    id: i32,
}

#[derive(PartialEq, Eq, Clone, Copy, Hash)]
pub struct UserIdT {
    id: i32,
}

#[derive(PartialEq, Eq, Clone)]
pub struct EventIdT {
    id: i32,
}

#[derive(PartialEq, Eq, Clone)]
pub struct AddressIdT {
    id: i32,
}

impl IdT for AddressIdT {
    fn id(&self) -> i32 {
        self.id
    }

    fn new(id: i32) -> Self {
        Self { id }
    }
}

impl IdT for EventIdT {
    fn id(&self) -> i32 {
        self.id
    }

    fn new(id: i32) -> Self {
        Self { id }
    }
}

impl IdT for UserIdT {
    fn id(&self) -> i32 {
        self.id
    }

    fn new(id: i32) -> Self {
        Self { id }
    }
}

impl IdT for VehicleIdT {
    fn id(&self) -> i32 {
        self.id
    }

    fn new(id: i32) -> Self {
        Self { id }
    }
}

impl IdT for CompanyIdT {
    fn id(&self) -> i32 {
        self.id
    }

    fn new(id: i32) -> Self {
        Self { id }
    }
}

impl IdT for ZoneIdT {
    fn id(&self) -> i32 {
        self.id
    }

    fn new(id: i32) -> Self {
        Self { id }
    }
}

impl IdT for TourIdT {
    fn id(&self) -> i32 {
        self.id
    }

    fn new(id: i32) -> Self {
        Self { id }
    }
}

impl IndexedIdT for VehicleIdT {}

impl IndexedIdT for CompanyIdT {}

impl IndexedIdT for ZoneIdT {}

impl IndexedIdT for AddressIdT {}
