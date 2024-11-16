var isChanging = false; // Used to prevent SSE updating controls when being edited
var isListening = false; // Used to prevent multiple SSE running

// SSE called on load, streams from pico to browser
function streamStatus() {
    if (!isListening) {
        isListening = true;
        var evtSrc = new EventSource("events");
        evtSrc.onmessage = function(event) {
            updateStatus(event.data);
        }
        evtSrc.onerror = function(error) {
            console.log(error);
            isListening = false;
        }
    }
}

// Legacy polling method (not used)
function getStatus() {
    const jsonData = {
        "action": "get_status"
    };
    // Post back to the python service
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
        updateStatus(this.responseText);
    }
    xhttp.open("POST", "/api", true);
    xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhttp.send(JSON.stringify(jsonData));
}

// Populate the fields and controls with the current status from the Pico's JSON response
function updateStatus(strRequest) {
    console.log(strRequest);
    var json_response = JSON.parse(strRequest);
    
    if (json_response.status == "OK") {
        document.getElementById("isHeating").innerHTML = (json_response.is_heating ? "ON" : "OFF");
        document.getElementById("heatingState").innerHTML = (json_response.heating_state ? "ENABLED" : "DISABLED");
        document.getElementById("temperature").innerHTML = json_response.temperature_value;
        if (!isChanging) {
            document.getElementById("highTemperature").innerHTML = json_response.target_temperature_high;
            document.getElementById("highTargetInput").value = json_response.target_temperature_high;
            document.getElementById("lowTemperature").innerHTML = json_response.target_temperature_low;
            document.getElementById("lowTargetInput").value = json_response.target_temperature_low;
            document.getElementById("onTime").innerHTML = formatTime(json_response.on_time);
            document.getElementById("onTimeInput").value = json_response.on_time;
            document.getElementById("offTime").innerHTML = formatTime(json_response.off_time);
            document.getElementById("offTimeInput").value = json_response.off_time;
        }
    }
}

// Functions to prevent the interval resetting displayed values when changing a control
function startChange() {
    isChanging = true;
}

function endChange() {
    isChanging = false;
}

// Manually trigger heating on or off
function triggerHeating() {
    const jsonData = {
        "action": "trigger_heating"
    };
    // Post back to the python service
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
        var json_response = JSON.parse(this.responseText);
        console.log(json_response);

        if (json_response.status == "OK") {
            // Show heating state
            document.getElementById("heatingState").innerHTML = (json_response.heating_state ? "ENABLED" : "DISABLED");
        } else {
            alert("Error setting heating state");
        }
    }
    xhttp.open("POST", "/api", true);
    xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhttp.send(JSON.stringify(jsonData));
}

function moveTargetTemperature(lowOrHigh) {
    startChange();
    document.getElementById(lowOrHigh + "Temperature").innerHTML = document.getElementById(lowOrHigh + "TargetInput").value;
    timeoutChange();
}

// This function is used when the control slider is dragged
function moveTime(onOrOff) {
    document.getElementById(onOrOff + "Time").innerHTML = formatTime(document.getElementById(onOrOff + "TimeInput").value);
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


function editTemp(lowOrHigh) {
    // Check state of a control
    if (document.getElementById(lowOrHigh + "TargetInput").disabled) {
        startChange();
        // Enable
        document.getElementById(lowOrHigh + "TargetInput").disabled = false;
        // Change to save icon
        document.getElementById(lowOrHigh + "BtnE").innerHTML = "&#x1F4BE;";
        // Show cancel button
        document.getElementById(lowOrHigh + "BtnC").style.display = "block";
    } else {
        // Apply the changes
        const jsonData = {
            "action": "set_target_temperature",
            "low_or_high": lowOrHigh,
            "new_target": document.getElementById(lowOrHigh + "TargetInput").value
        };
        const xhttp = new XMLHttpRequest();
        xhttp.onload = function() {
            var json_response = JSON.parse(this.responseText);
            console.log(json_response);
    
            if (json_response.status == "OK") {
                // Show new temperature target
                document.getElementById(lowOrHigh + "Temperature").innerHTML = json_response.target_temperature;
            } else {
                alert("Error setting target temperature: " + json_response.message);
            }
        }
        xhttp.open("POST", "/api", true);
        xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhttp.send(JSON.stringify(jsonData));

        // Disable
        document.getElementById(lowOrHigh + "TargetInput").disabled = true;
        // Change to edit icon
        document.getElementById(lowOrHigh + "BtnE").innerHTML = "&#x1F4DD;";
        // Hide cancel button
        document.getElementById(lowOrHigh + "BtnC").style.display = "none";
        // Delay resuming the SSE by over a second, allowing time for the Pico to receive and response with the new state
        setTimeout(endChange(), 1200);
    }
}

function cancelTemp(lowOrHigh) {
    // Disable
    document.getElementById(lowOrHigh + "TargetInput").disabled = true;
    // Change to edit icon
    document.getElementById(lowOrHigh + "BtnE").innerHTML = "&#x1F4DD;";
    // Hide cancel button
    document.getElementById(lowOrHigh + "BtnC").style.display = "none";
    endChange();
}

function editTime(onOrOff) {
    // Check state of a control
    if (document.getElementById(onOrOff + "TimeInput").disabled) {
        startChange();
        // Enable
        document.getElementById(onOrOff + "TimeInput").disabled = false;
        // Change to save icon
        document.getElementById(onOrOff + "BtnE").innerHTML = "&#x1F4BE;";
        // Show cancel button
        document.getElementById(onOrOff + "BtnC").style.display = "block";
    } else {
        // Apply the changes
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
                // Show new time
                document.getElementById(onOrOff + "Time").innerHTML = formatTime(json_response.time_set);
            } else {
                alert("Error setting on/off time: " + json_response.message);
            }
        }
        xhttp.open("POST", "/api", true);
        xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhttp.send(JSON.stringify(jsonData));

        // Disable
        document.getElementById(onOrOff + "TimeInput").disabled = true;
        // Change to edit icon
        document.getElementById(onOrOff + "BtnE").innerHTML = "&#x1F4DD;";
        // Hide cancel button
        document.getElementById(onOrOff + "BtnC").style.display = "none";
        // Delay resuming the SSE by over a second, allowing time for the Pico to receive and response with the new state
        setTimeout(endChange(), 1200);
    }
}

function cancelTime(onOrOff) {
    // Disable
    document.getElementById(onOrOff + "TimeInput").disabled = true;
    // Change to edit icon
    document.getElementById(onOrOff + "BtnE").innerHTML = "&#x1F4DD;";
    // Hide cancel button
    document.getElementById(onOrOff + "BtnC").style.display = "none";
    endChange();
}

// These events will start the server side event source to stream status
// This one is for mobiles when the browser/tab resumes
document.addEventListener("visibilitychange", streamStatus, false);
// For desktops when tab is focused
document.addEventListener("focus", streamStatus, false);
// For initial window load
window.addEventListener("load", streamStatus);
