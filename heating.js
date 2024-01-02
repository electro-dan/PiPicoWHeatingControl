var isChanging = false;
var changingTimeout;

// Called on load, then every second
function getStatus() {
    const formData = new FormData();
    formData.append("action", "get_status");
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
        var json_response = JSON.parse(this.responseText);
        console.log(json_response);

        if (json_response.status == "OK") {
            document.getElementById("isHeating").innerHTML = json_response.is_heating;
            document.getElementById("heatingState").innerHTML = json_response.heating_state;
            document.getElementById("temperature").innerHTML = json_response.temperature_value;
            if (!isChanging) {
                document.getElementById("temperatureTargetHigh").innerHTML = json_response.target_temperature_high;
                document.getElementById("inputTargetHigh").value = json_response.target_temperature_high;
                document.getElementById("temperatureTargetLow").innerHTML = json_response.target_temperature_low;
                document.getElementById("inputTargetLow").value = json_response.target_temperature_low;
                document.getElementById("onTime").innerHTML = formatTime(json_response.on_time);
                document.getElementById("onTimeInput").value = json_response.on_time;
                document.getElementById("offTime").innerHTML = formatTime(json_response.off_time);
                document.getElementById("offTimeInput").value = json_response.off_time;
            }
        }
    }
    xhttp.open("POST", "/api", true);
    xhttp.send(formData);
}

// Functions to prevent the interval reseting displayed values when changing a control
function resetChanging() {
    isChanging = false;
}

function startChange() {
    clearTimeout(changingTimeout);
    isChanging = true;
}

function timeoutChange() {
    changingTimeout = setTimeout(resetChanging, 10000);
}

function endChange() {
    changingTimeout = setTimeout(resetChanging, 1000);
}

// Manually trigger heating on or off
function triggerHeating() {
    const jsonData = {
        "action": "trigger_heating"
    };
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
        var json_response = JSON.parse(this.responseText);
        console.log(json_response);

        if (json_response.status == "OK") {
            // reset led indicator to none
            document.getElementById("heatingState").innerHTML = json_response.heating_state;
        } else {
            alert("Error setting heating state");
        }

    }
    xhttp.open("POST", "/api", true);
    xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhttp.send(JSON.stringify(jsonData));
}

// Set the target temperature
function setTargetTemperature(lowOrHigh) {
    startChange();

    const jsonData = {
        "action": "set_target_temperature",
        "low_or_high": lowOrHigh,
        "new_target": document.getElementById("inputTarget" + lowOrHigh).value
    };
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
        var json_response = JSON.parse(this.responseText);
        console.log(json_response);

        if (json_response.status == "OK") {
            // reset led indicator to none
            document.getElementById("temperatureTarget" + lowOrHigh).innerHTML = json_response.target_temperature;
        } else {
            alert("Error setting target temperature");
        }
    }
    xhttp.open("POST", "/api", true);
    xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhttp.send(JSON.stringify(jsonData));

    endChange();
}

function moveTargetTemperature(lowOrHigh) {
    startChange();
    document.getElementById("temperatureTarget" + lowOrHigh).innerHTML = document.getElementById("inputTarget" + lowOrHigh).value;
    timeoutChange();
}

// This function is used when the control is released - the result is saved
function setTime(onOrOff) {
    startChange();

    const jsonData = {
        "action": "set_time",
        "on_or_off": onOrOff,
        "new_time": document.getElementById(onOrOff + "TimeInput").value
    };
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
        var json_response = JSON.parse(this.responseText);
        console.log(json_response);

        if (json_response.status == "OK") {
            // reset led indicator to none
            document.getElementById(onOrOff + "Time").innerHTML = formatTime(json_response.time_set);
        } else {
            alert("Error setting on/off time");
        }
    }
    xhttp.open("POST", "/api", true);
    xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhttp.send(JSON.stringify(jsonData));

    endChange();
}

// This function is used when the control slider is dragged
function moveTime(onOrOff) {
    startChange();
    document.getElementById(onOrOff + "Time").innerHTML = formatTime(document.getElementById(onOrOff + "TimeInput").value);
    timeoutChange();
}

// Used by above functions to format the set time into 12h format hh:mm
function formatTime(timeIn) {
    var hour = Math.floor(timeIn / 60)
    var ampm = " AM"
    if (hour > 11)
        ampm = " PM"
    if (hour > 12)
        hour -= 12
    return String(hour) + ":" + String(timeIn % 60).padStart(2, "0") + ampm;
}

getStatus();
setInterval(getStatus, 1000);
