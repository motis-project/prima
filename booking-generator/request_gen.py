import requests
import csv
import random
import time
from datetime import datetime, timedelta
import argparse


def generate_random_datetime(start_date, end_date):
    """
    Generates a random datetime object within a given range of days, with the time between 8 AM and 10 PM.

    :param start_date: The start date of the range (datetime.date object).
    :param end_date: The end date of the range (datetime.date object).
    :return: A random datetime object within the specified range.
    """
    
    delta = end_date - start_date
    random_days = random.randint(0, delta.days)
    
    random_hour = random.randint(8, 21)
    random_minute = random.randint(0, 59)
    random_second = random.randint(0, 59)
    
    random_date = start_date + timedelta(days=random_days)
    random_time = datetime(random_date.year, random_date.month, random_date.day, random_hour, random_minute, random_second)
    
    return random_time


def generate_booking_requests(data, url, start_date, end_date,  max_passengers, nreq, delay):
    stops = []
    
    with open(data) as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            stops.append(row)

    try:
        n = 1
        while True:
            stop_from = stops[random.randint(0, len(stops) - 1)]
            stop_to = stops[random.randint(0, len(stops) - 1)]
            random_datetime = generate_random_datetime(start_date, end_date)

            req = {
                'from': {
                    'coordinates':{'lat':stop_from[2], 'lng':stop_from[3]},
                    'address': {
                        'street': stop_from[1]
                    }
                },
                'to': {
                    'coordinates':{'lat':stop_to[2], 'lng':stop_to[3]},
                    'address': {
                        'street': stop_to[1]
                    }
                },
                'startFixed': True,
                'timeStamp': random_datetime.strftime('%Y-%m-%d, %H:%M:%S'),
                'numPassengers': random.randint(1, max_passengers),
                'numWheelchairs': random.randint(0, 1),
                'numBikes': 0,
                'luggage': random.randint(1, max_passengers),
            }

            try:
                resp = requests.post(url=url, json=req)
                res = resp.json()
                print(res)
            except:
                print('Connection to server failed')
                break
            
            time.sleep(delay)

            print(nreq)
            print(n)
            if n == nreq:
                break
            n += 1
    except KeyboardInterrupt:
        pass  # be quiet


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True, help='URL of service endpoint')
    parser.add_argument('--data', required=True, help='Path to data file (stops)')
    parser.add_argument('--days', type=int, required=False, default=5, help='Range is NOW + days')
    parser.add_argument('--max-passengers', type=int, required=False, default=3)
    parser.add_argument('--nreq', type=int, required=False, help='Maximum number of requests')
    parser.add_argument('--delay', type=int, required=False, default=1, help='Delay between requests in seconds')
    args = parser.parse_args()

    now = datetime.now()
    start_date = now.date()
    end_date = (now + timedelta(days=args.days)).date()

    print(start_date)
    print(end_date)
    print(args.nreq)
    generate_booking_requests(args.data, args.url, start_date, end_date, args.max_passengers, args.nreq, args.delay)

    # use: python3 request_gen.py --url='http://localhost:5173/api/booking' --data=stops_test.txt
