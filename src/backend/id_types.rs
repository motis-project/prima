trait Id {
    fn id(&self) -> i32;
    fn as_idx(&self) -> usize;
}

#[macro_export]
macro_rules! define_id {
    ($t:ident) => {
        #[derive(Debug, PartialEq, Eq, Clone, PartialOrd, Ord, Hash, Copy)]
        pub struct $t(pub i32);

        impl Id for $t {
            fn id(&self) -> i32 {
                self.id
            }

            fn as_idx(&self) -> usize {
                assert!(self.id > 0);
                (self.id() - 1) as usize
            }
        }

        impl $t {
            #[allow(dead_code)]
            fn new(id: i32) -> Self {
                Self { id }
            }
        }

        impl std::fmt::Display for $t {
            fn fmt(
                &self,
                f: &mut std::fmt::Formatter<'_>,
            ) -> std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl PartialEq<i32> for $t {
            fn eq(
                &self,
                other: &i32,
            ) -> bool {
                self.0 == *other
            }
        }
    };
}

define_id!(for VehicleId, CompanyId, ZoneId, AddressId, UserId, TourId, EventId );

struct VecMap<K: Id, V> {
    vec: Vec<V>,
}

impl<K, V> VecMap<K, V> {
    fn get(
        &self,
        key: K,
    ) -> &V {
        self.vec[key]
    }
}
