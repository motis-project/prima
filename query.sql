with "busstops" as (
    select * from (
        SELECT
            cast(0 as INTEGER) AS bus_stop_index,
            cast(51.292260904642916 as decimal) AS lat,
            cast(14.822263713757678 as decimal) AS lng
    ) as "busstops"
),
"times" as (
    select * from (
        SELECT
            cast(0 as INTEGER) AS bus_stop_index,
            cast(0 as INTEGER) AS time_index,
            cast(2547568200000 as BIGINT) AS start_time,
            cast(2547568800000 as BIGINT) AS end_time
    ) as "times"
)
select 
    "busstoptimes"."time_index" as "time_index", 
    "busstoptimes"."bus_stop_index" as "bus_stop_index"
from "zone"
inner join lateral (
    select * from "busstops" 
    where ST_Covers(
        zone.area, 
        ST_SetSRID(ST_MakePoint(busstops.lng, busstops.lat), 4326)
    )
) as "busstopzone" on true
inner join lateral (
    select * from "times" 
    where "times"."bus_stop_index" = "busstopzone"."bus_stop_index"
) as "busstoptimes" on true
where ST_Covers(
        zone.area, 
        ST_SetSRID(ST_MakePoint(14.822263713757678, 51.292260904642916), 4326)
    )
  and exists (
      select from "company" 
      where 
          "company"."zone" = "zone"."id" 
          and exists (
              select from "vehicle" 
              where 
                  "vehicle"."company" = "company"."id" 
                  and (
                      "vehicle"."passengers" >= 1 
                      and "vehicle"."bike_capacity" >= 0 
                      and "vehicle"."wheelchair_capacity" >= 0 
                      and "vehicle"."storage_space" >= cast(0 as integer) + cast(1 as integer) - cast("vehicle"."passengers" as integer)
                      and (
                          exists (
                              select from "availability" 
                              where 
                                  "availability"."vehicle" = "vehicle"."id" 
                                  and "availability"."start_time" <= "busstoptimes"."end_time" 
                                  and "availability"."start_time" >= "busstoptimes"."start_time"
                          )
                          or exists (
                              select from "tour" 
                              where 
                                  "tour"."vehicle" = "vehicle"."id" 
                                  and (tour.departure <= busstoptimes.end_time and tour.arrival >= busstoptimes.start_time)
                          )
                      )
                  )
          )
  );