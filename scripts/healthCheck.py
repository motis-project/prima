import os
import psycopg2
import json
import requests
from urllib.parse import urlparse
from datetime import datetime

def parse_env_file(file_path='.env'):
    env_vars = {}
    try:
        with open(file_path, 'r') as file:
            for line in file:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        value = parts[1].strip().strip('"\'')
                        env_vars[key] = value
        return env_vars
    except FileNotFoundError:
        print(f"Error: .env file not found at {file_path}")
        return {}
    except Exception as e:
        print(f"Error reading .env file: {e}")
        return {}

def create_database_connection(env_vars):
    try:
        if 'DATABASE_URL' in env_vars:
            parsed_url = urlparse(env_vars['DATABASE_URL'])
            host = parsed_url.hostname
            port = parsed_url.port or 5432
            database = parsed_url.path.lstrip('/')
            user = parsed_url.username
            password = parsed_url.password
        else:
            host = env_vars.get('DB_HOST', 'localhost')
            port = env_vars.get('DB_PORT', '5432')
            database = env_vars.get('DB_NAME', 'prima')
            user = env_vars.get('POSTGRES_USER', 'postgres')
            password = env_vars.get('POSTGRES_PASSWORD', '')
        
        print(f"Attempting to connect with: host={host}, port={port}, database={database}, user={user}")
        
        connection = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        
        return connection
    
    except psycopg2.Error as e:
        print(f"PostgreSQL Error connecting to the database: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error parsing database connection: {e}")
        return None

def fetch_comprehensive_tour_data(connection):
    if connection:
        print("Connected to the database")
        try:
            with connection.cursor() as cursor:
                query = """
                SELECT 
                    t.id AS tour_id,
                    t.departure AS start_time,
                    t.arrival AS end_time,
                    t.fare,
                    t.cancelled,
                    t.message,
                    t.direct_duration,
                    c.name AS company_name,
                    c.id AS company_id,
                    c.lat AS company_lat,
                    c.lng AS company_lng,
                    v.id AS vehicle_id,
                    v.license_plate,
                    r.id AS request_id,
                    r.passengers,
                    r.wheelchairs,
                    r.bikes,
                    r.luggage,
                    r.customer AS customer_id,
                    md5(r.ticket_code) AS ticket_code,
                    r.ticket_checked,
                    r.cancelled AS request_cancelled,
                    e.id AS event_id,
                    e.is_pickup,
                    e.lat,
                    e.lng,
                    e.scheduled_time_start,
                    e.scheduled_time_end,
                    e.communicated_time,
                    e.prev_leg_duration,
                    e.next_leg_duration,
                    e.event_group,
                    e.address,
                    e.cancelled AS event_cancelled,
                    u.name AS customer_name,
                    u.phone AS customer_phone
                FROM tour t
                LEFT JOIN vehicle v ON t.vehicle = v.id
                LEFT JOIN company c ON v.company = c.id
                LEFT JOIN request r ON r.tour = t.id
                LEFT JOIN event e ON e.request = r.id
                LEFT JOIN "user" u ON r.customer = u.id
                ORDER BY t.id, r.id, e.scheduled_time_start;
                """
                cursor.execute(query)
                tours = cursor.fetchall()

                column_names = [
                    'tour_id', 'start_time', 'end_time', 'fare', 'cancelled', 'message', 'direct_duration',
                    'company_name', 'company_id', 'company_lat', 'company_lng',
                    'vehicle_id', 'license_plate', 'request_id', 'passengers', 'wheelchairs', 
                    'bikes', 'luggage', 'customer_id', 'ticket_code', 'ticket_checked', 
                    'request_cancelled', 'event_id', 'is_pickup', 'lat', 'lng', 'scheduled_time_start',
                    'scheduled_time_end', 'communicated_time', 'prev_leg_duration', 'next_leg_duration', 
                    'event_group', 'address', 'event_cancelled', 'customer_name', 'customer_phone'
                ]

                tours_dict = {}
                for tour in tours:
                    tour_dict = dict(zip(column_names, tour))
                    tour_dict['start_time'] = datetime.fromtimestamp(tour_dict['start_time'] / 1000).isoformat() if tour_dict['start_time'] else None
                    tour_dict['end_time'] = datetime.fromtimestamp(tour_dict['end_time'] / 1000).isoformat() if tour_dict['end_time'] else None

                    if tour_dict['tour_id'] not in tours_dict:
                        tours_dict[tour_dict['tour_id']] = {
                            'tour_id': tour_dict['tour_id'],
                            'start_time': tour_dict['start_time'],
                            'end_time': tour_dict['end_time'],
                            'fare': tour_dict['fare'],
                            'cancelled': tour_dict['cancelled'],
                            'message': tour_dict['message'],
                            'direct_duration': tour_dict['direct_duration'],
                            'company_name': tour_dict['company_name'],
                            'company_id': tour_dict['company_id'],
                            'company_lat': tour_dict['company_lat'],
                            'company_lng': tour_dict['company_lng'],
                            'vehicle_id': tour_dict['vehicle_id'],
                            'license_plate': tour_dict['license_plate'],
                            'events': []
                        }

                    if tour_dict['event_id']:
                        event_data = {
                            'request_id': tour_dict['request_id'],
                            'passengers': tour_dict['passengers'],
                            'wheelchairs': tour_dict['wheelchairs'],
                            'bikes': tour_dict['bikes'],
                            'luggage': tour_dict['luggage'],
                            'customer_id': tour_dict['customer_id'],
                            'ticket_code': tour_dict['ticket_code'],
                            'ticket_checked': tour_dict['ticket_checked'],
                            'request_cancelled': tour_dict['request_cancelled'],
                            'event_id': tour_dict['event_id'],
                            'is_pickup': tour_dict['is_pickup'],
                            'lat': tour_dict['lat'],
                            'lng': tour_dict['lng'],
                            'scheduled_time_start': tour_dict['scheduled_time_start'],
                            'scheduled_time_end': tour_dict['scheduled_time_end'],
                            'communicated_time': tour_dict['communicated_time'],
                            'prev_leg_duration': tour_dict['prev_leg_duration'],
                            'next_leg_duration': tour_dict['next_leg_duration'],
                            'event_group': tour_dict['event_group'],
                            'address': tour_dict['address'],
                            'event_cancelled': tour_dict['event_cancelled'],
                            'customer_name': tour_dict['customer_name'],
                            'customer_phone': tour_dict['customer_phone']
                        }
                        tours_dict[tour_dict['tour_id']]['events'].append(event_data)

                # Return all tours, even those without requests or events
                formatted_tours = list(tours_dict.values())
                return formatted_tours

        except psycopg2.Error as e:
            print(f"Error executing query: {e}")
            return None
    else:
        print("No database connection available.")
        return None


