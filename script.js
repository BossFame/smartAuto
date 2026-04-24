const ESP = "http://192.168.43.120";
const devices = [
    { name: "Light", icon: "fa-lightbulb" },
    { name: "Fan", icon: "fa-wind" },
    { name: "TV", icon: "fa-tv" },
    { name: "Socket", icon: "fa-bolt" }
];
let states = [false, false, false, false];

const grid = document.getElementById("grid");
const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");
const connLabel = document.getElementById("connLabel");
const statusDot = document.querySelector(".pulse-dot");

function updateConnectionStatus() {
    if (navigator.onLine) {
        connLabel.innerText = "Connected";
        connLabel.parentElement.style.color = "#22c55e";
        statusDot.style.background = "#22c55e";
        statusDot.style.boxShadow = "0 0 10px #22c55e";
    } else {
        connLabel.innerText = "No Connection";
        connLabel.parentElement.style.color = "#ef4444";
        statusDot.style.background = "#ef4444";
        statusDot.style.boxShadow = "0 0 10px #ef4444";
    }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

function updateClock() {
    const now = new Date();
    document.getElementById("currentTime").innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

devices.forEach((dev, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.id = "card" + i;
    card.onclick = () => toggle(i);

    card.innerHTML = `
        <div class="icon-wrapper">
            <i class="fas ${dev.icon}"></i>
        </div>
        <h3>${dev.name}</h3>
        <p id="status${i}" class="device-status">OFF</p>
        <div class="switch-container">
            <div class="toggle-knob"></div>
        </div>
    `;

    grid.appendChild(card);
});

async function toggle(i) {
    states[i] = !states[i];
    updateUI(i);
    updateGlobalStatus(i, states[i]);

    // Send to ESP
    fetch(`${ESP}/relay${i + 1}/${states[i] ? "on" : "off"}`)
        .catch(() => console.log("ESP Request failed - device may be offline"));

    speak(`${devices[i].name} turned ${states[i] ? "on" : "off"}`);
}

function updateUI(i) {
    const statusText = document.getElementById("status" + i);
    const card = document.getElementById("card" + i);

    if (states[i]) {
        statusText.innerText = "ON";
        card.classList.add("active");
    } else {
        statusText.innerText = "OFF";
        card.classList.remove("active");
    }

    updateSummary();
}

function updateSummary() {
    const container = document.getElementById("summaryList");
    const countEl = document.getElementById("activeCount");
    container.innerHTML = "";
    
    let activeCount = 0;
    devices.forEach((dev, i) => {
        const pill = document.createElement("div");
        pill.className = `pill ${states[i] ? 'on' : ''}`;
        pill.innerText = `${dev.name}: ${states[i] ? "ON" : "OFF"}`;
        container.appendChild(pill);
        if (states[i]) activeCount++;
    });
    
    countEl.innerText = activeCount;
}

function updateGlobalStatus(i, state) {
    const status = document.getElementById("globalStatus");
    status.innerText = `${devices[i].name} is ${state ? "ON" : "OFF"}`;
}

function setGlobalMessage(message) {
    const status = document.getElementById("globalStatus");
    if (status) status.innerText = message;
}

let listenTimeout = null;

// Voice Control Logic
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-NG";
    recognition.continuous = true;

recognition.onresult = (e) => {
    const text = e.results[e.results.length - 1][0].transcript.toLowerCase();

    processVoice(text);

    resetListenTimer();
};
}

function resetListenTimer() {
    clearTimeout(listenTimeout);

    listenTimeout = setTimeout(() => {
        stopListening();
    }, 5000); 
}

voiceBtn.onclick = () => {
    if (!recognition) return;

    if (!isListening) {
        recognition.start();
        voiceBtn.classList.add("listening");
        voiceStatus.innerText = "Listening...";
        isListening = true;

        resetListenTimer(); 
    } else {
        stopListening();
    }
};

function stopListening() {
    recognition.stop();
    voiceBtn.classList.remove("listening");
    voiceStatus.innerText = "Ready";
    isListening = false;

    clearTimeout(listenTimeout);
}

function processVoice(text) {
    let commandDetected = false;

    if (text.includes("all off") || text.includes("everything off")) {
        controlAll(false);
        speak("Everything turned off");
        commandDetected = true;
    }

    if (text.includes("all on") || text.includes("everything on")) {
        controlAll(true);
        speak("Everything turned on");
        commandDetected = true;
    }

    devices.forEach((dev, i) => {
        if (text.includes(dev.name.toLowerCase())) {
            if (text.includes("on")) {
                voiceControl(i, true);
                commandDetected = true;
            }
            else if (text.includes("off")) {
                voiceControl(i, false);
                commandDetected = true;
            }
        }
    });

    if (commandDetected) {
    stopListening();
}
}

function controlAll(state) {
    devices.forEach((_, i) => voiceControl(i, state, false));
}

function voiceControl(i, state, shouldSpeak = true) {
    if (states[i] === state) return;
    states[i] = state;
    updateUI(i);

    fetch(`${ESP}/relay${i + 1}/${state ? "on" : "off"}`)
        .catch(() => console.log("Connection to ESP failed"));

    if (shouldSpeak) {
        setGlobalMessage(`${devices[i].name} is ${state ? "ON" : "OFF"}`);
        speak(`${devices[i].name} turned ${state ? "on" : "off"}`);
    }
}

function speak(message) {
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(speech);
}

// Initial Sync
updateSummary();
