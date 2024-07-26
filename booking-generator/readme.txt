----------------
./generator.conf
----------------

    "data":             path to input .txt file that contains the stops
    "days":             number of days from today the requests should be within
    "max_passengers":   maximum number of passengers for one request, a number between 1 and max_passengers will be generated randomly
    "max_requests":     optional, maximum number of requests
                        The script will stop when that number is reached.
    "max_bookings":     optional, maximum number of successful requests (bookings)
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