def validate_request_has_2events(tours):
    for tour in tours:
        event_groups = {}

        for event in tour['events']:
            if event['request_id'] not in event_groups:
                event_groups[event['request_id']] = []

            event_groups[event['request_id']].append(event)

        for request_id, events in event_groups.items():
            if len(events) != 2:
                print(f"Invalid tour: {tour['tour_id']} - Request ID: {request_id} does not have 2 events.")
                for event in events:
                    print(f"  Invalid Event ID: {event['event_id']}")
                break

            is_pickup_found = False
            is_dropoff_found = False

            for event in events:
                if event['is_pickup']:
                    is_pickup_found = True
                else:
                    is_dropoff_found = True

            if not (is_pickup_found and is_dropoff_found):
                print(f"Invalid tour: {tour['tour_id']} - Request ID: {request_id} does not have both pickup and dropoff.")
                for event in events:
                    print(f"  Invalid Event ID: {event['event_id']}")
                break
                
def validate_tours_with_no_events(tours):
    print("Validating tours with no events...")
    for tour in tours:
        if len(tour['events']) == 0:
            print(f"Tour {tour['tour_id']} has no associated events.")

def validate_tour_and_request_cancelled(tours):
    print("Validating tour and request cancellation consistency...")
    for tour in tours:
        all_requests_cancelled = True
        for event in tour['events']:
            event_cancelled = event.get('event_cancelled', False)
            request_cancelled = event.get('request_cancelled', False)
            if (event_cancelled and not request_cancelled) or (not event_cancelled and request_cancelled):
                print(f"event and request cancelled fields do not match for event_id {event['event_id']}")
            if not request_cancelled:
                all_requests_cancelled = False
                if tour['cancelled']:
                    print(f"tour was cancelled but associated request isn't for request_id {event['request_id']}")
        if all_requests_cancelled and not tour['cancelled']:
            print(f"all requests are cancelled but associated tour isn't for tour_id {tour['tour_id']}")

def validate_event_parameters(tours):
    print("Validating event parameters...")
    for tour in tours:
        for event in tour['events']:
            passengers = event.get('passengers', 0)
            wheelchairs = event.get('wheelchairs', 0)
            bikes = event.get('bikes', 0)
            luggage = event.get('luggage', 0)

            if passengers <= 0:
                print(f"Invalid passengers value for request_id {event['request_id']}: {passengers}. It should be positive.")

            if wheelchairs < 0:
                print(f"Invalid wheelchairs value for request_id {event['request_id']}: {wheelchairs}. It should be non-negative.")
            if bikes < 0:
                print(f"Invalid bikes value for request_id {event['request_id']}: {bikes}. It should be non-negative.")
            if luggage < 0:
                print(f"Invalid luggage value for request_id {event['request_id']}: {luggage}. It should be non-negative.")

def validate_event_time_no_overlap(tours):
    print("Validating that events do not overlap more than a single point...")
    def overlaps(event1, event2):
        start1 = event1['scheduled_time_start']
        end1 = event1['scheduled_time_end']
        start2 = event2['scheduled_time_start']
        end2 = event2['scheduled_time_end']
        return start1 < end2 and start2 < end1

    for tour in tours:
        events = [event for event in tour['events'] if not event.get('request_cancelled', False)]
        for i in range(len(events)):
            for j in range(i + 1, len(events)):
                event1 = events[i]
                event2 = events[j]
                
                if overlaps(event1, event2):
                    print(f"Overlap detected between event_id {event1['event_id']} and event_id {event2['event_id']}")

