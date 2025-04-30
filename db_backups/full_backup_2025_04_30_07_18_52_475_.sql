--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg110+2)
-- Dumped by pg_dump version 16.8 (Ubuntu 16.8-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: direct_duration_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.direct_duration_type AS (
	tour_id integer,
	duration integer
);


ALTER TYPE public.direct_duration_type OWNER TO postgres;

--
-- Name: event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.event_type AS (
	is_pickup boolean,
	lat double precision,
	lng double precision,
	scheduled_time_start bigint,
	scheduled_time_end bigint,
	communicated_time bigint,
	prev_leg_duration integer,
	next_leg_duration integer,
	address text,
	grp text
);


ALTER TYPE public.event_type OWNER TO postgres;

--
-- Name: request_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.request_type AS (
	passengers integer,
	kids_zero_to_two integer,
	kids_three_to_four integer,
	kids_five_to_six integer,
	wheelchairs integer,
	bikes integer,
	luggage integer,
	customer integer
);


ALTER TYPE public.request_type OWNER TO postgres;

--
-- Name: tour_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tour_type AS (
	departure bigint,
	arrival bigint,
	vehicle integer,
	direct_duration integer,
	id integer
);


ALTER TYPE public.tour_type OWNER TO postgres;

--
-- Name: anonymize(double precision, double precision); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.anonymize(IN t1 double precision, IN t2 double precision)
    LANGUAGE plpgsql
    AS $$
    DECLARE
        j RECORD;
        legs JSONB;
        leg JSONB;
        leg_index INT;
    BEGIN
        -- Anonymize request table
        UPDATE request
        SET customer = null
        FROM tour
        WHERE tour.id = request.tour
        AND tour.arrival > t1
        AND tour.arrival < t2;

        -- Anonymize event table
        UPDATE event
        SET lat = ROUND(event.lat::numeric, 2),
            lng = ROUND(event.lng::numeric, 2),
            address = 'anonymer Ort'
        FROM request
        INNER JOIN tour ON request.tour = tour.id
        WHERE event.request = request.id
        AND tour.arrival > t1
        AND tour.arrival < t2;

        -- Anonymize journey table
        FOR j IN
            SELECT journey.id, journey.json
            FROM journey
            LEFT JOIN request r1 ON journey.request1 = r1.id
            LEFT JOIN request r2 ON journey.request2 = r2.id
            LEFT JOIN tour tour1 ON r1.tour = tour1.id AND tour1.arrival > t1 AND tour1.arrival < t2
            LEFT JOIN tour tour2 ON r2.tour = tour2.id AND tour2.arrival > t1 AND tour2.arrival < t2
            WHERE
                journey.request1 IS NOT NULL
                OR
                journey.request2 IS NOT NULL

            LOOP
                legs := j.json->'legs';
                leg_index := 0;
            FOR leg IN
            SELECT * FROM jsonb_array_elements(legs) AS leg
            LOOP
                IF leg->>'mode' = 'ODM' THEN
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'from', 'lat'],
                        ROUND((leg->'from'->>'lat')::numeric, 2)::text::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'from', 'lon'],
                        ROUND((leg->'from'->>'lon')::numeric, 2)::text::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'from', 'name'],
                        '"anonymer Ort"'::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'to', 'lat'],
                        ROUND((leg->'to'->>'lat')::numeric, 2)::text::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'to', 'lon'],
                        ROUND((leg->'to'->>'lon')::numeric, 2)::text::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'to', 'name'],
                        '"anonymer Ort"'::jsonb
                    );
                END IF;
                leg_index := leg_index + 1;
            END LOOP;
            UPDATE journey SET json = j.json WHERE id = j.id;
        END LOOP;
    END;
    $$;


ALTER PROCEDURE public.anonymize(IN t1 double precision, IN t2 double precision) OWNER TO postgres;

--
-- Name: cancel_request(integer, integer, bigint); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.cancel_request(IN p_request_id integer, IN p_user_id integer, IN p_now bigint)
    LANGUAGE plpgsql
    AS $$
DECLARE
	v_tour_id INTEGER;
	v_all_requests_cancelled BOOLEAN;
BEGIN
	IF NOT EXISTS (
	    SELECT 1
			FROM request r
	    WHERE r.customer = p_user_id
			AND r.id = p_request_id
	) THEN
	    RETURN;
	END IF;

	IF (
		SELECT communicated_time
		FROM request r
		JOIN event e ON r.id = e.request
		WHERE r.id = p_request_id
		ORDER BY e.communicated_time ASC
		LIMIT 1
	) <= p_now THEN
		RETURN;
	END IF;

	UPDATE request r
	SET cancelled = true
	WHERE r.id = p_request_id;

	SELECT tour INTO v_tour_id
	FROM request
	WHERE id = p_request_id;

	SELECT bool_and(cancelled) INTO v_all_requests_cancelled
	FROM request
	WHERE tour = v_tour_id;

	IF v_all_requests_cancelled THEN
		UPDATE tour
		SET cancelled = TRUE
		WHERE id = v_tour_id;
	END IF;

	UPDATE event e
	SET cancelled = TRUE
	WHERE e.request = p_request_id;
END;
$$;


ALTER PROCEDURE public.cancel_request(IN p_request_id integer, IN p_user_id integer, IN p_now bigint) OWNER TO postgres;

