use chrono::{Duration, NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Copy, Clone, Eq, PartialEq, Hash, Debug, Deserialize, Serialize)]
#[readonly::make]
pub struct Interval {
    //intervals are halfopen
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
}

impl fmt::Display for Interval {
    fn fmt(
        &self,
        f: &mut fmt::Formatter<'_>,
    ) -> fmt::Result {
        write!(f, "{} - {}", self.start_time, self.end_time)
    }
}

impl Interval {
    pub fn new(
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
    ) -> Self {
        Self {
            start_time: NaiveDateTime::min(start_time, end_time),
            end_time: NaiveDateTime::max(start_time, end_time),
        }
    }

    #[allow(dead_code)]
    pub fn overlaps_day(
        &self,
        day: NaiveDate,
    ) -> bool {
        self.overlaps(&Interval::new(
            day.and_hms_opt(0, 0, 0).unwrap(),
            day.and_hms_opt(0, 0, 0).unwrap() + Duration::days(1),
        ))
    }

    pub fn touches(
        &self,
        other: &Interval,
    ) -> bool {
        self.start_time == other.end_time || self.end_time == other.start_time
    }

    pub fn overlaps(
        &self,
        other: &Interval,
    ) -> bool {
        self.start_time < other.end_time && self.end_time > other.start_time
    }

    pub fn contains(
        &self,
        other: &Interval,
    ) -> bool {
        self.start_time <= other.start_time && self.end_time >= other.end_time
    }

    pub fn contains_point(
        &self,
        point_in_time: &NaiveDateTime,
    ) -> bool {
        self.start_time <= *point_in_time && self.end_time >= *point_in_time
    }

    pub fn merge(
        &self,
        other: &Interval,
    ) -> Interval {
        assert!(
            (self.touches(other) || self.overlaps(other))
                && !self.contains(other)
                && !other.contains(self)
        );
        Interval::new(
            NaiveDateTime::min(self.start_time, other.start_time),
            NaiveDateTime::max(self.end_time, other.end_time),
        )
    }

    pub fn split(
        &self,
        splitter: &Interval,
    ) -> (Interval, Interval) {
        assert!(self.contains(splitter) && splitter != self);
        (
            Interval::new(self.start_time, splitter.start_time),
            Interval::new(splitter.end_time, self.end_time),
        )
    }

    pub fn cut(
        &self,
        cutter: &Interval,
    ) -> Interval {
        assert!(self.overlaps(cutter) && !self.contains(cutter) && !cutter.contains(self));
        if self.start_time < cutter.start_time {
            Interval::new(self.start_time, cutter.start_time)
        } else {
            Interval::new(cutter.end_time, self.end_time)
        }
    }

    pub fn expand(
        &self,
        prepone_start_by: Duration,
        postpone_end_by: Duration,
    ) -> Interval {
        Interval::new(
            self.start_time - prepone_start_by,
            self.end_time + postpone_end_by,
        )
    }
}

