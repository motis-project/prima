import requests
import csv
import random
import time
from datetime import datetime, timedelta
import json
import argparse
import os


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


def generate_booking_requests(data, conf):
    now = datetime.now()
    start_date = now.date()
    end_date = (now + timedelta(int(conf['days']))).date()
    print('\nGenerating booking requests in time interval:')
    print('Start\t', start_date)
    print('End\t', end_date)

    try:
        n_req = 0
        n_valid = 0
        
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
                'timeStamp': random_datetime.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'numPassengers': random.randint(1, conf['max_passengers']),
                'numWheelchairs': random.randint(0, 1),
                'numBikes': random.randint(0, 1),
                'luggage': random.randint(0, conf['max_passengers']),
            }

            res = send_request(req, conf['url'], conf['auth'])
            status = 1
            try:
                status = res['status']
            except:
                print('API not reachable. Invalid session id?')
            if status == 0:
                n_valid += 1
                print(res['tour_id'])
            else:
                print('status =', status)
            
            if conf['max_bookings'] and n_valid == conf['max_bookings']:
                break
            if conf['max_requests'] and n_req == conf['max_requests']:
                break

            time.sleep(conf['delay'])
            n_req += 1
    except KeyboardInterrupt:
        pass  # be quiet


def send_request(req, url, auth_session):
    try:
        headers = {'Cookie': 'auth_session=' + auth_session}
        resp = requests.post(url=url, headers=headers, json=req)
        res = resp.json()
        return res
    except:
        print('Connection to server failed')


def single_request(conf):
    data = conf['data']
    try:
        with open(data) as f:
            req = json.load(f)
    except:
        print('Cannot load data')
        exit(1)
    res = send_request(req, conf['url'], conf['auth'])
    status = 1
    try:
        status = res['status']
    except:
        print('API not reachable. Invalid session id?')
    if status == 0:
        print(res['tour_id'])
    else:
        print('status =', status)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--conf', required=True, help='Path to configuration file')
    args = parser.parse_args()

    data = None
    conf = None

    cwd = os.getcwd()
    conf_path = os.path.join(cwd, args.conf)

    try:
        with open(conf_path) as f:
            conf = json.load(f)
    except:
        print('Cannot load configuration')
        exit(1)

    if conf['single_request']:
        single_request(conf)
        exit(0)

    try:
        data_path = os.path.join(cwd, conf['data'])
        data = []
        with open(data_path) as csv_file:
            csv_reader = csv.reader(csv_file, delimiter=',')
            for row in csv_reader:
                data.append(row)
        print('Loaded Locations: ', len(data))
    except:
        print('Cannot load data')
        exit(1)

    generate_booking_requests(data, conf)
