import argparse
import csv
import json


def read_data(path):
    data = []
    try:
        with open(path) as csv_file:
            csv_reader = csv.reader(csv_file, delimiter=',')
            for row in csv_reader:
                data.append(row)
    except:
        print('Cannot load inout data')
    return data


def write_data(path, data):
    with open(path, 'w+', newline='') as csv_file:
        csv_writer = csv.writer(csv_file, delimiter=',')
        for e in data:
            csv_writer.writerow(e)


def filter(data, lat_min, lat_max, lng_min, lng_max):
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
    parser.add_argument('--src', required=True, help='Path to data file (stops)')
    args = parser.parse_args()

    conf = None

    try:
        with open('filter.json') as f:
            conf = json.load(f)
    except:
        print('Cannot load configuration')
        exit(1)

    data = read_data(args.src)
    
    for e in conf['filters']:
        filtered = filter(
            data,
            e['lat_min'],
            e['lat_max'],
            e['lng_min'],
            e['lng_max'])
        write_data('./data/' + e['name'] + '.txt', filtered)