--
-- Name: cancel_tour(integer, integer, character varying); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.cancel_tour(IN p_tour_id integer, IN p_company_id integer, IN p_message character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
	IF NOT EXISTS (
	    SELECT 1
	    FROM tour t
	    JOIN vehicle v ON v.id = t.vehicle
	    WHERE t.id = p_tour_id
	    AND v.company = p_company_id
	) THEN
	    RETURN;
	END IF;

	UPDATE tour t
	SET cancelled = TRUE,
		message = p_message
	WHERE t.id = p_tour_id;

	UPDATE request r
	SET cancelled = TRUE
	WHERE r.tour = p_tour_id;

	UPDATE event e
	SET cancelled = TRUE
	WHERE e.request IN (SELECT id FROM request WHERE tour = p_tour_id);
END;
$$;


ALTER PROCEDURE public.cancel_tour(IN p_tour_id integer, IN p_company_id integer, IN p_message character varying) OWNER TO postgres;

--
-- Name: create_and_merge_tours(public.request_type, public.event_type, public.event_type, integer[], public.tour_type, jsonb, jsonb, jsonb, public.direct_duration_type, public.direct_duration_type); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_and_merge_tours(p_request public.request_type, p_event1 public.event_type, p_event2 public.event_type, p_merge_tour_list integer[], p_tour public.tour_type, p_update_event_groups jsonb, p_update_next_leg_durations jsonb, p_update_prev_leg_durations jsonb, p_update_direct_duration_dropoff public.direct_duration_type, p_update_direct_duration_pickup public.direct_duration_type) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
	v_request_id INTEGER;
	v_tour_id INTEGER;
BEGIN
	CALL update_event_groups(p_update_event_groups);
	CALL update_direct_duration(p_update_direct_duration_dropoff);
	CALL update_next_leg_durations(p_update_next_leg_durations);
	CALL update_prev_leg_durations(p_update_prev_leg_durations);
	IF p_tour.id IS NULL THEN
			CALL insert_tour(p_tour, v_tour_id);
	ELSE
		v_tour_id := p_tour.id;
		CALL merge_tours(p_merge_tour_list, v_tour_id, p_tour.arrival, p_tour.departure);
		CALL update_direct_duration(p_update_direct_duration_pickup);
	END IF;
	CALL insert_request(p_request, v_tour_id, v_request_id);
	CALL insert_event(p_event1, v_request_id);
	CALL insert_event(p_event2, v_request_id);

	RETURN v_request_id;
END;
$$;


ALTER FUNCTION public.create_and_merge_tours(p_request public.request_type, p_event1 public.event_type, p_event2 public.event_type, p_merge_tour_list integer[], p_tour public.tour_type, p_update_event_groups jsonb, p_update_next_leg_durations jsonb, p_update_prev_leg_durations jsonb, p_update_direct_duration_dropoff public.direct_duration_type, p_update_direct_duration_pickup public.direct_duration_type) OWNER TO postgres;

--
-- Name: insert_event(public.event_type, integer); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.insert_event(IN p_event public.event_type, IN p_request_id integer)
    LANGUAGE plpgsql
    AS $$
	BEGIN
		INSERT INTO event (
			is_pickup, lat, lng, scheduled_time_start, scheduled_time_end, communicated_time,
			address, request, prev_leg_duration, next_leg_duration, event_group, cancelled
		)
	VALUES (
		p_event.is_pickup, p_event.lat, p_event.lng, p_event.scheduled_time_start, p_event.scheduled_time_end,
		p_event.communicated_time, p_event.address,
		p_request_id, p_event.prev_leg_duration, p_event.next_leg_duration, p_event.grp, FALSE
	);
END;
$$;


ALTER PROCEDURE public.insert_event(IN p_event public.event_type, IN p_request_id integer) OWNER TO postgres;

--
-- Name: insert_request(public.request_type, integer); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.insert_request(IN p_request public.request_type, IN p_tour_id integer, OUT v_request_id integer)
    LANGUAGE plpgsql
    AS $$
	BEGIN
		INSERT INTO request (passengers, wheelchairs, bikes, luggage, customer, tour, ticket_code, ticket_checked, cancelled, kids_zero_to_two, kids_three_to_four, kids_five_to_six)
		VALUES (p_request.passengers, p_request.wheelchairs, p_request.bikes, p_request.luggage, p_request.customer, p_tour_id, md5(random()::text), FALSE, FALSE, p_request.kids_zero_to_two, p_request.kids_three_to_four, p_request.kids_five_to_six)
		RETURNING id INTO v_request_id;
	END;
	$$;


ALTER PROCEDURE public.insert_request(IN p_request public.request_type, IN p_tour_id integer, OUT v_request_id integer) OWNER TO postgres;

--
-- Name: insert_tour(public.tour_type); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.insert_tour(IN p_tour public.tour_type, OUT v_tour_id integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
	INSERT INTO tour (departure, arrival, vehicle, fare, direct_duration, cancelled)
	VALUES (p_tour.departure, p_tour.arrival, p_tour.vehicle, NULL, p_tour.direct_duration, FALSE)
	RETURNING id INTO v_tour_id;
END;
$$;


ALTER PROCEDURE public.insert_tour(IN p_tour public.tour_type, OUT v_tour_id integer) OWNER TO postgres;

--
-- Name: merge_tours(integer[], integer, bigint, bigint); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.merge_tours(IN p_merge_tour_list integer[], IN p_target_tour_id integer, IN p_arrival bigint, IN p_departure bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
	UPDATE request
	SET tour = p_target_tour_id
	WHERE tour = ANY(p_merge_tour_list);

	UPDATE event
	SET tour = p_target_tour_id
	WHERE tour = ANY(p_merge_tour_list);

	UPDATE tour
	SET 
			arrival = CASE WHEN p_arrival IS NOT NULL THEN p_arrival ELSE arrival END,
			departure = CASE WHEN p_departure IS NOT NULL THEN p_departure ELSE departure END
	WHERE id = p_target_tour_id;


	DELETE FROM tour
	WHERE id = ANY(p_merge_tour_list);
END;
$$;


ALTER PROCEDURE public.merge_tours(IN p_merge_tour_list integer[], IN p_target_tour_id integer, IN p_arrival bigint, IN p_departure bigint) OWNER TO postgres;

--
-- Name: update_direct_duration(public.direct_duration_type); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.update_direct_duration(IN p_direct_duration public.direct_duration_type)
    LANGUAGE plpgsql
    AS $$
		BEGIN
			UPDATE tour t
			SET direct_duration = p_direct_duration.duration
			WHERE t.id = p_direct_duration.tour_id;
		END;
		$$;


ALTER PROCEDURE public.update_direct_duration(IN p_direct_duration public.direct_duration_type) OWNER TO postgres;

--
-- Name: update_event_groups(jsonb); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.update_event_groups(IN p_updates jsonb)
    LANGUAGE plpgsql
    AS $$
		BEGIN
			IF jsonb_typeof(p_updates) <> 'array' THEN
				RAISE EXCEPTION 'Input must be a JSON array';
			END IF;
	
			IF EXISTS (
					SELECT 1 
					FROM jsonb_array_elements(p_updates) elem 
					WHERE NOT (
						elem ? 'id' 
						AND elem ? 'event_group' 
						AND jsonb_typeof(elem->'id') = 'number' 
						AND jsonb_typeof(elem->'event_group') = 'string'
					)
			) THEN
					RAISE EXCEPTION 'Each JSON object must contain "id" (integer) and "event_group" (string)';
			END IF;
	
			UPDATE event e
			SET event_group = updates.event_group
			FROM (
				SELECT 
					(record->>'id')::INTEGER AS id, 
					(record->>'event_group')::VARCHAR AS event_group
				FROM jsonb_array_elements(p_updates) AS record
			) AS updates
			WHERE e.id = updates.id;
		END;
		$$;


ALTER PROCEDURE public.update_event_groups(IN p_updates jsonb) OWNER TO postgres;

--
-- Name: update_next_leg_durations(jsonb); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.update_next_leg_durations(IN p_next_leg_durations jsonb)
    LANGUAGE plpgsql
    AS $$
	BEGIN
		IF jsonb_typeof(p_next_leg_durations) <> 'array' THEN
			RAISE EXCEPTION 'Input must be a JSON array';
		END IF;

		IF EXISTS (
			SELECT 1 
			FROM jsonb_array_elements(p_next_leg_durations) elem 
			WHERE NOT (
				elem ? 'id' 
				AND elem ? 'next_leg_duration' 
				AND jsonb_typeof(elem->'id') = 'number' 
				AND jsonb_typeof(elem->'next_leg_duration') = 'number'
			)
		) THEN
			RAISE EXCEPTION 'Each JSON object must contain "id" (integer) and "next_leg_duration" (integer)';
		END IF;

		UPDATE event e
		SET next_leg_duration = updates.next_leg_duration
		FROM (
			SELECT 
				(record->>'id')::INTEGER AS id, 
				(record->>'next_leg_duration')::INTEGER AS next_leg_duration
			FROM jsonb_array_elements(p_next_leg_durations) AS record
		) AS updates
		WHERE e.id = updates.id;
	END;
	$$;


ALTER PROCEDURE public.update_next_leg_durations(IN p_next_leg_durations jsonb) OWNER TO postgres;

--
-- Name: update_prev_leg_durations(jsonb); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.update_prev_leg_durations(IN p_prev_leg_durations jsonb)
    LANGUAGE plpgsql
    AS $$
		BEGIN
			IF jsonb_typeof(p_prev_leg_durations) <> 'array' THEN
				RAISE EXCEPTION 'Input must be a JSON array';
			END IF;

			IF EXISTS (
				SELECT 1 
				FROM jsonb_array_elements(p_prev_leg_durations) elem 
				WHERE NOT (
					elem ? 'id' 
					AND elem ? 'prev_leg_duration' 
					AND jsonb_typeof(elem->'id') = 'number' 
					AND jsonb_typeof(elem->'prev_leg_duration') = 'number'
				)
			) THEN
				RAISE EXCEPTION 'Each JSON object must contain "id" (integer) and "prev_leg_duration" (integer)';
			END IF;

			UPDATE event e
			SET prev_leg_duration = updates.prev_leg_duration
			FROM (
				SELECT 
					(record->>'id')::INTEGER AS id, 
					(record->>'prev_leg_duration')::INTEGER AS prev_leg_duration
				FROM jsonb_array_elements(p_prev_leg_durations) AS record
			) AS updates
			WHERE e.id = updates.id;
		END;
		$$;


ALTER PROCEDURE public.update_prev_leg_durations(IN p_prev_leg_durations jsonb) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: availability; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.availability (
    id integer NOT NULL,
    start_time bigint NOT NULL,
    end_time bigint NOT NULL,
    vehicle integer NOT NULL
);


ALTER TABLE public.availability OWNER TO postgres;

--
-- Name: availability_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.availability_id_seq OWNER TO postgres;

--
-- Name: availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.availability_id_seq OWNED BY public.availability.id;


--
-- Name: company; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company (
    id integer NOT NULL,
    lat real,
    lng real,
    name character varying,
    address character varying,
    zone integer
);


ALTER TABLE public.company OWNER TO postgres;

--
-- Name: company_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.company_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_id_seq OWNER TO postgres;

--
-- Name: company_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.company_id_seq OWNED BY public.company.id;


--
-- Name: event; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event (
    id integer NOT NULL,
    is_pickup boolean NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    scheduled_time_start bigint NOT NULL,
    scheduled_time_end bigint NOT NULL,
    communicated_time bigint NOT NULL,
    prev_leg_duration integer NOT NULL,
    next_leg_duration integer NOT NULL,
    event_group character varying NOT NULL,
    request integer NOT NULL,
    address character varying NOT NULL,
    cancelled boolean NOT NULL
);


ALTER TABLE public.event OWNER TO postgres;

--
-- Name: event_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.event_id_seq OWNER TO postgres;

--
-- Name: event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.event_id_seq OWNED BY public.event.id;


--
-- Name: journey; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journey (
    id integer NOT NULL,
    json jsonb NOT NULL,
    "user" integer NOT NULL,
    request1 integer,
    request2 integer,
    rating integer,
    comment character varying
);


ALTER TABLE public.journey OWNER TO postgres;

--
-- Name: journey_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.journey_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.journey_id_seq OWNER TO postgres;

--
-- Name: journey_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.journey_id_seq OWNED BY public.journey.id;


--
-- Name: kysely_migration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kysely_migration (
    name character varying(255) NOT NULL,
    "timestamp" character varying(255) NOT NULL
);


ALTER TABLE public.kysely_migration OWNER TO postgres;

--
-- Name: kysely_migration_lock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kysely_migration_lock (
    id character varying(255) NOT NULL,
    is_locked integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.kysely_migration_lock OWNER TO postgres;

--
-- Name: request; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.request (
    id integer NOT NULL,
    passengers integer NOT NULL,
    kids_zero_to_two integer NOT NULL,
    kids_three_to_four integer NOT NULL,
    kids_five_to_six integer NOT NULL,
    wheelchairs integer NOT NULL,
    bikes integer NOT NULL,
    luggage integer NOT NULL,
    tour integer NOT NULL,
    customer integer,
    ticket_code character varying NOT NULL,
    ticket_checked boolean NOT NULL,
    cancelled boolean NOT NULL
);


ALTER TABLE public.request OWNER TO postgres;

--
-- Name: request_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_id_seq OWNER TO postgres;

--
-- Name: request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.request_id_seq OWNED BY public.request.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    id character varying NOT NULL,
    expires_at bigint NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: tour; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tour (
    id integer NOT NULL,
    departure bigint NOT NULL,
    arrival bigint NOT NULL,
    direct_duration integer,
    vehicle integer NOT NULL,
    fare integer,
    cancelled boolean NOT NULL,
    message character varying
);


ALTER TABLE public.tour OWNER TO postgres;

--
-- Name: tour_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tour_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tour_id_seq OWNER TO postgres;

--
-- Name: tour_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tour_id_seq OWNED BY public.tour.id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."user" (
    id integer NOT NULL,
    name character varying NOT NULL,
    email character varying,
    password_hash character varying NOT NULL,
    is_taxi_owner boolean NOT NULL,
    is_admin boolean NOT NULL,
    is_email_verified boolean DEFAULT false NOT NULL,
    email_verification_code character varying,
    email_verification_expires_at bigint,
    password_reset_code character varying,
    password_reset_expires_at bigint,
    phone character varying,
    company_id integer
);


ALTER TABLE public."user" OWNER TO postgres;

--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_id_seq OWNER TO postgres;

--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_id_seq OWNED BY public."user".id;


--
-- Name: vehicle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle (
    id integer NOT NULL,
    license_plate character varying NOT NULL,
    company integer NOT NULL,
    passengers integer NOT NULL,
    wheelchairs integer NOT NULL,
    bikes integer NOT NULL,
    luggage integer NOT NULL
);


ALTER TABLE public.vehicle OWNER TO postgres;

--
-- Name: vehicle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_id_seq OWNER TO postgres;

--
-- Name: vehicle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicle_id_seq OWNED BY public.vehicle.id;


--
-- Name: zone; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zone (
    id integer NOT NULL,
    area public.geography(MultiPolygon,4326) NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.zone OWNER TO postgres;

--
-- Name: zone_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zone_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zone_id_seq OWNER TO postgres;

--
-- Name: zone_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zone_id_seq OWNED BY public.zone.id;


--
-- Name: availability id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability ALTER COLUMN id SET DEFAULT nextval('public.availability_id_seq'::regclass);


--
-- Name: company id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company ALTER COLUMN id SET DEFAULT nextval('public.company_id_seq'::regclass);


--
-- Name: event id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event ALTER COLUMN id SET DEFAULT nextval('public.event_id_seq'::regclass);


--
-- Name: journey id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journey ALTER COLUMN id SET DEFAULT nextval('public.journey_id_seq'::regclass);


--
-- Name: request id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request ALTER COLUMN id SET DEFAULT nextval('public.request_id_seq'::regclass);


--
-- Name: tour id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tour ALTER COLUMN id SET DEFAULT nextval('public.tour_id_seq'::regclass);


--
-- Name: user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user" ALTER COLUMN id SET DEFAULT nextval('public.user_id_seq'::regclass);


--
-- Name: vehicle id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle ALTER COLUMN id SET DEFAULT nextval('public.vehicle_id_seq'::regclass);


--
-- Name: zone id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone ALTER COLUMN id SET DEFAULT nextval('public.zone_id_seq'::regclass);


--
-- Data for Name: availability; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.availability (id, start_time, end_time, vehicle) FROM stdin;
1	1745982000000	1746043200000	1
\.


--
-- Data for Name: company; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company (id, lat, lng, name, address, zone) FROM stdin;
1	51.493713	14.625855	Taxi Weißwasser	Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz	2
2	51.532974	14.660599	Taxi Gablenz	Schulstraße 21, 02953 Gablenz	2
3	51.38096	14.666578	Taxi Reichwalde	Robert-Koch-Straße 45, 02943 Boxberg/Oberlausitz	1
4	51.30576	14.782109	Taxi Moholz	Postweg 10, 02906 Niesky	1
5	51.302185	14.834551	Taxi Niesky	Trebuser Str. 4, 02906 Niesky	1
6	51.321884	14.944467	Taxi Rothenburg	Zur Wasserscheide 37, 02929 Rothenburg/Oberlausitz	1
7	51.166775	14.934901	Taxi Schöpstal	Ebersbacher Str. 43, 02829 Schöpstal	3
8	51.129536	14.941331	Taxi Görlitz	Plantagenweg 3, 02827 Görlitz	3
\.


--
-- Data for Name: event; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.event (id, is_pickup, lat, lng, scheduled_time_start, scheduled_time_end, communicated_time, prev_leg_duration, next_leg_duration, event_group, request, address, cancelled) FROM stdin;
1	t	51.55	14.55	1745997627000	1745997627000	1745997627000	633000	213000	7380dc6d-b161-47da-a49b-ca6d2728d1f5	1	anonymer Ort	f
2	f	51.54	14.53	1745997840000	1745997840000	1745997840000	213000	846000	7045f7df-8620-4035-af90-da4996425c17	1	anonymer Ort	f
\.


--
-- Data for Name: journey; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journey (id, json, "user", request1, request2, rating, comment) FROM stdin;
1	{"legs": [{"to": {"lat": 51.54, "lon": 14.53, "name": "anonymer Ort", "level": 0, "stopId": "timetable_233632", "arrival": "2025-04-30T07:24:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:24:00Z"}, "from": {"lat": 51.55, "lon": 14.55, "name": "anonymer Ort", "level": 0, "departure": "2025-04-30T07:20:00Z", "vertexType": "NORMAL", "scheduledDeparture": "2025-04-30T07:20:00Z"}, "mode": "ODM", "steps": [{"area": false, "exit": "", "stayOn": false, "toLevel": 0, "distance": 2, "polyline": {"length": 3, "points": "{z}dv]c}hotG~AcAxBxL"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 692334810, "stayOn": false, "toLevel": 0, "distance": 153, "polyline": {"length": 6, "points": "at}dv]mqhotGrcCftMx`BthJth@v_EdRpqDgIrxA"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 692334810, "stayOn": false, "toLevel": 0, "distance": 69, "polyline": {"length": 5, "points": "_{tdv]qe`ntGeLvrBw@xoCpZx~Ct`Al_D"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 16540241, "stayOn": false, "toLevel": 0, "distance": 21, "polyline": {"length": 5, "points": "ulrdv]w`nmtGaT``@mLbi@oCvm@~Ctm@"}, "fromLevel": 0, "streetName": "S 126;S 130", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 16540241, "stayOn": false, "toLevel": 0, "distance": 14, "polyline": {"length": 4, "points": "unsdv]cxhmtG|Jld@`Qn]tU`T"}, "fromLevel": 0, "streetName": "S 126;S 130", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 16540241, "stayOn": false, "toLevel": 0, "distance": 12, "polyline": {"length": 4, "points": "_zqdv]c_fmtG~TfHvUF`UwG"}, "fromLevel": 0, "streetName": "S 126;S 130", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 16540241, "stayOn": false, "toLevel": 0, "distance": 15, "polyline": {"length": 4, "points": "ewodv]k~emtGtVqTvQy^`Kgf@"}, "fromLevel": 0, "streetName": "S 126;S 130", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 171779381, "stayOn": false, "toLevel": 0, "distance": 431, "polyline": {"length": 7, "points": "u`ndv]_{hmtG`bA|Tpf@`n@fcHhk^v~Gnb`@nhFxhWbfFjxL"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 171779378, "stayOn": false, "toLevel": 0, "distance": 80, "polyline": {"length": 3, "points": "majcv]_c`jtGr|@rjDzkBrlN"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 171779378, "stayOn": false, "toLevel": 0, "distance": 7, "polyline": {"length": 2, "points": "}vdcv]wikitGvMzv@"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 453772272, "stayOn": false, "toLevel": 0, "distance": 26, "polyline": {"length": 2, "points": "ehdcv]{qiitGzgA|eE"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 453772272, "stayOn": false, "toLevel": 0, "distance": 56, "polyline": {"length": 2, "points": "i_bcv]}jcitGr}ChsL"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 453772272, "stayOn": false, "toLevel": 0, "distance": 110, "polyline": {"length": 7, "points": "u`}bv]svuhtGpgAteEx}BddJ~d@|pAh\\\\`y@jf@d~@bj@fw@"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 38885410, "stayOn": false, "toLevel": 0, "distance": 18, "polyline": {"length": 3, "points": "ocrbv]ig|gtGpf@dm@pk@jj@"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 38885410, "stayOn": false, "toLevel": 0, "distance": 34, "polyline": {"length": 4, "points": "koobv]wmygtGp_@d\\\\dp@`k@pmAv_B"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 38885410, "stayOn": false, "toLevel": 0, "distance": 44, "polyline": {"length": 4, "points": "aojbv]wctgtGdjAlsBng@naBr`@~}A"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 38885410, "stayOn": false, "toLevel": 0, "distance": 150, "polyline": {"length": 5, "points": "wyebv]ymjgtG`m@feCxyAnzFbvBbhGbfFx~L"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 38885410, "stayOn": false, "toLevel": 0, "distance": 12, "polyline": {"length": 2, "points": "srvav]cchftGpl@xtA"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 1194850092, "stayOn": false, "toLevel": 0, "distance": 12, "polyline": {"length": 2, "points": "aeuav]imeftGzk@tjA"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 453772273, "stayOn": false, "toLevel": 0, "distance": 8, "polyline": {"length": 2, "points": "exsav]sacftGr_@fu@"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 453772273, "stayOn": false, "toLevel": 0, "distance": 31, "polyline": {"length": 3, "points": "qwrav]kkaftGtb@zt@`{AvcC"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 453772273, "stayOn": false, "toLevel": 0, "distance": 243, "polyline": {"length": 8, "points": "ywnav]wp{etGtdGxeIbaCtnEhmC|tFjuAp{BvfBxaBfrG`eEh`BneA"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 38885408, "stayOn": false, "toLevel": 1, "distance": 8, "polyline": {"length": 2, "points": "_ol`v]kxsdtG|i@n]"}, "fromLevel": 1, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 453772268, "stayOn": false, "toLevel": 0, "distance": 49, "polyline": {"length": 2, "points": "adk`v]{yrdtGpgFbjF"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 453772268, "stayOn": false, "toLevel": 0, "distance": 80, "polyline": {"length": 2, "points": "o{c`v]wnkdtGz{JpzJ"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 641856806, "stayOn": false, "toLevel": 0, "distance": 139, "polyline": {"length": 3, "points": "s~w_v]es_dtGbgDpsDhnNhiN"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 641856806, "stayOn": false, "toLevel": 0, "distance": 152, "polyline": {"length": 7, "points": "egc_v]itjctGry@~x@phFblDrbDxxAnrDfz@~uB`Pdr@bB"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 1276205677, "stayOn": false, "toLevel": 0, "distance": 13, "polyline": {"length": 2, "points": "uaj~u]}c~btGrfAzD"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 1231656569, "stayOn": false, "toLevel": 0, "distance": 25, "polyline": {"length": 2, "points": "azg~u]a~}btGbjChK"}, "fromLevel": 0, "streetName": "Friedensstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 183166523, "stayOn": false, "toLevel": 0, "distance": 4, "polyline": {"length": 2, "points": "}nc~u]wq}btGhAub@"}, "fromLevel": 0, "streetName": "Werksweg", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 183166523, "stayOn": false, "toLevel": 0, "distance": 7, "polyline": {"length": 2, "points": "slc~u]mu~btGfFi~@"}, "fromLevel": 0, "streetName": "Werksweg", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 183166523, "stayOn": false, "toLevel": 0, "distance": 175, "polyline": {"length": 4, "points": "kec~u]wt`ctGlJusBtaBo_OpzCwwZ"}, "fromLevel": 0, "streetName": "Werksweg", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "stayOn": false, "toLevel": 0, "distance": 43, "polyline": {"length": 3, "points": "u{z}u]ubpdtG|d@opE~iB`q@"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}], "endTime": "2025-04-30T07:24:00Z", "distance": 2243, "duration": 240, "realTime": false, "startTime": "2025-04-30T07:20:00Z", "legGeometry": {"length": 118, "points": "{z}dv]c}hotG~AcAxBxL??rcCftMx`BthJth@v_EdRpqDgIrxA??eLvrBw@xoCpZx~Ct`Al_D??aT``@mLbi@oCvm@~Ctm@??|Jld@`Qn]tU`T??~TfHvUF`UwG??tVqTvQy^`Kgf@??`bA|Tpf@`n@fcHhk^v~Gnb`@nhFxhWbfFjxL??r|@rjDzkBrlN??vMzv@??zgA|eE??r}ChsL??pgAteEx}BddJ~d@|pAh\\\\`y@jf@d~@bj@fw@??pf@dm@pk@jj@??p_@d\\\\dp@`k@pmAv_B??djAlsBng@naBr`@~}A??`m@feCxyAnzFbvBbhGbfFx~L??pl@xtA??zk@tjA??r_@fu@??tb@zt@`{AvcC??tdGxeIbaCtnEhmC|tFjuAp{BvfBxaBfrG`eEh`BneA??|i@n]??pgFbjF??z{JpzJ??bgDpsDhnNhiN??ry@~x@phFblDrbDxxAnrDfz@~uB`Pdr@bB??rfAzD??bjChK??hAub@??fFi~@??lJusBtaBo_OpzCwwZ??|d@opE~iB`q@"}, "scheduledEndTime": "2025-04-30T07:24:00Z", "scheduledStartTime": "2025-04-30T07:20:00Z"}, {"to": {"lat": 51.535430000000005, "lon": 14.532100999999999, "name": "Schleife", "level": 0, "stopId": "timetable_233632", "arrival": "2025-04-30T07:29:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:29:00Z"}, "from": {"lat": 51.535430000000005, "lon": 14.532100999999999, "name": "Schleife", "level": 0, "stopId": "timetable_233632", "arrival": "2025-04-30T07:24:00Z", "departure": "2025-04-30T07:24:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:24:00Z", "scheduledDeparture": "2025-04-30T07:24:00Z"}, "mode": "WALK", "steps": [{"area": false, "exit": "", "stayOn": false, "toLevel": 0, "distance": 0, "polyline": {"length": 2, "points": "wjv}u]cbudtG??"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}], "endTime": "2025-04-30T07:29:00Z", "distance": 0, "duration": 300, "realTime": false, "startTime": "2025-04-30T07:24:00Z", "legGeometry": {"length": 2, "points": "wjv}u]cbudtG??"}, "scheduledEndTime": "2025-04-30T07:29:00Z", "scheduledStartTime": "2025-04-30T07:24:00Z"}, {"to": {"lat": 51.505444, "lon": 14.638026999999997, "name": "Weißwasser(Oberlausitz)", "level": 0, "stopId": "timetable_57826", "arrival": "2025-04-30T07:35:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:35:00Z"}, "from": {"lat": 51.535430000000005, "lon": 14.532100999999999, "name": "Schleife", "level": 0, "stopId": "timetable_233632", "departure": "2025-04-30T07:29:00Z", "vertexType": "TRANSIT", "scheduledDeparture": "2025-04-30T07:29:00Z"}, "mode": "REGIONAL_FAST_RAIL", "source": "GTFS/stop_times.txt:4190048:4190064", "tripId": "20250430_09:03_timetable_1631363", "endTime": "2025-04-30T07:35:00Z", "agencyId": "300", "duration": 360, "headsign": "", "realTime": false, "agencyUrl": "https://www.bahn.de", "startTime": "2025-04-30T07:29:00Z", "agencyName": "Ostdeutsche Eisenbahn GmbH", "legGeometry": {"length": 2, "points": "wjv}u]cbudtGfthQwzs_A"}, "routeShortName": "RB65", "scheduledEndTime": "2025-04-30T07:35:00Z", "intermediateStops": [], "scheduledStartTime": "2025-04-30T07:29:00Z"}, {"to": {"lat": 51.505424, "lon": 14.639178999999999, "name": "Weißwasser Bahnhof", "level": 0, "stopId": "timetable_150464", "arrival": "2025-04-30T07:37:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:37:00Z"}, "from": {"lat": 51.505444, "lon": 14.638026999999997, "name": "Weißwasser(Oberlausitz)", "level": 0, "stopId": "timetable_57826", "arrival": "2025-04-30T07:35:00Z", "departure": "2025-04-30T07:35:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:35:00Z", "scheduledDeparture": "2025-04-30T07:35:00Z"}, "mode": "WALK", "steps": [{"area": false, "exit": "", "stayOn": false, "toLevel": 0, "distance": 99, "polyline": {"length": 5, "points": "oulku]{}ievG]OcoBdlOqQsHh}@icH"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 275817482, "stayOn": false, "toLevel": 0, "distance": 3, "polyline": {"length": 3, "points": "yznku]c_cevG}GyCwFkC"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 275817482, "stayOn": false, "toLevel": 0, "distance": 2, "polyline": {"length": 2, "points": "okoku]ihcevGuIwD"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 275817479, "stayOn": false, "toLevel": 0, "distance": 66, "polyline": {"length": 3, "points": "evoku]ancevGhrBi}OwJyE"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 275817479, "stayOn": false, "toLevel": 0, "distance": 23, "polyline": {"length": 3, "points": "snlku]estevG}m@_Yug@ipB"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 44659495, "stayOn": false, "toLevel": 0, "distance": 9, "polyline": {"length": 2, "points": "gfoku]o~xevG_l@jd@"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 259589705, "stayOn": false, "toLevel": 0, "distance": 13, "polyline": {"length": 2, "points": "gspku]cywevG|PorB"}, "fromLevel": 0, "streetName": "Bahnhofstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 259589703, "stayOn": false, "toLevel": 0, "distance": 9, "polyline": {"length": 2, "points": "iapku]sl{evGrLshA"}, "fromLevel": 0, "streetName": "Bahnhofstraße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "stayOn": false, "toLevel": 0, "distance": 23, "polyline": {"length": 3, "points": "usoku]gv}evGvmBofAaCcO"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}], "endTime": "2025-04-30T07:37:00Z", "distance": 247, "duration": 120, "realTime": false, "startTime": "2025-04-30T07:35:00Z", "legGeometry": {"length": 25, "points": "oulku]{}ievG]OcoBdlOqQsHh}@icH??}GyCwFkC??uIwD??hrBi}OwJyE??}m@_Yug@ipB??_l@jd@??|PorB??rLshA??vmBofAaCcO"}, "scheduledEndTime": "2025-04-30T07:37:00Z", "scheduledStartTime": "2025-04-30T07:35:00Z"}, {"to": {"lat": 51.51341, "lon": 14.652690000000002, "name": "Weißwasser Straßenmeisterei", "level": 0, "stopId": "timetable_597587", "arrival": "2025-04-30T07:44:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:44:00Z"}, "from": {"lat": 51.505424, "lon": 14.639178999999999, "name": "Weißwasser Bahnhof", "level": 0, "stopId": "timetable_150464", "departure": "2025-04-30T07:40:00Z", "vertexType": "TRANSIT", "scheduledDeparture": "2025-04-30T07:40:00Z"}, "mode": "BUS", "source": "GTFS/stop_times.txt:13890229:13890243", "tripId": "20250430_09:40_timetable_177282", "endTime": "2025-04-30T07:44:00Z", "agencyId": "347", "duration": 240, "headsign": "", "realTime": false, "agencyUrl": "https://www.bahn.de", "startTime": "2025-04-30T07:40:00Z", "agencyName": "ZVON Oberlausitz-Niederschlesien", "legGeometry": {"length": 4, "points": "_ilku]{m`fvG_jF_`bA_n]_l^gduBkmdD"}, "routeShortName": "80", "scheduledEndTime": "2025-04-30T07:44:00Z", "intermediateStops": [{"lat": 51.5058, "lon": 14.642610999999999, "name": "Weißwasser Stadtzentrum", "level": 0, "stopId": "timetable_300037", "arrival": "2025-04-30T07:41:00Z", "departure": "2025-04-30T07:41:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:41:00Z", "scheduledDeparture": "2025-04-30T07:41:00Z"}, {"lat": 51.50736, "lon": 14.644218999999998, "name": "Weißwasser Muskauer Straße", "level": 0, "stopId": "timetable_650217", "arrival": "2025-04-30T07:42:00Z", "departure": "2025-04-30T07:42:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:42:00Z", "scheduledDeparture": "2025-04-30T07:42:00Z"}], "scheduledStartTime": "2025-04-30T07:40:00Z"}, {"to": {"lat": 51.51692, "lon": 14.657703, "name": "Weißwasser - Ost, Weißwasser/O.L. - Běła Woda", "level": 0, "arrival": "2025-04-30T07:55:00Z", "vertexType": "NORMAL", "scheduledArrival": "2025-04-30T07:55:00Z"}, "from": {"lat": 51.51341, "lon": 14.652690000000002, "name": "Weißwasser Straßenmeisterei", "level": 0, "stopId": "timetable_597587", "arrival": "2025-04-30T07:44:00Z", "departure": "2025-04-30T07:44:00Z", "vertexType": "TRANSIT", "scheduledArrival": "2025-04-30T07:44:00Z", "scheduledDeparture": "2025-04-30T07:44:00Z"}, "mode": "WALK", "steps": [{"area": false, "exit": "", "stayOn": false, "toLevel": 0, "distance": 11, "polyline": {"length": 3, "points": "ghhpu]gjhnvGxEsLki@wu@"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 41119820, "stayOn": false, "toLevel": 0, "distance": 6, "polyline": {"length": 2, "points": "ykipu]snjnvGsTfd@"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 39225298, "stayOn": false, "toLevel": 0, "distance": 94, "polyline": {"length": 3, "points": "majpu]kiinvG{|I{rMuz@mhA"}, "fromLevel": 0, "streetName": "Muskauer Straße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 26610824, "stayOn": false, "toLevel": 0, "distance": 62, "polyline": {"length": 2, "points": "_{vpu]ufznvGkjGqhJ"}, "fromLevel": 0, "streetName": "Muskauer Straße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 26610824, "stayOn": false, "toLevel": 0, "distance": 138, "polyline": {"length": 2, "points": "kf_qu]gpeovGivQc|W"}, "fromLevel": 0, "streetName": "Muskauer Straße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 39225299, "stayOn": false, "toLevel": 0, "distance": 150, "polyline": {"length": 4, "points": "u}qqu]km~ovGmuBalE}fC_kGmxGw}P"}, "fromLevel": 0, "streetName": "Muskauer Straße", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "osmWay": 443842621, "stayOn": false, "toLevel": 0, "distance": 59, "polyline": {"length": 5, "points": "oubru]ee_qvGct@dz@}}@xn@chA_DckBczA"}, "fromLevel": 0, "streetName": "Waldseeweg", "relativeDirection": "CONTINUE"}, {"area": false, "exit": "", "stayOn": false, "toLevel": 0, "distance": 55, "polyline": {"length": 3, "points": "y~kru]iz~pvGcvBk|F|zAunB"}, "fromLevel": 0, "streetName": "", "relativeDirection": "CONTINUE"}], "endTime": "2025-04-30T07:55:00Z", "distance": 575, "duration": 660, "realTime": false, "startTime": "2025-04-30T07:44:00Z", "legGeometry": {"length": 24, "points": "ghhpu]gjhnvGxEsLki@wu@??sTfd@??{|I{rMuz@mhA??kjGqhJ??ivQc|W??muBalE}fC_kGmxGw}P??ct@dz@}}@xn@chA_DckBczA??cvBk|F|zAunB"}, "scheduledEndTime": "2025-04-30T07:55:00Z", "scheduledStartTime": "2025-04-30T07:44:00Z"}], "endTime": "2025-04-30T07:55:00Z", "duration": 2100, "startTime": "2025-04-30T07:20:00Z", "transfers": 2}	3	1	\N	\N	\N
\.


--
-- Data for Name: kysely_migration; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kysely_migration (name, "timestamp") FROM stdin;
2024-07-01	2025-04-29T22:40:22.247Z
2025-04-07	2025-04-29T22:40:22.248Z
2025-04-20-anonimization	2025-04-29T22:40:22.249Z
2025-04-24-json-and-latlng-precision	2025-04-29T22:40:22.263Z
\.


--
-- Data for Name: kysely_migration_lock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kysely_migration_lock (id, is_locked) FROM stdin;
migration_lock	0
\.


--
-- Data for Name: request; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.request (id, passengers, kids_zero_to_two, kids_three_to_four, kids_five_to_six, wheelchairs, bikes, luggage, tour, customer, ticket_code, ticket_checked, cancelled) FROM stdin;
1	1	0	0	0	0	0	0	1	\N	bbce81bddb8e7a4af46a43879bd30f21	f	f
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (id, expires_at, user_id) FROM stdin;
9d6eab7d3470bf2eb73fa86078fc31c14ecdd27f10e223a1fd21795420c555f4	1748558428582	3
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: tour; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tour (id, departure, arrival, direct_duration, vehicle, fare, cancelled, message) FROM stdin;
1	1745996994000	1745998686000	\N	1	\N	f	\N
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."user" (id, name, email, password_hash, is_taxi_owner, is_admin, is_email_verified, email_verification_code, email_verification_expires_at, password_reset_code, password_reset_expires_at, phone, company_id) FROM stdin;
1	John	foo@bar.de	$argon2id$v=19$m=19456,t=2,p=1$9fW6tfdNBJHtNC/RgNpMgg$z+hlFH7KXxKbIyt1q4fTK134FYcF8y10ZjSslzyqmFc	f	f	t	\N	\N	\N	\N	0815-1231234	\N
2	John	maintainer@zvon.de	$argon2id$v=19$m=19456,t=2,p=1$ZtuiFUoQYRyXUQRduYBkfQ$E+aREm5wKl8Ldn5ASP3wZnPf/jRriMIQmR3L3BhDaSA	f	t	t	\N	\N	\N	\N	\N	\N
3	John	taxi@weisswasser.de	$argon2id$v=19$m=19456,t=2,p=1$BoC0z8dXsKPZmUMvpnRXPw$Hc6rK5wlUNizsw5GQFjJ9oQ9uMhgWln42Ak4J2rO8yc	t	f	t	\N	\N	\N	\N	\N	1
4	John	taxi@gablenz.de	$argon2id$v=19$m=19456,t=2,p=1$3/CML3alHoFB7kYR3Fz9Hw$qQ7MYo7N6NO0SeCKXFs4VrPdiwGAT0FhE5KmwC0fv8U	t	f	t	\N	\N	\N	\N	\N	2
5	John	taxi@reichwalde.de	$argon2id$v=19$m=19456,t=2,p=1$UCIZz8oGzu9kCDOpmWXxYQ$amyxen1cjPmi/TwetOz7I/f+neLvlx6eQxM6OTvIzx0	t	f	t	\N	\N	\N	\N	\N	3
6	John	taxi@moholz.de	$argon2id$v=19$m=19456,t=2,p=1$TCAyMLkDNz0F7nceulTs4A$+dCc3qIYwS362mcrSH/Z7hmXx2KW5Ow5NLhZH0XpPEI	t	f	t	\N	\N	\N	\N	\N	4
7	John	taxi@niesky.de	$argon2id$v=19$m=19456,t=2,p=1$jxW4oxa3l0tg+OG3+4lllw$l5TN76xuwWqc01KNBHB37WukqjmqjKsm/ZBF2y+NvPY	t	f	t	\N	\N	\N	\N	\N	5
8	John	taxi@rothenburg.de	$argon2id$v=19$m=19456,t=2,p=1$dviKXplqYeVGdRA+UztyDg$/rQUv5OVgKufsy6VqYtFhXfE6jaHOCV6oE+3aDZVGMo	t	f	t	\N	\N	\N	\N	\N	6
9	John	taxi@schoepstal.de	$argon2id$v=19$m=19456,t=2,p=1$B7mjUX8IFZv+1G/jiu2dSQ$xGhHcG8PKvDYLwydw2aVVqaaovdjFanlIrBjF0TgDkI	t	f	t	\N	\N	\N	\N	\N	7
10	John	taxi@goerlitz.de	$argon2id$v=19$m=19456,t=2,p=1$6zvrI5rYSzw+NP8hRZ1Yxg$pAY9o3o3rhlCNGo2zVwP/Kq5YVOrm6yvLrqaSDeWxpw	t	f	t	\N	\N	\N	\N	\N	8
11	John	fahrer@test.de	$argon2id$v=19$m=19456,t=2,p=1$6zvrI5rYSzw+NP8hRZ1Yxg$pAY9o3o3rhlCNGo2zVwP/Kq5YVOrm6yvLrqaSDeWxpw	f	f	t	\N	\N	\N	\N	\N	1
\.


--
-- Data for Name: vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicle (id, license_plate, company, passengers, wheelchairs, bikes, luggage) FROM stdin;
1	GR-TU-11	1	3	0	0	0
2	GR-TU-12	1	3	0	0	0
3	GR-TU-21	2	3	0	0	0
4	GR-TU-22	2	3	0	0	0
5	GR-TU-31	3	3	0	0	0
6	GR-TU-32	3	3	0	0	0
7	GR-TU-41	4	3	0	0	0
8	GR-TU-42	4	3	0	0	0
9	GR-TU-51	5	3	0	0	0
10	GR-TU-52	5	3	0	0	0
11	GR-TU-61	6	3	0	0	0
12	GR-TU-62	6	3	0	0	0
13	GR-TU-71	7	3	0	0	0
14	GR-TU-72	7	3	0	0	0
15	GR-TU-81	8	3	0	0	0
16	GR-TU-82	8	3	0	0	0
\.


--
-- Data for Name: zone; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zone (id, area, name) FROM stdin;
1	0106000020E610000001000000010300000001000000D5000000E7948C60FB0E2E40EE9B2ACAFBA5494047608795550F2E4013A8C107AFA549407F5C76880F112E407C63E8FDA6A54940D59D01EE67102E400D3C316CC9A44940106AD4D494102E40B7338ED378A44940B342FD1810122E40CABE047844A4494076ED1E9791112E40102DA3AE85A349406E50099773152E40BE21674DF4A24940443D1903E3122E404D930EA1A0A24940AA162B9894132E40095900A62CA249400BC66E647B122E404EC638F680A149406FE668F57E132E40C5C2FAF40CA14940F7FF9BD65F102E40F0BD2DEEF0A04940FF83D5B5640F2E408FF9ADB995A049407603CF57CE0C2E409E1F2ABD7FA04940DA85F6A8E60B2E400C57D98C0CA04940D4624953890D2E40EB3ADC3BDF9F4940231B6534370E2E40F2EEC1342BA0494006D21FE8510F2E40ABE73F4028A04940FAFDCA2B2D102E401EEC556AC09F49408104EED964132E407EDF80FA389F49409BA4E1B972102E40C925381FCC9E4940524F7A04AB0E2E40E831ABA1F19E4940F4CFDC2FB80D2E40CDE39381A69E4940C7CB3294CF0E2E4030E9DAED5C9E4940F9316493090C2E402491C2971C9E4940B85F3E73C40D2E404AD97356EE9D49409736E7523C0D2E4000FE1391AC9D4940075DB6EAEF0A2E40209B5AF1449D49406506AB434D082E40F58BD7751F9D494073EF943432092E40C9ECBC9B329C49404ADE1106A9022E4011C47B97979C49402F304F30B9F72D407E0E8383CC9C49400554A6EA31F32D40D012977A209D494031CD08A470F22D40DAAD3460AB9C494087C59D1B42E82D409DBA8681399C4940E12C8ACD98E72D40818D9A31919C49403B965A8D76E32D409971817B219D49400BBE6A1ADADE2D40923D587DA29D49401EF51FCCBBDA2D403E8FB806859D4940853A954041D82D4042D0EEB30A9C4940D27D518721D82D40D2D10E58189B4940B85608C428D42D40E7A8520E429B49409EE78EB807D32D40643B2366D89A49409199EAC988D42D400E9073E8B29A4940F633B7EA40D22D40FBCF13A1D199494019ADCBDDC2CC2D40FCA4D98F149A4940C4444ACF5EC72D4084BC27FCDF9949409B2147AC95C42D40D821C3A587994940C99CBCBB29C32D40A953BF85D09949403B19F0929EBE2D40207D8A97D69949408D965BE14FBC2D40B5F1DF252E9A4940C81BC89F66B82D40879D1639429A4940897A6B65BFB72D4063C4BA437C9A4940ECEF129A11B42D40E7F43A4C969A4940411E324FE7AC2D407F43F47A1B9A494095F52957C4AC2D40DEBB1EC797994940DCD2EFF0D0AA2D40B73D0B3EB7994940232882A993A92D400FFEEF358F9949407AE7B6DF1AAA2D40231534733A994940D11FCAA675A72D40F564F2679E984940EFDECBD525A52D406B110D76979849400E1711FC4EA42D40950C6575F99849408B55C70FE2A12D40BF928603219949407402F403FEA02D402D341988DD994940ACF6C628AD9E2D40DB07AD572C9A4940D7F5F971299C2D403EFD4108EF9A4940D3D822FD4D892D401AD19EF10B9A4940406E38E357872D400543AAEC189A494093C9FAFF66872D406633CE1C549A49406AF7B4506D842D4042DEDBAD469A4940B3CC8A8F32762D4066C4A848219B494026E632AD68762D40EA925D64719B4940181CBCCB857A2D40937C15A6CD9B4940E42A64C6D87A2D4005E81109209C494047F4C9F66E762D402A1926895D9D49403F5A78D2D4732D40DE4C6842C99D4940DDEA0EEF4B712D408B7EF7FDCF9D4940D007C5ED6A6E2D4093F41667BE9D4940BC9153DCCB6C2D40341306F4569D49403BDD4ABD0D6A2D40CA87DAA52B9D4940F24DA4EC97652D400A75AF79D79B49400607A326C55E2D4032456931089B49402EFAF4EA8C592D40C58CA011019B4940917AD648B9592D40900AA8CD2C9B4940A936461E77582D40BA8872163D9B4940E3F64B7124582D40D052321EFE9A49407D23E7D261542D4042F8B9A0F89A49409013BDA7DE502D40AC4824FB459B4940C200843948512D4098A65EBB6B9B4940CF91CD779F4E2D40EFC11A17999B494078CC6CCCE94D2D4083589FA6E09B4940F03B026CDE4B2D404363573EDE9B49403E30510CCE4C2D40F99F1E9AAB9C49404BE723775E4E2D400FCACBDBE39C4940F8488C2B514C2D402F6DC32B829D49408F1E68FA714A2D406905F2F1769D4940B017DA28A1472D401C1CBEF9EE9C4940D106835BE0462D403EE4AE2A679C4940126D7F2A4E452D409035A6666A9C4940C549DCCB14452D409352AEC8409C4940E7B4ED14B0412D40CE9E2306319D4940E2947AADB13D2D40D2EFB4FC499D494050868C5AD3412D40BD146219A39E4940EE6D1D55F9432D40550B954DF09E4940B11D4A825C452D40DC5B2D57E79E49407F49A4C0D7452D40D0040575D69F4940F67466C70C412D40E162B37512A14940E8C340DAEF392D408835D2DF43A1494089815BF6D93C2D40E3EF523A19A249406703E89DFB3E2D4059FB7190C0A3494032E34A78B5392D40C0B01BEFC9A34940DDBF243763382D40595E205E74A44940546B61C63E332D40628E1386F1A449400D2D0D476F322D40AF9A0BF5C6A549402030AF7280352D40CBC9C7F8A6A6494059B079BB32382D40BEB29D7255A64940FE3573AE4B3B2D40FE9C08E87FA649400DCEC54CAF3C2D40CFE2B59D08A74940D35CA291A9402D40377ED9B40DA74940CDBA4AA7C1412D40CA7D03D0E5A64940C528E22DC4432D4030EB558B0BA749407B6EFA8FDF432D4077EB899F58A74940802AA5972E462D40E31E8D7AD0A64940F158AD3C59492D40747B01E018A749401CDA500270482D40D618179CEDA74940F41FE573DA452D40F43886BD33A849401A9F0BEB81502D40C471F07A7EA849408D4F6DBE2B4F2D401C0B4D26F4A94940926A20CD92522D4043C6DA33DEA94940197460A7E5532D4028A7D59E27AA49404EBE79AEEB522D402E0CC62B6AAA49402063A1FFAC512D40CCECA9D05CAA494070E32E625F4F2D4065BACDC0A3AA4940DD64A573D84D2D40DA14735264AA494054D55CD7344A2D401FEF0958CDAA49403B895F11514C2D403135665E1DAB494058C6CD9C9C4F2D4080D2716206AB49402099E814D6522D40C2DA517DB8AB494026E05A0F38542D40F18D9F3537AC4940CA0AFA7C4F532D40D423B1B954AC49407DC7AAE791542D407700F6D4C3AC494073582D93B7542D40F57F00ABFFAD4940905107FEBA562D4000DDC83E64AE49406220011D31562D4002DCF1B9FBAE4940FE73C4B8CD5B2D409948D245E1AF4940998FB4A55F602D40342F41D0FFAF494022F6AF7FE5632D40B0970E7951B1494010FC118EDC612D40C4A72B770FB249405A8CF012C9652D4008A7E7E839B34940E72262099B6A2D40CC68BB95D2B34940533D2A310C662D406A6EFC9DB5B449409CDD6F25FA672D40C79718A367B4494093B5E3534E682D40365EA6CABCB449406E1CE2E40A6C2D4000F26B0870B449406AFDFB783D6C2D40CCEB809217B4494028D3F0E88D712D40BAEEC756CDB349402B0D424019772D4076DEC806D8B34940D3A682378C762D407E092395FBB349405EBB5EE2277A2D4082444C897AB54940CBB09679E37E2D40EA486093E8B64940C4A456F106822D40BE9B40B983B7494096EF9CA7E48B2D401FF3213904B8494045976DE2FB932D40150E9D2EC8B8494077B8C5B6A59F2D40FF41775AB4B94940F88396E472A42D405B31136154B94940A8D238E7A4B32D40733B646F36B94940AF2CC89844B02D40797A914CA1B74940DFEC97C5E9B82D403076716190B6494006718DFB02B92D40FE63502446B64940B1F7474119C42D40F89CA11CD4B54940B8DAACEBE0C82D40909DADA5BBB44940B235767F69D62D406DAA6F0AC7B44940CE92B9471EDD2D4051C6546C2BB54940C5680D6765E02D403BAA323800B64940F352FFED0BD92D400090F70AE1B6494041BB22A278DF2D40B07CB9924FB74940878E12887CEB2D40C25472F958B749405316F9816CEB2D403C388B67F7B64940DD7F85CCBFEE2D407362950F97B64940C817A3DB9BED2D40595BA33033B649406DDE877529EF2D402116017558B54940AEDD446EFCED2D40C8D17B08CAB44940A9CF3F83D4EA2D40569764D278B4494004BFA05D8CEF2D40259DA4A78CB3494088B03F643CF02D4014D82C05FBB2494060473879B0EC2D40A6383C5EE5B249400121CFA2A5EA2D400D2452419EB249402A67C821C9EC2D40A9D31C8A8AB24940EFDA1B6195EE2D40389880D013B24940A093F650EAED2D4042417BEB7EB14940C777B8E042F02D4053E5420EE3B049407A28C02F30F02D4079DB30EC8AB04940B492E594A1F72D406A73B46DE1AF4940497665FE7AF42D404743F79944AF494038610B4470F42D4015B1945ECFAE49406D1B00252DEE2D40A4D0551940AE494005372D83AAEE2D40A391919104AE4940614D9396FEF12D40254BD1C30FAE4940E8F44B8DE1F32D40D4CFB33AB4AD4940C6C487CB95F42D40AF2E4C25BBAB4940758ECDF31BF62D402EDED21D7FAB4940A30578C1B1F62D40BBCD2864CCAA4940D376E9B5B0F82D4040C3802F90AA494077B3A30AF6F82D4041D1574A21AA49407D9E431F75FC2D40C6CE251A13AA4940E8ED44B9E7FC2D405CBC42FB44A949404A368902A9042E40351377458EA84940D5BB20106A032E409ACD64D4E1A74940E09F3FE773062E401EA82CB17FA74940457C6A9693062E40B227322A82A6494012D44E6EBC0A2E40CA593D3E83A64940E7948C60FB0E2E40EE9B2ACAFBA54940	Niesky
2	0106000020E610000001000000010300000001000000FF000000FDC9AEC39E642D40EB82104C60CC4940DD1C68217A6A2D40DDE9DA516FCC494071EEBF3AF0702D404897A44852CB4940B3D2CCC6E3702D405DA302610FCB4940223FD476B2752D40F08B3DE577CA4940985BEE804A742D4045D178B7A0C949404266AB0A296C2D40FC5D24BD00C849403C9E18BCF16E2D40568101DD08C749408F73A41E90722D40BA2EBD92E2C6494009EAA97766752D40F4E697B563C64940B4F0BF7985762D402E2E9DF6B0C549400296AFCDE2732D409791A06805C549403BE0AB5AF7752D40F3596933E9C34940E3DBFECD01792D40BE57BB4E4AC34940825AD9483B7C2D4084B9018E3FC349402D7CEC8E0C812D40922E8B75C8C2494040E2997730852D40ACFDD69E00C349404EEAD6F0D2872D40638029766DC24940A57E6B10048E2D401790E35542C24940295368332E912D40A5BAA2E35DC2494056063DA88C932D4083C2908C2EC24940E7585BE7B1972D40DE7419CD47C24940F1E179FC11992D40D4CC39FFF4C1494020ED98D6349C2D405B29D8A0DBC149402E859D19989F2D405ED56F15C8C049400AC227853FA32D400424B59EFDC049407341A08721A62D40AAFF040AA8C04940EF59A1341BAA2D404901D74C7FC049408D5CC30771AB2D40208A0305F0BF4940AE6B719809AD2D4065D66787DDBF49403806A70A0EAE2D40A5C496DF79BF4940E4D4310322B02D40D69E0CCF5ABF4940880714EF3FB42D40C46CD46EA5BE494075605C23C0BA2D40A73BAAD9C8BE494047971F8E5EBE2D407E21AD7E0ABE494015A2EDF438C62D406FA41EB277BE4940BC1716A85AC82D4028B2626903BE4940ADF7092DF0CB2D40828D9E52B2BD4940D57180927AD02D403D4B503BF3BD494065FC42ECFFD42D407FB3B53DEBBD494054D791127AD92D402DE9971F7EBD494082E5E44B56DA2D40CAF970C394BC4940D5B9D62CA7E52D40B0AC1D685FBC49405E96E1B5BDE92D40167C85FC4BBB49408BB3E17784E92D4041A4AB0FA9BA4940314B69D6FDEC2D406D6A68F0FAB949408CC66779C3EE2D4040211B8A25B94940D0827B69D0F22D40558B5AC584B84940C87578C1DDF02D40DF603B6055B74940E81C290D91ED2D40FD0A8F8896B74940878E12887CEB2D40C25472F958B7494041BB22A278DF2D40B07CB9924FB74940F352FFED0BD92D400090F70AE1B64940C5680D6765E02D403BAA323800B64940CE92B9471EDD2D4051C6546C2BB54940B235767F69D62D406DAA6F0AC7B44940B8DAACEBE0C82D40909DADA5BBB44940B1F7474119C42D40F89CA11CD4B5494006718DFB02B92D40FE63502446B64940DFEC97C5E9B82D403076716190B64940AF2CC89844B02D40797A914CA1B74940A8D238E7A4B32D40733B646F36B94940F88396E472A42D405B31136154B9494077B8C5B6A59F2D40FF41775AB4B9494045976DE2FB932D40150E9D2EC8B8494096EF9CA7E48B2D401FF3213904B84940C4A456F106822D40BE9B40B983B74940CBB09679E37E2D40EA486093E8B649405EBB5EE2277A2D4082444C897AB54940D3A682378C762D407E092395FBB349402B0D424019772D4076DEC806D8B3494028D3F0E88D712D40BAEEC756CDB349406AFDFB783D6C2D40CCEB809217B449406E1CE2E40A6C2D4000F26B0870B4494093B5E3534E682D40365EA6CABCB449409CDD6F25FA672D40C79718A367B44940533D2A310C662D406A6EFC9DB5B44940E72262099B6A2D40CC68BB95D2B349405A8CF012C9652D4008A7E7E839B3494010FC118EDC612D40C4A72B770FB2494022F6AF7FE5632D40B0970E7951B14940998FB4A55F602D40342F41D0FFAF4940FE73C4B8CD5B2D409948D245E1AF49406220011D31562D4002DCF1B9FBAE4940905107FEBA562D4000DDC83E64AE494073582D93B7542D40F57F00ABFFAD49407DC7AAE791542D407700F6D4C3AC4940CA0AFA7C4F532D40D423B1B954AC494026E05A0F38542D40F18D9F3537AC49402099E814D6522D40C2DA517DB8AB494058C6CD9C9C4F2D4080D2716206AB49403B895F11514C2D403135665E1DAB494054D55CD7344A2D401FEF0958CDAA4940DD64A573D84D2D40DA14735264AA494070E32E625F4F2D4065BACDC0A3AA49402063A1FFAC512D40CCECA9D05CAA49404EBE79AEEB522D402E0CC62B6AAA4940197460A7E5532D4028A7D59E27AA4940926A20CD92522D4043C6DA33DEA949408D4F6DBE2B4F2D401C0B4D26F4A949401A9F0BEB81502D40C471F07A7EA84940F41FE573DA452D40F43886BD33A849401CDA500270482D40D618179CEDA74940F158AD3C59492D40747B01E018A74940802AA5972E462D40E31E8D7AD0A649407B6EFA8FDF432D4077EB899F58A74940C528E22DC4432D4030EB558B0BA74940CDBA4AA7C1412D40CA7D03D0E5A64940D35CA291A9402D40377ED9B40DA749400DCEC54CAF3C2D40CFE2B59D08A74940FE3573AE4B3B2D40FE9C08E87FA6494059B079BB32382D40BEB29D7255A649402030AF7280352D40CBC9C7F8A6A64940483C776965362D404DA6B2EF59A74940DCCEE9C836302D401EE42B9A45A74940995BB91B6E322D40D66215ACE4A74940E7EFADFB6D2C2D4030931C32FBA7494076BEF96F042D2D40374018B87FA84940A218BF028F302D400AB6D5DFE5A84940FE954F63EA2C2D40E3C9E192F1A84940B9296E33D42D2D40DB5AB4D838A9494048FE71E1C0292D40B72E39774BA94940545F7E89B6272D4022D12A4A8BA94940FBAA0357FA232D40504391BE98A849403149A89671212D406D716DE596A84940E0FBDF7DC61D2D40AAAA445FA3A949407B426588C71B2D40C4FCF973D0A949403A8EADA1231C2D40DF9E515BFAA94940A3DE748EAC192D40E68D420327AA4940D960F2682E192D40078BAC54E8AA49404B570559E4142D405B53B3AC38AB494029B0F54EE1122D4016F461E0A2AB49401B6C435DD8112D403D6DCE9674AB4940DB50F4A2F4102D401617EB498FAB4940B2A3723513152D40475FE9DDBCAC49402EE5231AE8162D405E8AF562BAAD4940684BEE02B0142D405AE864DC87AD49400A324DE99F122D409A47F10A9FAC494050CA4A799B0C2D4017BA870D79AC494080F7432A220C2D4042A1F3CF26AC4940881B585C960A2D40F92405D10CAC4940D6D0EA32120B2D409695A48185AB49406BE9764A470C2D40550230746DAB4940A52DFF44A60A2D4006D502D42BAB4940A94B51631B0C2D40A64D402BEFAA4940EB388519DF092D409FF6E717C8AA4940C5969F8C1E0B2D4082B8042924AA4940B1D1DA0B18052D401561642A24AA49402930B004B1032D4030ED86A1F9A949406B6A2F27F4032D407E25647FBFA94940FCE9B6D268042D40AEE4A6C601A94940EDA30D9F79012D407D5BFBAB5CA94940E3067B6FBC012D40D979C157EBA94940611E12E6A2FD2C40182DE41FCBA94940996DF1B997F52C405431CF101CA94940956C64BF32F42C40A6D39CCB10A94940654DAE4F1BF22C40D6FC0C8E6DA949402C0A983090F22C40C4367212A8A9494065DA5CC6A6F32C4081F42199A6A9494003FED9E72AF32C40A99847B020AA4940A3356BB48BF12C409F8B1F796EAA49401C1D4B3665F12C402AA5EB76EAAB49400C7DBD38B1EF2C40DFED8F7145AC4940363277EA13ED2C40B530896A4EAC4940352679FC63EA2C409762C09E41AC4940BED785CFE6EC2C401DB6C89E8EAD4940EAE60447BBF12C405D31FF8206AF494066611DE3AAF22C40BDF4B71501AF4940B4E211761BF42C401BD5A6057DAF4940053D6EBF58F52C4099AE494461AF49404C47F6E9E4F72C408965124213B04940CE84291016F82C40E57BF93975B04940AE78EC883EF52C401A56E8D543B14940625D5F0AA6F62C4005255A1101B249409F589CF4A7F82C40DFD9E25545B24940DEF7827BA8FB2C401CEC6F6980B349407CF01CF64BFF2C40AE379B26C7B34940446E25F5AE002D407AD64C464AB44940FEA7E488DFF92C40E2F707D087B44940C2019C723D032D408A62D1B5BAB44940B5440D1A27032D40200E1C9D0DB54940128812A1B7062D40F941CA4B0CB549405751E19E64052D40E5593813A4B5494093B94F5F510A2D40961A54B310B74940B10C3ABC770B2D40FD0D0D950BB74940E96A2A1D690C2D40C928F2FE8DB7494002428CDF800B2D40DC033B07E3B749400B9A5DA46A042D4096383FDC03B849403D549A0809052D4067AEA7FBD2B849400D39877214032D40C45AE93962B9494015A92D4619FB2C401B11C00D65B94940D0E3E34067F72C40965EAB74AFB94940D381EAC336F92C4066965CF67FBA494030AFA29177FD2C4028B7DDDB07BB49406EB5CCF617FB2C403A207F0613BB494044EF6881DCF82C408151E9B874BB4940CF8F041415F82C4084CD6070A2BB49404B4F7B5A6CF92C40E1FE1C39E0BB4940CBF25D9CFBF32C401A06D13D47BC494080E34470E4F02C403E86E56200BD49400334922ED9F12C407ED418C8E6BC494059DA8924B7F32C40D41FA59F58BD49408463512BE6F32C403FD1F1D6C7BD4940A0BE6D249AF12C402B41A8BD07BE494045844B2B21F32C404B049D7E42BF494030E7838AE9F52C4071D4AC3124BF49408FA981DA5BF82C40555FA46174BF4940A3EADA34CDF22C40D7609E72CFBF49408F72DB15B1F22C40F8ACF5DA25C1494009D91C142AEB2C40D8A6F97274C14940A85160661EE12C40A847E8777CC149403056179B7BE72C4078115E7ADBC34940060ACB5F9BE62C40EEB89E8019C54940637CBDEB3BE52C40D0366A2F63C54940C7ADB204C3E42C40D636F465C1C6494064AFAD52DBE62C403708B03622C74940C74F3D95ACED2C409754B58E4FC749400B00B7C444ED2C40AC1D3D5023C74940A73FBEDE4DEE2C40D4AABDFB0DC74940F86D75C2F7EE2C405CBAD94D54C74940472DB33EE7FF2C40C9AAA8E396C74940794E92716D032D4094DC4EC24BC74940B62754D976042D40146DD60C76C74940C4E312FE2C082D400F8D11A6EBC64940974E67F2E60C2D4011AF5D267FC7494088122C8210152D40B097806EB3C74940362BAC316B182D409A45F3D526C84940FD0B3C95C1162D406EDC86336CC94940E21F3E952A1C2D40334F5C0339C94940761D701B361F2D40DCDAA5D56CC9494067E00924AB222D40EC9B3BD461CA4940FA1C9A6243292D40B6E6C4384FCA49403BB9E9337C2A2D4083FA33FC8AC94940F491F12EDC2F2D408686F9B180C94940DD02CB75B4322D409A7A4CBE1CC94940C6CB378D12342D403D2FDF21D2C74940B63B22DB7A362D40CB35CE5740C749406619038911352D40C98567B50DC74940C8EA076117372D40C78AC8CDD4C64940597D90FC26382D40A52AD5B46AC64940A68F2CED4E432D409429F90185C6494004C66D2AE1462D409C7071CAF5C64940F700096B1F542D4095B368FF00C7494022359483FA532D40F2EA3F8CC8C6494067DB0D5B16552D40C9D5DFC8DDC64940FA71B950ED582D40F73D50FC81C64940B7DEF815BA5A2D40BD7576A3A4C64940AC1C32E1D0612D4095CF738AF1C74940ECE5D76D90642D40D8E472449FC94940A54DAEBEB6622D403DEBD00CC5C94940FB95C397DA652D40A7350F0ADAC94940B685B46467672D4067552C4EA7C94940A1B13075DC692D403B18459DD3C94940BB07AB008E652D405B7B5A4E7BCB4940FDC9AEC39E642D40EB82104C60CC4940	Weißwasser
3	0106000020E610000001000000010300000001000000A30000002CB9F68DB6082E4036EF0AFC7C9B49401E8BDBFF06052E406B5549A0549B49406A78A42C1A052E400A027B650F9B4940BEA8F2D3A9062E402B7F3A10019B4940A23D22EDA0062E40738540F8A69A49405A30B3D5E5032E4071187E1E2F9A494031CB8B3904042E402D61B0178399494085D1E35D6A072E4024F8FE124C9949409E93F5D14F052E4098F86209AF984940DB5CC9BA68022E40715D139671984940FDCDAD1890042E40D3774E075297494057D29679C0002E404FA407EF08964940044DA28499022E408FB5FB4F78954940DFDBA9257DFC2D401A889220CB94494057FB912102FD2D4007C00EC726944940FD85A3537B002E405B63331334934940906E362825FE2D40BE9831E26F92494000F59B7F01FB2D40A306F8693B92494096EE818A91FD2D40D0E42FA392914940091C3FB759FE2D40D6B9A6D7DA9049409230BCAF51FD2D40E24FA14ADA8F4940063775B5DAFE2D40DF7B48CEAE8F4940005E7CCD4BFA2D404188D1CDE88E494024D9AFFA5AF82D40978EBFE6E68E4940EDB8E79360F72D4016D27EA4168F4940D3F320B62FF62D40EDB73463DA8E4940E9E736501AF72D40272EA2D4818E4940BB7C5794AEF52D40274A29BA218E4940D67FE0D962F62D4053748A20F48D4940E51F0D88CCF42D4001E66B28D08D49403B168655C1F72D40FCEC5A731A8D49408A96C9E5B8F72D402A9CAEC7748C494087B8654EDAF52D40E2FE1E22478C4940A70009531DF72D40B24EB6522C8C4940AECEA6DBC6F72D405FB5043E9F8B494041A8454EB7F52D402F940F86838B49407DFE0798AAF52D40E45B0517258B49409022CB74F8F32D40E51B8C3E2F8B4940E952AEE27AF52D406F44AACDE0894940E189858EA8EF2D40BD12C5F92C894940F702FDFC9DEF2D40DACF2790E888494099A8A07375F12D40A80F293EE08849403467868096F02D40ADD10B6DA58849401943808F4CF12D4044E8532666884940A4A40C40A7EF2D4045E271263788494080FA1CD7DDEC2D4090DEA0C12A874940FF589DF0AAE62D40FCE4F51A4C874940EE7FC11126E62D40D78409B3D38649405821501BD7E42D405A86AF68BA86494028E8B43382DD2D40C40FA63EF68649405BC5982421DE2D40DCA818D2FE874940144E824BADDB2D405694F5A984874940155B5122E3D82D4094712D698C874940DED90ECC3DD82D4050FB94AD61874940B44D3EEA57D62D40825389F38C8749403D3BFF88F3D52D403DF57A10768849400882828AC0D82D40CB609ADB90884940B760ADABBBD92D404F06FE36E38849401FB6FFB66BDB2D40BF12FA44E388494051289B1341DB2D4097AD8A4E91884940AD685B4851DD2D40AE456036F78849400A0A055BD7E22D406329D97BE08849409C45494338E22D40EDC6A9E8568949408542ABF6FCDC2D403A97080044894940499BE3C72AE62D40154E5E5EA5894940DFC00B508DE62D403FC858413A8A4940D03C040E9BE82D405843C8E6618A49407FA5306AAAE82D40201F7C196A8A4940DE7FFBF9CDE82D404C873F726B8A494015F20C3984E82D40F1BB05A5B98A4940ACAA3F06AFE52D400A4B7DA2958A4940A1FF207FD5E22D40A97143AECF8A4940383F0278B4DE2D40178EBF44E98A4940E9D9A9ED84D82D402885A432A48A4940DC9182BAF5D32D40EE0341B4A58A49409681B42B58D12D405EF5C7A4CA8A4940B0727A32B4D02D404B24E7A4058B4940E092B49F6DCA2D40FC1C16FAF28A4940EA1D56BAA1C82D40831FB05DE68A4940AD8D21C5BBC62D40ED417435838A4940766451617FC02D40EF66B7D1688A4940DD2A1C49FABE2D409B3841C2F9894940F2FBFF2082B52D40443CE553AA894940275B5C5A0FB12D40891A914BBB89494009B027E15AAF2D40909063DC2F8B49403D64805206B02D40F3686989D38B494028354C221FAE2D40E54C5EC5DC8B4940722FF7B041AC2D40C36840C5778C494022ABA97122AC2D4023138BDACF8B4940142D97259EAA2D40C260CB8F9A8B4940AFB08AF1FBA72D40288A1608B28B4940D744AE05ADA52D407822E36E948A494022CF613D27A42D40F624B668A58A49408635BD3B89A72D40F19AB440658C49407252D77B00A22D40C7F7DD0DD98C4940CA61FA7F3FA22D40AA100FC5208E49402FABD134B8A32D40E7E8A6C7A88E4940AFB7B00202A22D406EF1279F048F49408E303991C7A02D40C863F9F7FC8E49405BA4D7043FA22D403DE30564B38F4940E6C199C74AA12D40F90DE227F88F4940E74A56BF04A22D402BB3F6042B904940B123BF9E19A42D40EBE423B0199049409AB8B3E9E2A92D40BEBEDE0CE99049403E879C02B3AA2D4042E2B9ED7B914940098D37263CB02D4090B18274529249405E558438C8AF2D40C44EB13D279349405FF6C0E7DAB12D4099930DDF1D9349405C5F04E28EB12D400829222642934940D20740C1DCAC2D4048BCB03E93934940CDF2EE82CDAA2D408720BB2143934940441283A7B3A92D40322DF9CEA0934940F3E82A5032A82D407DACE78A8C93494055C1AE434AA82D408E923F0FBF934940F082F037FAAD2D40FC7010622D944940720CD3B754AE2D4024E7782FA894494047D31F77A3B02D402EF8481E0295494022A90D6606AE2D4076003B103695494064EB130940AE2D4024D98623E9954940DC2A3D6A1AAD2D40AE1D248700964940295D42BE60AC2D40770348317695494044618E18E3AB2D4071735547939549400113771690AC2D408D66EC3B4B9649405C90609444AB2D40433E335FB096494067E8D6A5B9AB2D40BBE5902705974940F98FA76813AA2D40CA3A1CCB02974940E54F67BC5EA82D40CCCED9B36F964940E0F954C337A82D401DD8C6D6AB9649400C7E866112A82D407012297636974940410DE60D28A62D4097B57292BE97494054CAD6114DA72D40C90F3E8DD3974940D11FCAA675A72D40F564F2679E9849407AE7B6DF1AAA2D40231534733A994940232882A993A92D400FFEEF358F994940DCD2EFF0D0AA2D40B73D0B3EB799494095F52957C4AC2D40DEBB1EC797994940411E324FE7AC2D407F43F47A1B9A4940ECEF129A11B42D40E7F43A4C969A4940897A6B65BFB72D4063C4BA437C9A4940C81BC89F66B82D40879D1639429A49408D965BE14FBC2D40B5F1DF252E9A49403B19F0929EBE2D40207D8A97D6994940C99CBCBB29C32D40A953BF85D09949409B2147AC95C42D40D821C3A587994940C4444ACF5EC72D4084BC27FCDF99494019ADCBDDC2CC2D40FCA4D98F149A4940F633B7EA40D22D40FBCF13A1D19949409199EAC988D42D400E9073E8B29A49409EE78EB807D32D40643B2366D89A4940B85608C428D42D40E7A8520E429B4940D27D518721D82D40D2D10E58189B4940853A954041D82D4042D0EEB30A9C49401EF51FCCBBDA2D403E8FB806859D49400BBE6A1ADADE2D40923D587DA29D49403B965A8D76E32D409971817B219D4940E12C8ACD98E72D40818D9A31919C494087C59D1B42E82D409DBA8681399C494031CD08A470F22D40DAAD3460AB9C49400554A6EA31F32D40D012977A209D49402F304F30B9F72D407E0E8383CC9C49404ADE1106A9022E4011C47B97979C494073EF943432092E40C9ECBC9B329C49402CB9F68DB6082E4036EF0AFC7C9B4940	Görlitz
4	0106000020E610000001000000010300000001000000F600000041CD9EBC68252D400759975BE68B4940F105A5161C252D40FAE0DFA0578C494066A284F08C232D401E66F83C4E8C4940CAD4C9B9A5212D400DD1B46A918C4940F4B28BDA8C222D40FEA406A8DB8C494028C25708172B2D40265B50D4788D4940CB7A034DDE282D4099D91954EB8D49405C2FA9AFC4282D4095FC1AE3568E4940292BC3A540252D4006EC8136A38E4940DB7593E199262D405E25E714648F49409447D92C5E292D401643A653398F49407FC2BBF9B22A2D40198443AC668F49404688339400302D40480BF75B578F494004DC73EB8D352D40EDE9DC03F68E4940440A34FA893C2D40A900E3000F8F494031F73D5C9C3C2D401190D4F0408F4940EF212FAA4D392D4092A03D53618F49405018B4E208392D40E874CA41B18F4940AADAEA2ABE352D40B538A912C58F494075B0E3D18C352D404E963D62FA8F4940685C2415CD382D40211BE03BB2904940B2E2592DAE392D40DC29495E80904940346D3529C83D2D40C0E21111639049409AD3B46B89402D40DD1E6DABAE904940F3F9A39389432D405E6CD79AA79049405EE8426022462D40974FEDB212914940B7E04CF62E482D40D23B81FBF49049407C5C268145492D40FE7A9A593A914940B0743ED945462D403873D3ED1D9149404E1BABB3E1432D407CB42912819149409B02262A48442D40C4098B10C9914940B90715DD62472D40C996C86BD7914940765D3DC37D472D40B78559098D9249407579F77B52482D4029259EAA8892494050BBD94C46492D4045D7A832D59249400D16A2C8404B2D40783AC200D6924940D0D5A665894C2D40ACBB10AF6B9349401A646E6BD94B2D40DF62BDD394934940DA8CF345BB4C2D401A155A688793494075D58535F04F2D40D2738E5B1B94494022D9DA5993512D401F077A71EE934940D27C68C545522D40B683D0B419944940752FBB22D7542D403B5972E6B3934940C45895786A552D405F28503AD2934940FA631984C0552D4004C213FB68934940DE08A07D8F582D407B48A2AC4F9349408E38CA3DF9572D40047AA41106934940BB9C1BE09D592D40CBFD3DCA01934940FB1BD796E1592D409586F7265893494093BAD411E75A2D40B3A6627259934940B5238086245A2D40981590B506934940AFD5C3EBBD5D2D40F2D011C0089349406F20FFDACC5D2D40F70A29B16A934940EB11393A685C2D40460D3C548A93494011F29589A45D2D40E2773FE841944940AEA535511A5B2D40500C1CCD7494494007D6BA06F45A2D40BA99A1E0B99449404C2794A88F5C2D40D305AB83DE9449402BFA63AC755C2D40131B87023F9549403EAB1F87A45E2D40FA64A9A1579549405B513023BD5D2D40E95113C984954940153C794C2B612D40B57C81314B954940DD66ADD4D8602D4055B6253DB695494018D18A7FF8612D40A659C101D995494057C9455675602D40215CA79F3096494055FD984D12642D4085A66A99AE96494027A4E74A33642D407AFAC32FE796494028E4100719672D40E9D1EC260897494007224AC63F672D404447162730974940165F9FB107642D40D0071BEBA9974940CEA57AA59C652D40FD6F3ED4D697494053D8FAFFE7622D405F7E07BCBC974940BA1BD0F84E5D2D404972B9C2ED974940C4CA009C2D5C2D4054797E13179849407606FC96735E2D409D460D6524984940A23D10669D5B2D406232B5856198494028B56AE11A5C2D40040B2EBF7C9849402B51E411E45A2D408997C8A854984940F2609E61555A2D400395F47C8298494085446F9DD0562D406097014DA2984940E9E5C983865B2D408CB236C3F1984940A696EC7C345A2D4008607C736B9949409B59EEE4755D2D40A715B6A7B9994940713668C4295D2D407D7179E8659A49400607A326C55E2D4032456931089B4940F24DA4EC97652D400A75AF79D79B49403BDD4ABD0D6A2D40CA87DAA52B9D4940BC9153DCCB6C2D40341306F4569D4940D007C5ED6A6E2D4093F41667BE9D4940DDEA0EEF4B712D408B7EF7FDCF9D49403F5A78D2D4732D40DE4C6842C99D494047F4C9F66E762D402A1926895D9D4940E42A64C6D87A2D4005E81109209C4940181CBCCB857A2D40937C15A6CD9B494026E632AD68762D40EA925D64719B4940B3CC8A8F32762D4066C4A848219B49406AF7B4506D842D4042DEDBAD469A494093C9FAFF66872D406633CE1C549A4940406E38E357872D400543AAEC189A4940D3D822FD4D892D401AD19EF10B9A4940D7F5F971299C2D403EFD4108EF9A4940ACF6C628AD9E2D40DB07AD572C9A49407402F403FEA02D402D341988DD9949408B55C70FE2A12D40BF928603219949400E1711FC4EA42D40950C6575F9984940EFDECBD525A52D406B110D7697984940D11FCAA675A72D40F564F2679E98494054CAD6114DA72D40C90F3E8DD3974940410DE60D28A62D4097B57292BE9749400C7E866112A82D407012297636974940E0F954C337A82D401DD8C6D6AB964940E54F67BC5EA82D40CCCED9B36F964940F98FA76813AA2D40CA3A1CCB0297494067E8D6A5B9AB2D40BBE59027059749405C90609444AB2D40433E335FB09649400113771690AC2D408D66EC3B4B96494044618E18E3AB2D407173554793954940295D42BE60AC2D407703483176954940DC2A3D6A1AAD2D40AE1D24870096494064EB130940AE2D4024D98623E995494022A90D6606AE2D4076003B103695494047D31F77A3B02D402EF8481E02954940720CD3B754AE2D4024E7782FA8944940F082F037FAAD2D40FC7010622D94494055C1AE434AA82D408E923F0FBF934940F3E82A5032A82D407DACE78A8C934940441283A7B3A92D40322DF9CEA0934940CDF2EE82CDAA2D408720BB2143934940D20740C1DCAC2D4048BCB03E939349405C5F04E28EB12D4008292226429349405FF6C0E7DAB12D4099930DDF1D9349405E558438C8AF2D40C44EB13D27934940098D37263CB02D4090B18274529249403E879C02B3AA2D4042E2B9ED7B9149409AB8B3E9E2A92D40BEBEDE0CE9904940B123BF9E19A42D40EBE423B019904940E74A56BF04A22D402BB3F6042B904940E6C199C74AA12D40F90DE227F88F49405BA4D7043FA22D403DE30564B38F49408E303991C7A02D40C863F9F7FC8E4940AFB7B00202A22D406EF1279F048F49402FABD134B8A32D40E7E8A6C7A88E4940CA61FA7F3FA22D40AA100FC5208E49407252D77B00A22D40C7F7DD0DD98C49408635BD3B89A72D40F19AB440658C494022CF613D27A42D40F624B668A58A4940D30EB50859A02D401E5D8064E78A49401EE7DE2C949B2D40D16D5EB9988B494007A61AC8AB982D403DDC227E2D8B4940C26FDE287A992D40C5814BEFF28A49400DA9E07163962D403189B04DC78A49404465E49F05932D403140D5CDC98A49407AE47FA3C38D2D401FF76B65348B4940B7C5E93EAA8B2D403B71FF2C148B49408795473F6E8A2D408C588CB4E789494031185D222D822D40BADE689EC88749400370C69CF9812D40F04163A09E8649402213F67137852D407C20384E798649403276FF802F8B2D402EBD1B269C864940BFB1A22D42932D40C8D76BBAEF854940553730D70C992D4064F32C33028549404F43B8DACC9C2D4016975200AE844940461209B13A9E2D40A1BE3CFCCD8449406B08FE567B9E2D40A9CF3E00488449403D6E2632BCA42D40862A84198C824940A6B0FB0A23A82D400274F19F76824940065849C26FA92D40D034F4781C82494017BBCD53DCAA2D4056B87F630E8149401236531456AC2D4087AE5656FC8049400CDF2F5B2DAD2D408C3998B49B804940A617EB6140AC2D40DD3BB972C67F4940E671AE08FCA92D407517DA11807F49406B128F2AEBA82D40A9DBCEC7F67E49402508088EF6A52D402ECC2F24F27B4940EAFA444CD1A22D409715531CA77B49403FD450755C9E2D4021322C69D37B49400CE32ACF2A972D40273A9D6D497C494082B6E23630932D40A4E2E6A5117C4940D84C0D2A79902D409D7F854C7C7C494086598327DF8C2D40A695BE6D6D7C4940ABAE225DD78C2D402199E889DD7C49406695E854B7882D40C2E54C64DF7C494024895A055D862D4029C105C16D7C4940175E9E7273832D4006793635AA7C49402AA3780EAA822D4051E4352CA77D4940D797795F94832D4089BEB408FB7D494007E7A010A1822D40C3F07F2C167E4940A4056B686C7B2D401703BF52547D4940B0649F2B38782D4054D3AA0DC97D49409F37004D2A762D40E20E762AA77D49403960EFE954702D40B9370C91D77D4940A2DB1185F45D2D40134B52486F7F4940D9F6BEBCA65A2D406ACAB571D87D49401E9EB0FB685A2D40F5A592B3E87C4940392F53B62B572D40C2135ED9527C4940399D63EC19522D402E6A7D0E137C49409AC2F067BA4D2D40996D4154727B494095CB7098BD4C2D408D2D647D637B4940940C53DDBE4B2D408F1E9FC0F77B494077C4D93DC14A2D4049220D2FE87B494049F6BA55AA472D40A76D418E5A7C494072A7131500452D409884C4EE5F7C4940421602F683402D404B0B0345007D49406884FF8EA73B2D40494FF78C2F7C4940AB616E95173A2D4022B30BFEB87A4940E45B4DF71A372D40386E6362867A494038EC075174342D40B6C39ED0A47A49401B2C3FC43B312D4083B63DA43A7B4940D4BBFC73312F2D400DE0162BBE7B4940225A560E95312D4005888F120C7C4940F5BB7B2FBA312D405DA4A45BB47C49407350457E88332D40487A71705D7D4940BB0129A963322D4065B76D8F887D49408378F6E5B9322D40D2F81AC15B7E4940809A710BBE2F2D4088EF7DDE6E7E49404FD39569BA292D40BE26A0242D7F494045AB2FD950282D404D9B91DC0B804940B1CC3CECFC222D40FDC20057958049407333170C0D212D40CC7D0C2C4D8149409362EFC3B41E2D408E1894F1EC804940E353F357CB112D40C9139BA77A804940C9F1EA8DB0102D40696608C3BC804940A455F5BDC2112D406CF688A01E8149407D547C3D5F142D4024B4C8565581494070D839B87A102D408EA782561F8249405074C62B48FF2C4082482CDBD3824940890714E1E2002D40BDF56E9C248449408B1C2A025B042D4085AF9F996A854940832D26768F022D402A5C5081AD854940617CBDAACDFF2C4075D40D9BF6854940C602A83A79FB2C4018B956A194854940E8C5875072FB2C40DA9B64932A864940521698832CF82C409D1CF4B940864940C14F32A9E7FA2C408D953868D7874940FDF57EFB64F52C400290294060884940B95F2EB6E9F52C40D56FC3997B88494027517583B0F32C40D5D22E77BD884940E7A7E5CC60F22C407D58EFA7038949406BE9F9F979F32C4051F5CF6E7A894940C1A1390B9BF92C40F8B3B2D3D0894940C51365A372002D4065D98824168A4940A8E3692378132D40AC8DC697958A49409A8E6979AC162D4042194009958A494078BBADC18B1A2D408FEAA013218A4940D3165DFCC61D2D40832938B2348A494041CD9EBC68252D400759975BE68B4940	Löbau
5	0106000020E610000001000000010300000001000000D40000000370C69CF9812D40F04163A09E86494031185D222D822D40BADE689EC88749408795473F6E8A2D408C588CB4E7894940B7C5E93EAA8B2D403B71FF2C148B49407AE47FA3C38D2D401FF76B65348B49404465E49F05932D403140D5CDC98A49400DA9E07163962D403189B04DC78A4940C26FDE287A992D40C5814BEFF28A494007A61AC8AB982D403DDC227E2D8B49401EE7DE2C949B2D40D16D5EB9988B4940D30EB50859A02D401E5D8064E78A494022CF613D27A42D40F624B668A58A4940D744AE05ADA52D407822E36E948A4940AFB08AF1FBA72D40288A1608B28B4940142D97259EAA2D40C260CB8F9A8B494022ABA97122AC2D4023138BDACF8B4940722FF7B041AC2D40C36840C5778C494028354C221FAE2D40E54C5EC5DC8B49403D64805206B02D40F3686989D38B494009B027E15AAF2D40909063DC2F8B4940275B5C5A0FB12D40891A914BBB894940F2FBFF2082B52D40443CE553AA894940DD2A1C49FABE2D409B3841C2F9894940766451617FC02D40EF66B7D1688A4940AD8D21C5BBC62D40ED417435838A4940EA1D56BAA1C82D40831FB05DE68A4940E092B49F6DCA2D40FC1C16FAF28A4940B0727A32B4D02D404B24E7A4058B49409681B42B58D12D405EF5C7A4CA8A4940DC9182BAF5D32D40EE0341B4A58A4940E9D9A9ED84D82D402885A432A48A4940383F0278B4DE2D40178EBF44E98A4940A1FF207FD5E22D40A97143AECF8A4940ACAA3F06AFE52D400A4B7DA2958A494015F20C3984E82D40F1BB05A5B98A4940DE7FFBF9CDE82D404C873F726B8A49407FA5306AAAE82D40201F7C196A8A4940D03C040E9BE82D405843C8E6618A4940DFC00B508DE62D403FC858413A8A4940499BE3C72AE62D40154E5E5EA58949408542ABF6FCDC2D403A970800448949409C45494338E22D40EDC6A9E8568949400A0A055BD7E22D406329D97BE0884940AD685B4851DD2D40AE456036F788494051289B1341DB2D4097AD8A4E918849401FB6FFB66BDB2D40BF12FA44E3884940B760ADABBBD92D404F06FE36E38849400882828AC0D82D40CB609ADB908849403D3BFF88F3D52D403DF57A1076884940B44D3EEA57D62D40825389F38C874940DED90ECC3DD82D4050FB94AD61874940155B5122E3D82D4094712D698C874940144E824BADDB2D405694F5A9848749405BC5982421DE2D40DCA818D2FE87494028E8B43382DD2D40C40FA63EF68649405821501BD7E42D405A86AF68BA864940EE7FC11126E62D40D78409B3D3864940FF589DF0AAE62D40FCE4F51A4C87494080FA1CD7DDEC2D4090DEA0C12A8749409E4C66C3D0ED2D402F511BB7108749400E2E1D8EEAED2D4001C84FF569864940E2A8B0E446EC2D40B8E0D2DD6686494095801F5A74EA2D40F1C59117FD854940041626195FE82D40C85BFA93FD85494053ECE2975EE72D40793ED91C6E85494019DD9D15B2E62D40CDBBA6A890854940F0418425A8E52D406E12CA2376854940053E9B2052E62D400A6A66983F854940C734A8B07FE52D40EF230DAC0C854940AF486B5258E72D40B953D83FD2844940689E15D9A3E42D405B8325E20D84494072A12351F4E52D40D52202B1E483494015B11F6E2BE42D4014F7E2E0628349406D23737175E12D40425328A95D834940189CF04885E22D404E4C64E3FF8249408B6D8841E3E02D40184C8357038349404C0BD72043E12D40E59BDD80A5824940CE5708690DE02D409D104FB9D782494097DB511DCDDE2D406EE7A4BA97824940E742AD3BFDDE2D4066506E0458824940D9050796ECE02D401A7FED632F8249408E1BB8BA3FE02D4080287B0C748149402270DEDDB6DB2D4050D7F123C07F4940DED7DECB91D92D4049662D39917F4940262A73692FD72D409C7A5074B87F49405C71AC64A0D52D408F0188136B7F494000B9B6C7C0D52D4014049802B87E49400D9C98A836D72D40DFED3CFA737E4940401A85A12CD62D40E96E7225CB7D494002F3E60BC2D62D402094B37CD87C494065A164901CD02D4004E726BD707C4940A2CB58D25DCE2D408F5CCA265E7C4940DD4E5B2BDBCE2D400F0D93EFD47B4940995CF1EA97CC2D40F54F2316537B4940381843C2BECE2D40B886B2DE027B4940CD8BE4B999CB2D40F6ACFE1DCF7A49403350D5B136C92D406187D88D947949407AE80D9E3ACB2D40645BE02989784940164FD900A2C82D40BC950CB5C7774940E9F04AD3B1C02D40CB8BDEA44C774940119503E75FBC2D4025C31FB177754940E226D38723B42D40F4F718E79174494044A2165D11B02D40227F9E9453734940FB2BC78A0BA42D40A0EE6FEF6E714940F9100E9385A22D40B8E0BDA68D704940EB698A80ACA32D4043852EE8D36F4940F2901AFF75A62D400599E8CC356F49405DC1C5C786A42D40845137C4FF6D4940F37A101C079F2D40CD9129E1F56C4940B5B4F132799D2D4087539DB3556C49405AE7B918B89D2D4015840E49126C49408B454029EC9A2D40E0188B2B136B49401130941FB2992D404D9CA3085A694940B6F3E851F6952D40EF25086FF4684940980D1EC3BC952D408E37819F69694940BE559098BD942D40342F6FD679694940519364C6F78E2D4029065946F6684940B0A5B9A96E882D40B1F801C6DC684940C107FE029D842D40B6BF12208D6949408F5C9F87E37F2D40B88FC4928269494062023CDDB57E2D4090D941BE166A4940FDD3CBAF4A7D2D4085A89A7A2C6A49404AEFAB4B567A2D40DAABE6451A6A49402ECA4A4EEE772D40D5D130DFA5694940F166CA10D7712D4058D3175439694940056B4E76F46E2D407376CED7696949403684E977E36E2D40C367426E1A6A4940AB163334AD702D40F7793C23886A49402C5BA4FE486C2D40EAE36580496B4940DDBAF7B4A46A2D40F42CBD60A06B4940A26ECAF041612D404A3DEE9C436B49405A4357607C542D4091B82A1FB26C49402B74093B8E502D4078EE0D15B76C49408EA6B5B6AB4B2D4085F00584A36C494018AB7AC22A442D406C4C6DD5716D4940B20F50AFE23C2D4092646808CB6D49401EE167F1EA3C2D40F33178A3A96E4940678DEC6C873F2D40006E19E1246F4940DA39F8EA31422D4029663AEEA8704940041B1124EE432D40BD685118107149405A60901BFA452D400ACFDF5AEC724940D038AD985A4B2D40C7022E52B6734940D559C557404E2D40825F6BD9E4734940B73CD363C54D2D403C51C5B09C764940B1A2094AE74C2D4048CA2B253C774940A88615C6704B2D40F554FEA93D774940991DF8426A472D405187EC2F1277494012DFC7A79F412D407D25137C7676494030DE6FB4F23B2D405825563679764940F38A5E1C79392D400B5F58B80E764940FF3012DFFE332D406F6DFEF2DC754940D641AE4ED02F2D40621F38D54A7549409E42EF2C892D2D40465CF54C5E754940E74A04C6F3292D407B2C9922EF7449409C01B65FE0272D409F2F15603D754940C17830001A212D40D7D713748D754940562A21F7091F2D409A0C2B416E7649405B4A3D7CDD242D4011617988007849406FBA2AEFDC292D40260FEF75A078494053214DC6B02B2D40356D004ED07949401B2C3FC43B312D4083B63DA43A7B494038EC075174342D40B6C39ED0A47A4940E45B4DF71A372D40386E6362867A4940AB616E95173A2D4022B30BFEB87A49406884FF8EA73B2D40494FF78C2F7C4940421602F683402D404B0B0345007D494072A7131500452D409884C4EE5F7C494049F6BA55AA472D40A76D418E5A7C494077C4D93DC14A2D4049220D2FE87B4940940C53DDBE4B2D408F1E9FC0F77B494095CB7098BD4C2D408D2D647D637B49409AC2F067BA4D2D40996D4154727B4940399D63EC19522D402E6A7D0E137C4940392F53B62B572D40C2135ED9527C49401E9EB0FB685A2D40F5A592B3E87C4940D9F6BEBCA65A2D406ACAB571D87D4940A2DB1185F45D2D40134B52486F7F49403960EFE954702D40B9370C91D77D49409F37004D2A762D40E20E762AA77D4940B0649F2B38782D4054D3AA0DC97D4940A4056B686C7B2D401703BF52547D494007E7A010A1822D40C3F07F2C167E4940D797795F94832D4089BEB408FB7D49402AA3780EAA822D4051E4352CA77D4940175E9E7273832D4006793635AA7C494024895A055D862D4029C105C16D7C49406695E854B7882D40C2E54C64DF7C4940ABAE225DD78C2D402199E889DD7C494086598327DF8C2D40A695BE6D6D7C4940D84C0D2A79902D409D7F854C7C7C494082B6E23630932D40A4E2E6A5117C49400CE32ACF2A972D40273A9D6D497C49403FD450755C9E2D4021322C69D37B4940EAFA444CD1A22D409715531CA77B49402508088EF6A52D402ECC2F24F27B49406B128F2AEBA82D40A9DBCEC7F67E4940E671AE08FCA92D407517DA11807F4940A617EB6140AC2D40DD3BB972C67F49400CDF2F5B2DAD2D408C3998B49B8049401236531456AC2D4087AE5656FC80494017BBCD53DCAA2D4056B87F630E814940065849C26FA92D40D034F4781C824940A6B0FB0A23A82D400274F19F768249403D6E2632BCA42D40862A84198C8249406B08FE567B9E2D40A9CF3E0048844940461209B13A9E2D40A1BE3CFCCD8449404F43B8DACC9C2D4016975200AE844940553730D70C992D4064F32C3302854940BFB1A22D42932D40C8D76BBAEF8549403276FF802F8B2D402EBD1B269C8649402213F67137852D407C20384E798649400370C69CF9812D40F04163A09E864940	Zittau
6	0106000020E61000000100000001030000000100000094010000B90715DD62472D40C996C86BD79149409B02262A48442D40C4098B10C99149404E1BABB3E1432D407CB4291281914940B0743ED945462D403873D3ED1D9149407C5C268145492D40FE7A9A593A914940B7E04CF62E482D40D23B81FBF49049405EE8426022462D40974FEDB212914940F3F9A39389432D405E6CD79AA79049409AD3B46B89402D40DD1E6DABAE904940346D3529C83D2D40C0E2111163904940B2E2592DAE392D40DC29495E80904940685C2415CD382D40211BE03BB290494075B0E3D18C352D404E963D62FA8F4940AADAEA2ABE352D40B538A912C58F49405018B4E208392D40E874CA41B18F4940EF212FAA4D392D4092A03D53618F494031F73D5C9C3C2D401190D4F0408F4940440A34FA893C2D40A900E3000F8F494004DC73EB8D352D40EDE9DC03F68E49404688339400302D40480BF75B578F49407FC2BBF9B22A2D40198443AC668F49409447D92C5E292D401643A653398F4940DB7593E199262D405E25E714648F4940292BC3A540252D4006EC8136A38E49405C2FA9AFC4282D4095FC1AE3568E4940CB7A034DDE282D4099D91954EB8D494028C25708172B2D40265B50D4788D4940F4B28BDA8C222D40FEA406A8DB8C4940CAD4C9B9A5212D400DD1B46A918C494066A284F08C232D401E66F83C4E8C4940F105A5161C252D40FAE0DFA0578C494041CD9EBC68252D400759975BE68B4940D3165DFCC61D2D40832938B2348A494078BBADC18B1A2D408FEAA013218A49409A8E6979AC162D4042194009958A4940A8E3692378132D40AC8DC697958A4940C51365A372002D4065D98824168A4940C1A1390B9BF92C40F8B3B2D3D08949406BE9F9F979F32C4051F5CF6E7A894940E7A7E5CC60F22C407D58EFA70389494027517583B0F32C40D5D22E77BD884940B95F2EB6E9F52C40D56FC3997B884940FDF57EFB64F52C400290294060884940C14F32A9E7FA2C408D953868D7874940521698832CF82C409D1CF4B940864940E8C5875072FB2C40DA9B64932A864940C602A83A79FB2C4018B956A19485494066E0FDBA17FD2C40A77E7920948449406A5D435245FC2C40D6F7F430FF8249404E1A4A2BE6F22C40F6E15DE044834940EE0CD49464F32C405A9AECBFC783494056F28108DCF02C4086C359C9F5834940A6C5A9306EEE2C40A7FED84E86844940E2A5E8645CE82C4090C063D599844940A6EE6A60CDDE2C40A3969E8675834940EF2301DF31DD2C403DB811F5FE824940530B4490F4D62C40A13E6A7B70824940885D5DBFA9D12C40AAD7F9186782494017166B018BC62C40A1B8B95E3C8349404CBD2BB034C42C403CD4C820A2834940CF2B85F4EEC32C40003CE0C8EE844940EC87165781BF2C401656D4B4F184494067F2A17A54B92C40465AF36BCD854940172127F393B12C40AAA0196C4E85494064806A48B5B02C40690CB8D3FE844940F3F9E88082AC2C4068C25CBFFD844940FB81B92566A72C40B98F9C96048649407454140A41A72C40FA3BD2EA50864940295386B9C9A22C40A3553EE40087494042E5747D51A32C4037ACDBAB4187494091CB5AB216A22C40B33190E2BD874940747B96BC389F2C40CB025C18A8874940B9B765A8059E2C4010C5F7A1E487494080FC461C1DA12C40CB005925EB874940C4CD17ED16A22C400FAEDFB4C1874940784F116A05A42C400CC7564CAA88494062D32FFC1E9A2C4078330976C3884940704365151C952C40BFD738014C8949406814A23A928E2C4018243ADF7589494017D1C7F8098B2C405B800EB37E884940A810BDF61B862C4069398568DC874940AE7C9FE7BE812C40C2FAD181B2874940760F52DB95822C40D62297BD478849409F6F7D6A59802C40E4B048FE8B8849401BD56D5F93802C40FB7EAD6DD28849404E0D17337E7E2C4092CC4FC06A894940B95CFAFC84782C40A199752BA48949400673164C76792C4028958959E1894940791DE04108772C40919E5D1E198A49404836A1CB95682C404C06CD15078B4940A0D30270E8672C4026264155E48A494002635D9F745F2C40E8823BED3A8B494038D681D1EB5C2C40CF5D860B828A4940F453E231E35B2C403B6F900CAE894940AADDEB5647592C4024325D12C989494080F8407490572C40D1AE572D99894940843C0181925B2C40B623D826228949406BF0324139552C4097EE61E71B894940EE878BAAE7542C4071E4F0A6C68849404E79A3F8D0572C40A9434497AD8849407AF212C904532C40D3902F9D8788494026B28BC162492C40CBB3457682894940299383FD5E492C40B764F7D6158A49406F14C178A5462C40ED6AA1438F8A49409BAC7DD8EB472C409610156AE98A4940F816E8D7E7462C40F7A5391BD18A49407ACD7127D5432C401030CEA9828B494085B83A9111412C40F8474B5D2B8B494078228916EE402C40EDE891D1CB8A49408D24F4C05B3D2C40CD7672B0808A49405E15B1A5A13A2C4047CE0613058A4940CA65FD4AF9382C40B2CA34592C8A4940BBDE877B60352C40C54D6F025C8949406E398F5CC9322C40841046CD45894940F104C5D1652C2C409996E13BC2894940C5084530D62A2C403BF565D65F894940DB34C3FC4B292C40D7181CB24F894940964CBA6F96272C40A7B1D541848949402EB0FC3FAC232C40E63C4D588D89494063921495CD202C40E626BD755F894940E7E6530C951A2C40BBE02132EC8A49400C92106C3F182C401DE7B430D38A49401D963E6956152C4048EE71A2D78A494070FD49E787102C40D113ED5E848B4940B6ADF37FD80C2C40FAA8BB0AAD8B49401BF70D57E10B2C40DBB74A97008C4940DDDC1EE3880A2C4070D844D1068C4940DEB658669F092C40452FE1BEB78C4940EFDF326E5C0A2C408594CB06068D494076296DF573072C40969010EEB98C49401EDB667C8D062C40D42137B5DB8C49408CA1E40D83082C40DB5B5C4B3E8D4940187CE110E0052C40FDECCAB5AE8D4940B887290122082C407E8ED4BE328E49404E0CE3C7C4072C40C1B0812E7F8E49406D3494E159022C40E197AF84F48E49401930907F5D012C40EAB64044608F49406465E72D12032C4017B12440808F49401FF3B20162032C40B54141315B8F4940B37A571046092C404972D589268F49407332C887230F2C40947270FC8E8F49408B28903FB5102C40188FF398409049409E3B26EE82142C40F60533DA3A9049406E88FAC0D3182C407E5BE727F18F49402B82F4F89A1F2C401E2411F9E58F4940E94A6230F2262C40196680FC7A9049409DA4BE0454292C403D62FE51B291494028872C188A282C407BD958C0A592494057ABCE2C003A2C401676D348F292494086240BADAA372C40CDE323BE6F9349404F4FE19282382C402A5D7C04549449401085216F56372C401401BF6170954940D9B66832BD322C40BBB140526B9549408D2EE231BF332C40A0C930F8C19549402E2EA72FD3322C40C757594339964940F013EB6DE82E2C40BF9D76E8D3954940A738EF75412E2C40151286AE0C964940BCAD1BB383302C406F2D17D0539649406AF8EB0B0C302C405B7763459796494094EF340753332C401FA06175B0964940D786FF433B382C4025ABA34C5596494009470C2E28392C4075BDCCDE98964940E3E8491F323A2C40F95A555A7E96494083EA04F9EC3B2C4070956F31F59649402E5D8ADBCF402C406569538C75964940F88F72B700482C40548A0285239749404EFB4BEE2D482C40F739D819CB97494075489FA5174C2C40CADA0CC219984940FBDCBFC550502C402B102F61509749401FAE4FD87E532C408D0FC5EC59974940F2841770F3582C40B018D398BA97494068F25013CE5B2C409856322175984940471A26C8275F2C40C5FCAA5D5F984940C51D53AB3A652C400EF6DB36CA984940BD677FA8EB662C402A8EC7944B994940FE3745FBA1652C403A15727E75994940EC70BDA759662C40049D4091B3994940D9B8D3C021652C4084FB328E039A49404A655E36DC612C407AD64BEBE599494016FCCC6E76612C40FCBF27FDC09A4940DFE0073F1F662C409AB1F679A19A49408B40EE7761662C4046509CE5FA9A494045DCFDBAC3662C401E1AB289B99A494050C67FCFC0672C40CD51D44EF19A49400DF4365F9A672C408E06355A4C9B4940621964F2D26A2C4010B7E3A6CD9B49406298AE77816C2C4036D1FA2FD99B49402689705B9F6C2C405BD157C1A39B494002725F1BD16C2C40B43F48E5DB9B49408F4FD68E4D742C40506C993B1B9C494096566CBEF5732C40FA0D3D8D739B4940CF285BC030772C40D90C0229469B49400448799122772C40636DA1B4229B4940A410A75516792C4040310949379B49403B3F1A761E7A2C404E0B513FDD9A4940CC171663917C2C40DD807D61BF9A4940F2160E48A17B2C40F43AAB3A809A4940B5AA5D7653802C404978DEBF249B4940F3F7C080E3842C40F96FACC2949A49404E05E6DA7C882C4004B9DB40939A4940625324FBD0882C4027EDB0BE199B49409B3ED235CF862C407ECEE4E1429B494009B67B4FEB872C4051A4BDAAAE9B49403B80E86257872C406FF4156DFA9B49404081A45E048A2C403D6A8930E79B4940140348DF708A2C4020B8163D4C9C49409F4BA16825912C40178545FA119C494039A88E4898912C407E2396866D9C4940A8F13C2C16942C4049FE5862579C49400C37E482ED912C4030857EE9DE9C49403925621B9C922C4044700E0E079D4940F4CFC7CF578E2C40CE9D35740C9D4940F62AC03AC08D2C4060AFD8BB429D494008274540EF8B2C40BEAF9F1E4F9D49403B2A8023B78B2C401CAC0D7F699E49400624CEB049852C40D734A5B1A89E494017A3731A32832C402AED6AF14E9F494082D503F47A842C40F5F7B1207B9F4940B852EAB348842C402B76AB393BA04940F406D245DE862C4069A560B67AA049403F00981F99862C403068CC60ACA1494054B8E4141B852C40F148EF2A18A24940D7A2B161B0852C40A80E3BB03DA2494069DC1B25A9822C405236BE8F49A2494057CC8165B0822C4099C2BCCEA1A249407742ADF3A1822C409A6F281C09A34940E5674ED5C2852C40799FAB2B62A34940BACBA8CD88852C407BEE7A6BD7A349405245DFE015882C403974D7AF3BA4494099B6E46574882C402CDF67B699A54940C7BDC49657882C40F68F5AF66AA64940E6D4E402CD8A2C40C596E7A4F3A749409FF20C54EF8A2C406B7082A6C0A84940C3280276618A2C40BB1AB392F2A949409DD8CEEAA5862C406C8DE7AF5BAB4940A2B653188D862C400283F56C85AB4940DC86E7FD94902C40B81C440B2AAC4940251715532E982C40472BFCE7E4AC4940DB8D203627A02C409B2C899C03AD4940149C3F0A8E9E2C40563904A2D0AD494091F5744C08A82C40513FF6F854AE49403DB53D4ECAB12C40041B3C1D2BAE49407440CE0AA8B32C40D39117B174AD49404DBFF3703BB32C40763E87D490AC4940E9A23F3DE4B02C4072204D5F9EAB4940CF3B68A905B62C40FBF162016EAB49401B4DCDDCACB62C40F49165C4C3A94940FCD2F138B6B72C4020DFB98B79A9494054438EF8ABBB2C408417F6D823A94940BB866B0B99BC2C4036E98AD097A84940E82857D4B5C62C40A47A4EA56FA84940B25C3967C3C42C408C6978FA17A74940FA80F4B30FCC2C40018B0623E7A649408AB321E002CF2C4049E15F518CA74940F34715BA2DD12C400FB7FA49BFA74940934C775F33D42C40A8900680BBA749402F8AB07531D52C402BC80B5538A849408BACCF46E6D62C4065B6C9E74EA849408F0B57ACA1D52C40BCDD577693A84940E25DB99F46D52C4008D12DC476A949409B71A0C601D92C40A8033D1DFEA84940627ED1338ADA2C402A13B1180CA949401794820B0BDD2C40FA6413BAA7A94940A4955CDA9FE12C40A585893A2AAB4940F739B0C2E3E82C40393C21686DAB494089ADC4A333EA2C4074AE9FE4EEAB4940363277EA13ED2C40B530896A4EAC49400C7DBD38B1EF2C40DFED8F7145AC49401C1D4B3665F12C402AA5EB76EAAB4940A3356BB48BF12C409F8B1F796EAA494003FED9E72AF32C40A99847B020AA494065DA5CC6A6F32C4081F42199A6A949402C0A983090F22C40C4367212A8A94940654DAE4F1BF22C40D6FC0C8E6DA94940956C64BF32F42C40A6D39CCB10A94940996DF1B997F52C405431CF101CA94940611E12E6A2FD2C40182DE41FCBA94940E3067B6FBC012D40D979C157EBA94940EDA30D9F79012D407D5BFBAB5CA94940FCE9B6D268042D40AEE4A6C601A949406B6A2F27F4032D407E25647FBFA949402930B004B1032D4030ED86A1F9A94940B1D1DA0B18052D401561642A24AA4940C5969F8C1E0B2D4082B8042924AA4940EB388519DF092D409FF6E717C8AA4940A94B51631B0C2D40A64D402BEFAA4940A52DFF44A60A2D4006D502D42BAB49406BE9764A470C2D40550230746DAB4940D6D0EA32120B2D409695A48185AB4940881B585C960A2D40F92405D10CAC494080F7432A220C2D4042A1F3CF26AC494050CA4A799B0C2D4017BA870D79AC49400A324DE99F122D409A47F10A9FAC4940684BEE02B0142D405AE864DC87AD49402EE5231AE8162D405E8AF562BAAD4940B2A3723513152D40475FE9DDBCAC4940DB50F4A2F4102D401617EB498FAB49401B6C435DD8112D403D6DCE9674AB494029B0F54EE1122D4016F461E0A2AB49404B570559E4142D405B53B3AC38AB4940D960F2682E192D40078BAC54E8AA4940A3DE748EAC192D40E68D420327AA49403A8EADA1231C2D40DF9E515BFAA949407B426588C71B2D40C4FCF973D0A94940E0FBDF7DC61D2D40AAAA445FA3A949403149A89671212D406D716DE596A84940FBAA0357FA232D40504391BE98A84940545F7E89B6272D4022D12A4A8BA9494048FE71E1C0292D40B72E39774BA94940B9296E33D42D2D40DB5AB4D838A94940FE954F63EA2C2D40E3C9E192F1A84940A218BF028F302D400AB6D5DFE5A8494076BEF96F042D2D40374018B87FA84940E7EFADFB6D2C2D4030931C32FBA74940995BB91B6E322D40D66215ACE4A74940DCCEE9C836302D401EE42B9A45A74940483C776965362D404DA6B2EF59A749402030AF7280352D40CBC9C7F8A6A649400D2D0D476F322D40AF9A0BF5C6A54940546B61C63E332D40628E1386F1A44940DDBF243763382D40595E205E74A4494032E34A78B5392D40C0B01BEFC9A349406703E89DFB3E2D4059FB7190C0A3494089815BF6D93C2D40E3EF523A19A24940E8C340DAEF392D408835D2DF43A14940F67466C70C412D40E162B37512A149407F49A4C0D7452D40D0040575D69F4940B11D4A825C452D40DC5B2D57E79E4940EE6D1D55F9432D40550B954DF09E494050868C5AD3412D40BD146219A39E4940E2947AADB13D2D40D2EFB4FC499D4940E7B4ED14B0412D40CE9E2306319D4940C549DCCB14452D409352AEC8409C4940126D7F2A4E452D409035A6666A9C4940D106835BE0462D403EE4AE2A679C4940B017DA28A1472D401C1CBEF9EE9C49408F1E68FA714A2D406905F2F1769D4940F8488C2B514C2D402F6DC32B829D49404BE723775E4E2D400FCACBDBE39C49403E30510CCE4C2D40F99F1E9AAB9C4940F03B026CDE4B2D404363573EDE9B494078CC6CCCE94D2D4083589FA6E09B4940CF91CD779F4E2D40EFC11A17999B4940C200843948512D4098A65EBB6B9B49409013BDA7DE502D40AC4824FB459B49407D23E7D261542D4042F8B9A0F89A4940E3F64B7124582D40D052321EFE9A4940A936461E77582D40BA8872163D9B4940917AD648B9592D40900AA8CD2C9B49402EFAF4EA8C592D40C58CA011019B49400607A326C55E2D4032456931089B4940713668C4295D2D407D7179E8659A49409B59EEE4755D2D40A715B6A7B9994940A696EC7C345A2D4008607C736B994940E9E5C983865B2D408CB236C3F198494085446F9DD0562D406097014DA2984940F2609E61555A2D400395F47C829849402B51E411E45A2D408997C8A85498494028B56AE11A5C2D40040B2EBF7C984940A23D10669D5B2D406232B585619849407606FC96735E2D409D460D6524984940C4CA009C2D5C2D4054797E1317984940BA1BD0F84E5D2D404972B9C2ED97494053D8FAFFE7622D405F7E07BCBC974940CEA57AA59C652D40FD6F3ED4D6974940165F9FB107642D40D0071BEBA997494007224AC63F672D40444716273097494028E4100719672D40E9D1EC260897494027A4E74A33642D407AFAC32FE796494055FD984D12642D4085A66A99AE96494057C9455675602D40215CA79F3096494018D18A7FF8612D40A659C101D9954940DD66ADD4D8602D4055B6253DB6954940153C794C2B612D40B57C81314B9549405B513023BD5D2D40E95113C9849549403EAB1F87A45E2D40FA64A9A1579549402BFA63AC755C2D40131B87023F9549404C2794A88F5C2D40D305AB83DE94494007D6BA06F45A2D40BA99A1E0B9944940AEA535511A5B2D40500C1CCD7494494011F29589A45D2D40E2773FE841944940EB11393A685C2D40460D3C548A9349406F20FFDACC5D2D40F70A29B16A934940AFD5C3EBBD5D2D40F2D011C008934940B5238086245A2D40981590B50693494093BAD411E75A2D40B3A6627259934940FB1BD796E1592D409586F72658934940BB9C1BE09D592D40CBFD3DCA019349408E38CA3DF9572D40047AA41106934940DE08A07D8F582D407B48A2AC4F934940FA631984C0552D4004C213FB68934940C45895786A552D405F28503AD2934940752FBB22D7542D403B5972E6B3934940D27C68C545522D40B683D0B41994494022D9DA5993512D401F077A71EE93494075D58535F04F2D40D2738E5B1B944940DA8CF345BB4C2D401A155A68879349401A646E6BD94B2D40DF62BDD394934940D0D5A665894C2D40ACBB10AF6B9349400D16A2C8404B2D40783AC200D692494050BBD94C46492D4045D7A832D59249407579F77B52482D4029259EAA88924940765D3DC37D472D40B78559098D924940B90715DD62472D40C996C86BD7914940	Altkreis Bautzen
\.


--
-- Name: availability_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.availability_id_seq', 1, true);


--
-- Name: company_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.company_id_seq', 8, true);


--
-- Name: event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.event_id_seq', 2, true);


--
-- Name: journey_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.journey_id_seq', 1, true);


--
-- Name: request_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.request_id_seq', 1, true);


--
-- Name: tour_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tour_id_seq', 1, true);


--
-- Name: user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_id_seq', 11, true);


--
-- Name: vehicle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_id_seq', 16, true);


--
-- Name: zone_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zone_id_seq', 6, true);


--
-- Name: availability availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_pkey PRIMARY KEY (id);


--
-- Name: company company_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_pkey PRIMARY KEY (id);


--
-- Name: event event_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_pkey PRIMARY KEY (id);


--
-- Name: journey journey_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journey
    ADD CONSTRAINT journey_pkey PRIMARY KEY (id);


--
-- Name: kysely_migration_lock kysely_migration_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kysely_migration_lock
    ADD CONSTRAINT kysely_migration_lock_pkey PRIMARY KEY (id);


--
-- Name: kysely_migration kysely_migration_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kysely_migration
    ADD CONSTRAINT kysely_migration_pkey PRIMARY KEY (name);


--
-- Name: request request_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request
    ADD CONSTRAINT request_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: tour tour_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tour
    ADD CONSTRAINT tour_pkey PRIMARY KEY (id);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: vehicle vehicle_license_plate_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_license_plate_key UNIQUE (license_plate);


--
-- Name: vehicle vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_pkey PRIMARY KEY (id);


--
-- Name: zone zone_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone
    ADD CONSTRAINT zone_pkey PRIMARY KEY (id);


--
-- Name: availability_vehicle_start_end_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX availability_vehicle_start_end_time_idx ON public.availability USING btree (vehicle, start_time, end_time);


--
-- Name: tour_vehicle_departure_arrival_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tour_vehicle_departure_arrival_idx ON public.tour USING btree (vehicle, departure, arrival);


--
-- Name: zone_area_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX zone_area_idx ON public.zone USING gist (area);


--
-- Name: availability availability_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_vehicle_fkey FOREIGN KEY (vehicle) REFERENCES public.vehicle(id);


--
-- Name: company company_zone_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_zone_fkey FOREIGN KEY (zone) REFERENCES public.zone(id);


--
-- Name: event event_request_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_request_fkey FOREIGN KEY (request) REFERENCES public.request(id);


--
-- Name: journey journey_request1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journey
    ADD CONSTRAINT journey_request1_fkey FOREIGN KEY (request1) REFERENCES public.request(id);


--
-- Name: journey journey_request2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journey
    ADD CONSTRAINT journey_request2_fkey FOREIGN KEY (request2) REFERENCES public.request(id);


--
-- Name: journey journey_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journey
    ADD CONSTRAINT journey_user_fkey FOREIGN KEY ("user") REFERENCES public."user"(id);


--
-- Name: request request_customer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request
    ADD CONSTRAINT request_customer_fkey FOREIGN KEY (customer) REFERENCES public."user"(id);


--
-- Name: request request_tour_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request
    ADD CONSTRAINT request_tour_fkey FOREIGN KEY (tour) REFERENCES public.tour(id);


--
-- Name: session session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: tour tour_vehicle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tour
    ADD CONSTRAINT tour_vehicle_fkey FOREIGN KEY (vehicle) REFERENCES public.vehicle(id);


--
-- Name: user user_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(id);


--
-- Name: vehicle vehicle_company_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_company_fkey FOREIGN KEY (company) REFERENCES public.company(id);


--
-- PostgreSQL database dump complete
--

