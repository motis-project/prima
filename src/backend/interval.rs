use chrono::{NaiveDate, NaiveDateTime};
use serde::Deserialize;
use std::fmt;

#[derive(Copy, Clone, Eq, PartialEq, Hash, Debug, Deserialize)]
#[readonly::make]
pub struct Interval {
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
}

impl fmt::Display for Interval {
    fn fmt(
        &self,
        f: &mut fmt::Formatter<'_>,
    ) -> fmt::Result {
        write!(f, "{} - {}", self.start_time.time(), self.end_time.time())
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
    pub fn touches_day(
        &self,
        day: NaiveDate,
    ) -> bool {
        self.start_time.date() == day || self.end_time.date() == day
    }
    pub fn overlaps(
        self,
        other: &Interval,
    ) -> bool {
        self.start_time <= other.end_time && self.end_time >= other.start_time
    }
    pub fn contains(
        self,
        other: &Interval,
    ) -> bool {
        self.start_time <= other.start_time && self.end_time >= other.end_time
    }
    pub fn contains_point(
        self,
        point_in_time: &NaiveDateTime,
    ) -> bool {
        self.start_time <= *point_in_time && self.end_time >= *point_in_time
    }
    //asserts that self and other overlap, neither contains the other
    pub fn merge(
        &self,
        other: &Interval,
    ) -> Interval {
        Interval::new(
            NaiveDateTime::min(self.start_time, other.start_time),
            NaiveDateTime::max(self.end_time, other.end_time),
        )
    }
    //asserts that splitter is contained in self, but not vice versa
    pub fn split(
        self,
        splitter: &Interval,
    ) -> (Interval, Interval) {
        (
            Interval::new(self.start_time, splitter.start_time),
            Interval::new(splitter.end_time, self.end_time),
        )
    }
    //asserts that the intervals (self and cutter) overlap each other but neither one contains the other.
    pub fn cut(
        &self,
        cutter: &Interval,
    ) -> Interval {
        if self.start_time < cutter.start_time {
            Interval::new(self.start_time, cutter.start_time)
        } else {
            Interval::new(cutter.end_time, self.end_time)
        }
    }
}

#[cfg(test)]
mod test {
    use crate::backend::interval::Interval;
    use chrono::{NaiveDate, Timelike};
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
        let non_touching_interval: Interval = Interval::new(
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
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

        assert_eq!(interval.contains(&overlapping_interval), false);
        assert_eq!(interval.contains(&overlapping_interval2), false);
        assert_eq!(interval.contains(&containing_interval), false);
        assert_eq!(interval.contains(&contained_interval), true);
        assert_eq!(interval.overlaps(&non_touching_interval), false);

        assert_eq!(overlapping_interval.contains(&interval), false);
        assert_eq!(overlapping_interval2.contains(&interval), false);
        assert_eq!(containing_interval.contains(&interval), true);
        assert_eq!(contained_interval.contains(&interval), false);
        assert_eq!(non_touching_interval.overlaps(&interval), false);

        assert_eq!(interval.overlaps(&overlapping_interval), true);
        assert_eq!(interval.overlaps(&overlapping_interval2), true);
        assert_eq!(interval.overlaps(&containing_interval), true);
        assert_eq!(interval.overlaps(&contained_interval), true);
        assert_eq!(interval.overlaps(&non_touching_interval), false);

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
        assert_eq!(interval.start_time < interval.end_time, true);
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
        assert_eq!(mid_1_point_touch.overlaps(&right_1_point_touch), true);
        assert_eq!(mid_1_point_touch.contains(&right_1_point_touch), false);
        assert_eq!(mid_1_point_touch.overlaps(&right_1_point_touch), true);

        assert_eq!(mid_1_point_touch.overlaps(&left_1_point_touch), true);
        assert_eq!(mid_1_point_touch.contains(&left_1_point_touch), false);
        assert_eq!(mid_1_point_touch.overlaps(&left_1_point_touch), true);

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
            .cut(&left_1_point_touch)
            .cut(&right_1_point_touch); //cut 9:05 - 9:15 and 9:45 - 9:55 from expext 9:15 - 9:45 -> expect 9:15 - 9:45
        assert_eq!(merge.start_time.hour(), 9);
        assert_eq!(merge.start_time.minute(), 15);
        assert_eq!(merge.start_time.second(), 0);
        assert_eq!(merge.end_time.hour(), 9);
        assert_eq!(merge.end_time.minute(), 45);
        assert_eq!(merge.end_time.second(), 0);
    }
}
