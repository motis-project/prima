use chrono::{Datelike, NaiveDate, NaiveDateTime};
use serde::Deserialize;
use std::fmt;

#[derive(Copy, Clone, Eq, PartialEq, Hash, Debug, Deserialize)]
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
    pub fn touches_day(
        &self,
        day: NaiveDate,
    ) -> bool {
        let time_touches_day = |time: NaiveDateTime, day: NaiveDate| -> bool {
            if time.day() == day.day() && time.month() == day.month() && time.year() == day.year() {
                return true;
            }
            return false;
        };
        if time_touches_day(self.start_time, day) || time_touches_day(self.end_time, day) {
            return true;
        }
        false
    }
    pub fn touches(
        self,
        other: &Interval,
    ) -> bool {
        !(self.start_time > other.end_time || self.end_time < other.start_time)
    }
    //overlaps asserts that the two intervals are touching
    pub fn overlaps(
        self,
        other: &Interval,
    ) -> bool {
        (self.start_time <= other.start_time && self.end_time <= other.end_time)
            || (self.start_time >= other.start_time && self.end_time >= other.end_time)
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
    pub fn merge(
        &mut self,
        other: &Interval,
    ) {
        self.start_time = if self.start_time < other.start_time {
            self.start_time
        } else {
            other.start_time
        };
        self.end_time = if self.end_time > other.end_time {
            self.end_time
        } else {
            other.end_time
        };
    }
    pub fn split(
        self,
        splitter: &Interval,
    ) -> (Interval, Interval) {
        (
            Interval {
                start_time: self.start_time,
                end_time: splitter.start_time,
            },
            Interval {
                start_time: splitter.end_time,
                end_time: self.end_time,
            },
        )
    }
    //asserts that the intervals (self and cutter) overlap each other but neither one contains the other.
    pub fn cut(
        &mut self,
        cutter: &Interval,
    ) {
        if self.start_time < cutter.start_time {
            self.end_time = cutter.start_time;
        } else {
            self.start_time = cutter.end_time;
        }
    }
}

pub struct InfiniteInterval {
    pub time_frame_start: Option<NaiveDateTime>,
    pub time_frame_end: Option<NaiveDateTime>,
}

impl InfiniteInterval {
    pub fn contained_in_time_frame(
        &self,
        start: NaiveDateTime,
        end: NaiveDateTime,
    ) -> bool {
        (match self.time_frame_start {
            None => true,
            Some(t) => start >= t,
        } && match self.time_frame_end {
            None => true,
            Some(t) => end <= t,
        })
    }
}

#[cfg(test)]
mod test {
    use crate::backend::interval::Interval;
    use chrono::{NaiveDate, Timelike};
    #[test]
    fn test() {
        let mut interval: Interval = Interval {
            start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 0, 0)
                .unwrap(),
            end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
        };
        let non_touching_interval: Interval = Interval {
            start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
            end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
        };
        let overlapping_interval: Interval = Interval {
            start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 30, 0)
                .unwrap(),
            end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 30, 0)
                .unwrap(),
        };
        let overlapping_interval2: Interval = Interval {
            start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(8, 30, 0)
                .unwrap(),
            end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 30, 0)
                .unwrap(),
        };
        let containing_interval: Interval = Interval {
            start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(8, 0, 0)
                .unwrap(),
            end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
        };
        let contained_interval: Interval = Interval {
            start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 45, 0)
                .unwrap(),
        };

        assert_eq!(interval.touches(&non_touching_interval), false);
        assert_eq!(interval.touches(&overlapping_interval), true);
        assert_eq!(interval.touches(&overlapping_interval2), true);
        assert_eq!(interval.touches(&containing_interval), true);
        assert_eq!(interval.touches(&contained_interval), true);

        assert_eq!(interval.contains(&overlapping_interval), false);
        assert_eq!(interval.contains(&overlapping_interval2), false);
        assert_eq!(interval.contains(&containing_interval), false);
        assert_eq!(interval.contains(&contained_interval), true);

        assert_eq!(overlapping_interval.contains(&interval), false);
        assert_eq!(overlapping_interval2.contains(&interval), false);
        assert_eq!(containing_interval.contains(&interval), true);
        assert_eq!(contained_interval.contains(&interval), false);

        assert_eq!(interval.overlaps(&overlapping_interval), true);
        assert_eq!(interval.overlaps(&overlapping_interval2), true);
        assert_eq!(interval.overlaps(&containing_interval), false);
        assert_eq!(interval.overlaps(&contained_interval), false);

        let mut cut_interval = interval.clone();
        cut_interval.cut(&overlapping_interval); //cut 9:00 - 10:00 from 9:30 - 10:30 -> expext 10:00 - 10:30
        assert_eq!(cut_interval.start_time.hour(), 9);
        assert_eq!(cut_interval.start_time.minute(), 0);
        assert_eq!(cut_interval.end_time.hour(), 9);
        assert_eq!(cut_interval.end_time.minute(), 30);

        cut_interval = interval.clone();
        cut_interval.cut(&overlapping_interval2); //cut 9:00 - 10:00 from 8:30 - 9:30 -> expext 8:30 - 9:00
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

        interval.merge(&overlapping_interval); //merge 9:00 - 10:00 and 9:30 - 10:30 -> expext 9:00 - 10:30
        assert_eq!(interval.start_time.hour(), 9);
        assert_eq!(interval.start_time.minute(), 0);
        assert_eq!(interval.end_time.hour(), 10);
        assert_eq!(interval.end_time.minute(), 30);

        interval.merge(&overlapping_interval2); //merge 9:00 - 10:30 and 8:30 - 9:30 -> expext 8:30 - 10:30
        assert_eq!(interval.start_time.hour(), 8);
        assert_eq!(interval.start_time.minute(), 30);
        assert_eq!(interval.end_time.hour(), 10);
        assert_eq!(interval.end_time.minute(), 30);

        //TODO: anything with 2 intervals that touch in exactly one point for example: 9:00 - 10:00 and 10:00 - 11:00
    }
}
