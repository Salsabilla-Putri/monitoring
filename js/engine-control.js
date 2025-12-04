// engine-control.js
// Connects to Shiftr.io and allows sending commands to ESP32.

const MQTT_CONF = {
  brokerWs: "wss://generatorta20.cloud.shiftr.io:443",
  user: "generatorta20",
  pass: "TA252601020",
  subs: ["gen/volt", "gen/curr", "gen/power", "gen/freq", "gen/pf", "gen/status"]
};

// --- UI references ---
const engVolt = document.getElementById("engVolt");
const engCurr = document.getElementById("engCurr");
const engPower = document.getElementById("engPower");
const engFreq = document.getElementById("engFreq");
const engPF = document.getElementById("engPF");
const engStatus = document.getElementById("engStatus");
const connStatus = document.getElementById("connStatus");
const logArea = document.getElementById("logArea");

// --- MQTT connection ---
const client = mqtt.connect(MQTT_CONF.brokerWs, {
  username: MQTT_CONF.user,
  password: MQTT_CONF.pass,
  reconnectPeriod: 3000
});

client.on("connect", () => {
  log("✅ Connected to broker");
  connStatus.textContent = "Connected to Shiftr.io";
  connStatus.style.color = "#9fe49f";
  MQTT_CONF.subs.forEach(t => client.subscribe(t));
});

client.on("reconnect", () => {
  connStatus.textContent = "Reconnecting...";
  connStatus.style.color = "#f4c860";
});

client.on("close", () => {
  connStatus.textContent = "Disconnected";
  connStatus.style.color = "#f28b82";
});

client.on("message", (topic, msg) => {
  const val = msg.toString();
  if (topic === "gen/volt") engVolt.textContent = val;
  else if (topic === "gen/curr") engCurr.textContent = val;
  else if (topic === "gen/power") engPower.textContent = val;
  else if (topic === "gen/freq") engFreq.textContent = val;
  else if (topic === "gen/pf") engPF.textContent = val;
  else if (topic === "gen/status") {
    engStatus.textContent = val.toUpperCase();
    engStatus.style.color = val.toLowerCase() === "on" ? "#1eb899" : "#888";
  }
});

// --- Command publisher ---
function sendCmd(cmd) {
  const topic = "cmd/" + cmd;
  client.publish(topic, "1");
  log(`📤 Command sent: ${topic}`);
}

// --- Log helper ---
function log(text) {
  const line = `[${new Date().toLocaleTimeString()}] ${text}\n`;
  logArea.textContent = line + logArea.textContent;
}
