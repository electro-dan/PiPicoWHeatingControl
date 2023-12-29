import os
import time
import ntptime
from time import sleep
import uasyncio
from machine import Pin
from onewire import OneWire
from ds18x20 import DS18X20
from RequestParser import RequestParser
from ResponseBuilder import ResponseBuilder
from WiFiConnection import WiFiConnection

# set up temperature sensor with onewire
ow = OneWire(Pin(22))
ds = DS18X20(ow)
r = ds.scan()[0]
heating_pin = Pin(16, Pin.OUT)

is_heating = 0
heating_state = 0
ds18b20_temperature = 0.00
target_temperature = 20.0
on_time = 570 # 9:30
off_time = 1290 # 21:30

# coroutine to handle HTTP request
async def handle_request(reader, writer):
    global heating_state
    global target_temperature
    global on_time
    global off_time
    try:
        # await allows other tasks to run while waiting for data
        raw_request = await reader.read(2048)

        request = RequestParser(raw_request)

        response_builder = ResponseBuilder()

        # filter out api request
        if request.url_match("/api"):
            action = request.get_action()
            if action == 'get_status':
                # turn on requested coloured led
                # returns json object with led states
                response_obj = {
                    'status': 'OK',
                    'is_heating': "ON" if is_heating else "OFF",
                    'heating_state': "ENABLED" if heating_state else "DISABLED",
                    'temperature_value': ds18b20_temperature,
                    'target_temperature': '{0:.1f}'.format(target_temperature),
                    'on_time': on_time,
                    'off_time': off_time
                }
                response_builder.set_body_from_dict(response_obj)
            elif action == 'trigger_heating':
                # turn on requested coloured led
                if heating_state == 0:
                    heating_state = 1
                else:
                    heating_state = 0
                
                response_obj = {
                    'status': 'OK',
                    'heating_state': "ENABLED" if heating_state else "DISABLED"
                }
                response_builder.set_body_from_dict(response_obj)
            elif action == "set_target_temperature":
                # Set target temperature
                new_target = float(request.data()['new_target'])
                if new_target >= 20 and new_target <= 28:
                    target_temperature = new_target
                    save_data()
                    response_obj = {
                        'status': 'OK',
                        'target_temperature': '{0:.1f}'.format(target_temperature)
                    }
                    response_builder.set_body_from_dict(response_obj)
                else:
                    response_obj = {
                        'status': 'ERROR',
                        'message': "Invalid target sent"
                    }
                    response_builder.set_body_from_dict(response_obj)
                    response_builder.set_status(400)
            elif action == "set_time":
                # Set off time
                on_or_off = request.data()['on_or_off']
                new_time = int(request.data()['new_time'])
                if new_time >= 0 and new_time <= 1410:
                    if on_or_off == "on":
                        on_time = new_time
                    else:
                        off_time = new_time
                    save_data()
                    response_obj = {
                        'status': 'OK',
                        'time_set': new_time
                    }
                    response_builder.set_body_from_dict(response_obj)
                else:
                    response_obj = {
                        'status': 'ERROR',
                        'message': "Invalid time sent"
                    }
                    response_builder.set_body_from_dict(response_obj)
                    response_builder.set_status(400)

            else:
                # unknown action
                response_builder.set_status(404)

        # try to serve static file
        else:
            response_builder.serve_static_file(request.url, "/index.html")

        # build response message
        response_builder.build_response()
        # send response back to client
        writer.write(response_builder.response)
        # allow other tasks to run while data being sent
        await writer.drain()
        await writer.wait_closed()

    except OSError as e:
        print('connection error ' + str(e.errno) + " " + str(e))


# main coroutine to boot async tasks
async def main():
    # start web server task
    print('Setting up webserver...')
    server = uasyncio.start_server(handle_request, "0.0.0.0", 80)
    uasyncio.create_task(server)

    ntptime.settime()
    print(time.localtime())

    # start the heater task
    print('Starting heater scheduler...')
    counter = 0
    while True:
        if counter == 30:
            # Read temperature
            ds.convert_temp()
            # 1 sec wait before reading
            await uasyncio.sleep(1)
            counter = 0

        global ds18b20_temperature
        global heating_state
        global is_heating

        # Read temperature conversion
        ds18b20_temperature = round(ds.read_temp(r), 2)

        current_time = (time.localtime()[3] * 60000) + time.localtime()[4]
        # If on/off times are not equal, change heating state (will heat) if local time matches
        if on_time != off_time:
            if current_time == on_time:
                heating_state = 1
            if current_time == off_time:
                heating_state = 0
        
        # If heating state (will heat) is true and current temperature is less than target, trigger heating
        if heating_state and ds18b20_temperature <= target_temperature:
            is_heating = 1
        else:
            is_heating = 0
        
        # Enable or disable the output
        heating_pin.value(is_heating)

        # 30 second pause between temperature readings
        await uasyncio.sleep(1)

        counter += 1

def save_data():
    print('Saving variables...')
    with open('config.txt', 'w+') as f:
        f.write(str(target_temperature) + "|" + str(on_time) + "|" + str(off_time))

def read_data():

    global target_temperature
    global on_time
    global off_time

    with open('config.txt', 'r') as f:
        fdata = f.readline()
        print(fdata)
        target_temperature = float(fdata.split("|")[0])
        on_time = int(fdata.split("|")[1])
        off_time = int(fdata.split("|")[2])


# Entry Here

# Connect to WiFi
if not WiFiConnection.start_station_mode(True):
    raise RuntimeError('network connection failed')

# Read any existing saved data
read_data()

# start asyncio task and loop
try:
    # start the main async tasks
    uasyncio.run(main())
finally:
    # reset and start a new event loop for the task scheduler
    uasyncio.new_event_loop()
