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
    try:
        nreq_valid = 0
        while True:
            stop_from = data[random.randint(0, len(data) - 1)]
            stop_to = data[random.randint(0, len(data) - 1)]
            random_datetime = generate_random_datetime(start_date, end_date)

            from_lat = float(stop_from[2])
            from_lng = float(stop_from[3])
            to_lat = float(stop_to[2])
            to_lng = float(stop_to[3])
            
            req = {
                'from': {
                    'coordinates':{'lat': from_lat, 'lng': from_lng},
                    'address': {
                        'street': stop_from[1],
                        'house_number': '',
                        'city': '',
                        'postal_code': '',
                    }
                },
                'to': {
                    'coordinates':{'lat': to_lat, 'lng': to_lng},
                    'address': {
                        'street': stop_to[1],
                        'house_number': '',
                        'city': '',
                        'postal_code': '',
                    }
                },
                'startFixed': True,
                'timeStamp': random_datetime.strftime('%Y-%m-%d, %H:%M:%S'),
                'numPassengers': random.randint(1, max_passengers),
                'numWheelchairs': 0, # random.randint(0, 1),
                'numBikes': 0,
                'luggage': 0 # random.randint(1, max_passengers),
            }

            try:
                headers = {"Cookie": "auth_session=blhfzffcmfhv5ur2w32ujfwcffxt6iozlylafnxj"}
                resp = requests.post(url=url, headers=headers, json=req)
                res = resp.json()
                print(res)
                if res['status'] == 0:
                    nreq_valid += 1
            except:
                print('Connection to server failed')
                break
            
            time.sleep(delay)
            if nreq_valid == nreq:
                break
    except KeyboardInterrupt:
        pass  # be quiet


def filter(data):
    # lng_min = 14.077585327508132
    # lng_max = 14.592268628077534
    # lat_min = 51.04407811914251
    # lat_max = 51.27917854861832

    lng_min = 14.28558906880724
    lng_max = 14.563185831220778
    lat_min = 51.08430122499979
    lat_max = 51.30071292818033

    filtered = []
    for e in data:
        lat = float(e[2])
        lng = float(e[3])
        if not (
            lat > lat_min and lat < lat_max
            and lng > lng_min and lng < lng_max):
                continue
        filtered.append(e)
    return filtered


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

    data = []
    with open(args.data) as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            data.append(row)

    fdata = filter(data)
    print('Used number of locations: ', len(fdata))
    generate_booking_requests(fdata, args.url, start_date, end_date, args.max_passengers, args.nreq, args.delay)

    # use: python3 request_gen.py --url='http://localhost:5173/api/booking' --data=stops_test.txt
