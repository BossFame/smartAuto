import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCznHGmoNftvbixSi9Pme56QdnqAshGmf0",
  databaseURL: "https://smartauto-fae7c-default-rtdb.firebaseio.com/",
  authDomain: "smartauto-fae7c.firebaseapp.com",
  projectId: "smartauto-fae7c",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const devices = [
  { name: "Light", icon: "fa-lightbulb" },
  { name: "Fan", icon: "fa-wind" },
  { name: "TV", icon: "fa-tv" },
  { name: "Socket", icon: "fa-bolt" }
];

let states = [false, false, false, false];
let isAuthed = false;
let initialized = false;

// ─── START APP AFTER DOM LOAD ───────────────────────
document.addEventListener("DOMContentLoaded", () => {

  const grid = document.getElementById("grid");
  const voiceBtn = document.getElementById("voiceBtn");
  const voiceStatus = document.getElementById("voiceStatus");
  const connLabel = document.getElementById("connLabel");
  const statusDot = document.querySelector(".pulse-dot");

  // ─── AUTH ─────────────────────────────────────────
  signInAnonymously(auth).catch(console.error);

  onAuthStateChanged(auth, (user) => {
    isAuthed = !!user;

    // ✅ Reset ONLY once (not every refresh)
    if (isAuthed && !initialized) {
      initialized = true;
      for (let i = 1; i <= 4; i++) {
        set(ref(db, "relay" + i), 0);
      }
    }
  });

  // ─── CONNECTION STATUS ────────────────────────────
  function updateConnectionStatus() {
    if (!connLabel || !statusDot) return;

    if (navigator.onLine) {
      connLabel.innerText = "Connected";
      connLabel.parentElement.style.color = "#22c55e";
      statusDot.style.background = "#22c55e";
    } else {8
      connLabel.innerText = "No Connection";
      connLabel.parentElement.style.color = "#ef4444";
      statusDot.style.background = "#ef4444";
    }
  }

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  updateConnectionStatus();

  // ─── CLOCK ───────────────────────────────────────
  setInterval(() => {
    const now = new Date();
    const el = document.getElementById("currentTime");
    if (el) {
      el.innerText = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }
  }, 1000);

  // ─── BUILD UI ────────────────────────────────────
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

  // ─── REALTIME SYNC ───────────────────────────────
  for (let i = 1; i <= 4; i++) {
    onValue(ref(db, "relay" + i), (snap) => {
      const val = snap.val();
      if (val !== null) {
        states[i - 1] = val === 1;
        updateUI(i - 1);
      }
    });
  }

  // ─── TOGGLE ──────────────────────────────────────
  async function toggle(i) {
    if (!isAuthed) return;

    states[i] = !states[i];
    updateUI(i);
    updateGlobalStatus(i, states[i]);

    await set(ref(db, "relay" + (i + 1)), states[i] ? 1 : 0);

    speak(`${devices[i].name} turned ${states[i] ? "on" : "off"}`);
  }

  // ─── VOICE CONTROL ───────────────────────────────
  function voiceControl(i, state) {
    if (!isAuthed || states[i] === state) return;

    states[i] = state;
    updateUI(i);

    set(ref(db, "relay" + (i + 1)), state ? 1 : 0);

    speak(`${devices[i].name} turned ${state ? "on" : "off"}`);
  }

  function voiceControlAll(state) {
    if (!isAuthed) return;

    devices.forEach((_, i) => {
      states[i] = state;
      updateUI(i);
      set(ref(db, "relay" + (i + 1)), state ? 1 : 0);
    });

    speak(`All devices turned ${state ? "on" : "off"}`);
  }

  // ─── SPEECH ──────────────────────────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";

    voiceBtn.onclick = () => {
      recognition.start();
      voiceStatus.innerText = "Listening...";
      voiceBtn.classList.add("listening");
    };

recognition.onresult = (e) => {
  const cmd = e.results[0][0].transcript.toLowerCase();
  console.log("Heard:", cmd); // 👈 Add this to debug what's being heard

  // Check longer/more specific phrase first
  if (cmd.includes("all on") || cmd.includes("everything on") || cmd.includes("all devices on")) {
    return voiceControlAll(true);
  }
  if (cmd.includes("all off") || cmd.includes("everything off") || cmd.includes("all devices off")) {
    return voiceControlAll(false);
  }

  devices.forEach((dev, i) => {
    if (cmd.includes(dev.name.toLowerCase())) {
      if (cmd.includes("on")) voiceControl(i, true);
      if (cmd.includes("off")) voiceControl(i, false);
    }
  });
};
    recognition.onend = () => {
      voiceBtn.classList.remove("listening");
      voiceStatus.innerText = "Ready";
    };
  }

  // ─── UI ──────────────────────────────────────────
  function updateUI(i) {
    const statusText = document.getElementById("status" + i);
    const card = document.getElementById("card" + i);

    if (!statusText || !card) return;

    statusText.innerText = states[i] ? "ON" : "OFF";
    card.classList.toggle("active", states[i]);

    updateSummary();
  }

  function updateSummary() {
    const container = document.getElementById("summaryList");
    const countEl = document.getElementById("activeCount");

    container.innerHTML = "";
    let count = 0;

    devices.forEach((dev, i) => {
      const pill = document.createElement("div");
      pill.className = `pill ${states[i] ? "on" : ""}`;
      pill.innerText = `${dev.name}: ${states[i] ? "ON" : "OFF"}`;
      container.appendChild(pill);
      if (states[i]) count++;
    });

    countEl.innerText = count;
  }

  function updateGlobalStatus(i, state) {
    const el = document.getElementById("globalStatus");
    if (el) el.innerText = `${devices[i].name} is ${state ? "ON" : "OFF"}`;
  }

  function speak(msg) {
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(msg);
    window.speechSynthesis.speak(speech);
  }

  updateSummary();
});
