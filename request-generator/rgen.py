import requests
import csv
import random
from datetime import datetime, timedelta


def generate_random_datetime(start_date, end_date):
    """
    Generates a random datetime object within a given range of days, with the time between 8 AM and 10 PM.

    :param start_date: The start date of the range (datetime.date object).
    :param end_date: The end date of the range (datetime.date object).
    :return: A random datetime object within the specified range.
    """
    
    # Calculate the difference between start and end date
    delta = end_date - start_date
    
    # Generate a random number of days within the range
    random_days = random.randint(0, delta.days)
    
    # Generate a random time between 8 AM and 10 PM
    random_hour = random.randint(8, 21)  # 8 AM to 9 PM
    random_minute = random.randint(0, 59)
    random_second = random.randint(0, 59)
    
    # Construct the random datetime
    random_date = start_date + timedelta(days=random_days)
    random_time = datetime(random_date.year, random_date.month, random_date.day, random_hour, random_minute, random_second)
    
    return random_time

def random_stop(stops):
    return stops[random.randint(0, len(stops) - 1)]


def generate_booking_requests():
    url = 'http://localhost:5173/api/booking'
    stops = []
    
    with open('stops.txt') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            stops.append(row)

    stop_from = random_stop(stops)
    stop_to = random_stop(stops)
    
    start_date = datetime(2024, 7, 25).date()
    end_date = datetime(2024, 7, 31).date()
    max_passengers = 3

    random_datetime = generate_random_datetime(start_date, end_date)

    req = {
        'from': {'lat':stop_from[2], 'lng':stop_from[3]},
        'to': {'lat':stop_to[2], 'lng':stop_to[3]},
        'startFixed': True,
        'timeStamp': random_datetime,
        'numPassengers': random.randint(1, max_passengers),
        'numWheelchairs': random.randint(0, 1),
        'numBikes': 0,
        'luggage': random.randint(1, max_passengers),
    }

    print(req)
    # resp = requests.post(url=url, json=req)
    # res = resp.json()


generate_booking_requests()
