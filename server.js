const express = require('express');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// SECURITY HEADERS
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self' * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' * ws: wss:;");
    next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DATABASE
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/generator_monitoring', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ MongoDB Connected');
    loadThresholdsFromDB(); // Load threshold saat server nyala
})
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- SCHEMAS ---
const generatorDataSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    deviceId: { type: String, required: true },
    rpm: Number, volt: Number, amp: Number, power: Number,
    freq: Number, temp: Number, coolant: Number, fuel: Number,
    sync: String, status: String, oil: Number, iat: Number,
    map: Number, afr: Number, tps: Number
});
const GeneratorData = mongoose.model('GeneratorData', generatorDataSchema);

const alertSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    deviceId: String,
    parameter: String,
    value: Number,
    message: String,
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    resolved: { type: Boolean, default: false }
});
const Alert = mongoose.model('Alert', alertSchema);

// NEW: Schema untuk menyimpan Konfigurasi Threshold
const configSchema = new mongoose.Schema({
    key: { type: String, unique: true }, // e.g. "engine_thresholds"
    value: Object // Menyimpan object JSON threshold
});
const Config = mongoose.model('Config', configSchema);

// --- DYNAMIC THRESHOLDS ---
// Default values (jika db kosong)
let ACTIVE_THRESHOLDS = {
    rpm: { max: 3800 },
    temp: { max: 95 },
    volt: { min: 180, max: 250 },
    fuel: { min: 20 },
    oil: { min: 20 },
    amp: { max: 100 },
    freq: { min: 48, max: 52 }
};

// Fungsi Load dari DB ke Memory Server
async function loadThresholdsFromDB() {
    try {
        let conf = await Config.findOne({ key: 'engine_thresholds' });
        if (conf) {
            ACTIVE_THRESHOLDS = { ...ACTIVE_THRESHOLDS, ...conf.value };
            console.log('⚙️ Thresholds Loaded from DB:', ACTIVE_THRESHOLDS);
        } else {
            // Jika belum ada, buat default
            await new Config({ key: 'engine_thresholds', value: ACTIVE_THRESHOLDS }).save();
            console.log('⚙️ Default Thresholds Created');
        }
    } catch (e) { console.error('Config Load Error:', e); }
}

// --- MQTT LOGIC ---
const mqttClient = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://10.28.88.227:1883', {
    username: process.env.MQTT_USERNAME || '/TA20:TA20',
    password: process.env.MQTT_PASSWORD || 'TA242501020'
});

let latestData = {
    deviceId: 'ESP32_GENERATOR_01', timestamp: new Date(),
    rpm: 0, volt: 0, amp: 0, power: 0, freq: 0, temp: 0, coolant: 0,
    fuel: 0, sync: 'OFF-GRID', status: 'STOPPED', oil: 0, iat: 0, map: 0, afr: 0, tps: 0
};

mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT Broker');
    mqttClient.subscribe('gen/#');
});

// LOGIC ALARM DINAMIS (Menggunakan ACTIVE_THRESHOLDS)
async function checkAndSaveAlerts(data) {
    const alertsToSave = [];
    const T = ACTIVE_THRESHOLDS; // Gunakan variabel dinamis

    // Helper check
    const check = (param, val) => {
        if (!T[param]) return;
        if (T[param].max && val > T[param].max) {
            alertsToSave.push({ parameter: param, value: val, message: `${param.toUpperCase()} Too High (> ${T[param].max})`, severity: 'critical' });
        }
        if (T[param].min && val < T[param].min) {
            alertsToSave.push({ parameter: param, value: val, message: `${param.toUpperCase()} Too Low (< ${T[param].min})`, severity: 'medium' });
        }
    };

    // Check semua parameter
    check('rpm', data.rpm);
    check('coolant', data.coolant); // atau data.temp
    check('volt', data.volt);
    check('fuel', data.fuel);
    check('oil', data.oil);
    // Tambahkan parameter lain jika perlu

    if (alertsToSave.length > 0) {
        const lastAlert = await Alert.findOne().sort({ timestamp: -1 });
        const timeDiff = lastAlert ? (new Date() - lastAlert.timestamp) : 9999999;
        
        if (timeDiff > 60000) { 
            for (const a of alertsToSave) {
                await new Alert({ ...a, deviceId: data.deviceId }).save();
                console.log(`⚠️ Alert: ${a.message}`);
            }
        }
    }
}

