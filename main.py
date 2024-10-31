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
from machine import WDT
from machine import Timer

# Watchdog timer - set to 8 seconds to allow enough time for WiFi connect attempts
# Will reset the Pico if unresponsive after 8 seconds. Use wdt.feed() to indicate 'alive'
#wdt = WDT(timeout=8000) #timeout is in ms
 
# set up temperature sensor with onewire
ow = OneWire(Pin(22))
ds = DS18X20(ow)
r = ds.scan()[0]
# Pin that activates the heating via the opto-coupler
heating_pin = Pin(16, Pin.OUT)

is_heating = False # Default to off
heating_state = False # Default to off
ds18b20_temperature = 0.00
target_temperature_low = 22.0
target_temperature_high = 24.0
on_time = 450 # 7:30
off_time = 1290 # 21:30
counter = 0

# coroutine to handle HTTP request
async def handle_request(reader, writer):
    global heating_state
    global target_temperature_low
    global target_temperature_high
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
                # returns json object with the heating states and timer/temperature settings
                response_obj = {
                    'status': 'OK',
                    'is_heating': is_heating,
                    'heating_state': heating_state,
                    'temperature_value': ds18b20_temperature,
                    'target_temperature_low': target_temperature_low,
                    'target_temperature_high': target_temperature_high,
                    'on_time': on_time,
                    'off_time': off_time
                }
                response_builder.set_body_from_dict(response_obj)
            elif action == 'trigger_heating':
                # Permanently enable or disable heating
                heating_state = not heating_state
                
                response_obj = {
                    'status': 'OK',
                    'heating_state': heating_state
                }
                response_builder.set_body_from_dict(response_obj)
            elif action == "set_target_temperature":
                # Set target temperatures for high or low temperature modes
                low_or_high = request.data()['low_or_high']
                new_target = float(request.data()['new_target'])
                if new_target >= 20 and new_target <= 28: # Has to be between 20 and 28 degrees
                    if low_or_high == "Low":
                        target_temperature_low = new_target
                    else:
                        target_temperature_high = new_target
                    save_data()
                    response_obj = {
                        'status': 'OK',
                        'target_temperature': new_target
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
                # Set on or off time for high temperature setting
                on_or_off = request.data()['on_or_off']
                new_time = int(request.data()['new_time'])
                if new_time >= 0 and new_time <= 1410: # Has to be between 12AM and 11:30PM
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

    updated_today = False

    while True:
        # This loop just monitors the WiFi connection and tries re-connects if disconnected
        # Connect to WiFi if disconnected
        if not WiFiConnection.is_connected():
            # try to connect again
            print('WiFi connect...')
            if WiFiConnection.do_connect(True):
                # Time will be in UTC only
                try:
                    ntptime.settime()
                except:
                    print("NTP timeout")
                finally:
                    print(time.localtime())
        else:
            # After midnight, update NTP time once a day
            if time.localtime()[3] == 0:
                if not updated_today:
                    try:
                        ntptime.settime()
                        updated_today = True
                    except:
                        print("NTP timeout")
                    finally:
                        print(time.localtime())
            else:
                updated_today = False

        await uasyncio.sleep_ms(2000)
        
        #wdt.feed() # Reset watchdog

# Main timer interrupt - runs every second
# This will activate / deactivate heating based on whether the local time is within an active timer 
# and whether the temperature limit has been reached
# Will measure the temperature every 30 seconds
def timer_check_interrupt(pin):
    global ds18b20_temperature
    global heating_state
    global is_heating
    global counter

    # 30 seconds between temperature readings
    if counter == 29:
        # Read temperature
        ds.convert_temp()
    # 1 sec wait before reading result
    if counter == 30:
        # Read temperature conversion
        ds18b20_temperature = round(ds.read_temp(r), 2)
        # Reset counter
        counter = 0

    # Temperature to target - default to high
    target_temperature = target_temperature_high

    # Convert local time into minutes since midnight
    current_time = (time.localtime()[3] * 60) + time.localtime()[4]
    # If on/off times are not equal, change heating state (will heat) if local time matches
    if on_time != off_time:
        if current_time < on_time or current_time > off_time:
            target_temperature = target_temperature_low

    # If heating state (will heat) is true
    if heating_state:
        # Turn off heating if temperature is 0.25 degrees above target
        if is_heating and ds18b20_temperature > (target_temperature + 0.25):
            is_heating = False
        # Turn on heating is temperature is 0.25 degrees below target
        elif not is_heating and ds18b20_temperature < (target_temperature - 0.25):
            is_heating = True
    else:
        is_heating = False
    
    # Enable or disable the output
    heating_pin.value(is_heating)

    counter += 1

# Save variables to the eeprom
def save_data():
    print('Saving variables...')
    with open('config.txt', 'w+') as f:
        f.write(str(target_temperature_high) + "|" + str(on_time) + "|" + str(off_time) + '|' + str(target_temperature_low))

# Read variables from the eeprom - done at boot
def read_data():
    global target_temperature_low
    global target_temperature_high
    global on_time
    global off_time

    with open('config.txt', 'r') as f:
        fdata = f.readline()
        if len(fdata.split("|")) == 4:
            target_temperature_high = float(fdata.split("|")[0])
            on_time = int(fdata.split("|")[1])
            off_time = int(fdata.split("|")[2])
            target_temperature_low = float(fdata.split("|")[3])


# Entry Here
# Read any existing saved data
read_data()

# Start a timer to interrupt every 1 second
timer_check = Timer(mode=Timer.PERIODIC, period=1000, callback=timer_check_interrupt)

# start asyncio task and loop
try:
    # start the main async tasks
    uasyncio.run(main())
finally:
    # reset and start a new event loop for the task scheduler
    uasyncio.new_event_loop()
