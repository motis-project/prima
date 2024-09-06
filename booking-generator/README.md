# Setup

Make sure you have python3 installed.

The scripts where tested with Python 3.10.12

You can run the scripts from any path and specify absolute or relative paths as arguments.

# generator.conf

Configuration file for the script `request_gen.py`

- `data`: path to input .txt file that contains the stops
- `days`: number of days from today the requests should be within
- `max_passengers`: maximum number of passengers for one request,
  a number between 1 and max_passengers will be generated randomly
- `max_requests`: optional, maximum number of requests
  The script will stop when that number is reached.
- `max_bookings`: optional, maximum number of successful requests (bookings)
  The script will stop when that number is reached.
- `delay`: delay between requests in seconds
- `single_request`
  - `true`: send only one predefinded request (./data/single.json).
  - `false`: continue picking random requests using stops from input file (data).
- `url`: host:port/api/booking
- `auth`: Session ID of a user to send the requests with

`max_requests` and `max_bookings` can be null.

# Single request

- edit `generator.conf`:

  - set `single_request`: true
  - set `data` to the file containing the request in json-format

- don't forget to set `auth` to a valid session id
- run `python3 booking-generator/request_gen.py --conf=<path-to>/generator.conf`

# Random request loop

- edit `generator.conf`:
  - set `single_request`: false
- don't forget to set `auth` to a valid session id
- run `python3 booking-generator/request_gen.py --conf=./booking-generator/generator.conf`

# Filter

Write a file `filters.json` according to the following pattern:

```json
{
	"filters": [
		{
			"name": "Bautzen",
			"lng_min": 14.317146232647332,
			"lng_max": 14.543065204654113,
			"lat_min": 51.102234656112046,
			"lat_max": 51.23982499106336
		},
		{
			"name": "Weisswasser",
			"lng_min": 14.486673850617109,
			"lng_max": 14.876856959960378,
			"lat_min": 51.386149408750555,
			"lat_max": 51.555362226023504
		}
	]
}
```

Run `python3 booking-generator/filter.py --src=<input-file> --filters=<filters.json> --out=<path>`

```
--src:          path to input file.
--filters:      path to .json file that contains filter definitions.
--out:          path, where the output file should be placed.
                For each filter definition an output file with the name of the filter  will be placed in the given path.
```

The given paths can be absolute or relative.

The output file can then be used as data file for request_gen.py (configure in generator.conf, "data").
