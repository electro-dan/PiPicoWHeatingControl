# PiPicoWHeatingControl
Using a Raspberry Pi Pico, control an electric heater and display the room temperature (using DS18B20) via a web page.

For more information, see:  
https://electro-dan.co.uk/blog/44/electric-heating-radiators-timer-thermostat-using-raspberry-pi-pico-w

Based on:  
https://github.com/getis/micropython-web-control-panel  
https://microcontrollerslab.com/raspberry-pi-pico-ds18b20-web-server-weather-station/  
https://www.multiwingspan.co.uk/pico.php?page=wasync  

You'll need to update secrets.py with your connection details. The file is ignored in .gitignore, but indexed, so to prevent uploading changes to your own repo, use:

    git update-index --assume-unchanged secrets.py

#### Update 1.2 16th November 2024
Now uses microdot as the web server https://github.com/miguelgrinberg/microdot/ 

This allows Server Side Events (SSE) to be used to push updates to the browser without polling, improving the UI experience. 

#### Update 1.2.1 7th December 2024
There were a couple of issues with the web server I think were memory related, so I've made some tweaks. 

I have also updated the project to require pre-compiling the microdot web server. This is done easily on by creating a virtual environment and using pip to install mpy-cross. Example below for Linux:

    sudo apt install python3.12-venv # change version per OS
    python3 -m venv picoenv
    picoenv/bin/pip install mpy-cross==1.22.2
    picoenv/bin/mpy-cross microdot/microdot.py
    picoenv/bin/mpy-cross microdot/helpers.py
    picoenv/bin/mpy-cross microdot/sse.py

This will create .mpy files and only these should be uploaded to the Pico W. The updated file .vscode/settings.json contains a "micropico.pyIgnore" array that stops uploading the original files, as well as the virtualenv. 
