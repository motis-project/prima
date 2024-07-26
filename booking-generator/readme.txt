----------------
./generator.conf
----------------

    "data":             Input .txt file that contains the stops.
    "days":             Range of days the requests should be within. Start day is today.
    "max_passengers":   Maximum nunber of passengers for one request.
    "max_requests":     (Optional: null) Maximum nunber of requests.
                        The script will stop when that number is reached.
    "max_bookings":     (Optional: null) Maximum nunber of successful requests (bookings).
                        The script will stop when that number is reached.
    "delay":            Delay between requests in seconds.
    "single_request":   true: send only one predefinded request (./data/single.json).
                        false: continue picking random requests using stops from input file (data).
    "url":              host:port/api/booking
    "auth":             Session ID of a user to send the requests with

    "max_requests" and "max_bookings" can be null.


--------------
Single request
--------------

- edit ./data/single.json to set up the request you want to send
- edit ./generator.conf: set "single_request": true

- don't forget to set "auth" to a valid session id
- run python3 request_gen.py


-------------------
Random request loop
-------------------

- edit ./generator.conf: set "single_request": false

- don't forget to set "auth" to a valid session id
- run python3 request_gen.py


------
Filter
------

Select a range of geo-coordinates for the requests.

- edit ./filter.json
For each filter a file <name>.txt will be placed in ./data
The output file can then be used as data file for request_gen.py (configure in generator.conf, "data")

run python3 filter.py --src=<source_data_file>