mqttClient.on('message', async (topic, message) => {
    try {
        const value = message.toString();
        switch(topic) {
            case 'gen/rpm': latestData.rpm = parseInt(value) || 0; break;
            case 'gen/volt': latestData.volt = parseFloat(value) || 0; break;
            case 'gen/amp': latestData.amp = parseFloat(value) || 0; break;
            case 'gen/power': latestData.power = parseFloat(value) || 0; break;
            case 'gen/freq': latestData.freq = parseFloat(value) || 0; break;
            case 'gen/temp': latestData.temp = parseFloat(value) || 0; latestData.coolant = latestData.temp; break;
            case 'gen/fuel': latestData.fuel = parseFloat(value) || 0; break;
            case 'gen/sync': latestData.sync = value; break;
            case 'gen/oil': latestData.oil = parseFloat(value) || 0; break;
            case 'gen/iat': latestData.iat = parseFloat(value) || 0; break;
            case 'gen/map': latestData.map = parseFloat(value) || 0; break;
            case 'gen/afr': latestData.afr = parseFloat(value) || 0; break;
            case 'gen/tps': latestData.tps = parseFloat(value) || 0; break;
            
            case 'gen/status': 
                latestData.status = value;
                latestData.timestamp = new Date();
                try {
                    await new GeneratorData(latestData).save();
                    await checkAndSaveAlerts(latestData);
                } catch (saveErr) { console.error('❌ DB Save Error:', saveErr.message); }
                break;
        }
    } catch (error) { console.error('❌ MQTT Error:', error); }
});

// --- API ENDPOINTS ---

app.get('/api/engine-data/latest', async (req, res) => {
    try {
        const dbData = await GeneratorData.findOne().sort({ timestamp: -1 });
        const isDbFresh = dbData && (new Date() - dbData.timestamp < 15000);
        res.json({ success: true, data: isDbFresh ? dbData : latestData });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// 2. GET History Data (Updated for Date Filter)
app.get('/api/engine-data/history', async (req, res) => {
    try {
        const { limit = 1000, hours, startDate, endDate } = req.query;
        let query = {};

        // Jika ada filter tanggal spesifik dari Frontend
        if (startDate && endDate) {
            // Set start date ke 00:00:00 dan end date ke 23:59:59
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            
            const end = new Date(endDate);
            end.setHours(23,59,59,999);

            query.timestamp = {
                $gte: start,
                $lte: end
            };
        } 
        // Fallback ke filter jam (default logic)
        else {
            const h = parseInt(hours) || 24;
            const cutoff = new Date(Date.now() - (h * 60 * 60 * 1000));
            query.timestamp = { $gte: cutoff };
        }

        const data = await GeneratorData.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
            
        res.json({ success: true, count: data.length, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/alerts', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const alerts = await Alert.find().sort({ timestamp: -1 }).limit(parseInt(limit));
        res.json({ success: true, data: alerts });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/engine-data/stats', async (req, res) => {
    try {
        const last24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000));
        const stats = await GeneratorData.aggregate([
            { $match: { timestamp: { $gte: last24Hours } } },
            { $group: { _id: null, avgRPM: { $avg: "$rpm" }, avgVoltage: { $avg: "$volt" }, avgPower: { $avg: "$power" }, avgTemp: { $avg: "$temp" }, maxTemp: { $max: "$temp" }, minFuel: { $min: "$fuel" }, totalRecords: { $sum: 1 } } },
            { $project: { _id: 0, avgRPM: 1, avgVoltage: 1, avgPower: 1, avgTemp: 1, maxTemp: 1, minFuel: 1, totalHours: { $divide: [{ $multiply: ["$totalRecords", 5] }, 3600] } } }
        ]);
        res.json({ success: true, data: stats[0] || { avgPower: 0, totalHours: 0 } });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// --- API UNTUK CONFIG THRESHOLD ---

// 1. GET Thresholds (Untuk ditampilkan di Modal Frontend)
app.get('/api/thresholds', (req, res) => {
    res.json({ success: true, data: ACTIVE_THRESHOLDS });
});

// 2. UPDATE Thresholds (Saat user klik Save di Frontend)
app.post('/api/thresholds', async (req, res) => {
    try {
        const newThresholds = req.body; // Expect { param: { min: x, max: y } }
        
        // Merge dengan existing
        ACTIVE_THRESHOLDS = { ...ACTIVE_THRESHOLDS, ...newThresholds };
        
        // Simpan Permanen ke DB
        await Config.findOneAndUpdate(
            { key: 'engine_thresholds' },
            { value: ACTIVE_THRESHOLDS },
            { upsert: true, new: true }
        );
        
        console.log('⚙️ Thresholds Updated:', ACTIVE_THRESHOLDS);
        res.json({ success: true, message: 'Thresholds updated successfully', data: ACTIVE_THRESHOLDS });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'healthy', mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get(/(.*)/, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running: http://localhost:${PORT}`);
});