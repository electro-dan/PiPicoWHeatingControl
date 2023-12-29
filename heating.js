var isChanging = false;

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
                document.getElementById("temperatureTarget").innerHTML = json_response.target_temperature;
                document.getElementById("onTime").innerHTML = formatTime(json_response.on_time);
                document.getElementById("offTime").innerHTML = formatTime(json_response.off_time);
                document.getElementById("inputTarget").value = json_response.target_temperature;
                document.getElementById("onTimeInput").value = json_response.on_time;
                document.getElementById("offTimeInput").value = json_response.off_time;
            }
        }
    }
    xhttp.open("POST", "/api", true);
    xhttp.send(formData);

    if (isChanging)
        isChanging = false;
}


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

function setTargetTemperature() {
    const jsonData = {
        "action": "set_target_temperature",
        "new_target": document.getElementById("inputTarget").value
    };
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
        var json_response = JSON.parse(this.responseText);
        console.log(json_response);

        if (json_response.status == "OK") {
            // reset led indicator to none
            document.getElementById("temperatureTarget").innerHTML = json_response.target_temperature;
        } else {
            alert("Error setting target temperature");
        }
    }
    xhttp.open("POST", "/api", true);
    xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhttp.send(JSON.stringify(jsonData));

    isChanging = true;
}

function setTime(onOrOff) {
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

    isChanging = true;
}

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
