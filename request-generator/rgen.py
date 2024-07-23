import requests
import csv
import random


def random_stop(stops):
    return stops[random.randint(0, len(stops) - 1)]


def random_time():
    time = '2024-07-25 10:15:00'
    return time


def test():
    url = 'http://localhost:5173/api/booking'
    stops = []
    with open('stops.txt') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            stops.append(row)

    stop_from = random_stop(stops)
    stop_to = random_stop(stops)
    time = random_time()

    req = {
        'from': {'lat':stop_from[2], 'lng':stop_from[3]},
        'to': {'lat':stop_to[2], 'lng':stop_to[3]},
        'startFixed':True,
        'timeStamp': time,
        'numPassengers':1,
        'numWheelchairs':0,
        'numBikes':0,
        'luggage':0,
    }

    print(req)
    # resp = requests.post(url=url, json=req)
    # res = resp.json()


test()