#[cfg(test)]
mod test {
    use crate::backend::interval::Interval;
    use chrono::{Datelike, Duration, NaiveDate, Timelike};
    #[test]
    fn test() {
        //interval is the reference interval. The other intervals are named according to their realtion to interval.
        let interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
        );
        let non_overlapping_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 18)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 19)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
        );
        let overlapping_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 30, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 30, 0)
                .unwrap(),
        );
        let overlapping_interval2: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(8, 30, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 30, 0)
                .unwrap(),
        );
        let containing_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(8, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
        );
        let contained_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        );

        assert!(!interval.contains(&overlapping_interval));
        assert!(!interval.contains(&overlapping_interval2));
        assert!(!interval.contains(&containing_interval));
        assert!(interval.contains(&contained_interval));
        assert!(!interval.overlaps(&non_overlapping_interval));

        assert!(!overlapping_interval.contains(&interval));
        assert!(!overlapping_interval2.contains(&interval));
        assert!(containing_interval.contains(&interval));
        assert!(!contained_interval.contains(&interval));
        assert!(!non_overlapping_interval.overlaps(&interval));

        assert!(interval.overlaps(&overlapping_interval));
        assert!(interval.overlaps(&overlapping_interval2));
        assert!(interval.overlaps(&containing_interval));
        assert!(interval.overlaps(&contained_interval));
        assert!(!interval.overlaps(&non_overlapping_interval));

        let cut_interval = interval.cut(&overlapping_interval); //cut 9:30 - 10:30 from 9:00 - 10:00 -> expext 9:00 - 9:30
        assert_eq!(cut_interval.start_time.hour(), 9);
        assert_eq!(cut_interval.start_time.minute(), 0);
        assert_eq!(cut_interval.end_time.hour(), 9);
        assert_eq!(cut_interval.end_time.minute(), 30);

        let cut_interval = interval.cut(&overlapping_interval2); //cut 8:30 - 9:30 from 9:00 - 10:00 -> expext 9:30 - 10:00
        assert_eq!(cut_interval.start_time.hour(), 9);
        assert_eq!(cut_interval.start_time.minute(), 30);
        assert_eq!(cut_interval.end_time.hour(), 10);
        assert_eq!(cut_interval.end_time.minute(), 0);

        let (left, right) = interval.split(&contained_interval); //split 9:00 - 10:00 by  9:15 - 9:45 -> expect  9:00 - 9:15 and 9:45 - 10:00
        assert_eq!(left.start_time.hour(), 9);
        assert_eq!(left.start_time.minute(), 0);
        assert_eq!(left.end_time.hour(), 9);
        assert_eq!(left.end_time.minute(), 15);
        assert_eq!(right.start_time.hour(), 9);
        assert_eq!(right.start_time.minute(), 45);
        assert_eq!(right.end_time.hour(), 10);
        assert_eq!(right.end_time.minute(), 0);

        let merged = interval.merge(&overlapping_interval); //merge 9:00 - 10:00 and 9:30 - 10:30 -> expext 9:00 - 10:30
        assert_eq!(merged.start_time.hour(), 9);
        assert_eq!(merged.start_time.minute(), 0);
        assert_eq!(merged.end_time.hour(), 10);
        assert_eq!(merged.end_time.minute(), 30);

        let merged = interval.merge(&overlapping_interval2); //merge 9:00 - 10:00 and 8:30 - 9:30 -> expext 8:30 - 10:00
        assert_eq!(merged.start_time.hour(), 8);
        assert_eq!(merged.start_time.minute(), 30);
        assert_eq!(merged.end_time.hour(), 10);
        assert_eq!(merged.end_time.minute(), 0);
    }

    #[test]
    fn test_start_bigger_end() {
        let interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
        );
        assert!(interval.start_time < interval.end_time);
    }

    #[test]
    fn test_day_overlaps() {
        let day = NaiveDate::from_ymd_opt(2024, 4, 18).unwrap();
        let next_day_as_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 19)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 20)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
        );
        let overlapping_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 18)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 19)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
        );
        let contained_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 18)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 18)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
        );
        let non_overlapping_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 19)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 19)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
        );
        assert!(!non_overlapping_interval.overlaps_day(day));
        assert!(overlapping_interval.overlaps_day(day));
        assert!(contained_interval.overlaps_day(day));
        assert!(!next_day_as_interval.overlaps_day(day));
    }

    #[test]
    fn test_1_point_touches() {
        //test 1 point touches
        let mid_1_point_touch = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        );
        let right_1_point_touch = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
        );
        let left_1_point_touch = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 5, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
        );
        assert!(!mid_1_point_touch.overlaps(&right_1_point_touch));
        assert!(!mid_1_point_touch.contains(&right_1_point_touch));
        assert!(mid_1_point_touch.touches(&right_1_point_touch));

        assert!(!mid_1_point_touch.overlaps(&left_1_point_touch));
        assert!(!mid_1_point_touch.contains(&left_1_point_touch));
        assert!(mid_1_point_touch.touches(&right_1_point_touch));

        let left_merge = mid_1_point_touch.merge(&left_1_point_touch); //merge 9:15 - 9:45 and 9:05 - 9:15 -> expext 9:05 - 9:45
        assert_eq!(left_merge.start_time.hour(), 9);
        assert_eq!(left_merge.start_time.minute(), 5);
        assert_eq!(left_merge.end_time.hour(), 9);
        assert_eq!(left_merge.end_time.minute(), 45);
        let right_merge = mid_1_point_touch.merge(&right_1_point_touch); //merge 9:15 - 9:45 and 9:45 - 9:55 -> expext 9:15 - 9:55
        assert_eq!(right_merge.start_time.hour(), 9);
        assert_eq!(right_merge.start_time.minute(), 15);
        assert_eq!(right_merge.end_time.hour(), 9);
        assert_eq!(right_merge.end_time.minute(), 55);

        let merge = mid_1_point_touch
            .merge(&left_1_point_touch)
            .merge(&right_1_point_touch); //merge 9:05 - 9:15, 9:15 - 9 - 45  and  9:45 - 9:55 expext 9:05 - 9:45 -> expect 9:15 - 9:55
        assert_eq!(merge.start_time.hour(), 9);
        assert_eq!(merge.start_time.minute(), 5);
        assert_eq!(merge.start_time.second(), 0);
        assert_eq!(merge.end_time.hour(), 9);
        assert_eq!(merge.end_time.minute(), 55);
        assert_eq!(merge.end_time.second(), 0);
    }

    #[should_panic]
    #[test]
    fn test_cut_assertion_failed() {
        let i1 = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        );
        let i2 = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
        );
        i1.cut(&i2);
    }

    #[should_panic]
    #[test]
    fn test_merge_assertion_failed() {
        let i1 = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        );
        let i2 = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 46, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
        );
        i1.merge(&i2);
    }

    #[should_panic]
    #[test]
    fn test_split_assertion_failed() {
        let i1 = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        );
        let i2 = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        );
        i1.split(&i2);
    }

    #[test]
    fn test_expand() {
        let i1 = Interval::new(
            //9:15 - 9:45
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        );

        let expanded_interval = i1.expand(Duration::minutes(13), Duration::minutes(7));
        assert_eq!(expanded_interval.start_time.hour(), 9);
        assert_eq!(expanded_interval.start_time.minute(), 02);
        assert_eq!(expanded_interval.start_time.second(), 0);
        assert_eq!(expanded_interval.end_time.hour(), 9);
        assert_eq!(expanded_interval.end_time.minute(), 52);
        assert_eq!(expanded_interval.end_time.second(), 0);
    }

    #[test]
    fn test_expand_to_new_day() {
        let i1 = Interval::new(
            //9:15 - 9:45
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        );
        assert_eq!(i1.end_time.day(), 15);

        let expanded_interval = i1.expand(Duration::minutes(0), Duration::hours(15));
        assert_eq!(expanded_interval.start_time.hour(), 9);
        assert_eq!(expanded_interval.start_time.minute(), 15);
        assert_eq!(expanded_interval.start_time.second(), 0);
        assert_eq!(expanded_interval.end_time.day(), 16);
        assert_eq!(expanded_interval.end_time.hour(), 0);
        assert_eq!(expanded_interval.end_time.minute(), 45);
        assert_eq!(expanded_interval.end_time.second(), 0);
    }
}
