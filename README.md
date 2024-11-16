# PiPicoWHeatingControl
Using a Raspberry Pi Pico, control an electric heater and display the room temperature (using DS18B20) via a web page.

For more information, see:  
https://electro-dan.co.uk/blog/44/electric-heating-radiators-timer-thermostat-using-raspberry-pi-pico-w

Based on:  
https://github.com/getis/micropython-web-control-panel  
https://microcontrollerslab.com/raspberry-pi-pico-ds18b20-web-server-weather-station/  
https://www.multiwingspan.co.uk/pico.php?page=wasync  

#### Update 1.2 16th November 2024
Now uses microdot as the web server https://github.com/miguelgrinberg/microdot/ 

This allows Server Side Events (SSE) to be used to push updates to the browser without polling, improving the UI experience. 
