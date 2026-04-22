const ESP = "http://192.168.43.120";
const names = ["Light", "Fan", "TV", "Socket"];
let states = [false, false, false, false];
const grid = document.getElementById("grid");
const voiceBtn = document.getElementById("voiceBtn");
let lastCommand = "";
let commandTimer = null;
let silenceTimer = null;

names.forEach((name, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.id = "card" + i;

    card.innerHTML = `
    <h3>${name}</h3>
    <p id="status${i}" class="device-status">OFF</p><br>
    <label class="switch">
        <input type="checkbox" onchange="toggle(${i})" id="toggle${i}">
        <span class="slider"></span>
    </label>
`;

    grid.appendChild(card);
});

async function toggle(i) {
    const toggleBtn = document.getElementById("toggle" + i);
    if (!toggleBtn) return;

    states[i] = toggleBtn.checked;

    updateUI(i);
    updateGlobalStatus(i, states[i]);

    fetch(`${ESP}/relay${i + 1}/${states[i] ? "on" : "off"}`)
        .catch(() => console.log("Request failed"));

    speak(`${names[i]} turned ${states[i] ? "on" : "off"}`);
}

function updateUI(i) {
    const status = document.getElementById("status" + i);
    const toggleBtn = document.getElementById("toggle" + i);

    toggleBtn.checked = states[i];

    if (states[i]) {
        status.innerText = "ON";
    } else {
        status.innerText = "OFF";
    }

    const card = document.getElementById("card" + i);
    if (card) {
        if (states[i]) {
            card.classList.add("active");
        } else {
            card.classList.remove("active");
        }
    }

    updateSummary();
}

async function syncState() {
    try {
        const res = await fetch(`${ESP}/status`);
        const data = await res.json();

        for (let i = 0; i < 4; i++) {
            if (document.visibilityState === "visible") {
                states[i] = data[`relay${i + 1}`] == 1;
            }
            updateUI(i);
        }
    } catch (e) {
        console.log("Sync error");
    }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = "en-NG";
recognition.continuous = true;

recognition.onend = () => {
    if (isListening) {
        recognition.start();
    }
};

let isListening = false;

voiceBtn.onclick = () => {
    if (!isListening) {
        recognition.start();
        voiceBtn.classList.add("listening");
        isListening = true;

        silenceTimer = setTimeout(() => {
            stopListening();
        }, 3000);
    } else {
        stopListening();
    }
};

function stopListening() {
    recognition.stop();
    voiceBtn.classList.remove("listening");
    isListening = false;
}

recognition.onresult = (e) => {
    clearTimeout(silenceTimer);

    const result = e.results[e.results.length - 1];

    if (!result.isFinal) return;

    const text = result[0].transcript.toLowerCase();
    console.log("Final Heard:", text);

    processVoice(text);

    silenceTimer = setTimeout(() => {
        stopListening();
    }, 5000);
};

function processVoice(text) {
    text = text.toLowerCase().trim();

    if (text === lastCommand) return;

    lastCommand = text;

    clearTimeout(commandTimer);
    commandTimer = setTimeout(() => {
        lastCommand = "";
    }, 3000);

    if (text.includes("all off") || text.includes("turn everything off")) {
        controlAll(false);
        window.speechSynthesis.cancel();
        speak("Everything turned off");
        setGlobalMessage("Everything is OFF");
        return;
    }

    if (text.includes("all on") || text.includes("turn everything on")) {
        controlAll(true);
        window.speechSynthesis.cancel();
        speak("Everything turned on");
        setGlobalMessage("Everything is ON");
        return;
    }

    for (let i = 0; i < names.length; i++) {
        if (text.includes(names[i].toLowerCase())) {
            if (text.includes("on")) {
                voiceControl(i, true, true);
                return;
            }

            if (text.includes("off")) {
                voiceControl(i, false, true);
                return;
            }
        }
    }
}

function controlAll(state) {
    for (let i = 0; i < names.length; i++) {
        voiceControl(i, state, false);
    }
}

function voiceControl(i, state, shouldSpeak = true) {
    if (states[i] === state) return;

    states[i] = state;

    const toggleBtn = document.getElementById("toggle" + i);
    if (toggleBtn) toggleBtn.checked = state;

    updateUI(i);

    const card = document.getElementById("card" + i);
    if (card) {
        card.classList.add("flash");
        setTimeout(() => card.classList.remove("flash"), 400);
    }

    fetch(`${ESP}/relay${i + 1}/${state ? "on" : "off"}`)
        .catch(() => console.log("Connection failed"));

    if (shouldSpeak) {
        setGlobalMessage(`${names[i]} is ${state ? "ON" : "OFF"}`);
        speak(`${names[i]} turned ${state ? "on" : "off"}`);
    }
}

function speak(message) {
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(message);
    speech.rate = 1;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
}

function setStatus(i, state) {
    const status = document.getElementById("status" + i);

    if (status) {
        status.innerText = `${names[i]} is ${state ? "ON" : "OFF"}`;
    }
}

function updateGlobalStatus(i, state) {
    const status = document.getElementById("globalStatus");
    status.innerText = `${names[i]} is ${state ? "ON" : "OFF"}`;
}

function updateSummary() {
    const container = document.getElementById("summaryList");
    container.innerHTML = "";

    for (let i = 0; i < names.length; i++) {
        const item = document.createElement("p");
        item.innerText = `${names[i]}: ${states[i] ? "ON" : "OFF"}`;
        container.appendChild(item);
    }
}

function setGlobalMessage(message) {
    const status = document.getElementById("globalStatus");
    if (status) {
        status.innerText = message;
    }
}