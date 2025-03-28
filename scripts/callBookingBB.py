import csv
import json
import random
import socket
import sys
import time
import math

def generate_random_coordinate(min_lat, max_lat, min_lng, max_lng):
    """
    Generate a random coordinate within the specified bounding box.
    
    :param min_lat: Minimum latitude
    :param max_lat: Maximum latitude
    :param min_lng: Minimum longitude
    :param max_lng: Maximum longitude
    :return: Dictionary with 'lat' and 'lng' keys
    """
    lat = random.uniform(min_lat, max_lat)
    lng = random.uniform(min_lng, max_lng)
    
    return {
        'lat': lat,
        'lng': lng
    }

def haversine_distance(coord1, coord2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) using Haversine formula.
    
    :param coord1: First coordinate dictionary with 'lat' and 'lng'
    :param coord2: Second coordinate dictionary with 'lat' and 'lng'
    :return: Distance in meters
    """
    
    R = 6371.0
    
    lat1 = math.radians(coord1['lat'])
    lon1 = math.radians(coord1['lng'])
    lat2 = math.radians(coord2['lat'])
    lon2 = math.radians(coord2['lng'])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c * 1000
    
    return distance

def generate_coordinates_pair(min_lat, max_lat, min_lng, max_lng, min_distance=500):
    """
    Generate two coordinates that are at least min_distance apart.
    
    :param min_lat: Minimum latitude
    :param max_lat: Maximum latitude
    :param min_lng: Minimum longitude
    :param max_lng: Maximum longitude
    :param min_distance: Minimum distance between coordinates in meters
    :return: Tuple of two coordinate dictionaries
    """
    max_attempts = 100
    for _ in range(max_attempts):
        coord1 = generate_random_coordinate(min_lat, max_lat, min_lng, max_lng)
        coord2 = generate_random_coordinate(min_lat, max_lat, min_lng, max_lng)
        
        if haversine_distance(coord1, coord2) >= min_distance:
            return coord1, coord2
    
    return coord1, coord2

def create_location(coord, address="Generated Address"):
    """
    Create a location dictionary based on coordinates.
    """
    return {
        'lat': coord['lat'],
        'lng': coord['lng'],
        'address': address
    }

def generate_booking_request(min_lat, max_lat, min_lng, max_lng, include_second_connection=True):
    """
    Generate a booking request based on random coordinates within a bounding box.
    
    :param min_lat: Minimum latitude for coordinate generation
    :param max_lat: Maximum latitude for coordinate generation
    :param min_lng: Minimum longitude for coordinate generation
    :param max_lng: Maximum longitude for coordinate generation
    :param include_second_connection: Flag to include or exclude second connection
    """
    current_time = int(time.time() * 1000)
    
    start_time_range = current_time - (7 * 24 * 60 * 60 * 1000)  
    end_time_range = current_time + (21 * 24 * 60 * 60 * 1000)  
    
    start_coord, target_coord = generate_coordinates_pair(
        min_lat, max_lat, min_lng, max_lng
    )
    
    booking_request = {
        'capacities': {
            'passengers': random.randint(1, 2),
            'wheelchairs': random.randint(0, 0),
            'bikes': random.randint(0, 0),
            'luggage': random.randint(0, 0)
        }
    }
    
    first_start_time = random.randint(start_time_range, end_time_range)
    first_target_time = first_start_time + random.randint(3600000, 14400000)  
    
    booking_request['connection1'] = {
        'start': create_location(start_coord),
        'target': create_location(target_coord),
        'startTime': min(first_start_time, first_target_time),
        'targetTime': max(first_start_time, first_target_time)
    }
    
    if include_second_connection:
        another_start, another_target = generate_coordinates_pair(
            min_lat, max_lat, min_lng, max_lng
        )
        

        second_start_time = random.randint(start_time_range, end_time_range)
        second_target_time = second_start_time + random.randint(3600000, 14400000)  
        
        booking_request['connection2'] = {
            'start': create_location(another_start),
            'target': create_location(another_target),
            'startTime': min(second_start_time, second_target_time),
            'targetTime': max(second_start_time, second_target_time)
        }
    else:
        booking_request['connection2'] = None
    
    return booking_request

def send_booking_request(booking_data):
    """
    Send booking request to the specified endpoint using raw socket communication.
    """
    try:
        payload = json.dumps(booking_data).encode('utf-8')
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('localhost', 5173))
        
        session_token = "65g77aqgzo7b5u66ltkk5hfvt67unxos"
        request_str = (
            f"POST /api/booking HTTP/1.1\r\n"
            f"Host: localhost:5173\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(payload)}\r\n"
            f"Cookie: session = {session_token}\r\n"
            f"Connection: close\r\n\r\n"
        )
        request = request_str.encode('utf-8')
        
        sock.sendall(request + payload)
        
        response = sock.recv(4096).decode('utf-8')
        
        sock.close()
        
    except Exception as e:
        print(f"Error sending request: {e}")

def main(
    min_lat, max_lat, min_lng, max_lng, 
    num_requests=1, 
    include_second_connection=True
):
    """
    Main function to generate and send multiple booking requests.
    
    :param min_lat: Minimum latitude for coordinate generation
    :param max_lat: Maximum latitude for coordinate generation
    :param min_lng: Minimum longitude for coordinate generation
    :param max_lng: Maximum longitude for coordinate generation
    :param num_requests: Number of requests to send
    :param include_second_connection: Flag to include or exclude second connection
    """
    try:
        for i in range(num_requests):        
            booking_request = generate_booking_request(
                min_lat, max_lat, min_lng, max_lng,
                include_second_connection=include_second_connection
            )
                      
            send_booking_request(booking_request)
    
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    min_lat = 51.299482657433586
    max_lat = 51.597147209063884
    min_lng = 14.439685057885825
    max_lng = 14.974246307684922
    
    num_requests = 1
    include_second_connection = True
    
    for arg in sys.argv[1:]:
        if arg in ['--no-c2', '--no-connection2', '--no-connection']:
            include_second_connection = False
        elif arg.startswith('--requests='):
            num_requests = int(arg.split('=')[1])
        elif arg.startswith('--min-lat='):
            min_lat = float(arg.split('=')[1])
        elif arg.startswith('--max-lat='):
            max_lat = float(arg.split('=')[1])
        elif arg.startswith('--min-lng='):
            min_lng = float(arg.split('=')[1])
        elif arg.startswith('--max-lng='):
            max_lng = float(arg.split('=')[1])
    
    main(
        min_lat, max_lat, min_lng, max_lng,
        num_requests=num_requests, 
        include_second_connection=include_second_connection
    )