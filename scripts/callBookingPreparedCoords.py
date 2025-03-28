import csv
import json
import random
import socket
import sys
import time

def read_coordinates(filepath):
    """
    Read coordinates from a CSV file.
    Assumes the file is comma-separated with a header row.
    Reads longitude and latitude values.
    """
    coordinates = []
    with open(filepath, 'r') as csvfile:
        # Use csv.reader to handle potential quotes or escaping
        reader = csv.reader(csvfile)
        
        # Skip the header row
        next(reader, None)
        
        for row in reader:
            # Check if row has at least two elements
            if len(row) >= 2:
                try:
                    # Convert first two elements to float (longitude, latitude)
                    lng = float(row[0])
                    lat = float(row[1])
                    coordinates.append({
                        'lng': lng,
                        'lat': lat
                    })
                except (ValueError, IndexError) as e:
                    # Skip rows that can't be converted
                    print(f"Skipping row due to conversion error: {row}")
    
    # Raise an error if no valid coordinates were found
    if not coordinates:
        raise ValueError("No valid coordinates found in the CSV file")
    
    return coordinates

def create_location(coord, address="Generated Address"):
    """
    Create a location dictionary based on coordinates.
    """
    return {
        'lat': coord['lat'],
        'lng': coord['lng'],
        'address': address
    }

def generate_booking_request(coordinates, include_second_connection=True):
    """
    Generate a booking request based on the coordinates.
    Randomly selects connections and generates times.
    
    :param coordinates: List of coordinate dictionaries
    :param include_second_connection: Flag to include or exclude second connection
    """
    # Ensure we have at least 2 coordinates
    if len(coordinates) < 2:
        raise ValueError("Not enough coordinates to create a booking request")
    
    # Current time in milliseconds
    current_time = int(time.time() * 1000)
    
    # Time range: 1 week in the past to 3 weeks in the future
    start_time_range = current_time - (7 * 24 * 60 * 60 * 1000)  # 1 week ago
    end_time_range = current_time + (21 * 24 * 60 * 60 * 1000)  # 3 weeks in the future
    
    # Randomly select start and end locations
    start_coord = random.choice(coordinates)
    target_coord = random.choice([c for c in coordinates if c != start_coord])
    
    # Generate a booking request
    booking_request = {
        'capacities': {
            'passengers': random.randint(1, 2),
            'wheelchairs': random.randint(0, 0),
            'bikes': random.randint(0, 0),
            'luggage': random.randint(0, 0)
        }
    }
    
    # First connection (always added)
    first_start_time = random.randint(start_time_range, end_time_range)
    first_target_time = first_start_time + random.randint(3600000, 14400000)  # 1-4 hours later in ms
    
    booking_request['connection1'] = {
        'start': create_location(start_coord),
        'target': create_location(target_coord),
        'startTime': first_start_time,
        'targetTime': first_target_time
    }
    
    # Second connection based on flag
    if include_second_connection:
        # Select different coordinates for second connection
        another_start = random.choice([c for c in coordinates if c not in [start_coord, target_coord]])
        another_target = random.choice([c for c in coordinates if c not in [start_coord, target_coord, another_start]])
        
        # Generate times for second connection
        second_start_time = random.randint(start_time_range, end_time_range)
        second_target_time = second_start_time + random.randint(3600000, 14400000)  # 1-4 hours later in ms
        
        booking_request['connection2'] = {
            'start': create_location(another_start),
            'target': create_location(another_target),
            'startTime': second_start_time,
            'targetTime': second_target_time
        }
    else:
        # Explicitly set connection2 to null
        booking_request['connection2'] = None
    
    return booking_request

def send_booking_request(booking_data):
    """
    Send booking request to the specified endpoint using raw socket communication.
    """
    try:
        # Prepare the JSON payload
        payload = json.dumps(booking_data).encode('utf-8')
        
        # Create a socket connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('localhost', 5173))
        
        session_token = "4xe4boupnm7226nykjdfvpjrlmx5k23c"
        request_str = (
            f"POST /api/booking HTTP/1.1\r\n"
            f"Host: localhost:5173\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(payload)}\r\n"
            f"Cookie: session = {session_token}\r\n"
            f"Connection: close\r\n\r\n"
        )
        print("Full request:")
        print(request_str)
        request = request_str.encode('utf-8')
        # Send request
        sock.sendall(request + payload)
        
        # Receive response
        response = sock.recv(4096).decode('utf-8')
        # Close socket
        sock.close()
        
    except Exception as e:
        print(f"Error sending request: {e}")

def main(filepath, num_requests=1, include_second_connection=True):
    """
    Main function to process coordinates and send multiple booking requests.
    
    :param filepath: Path to the CSV file with coordinates
    :param num_requests: Number of requests to send
    :param include_second_connection: Flag to include or exclude second connection
    """
    try:
        coordinates = read_coordinates(filepath)
        
        for i in range(num_requests):        
            booking_request = generate_booking_request(
                coordinates, 
                include_second_connection=include_second_connection
            )
                      
            send_booking_request(booking_request)
    
    except Exception as e:
        print(f"An error occurred: {e}")

# Usage
if __name__ == "__main__":
    # Default values
    filepath = 'coordinates.csv'
    num_requests = 1
    include_second_connection = True
    
    # Parse command-line arguments
    for arg in sys.argv[1:]:
        # More flexible flag matching
        if arg in ['--no-c2', '--no-connection2', '--no-connection']:
            include_second_connection = False
        elif arg.startswith('--requests='):
            num_requests = int(arg.split('=')[1])
        elif arg.startswith('--file='):
            filepath = arg.split('=')[1]
    
    # Run the main function
    main(
        filepath, 
        num_requests=num_requests, 
        include_second_connection=include_second_connection
    )