def validate_direct_durations(tours):
    print("Validating direct durations...")
    for tour_idx in range(1, len(tours)):
        earlier_tour = tours[tour_idx - 1]
        later_tour = tours[tour_idx] 
        if later_tour['vehicle_id'] == earlier_tour['vehicle_id']:
            e1 = earlier_tour['events'][-1]
            e2 = later_tour['events'][0]
            earlier_tour_end = e1['scheduled_time_end']
            later_tour_start = e2['scheduled_time_start']
            if 0 < later_tour_start - earlier_tour_end <= 5 * 3600 * 1000:
                expected_duration = one_to_many(e1['lat'], e1['lng'], e2['lat'], e2['lng'])
                if expected_duration is not None and expected_duration != later_tour['direct_duration'] / 1000:
                    print(f"Direct duration mismatch for tour {later_tour['tour_id']}: \
                          Expected {expected_duration} seconds,\
                          Found {later_tour['direct_duration'] / 1000} seconds")

def validate_leg_durations(tours):
    print("Validating leg durations...")
    for tour in tours:
        events = sorted(tour['events'], key=lambda e: e['scheduled_time_start'])
        for i in range(len(events) - 1):
            earlier_event = events[i]
            later_event = events[i + 1]
            if earlier_event['next_leg_duration'] != later_event['prev_leg_duration']:
                print(f"Leg duration mismatch between events {earlier_event['event_id']} and {later_event['event_id']}")
            expected_duration = one_to_many(
                earlier_event['lat'], earlier_event['lng'],
                later_event['lat'], later_event['lng']
            )
            if expected_duration is not None and expected_duration + 60 != earlier_event['next_leg_duration'] / 1000:
                print(f"Direct duration mismatch for events {earlier_event['event_id']} -> {later_event['event_id']}: \
                      Expected {expected_duration + 60} seconds, Found {earlier_event['next_leg_duration'] / 1000} seconds")
            earlier_event_start = earlier_event['scheduled_time_start']
            later_event_end = later_event['scheduled_time_end']
            time_diff = (later_event_end - earlier_event_start) / 1000
            if time_diff > expected_duration + 60:
                print(f"Time difference mismatch for event_id {earlier_event['event_id']} and event_id {later_event['event_id']}: \
                        Time difference {time_diff} seconds exceeds expected duration {expected_duration + 60} seconds")

def validate_company_durations(tours):
    print("Validating leg durations from/to company...")
    for tour in tours:
        events = sorted(tour['events'], key=lambda e: e['scheduled_time_start'])
        from_company = one_to_many(tour['company_lat'], tour['company_lng'], events[0]['lat'], events[0]['lng'])
        if from_company != events[0]['prev_leg_duration'] / 1000:
            print(f"Duration from company to first event does not match in tour with id: {tour['tour_id']}")
        to_company = one_to_many(events[-1]['lat'], events[-1]['lng'], tour['company_lat'], tour['company_lng']) + 60
        if to_company != events[-1]['next_leg_duration'] / 1000:
            print(f"Duration to company from last event does not match in tour with id: {tour['tour_id']}")

def test_database_connection(connection):
    if connection:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_date")
                current_date = cursor.fetchone()[0]
                
                cursor.execute("SELECT version()")
                version = cursor.fetchone()[0]
                
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """)
                tables = cursor.fetchall()
        
        except psycopg2.Error as e:
            print(f"Error executing query: {e}")
    else:
        print("No database connection available.")

def one_to_many(from_lat, from_lng, to_lat, to_lng):
    """
    Accesses the Motis API one-to-many endpoint.
    """
    headers = {
        'Content-Type': 'application/json'
    }

    base_url = "http://localhost:6499"
    data = {
        "arriveBy": False,
        "many": [f"{to_lat};{to_lng}"],
        "max": 3600,
        "maxMatchingDistance": 200,
        "mode": "CAR",
        "one": f"{from_lat};{from_lng}"
    }
    url = f"{base_url}/api/v1/one-to-many"

    try:
        response = requests.get(url, params=data, headers=headers)
        response.raise_for_status()
        return response.json()[0]['duration']
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def main():
    env_vars = parse_env_file()
    
    connection = create_database_connection(env_vars)
    
    try:
        test_database_connection(connection)
        
        tours = fetch_comprehensive_tour_data(connection)

        if tours:
            print("Validating tours...")
            validate_request_has_2events(tours)
            validate_tours_with_no_events(tours)
            validate_tour_and_request_cancelled(tours)
            validate_event_parameters(tours)
            validate_event_time_no_overlap(tours)
            validate_direct_durations(tours)
            validate_leg_durations(tours)
            validate_company_durations(tours)
        else:
            print("No tours found or there was an error fetching the data.")
    
    finally:
        if connection:
            connection.close()

if __name__ == "__main__":
    main()

