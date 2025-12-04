// mqtt-client.js
// Uses mqtt.min.js and chart-utils.js

// --- CONFIG: sesuaikan jika perlu ---
const MQTT_CONFIG = {
  brokerWs: 'wss://generatorta20.cloud.shiftr.io:443',
  user: 'generatorta20',
  pass: 'TA252601020',
  // topics that ESP32 publishes (example)
  topics: ['gen/rpm', 'gen/temp', 'gen/volt']
};
// thresholds for simple alarms (tweak sesuai kebutuhan)
const ALARM_THRESHOLDS = {
  rpm: { high: 4000 },           // contoh >4000 RPM
  temp: { high: 95 },            // >95 °C
  volt: { low: 200, high: 260 }  // outside range
};

// --- state & persistence keys ---
const HISTORY_KEY = 'gen_history'; // array of {ts, topic, value}
const ALARMS_KEY = 'gen_alarms';   // array of {id, ts, topic, value, type, ack}

// --- Charts initialization (assume DOM ready) ---
const chartRPM = createLineChart(document.getElementById('chartRPM').getContext('2d'), 'RPM', '#1976d2');
const chartTemp = createLineChart(document.getElementById('chartTemp').getContext('2d'), 'Temp', '#ef4444');
const chartVolt = createLineChart(document.getElementById('chartVolt').getContext('2d'), 'Volt', '#1eb899');

// helper DOM
const lastRpm = document.getElementById('lastRpm');
const lastTemp = document.getElementById('lastTemp');
const lastVolt = document.getElementById('lastVolt');
const connStatus = document.getElementById('connStatus');

// --- persistence helpers ---
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch (e) { return []; }
}
function saveHistory(arr) { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }
function addHistoryEntry(topic, value) {
  const hist = loadHistory();
  hist.push({ ts: new Date().toISOString(), topic, value: Number(value) });
  // limit history size
  if (hist.length > 5000) hist.splice(0, hist.length - 5000);
  saveHistory(hist);
}

// alarms
function loadAlarms(){ try { return JSON.parse(localStorage.getItem(ALARMS_KEY) || '[]'); } catch(e){ return []; } }
function saveAlarms(arr){ localStorage.setItem(ALARMS_KEY, JSON.stringify(arr)); }
function pushAlarm(topic, value, type){
  const alarms = loadAlarms();
  const id = 'a' + Date.now();
  const a = { id, ts: new Date().toISOString(), topic, value: Number(value), type, ack: false };
  alarms.unshift(a);
  // keep reasonable size
  if (alarms.length > 200) alarms.length = 200;
  saveAlarms(alarms);
  // broadcast (if alarm page open)
  window.dispatchEvent(new CustomEvent('gen:alarm', { detail: a }));
}

// acknowledgement util (used on alarm page)
window.ackAlarm = function(id){
  const alarms = loadAlarms();
  const idx = alarms.findIndex(x=>x.id===id);
  if(idx>=0){ alarms[idx].ack = true; saveAlarms(alarms); window.dispatchEvent(new CustomEvent('gen:alarm-update')); }
};

// --- alarm checking logic ---
function checkAlarms(topic, value){
  if(topic.endsWith('/rpm') || topic==='gen/rpm'){
    if(value > (ALARM_THRESHOLDS.rpm.high || Infinity)) pushAlarm(topic, value, 'rpm_high');
  } else if(topic.endsWith('/temp') || /temp/.test(topic)){
    if(value > (ALARM_THRESHOLDS.temp.high || Infinity)) pushAlarm(topic, value, 'temp_high');
  } else if(topic.endsWith('/volt') || /volt/.test(topic)){
    if(value < ALARM_THRESHOLDS.volt.low || value > ALARM_THRESHOLDS.volt.high) pushAlarm(topic, value, 'volt_out_of_range');
  }
}

// --- MQTT connection ---
const options = {
  username: MQTT_CONFIG.user,
  password: MQTT_CONFIG.pass,
  keepalive: 30,
  reconnectPeriod: 3000,
  connectTimeout: 5 * 1000,
  clean: true
};

const client = mqtt.connect(MQTT_CONFIG.brokerWs, options);

client.on('connect', () => {
  console.info('[MQTT] connected');
  connStatus.textContent = 'MQTT: connected';
  connStatus.style.color = '#9fe49f';
  MQTT_CONFIG.topics.forEach(t => client.subscribe(t, { qos: 0 }));
});

client.on('reconnect', () => {
  connStatus.textContent = 'MQTT: reconnecting...';
  connStatus.style.color = '#f4c860';
});

client.on('close', () => {
  connStatus.textContent = 'MQTT: disconnected';
  connStatus.style.color = '#f28b82';
});

client.on('error', (err) => {
  console.error('[MQTT] error', err);
  connStatus.textContent = 'MQTT: error';
  connStatus.style.color = '#f28b82';
});

client.on('message', (topic, payload) => {
  const msg = payload.toString();
  const v = parseFloat(msg);
  // persist history
  addHistoryEntry(topic, isNaN(v) ? msg : v);
  // update charts & last values
  if(topic === 'gen/rpm') {
    if(!isNaN(v)){ pushToChart(chartRPM, v); lastRpm.textContent = v; }
  } else if(topic === 'gen/temp') {
    if(!isNaN(v)){ pushToChart(chartTemp, v); lastTemp.textContent = v; }
  } else if(topic === 'gen/volt') {
    if(!isNaN(v)){ pushToChart(chartVolt, v); lastVolt.textContent = v; }
  } else {
    // other topics can be supported
    console.log('Topic', topic, msg);
  }

  // alarm check
  if(!isNaN(v)) checkAlarms(topic, v);

  // notify history page (if open)
  window.dispatchEvent(new CustomEvent('gen:data', { detail: { topic, value: msg, ts: new Date().toISOString() } }));
});

// --- initial hydration of charts from history recent points ---
(function hydrateFromHistory(){
  const hist = loadHistory().slice(-120); // last N
  hist.forEach(entry => {
    const t = entry.topic;
    const v = Number(entry.value);
    if(t === 'gen/rpm') pushToChart(chartRPM, v);
    else if(t === 'gen/temp') pushToChart(chartTemp, v);
    else if(t === 'gen/volt') pushToChart(chartVolt, v);
  });
})();
