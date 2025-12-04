#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Konfigurasi WiFi
const char* ssid = "hai";
const char* password = "hello123";

// Konfigurasi MQTT/RabbitMQ
const int mqtt_port = 1883;
const char* mqtt_server = "10.28.88.227";
const char* mqtt_user = "/TA20:TA20";
const char* mqtt_pass = "TA242501020";
const char* mqtt_topic = "engine/data";

// Pin sensor (sesuaikan dengan koneksi aktual Anda)
const int VOLTAGE_SENSOR_PIN = A0;
const int CURRENT_SENSOR_PIN = A1;
const int OIL_PRESSURE_PIN = A2;
const int COOLANT_TEMP_PIN = A3;
const int RPM_SENSOR_PIN = 2;  // Interrupt pin untuk RPM

// Variabel untuk perhitungan RPM
volatile unsigned long rpmPulseCount = 0;
unsigned long lastRpmTime = 0;

// Interval pengiriman data
const unsigned long SEND_INTERVAL = 5000;
unsigned long lastSendTime = 0;

WiFiClient espClient;
PubSubClient client(espClient);

struct EngineData {
  float volt = 0;
  float amp = 0;
  float power = 0;
  float freq = 0;
  int rpm = 0;
  float oil = 0;
  float coolant = 0;
  float iat = 0;
  float fuel = 0;
  String phase = "SEFASA";
  float afr = 0;
  float map = 0;
  float tps = 0;
  String sync = "ON-GRID";
  String activeTime = "0h 0m";
};

EngineData engineData;

// Interrupt service routine untuk menghitung RPM
void IRAM_ATTR rpmPulse() {
  rpmPulseCount++;
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    String clientId = "ESP32-Engine-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      client.publish("engine/status", "ESP32 Engine Monitor Connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

float readVoltage() {
  // Kalibrasi sesuai sensor voltage Anda
  int raw = analogRead(VOLTAGE_SENSOR_PIN);
  float voltage = (raw / 4095.0) * 3.3 * 100; // Contoh kalibrasi
  return voltage;
}

float readCurrent() {
  // Kalibrasi sesuai sensor current Anda
  int raw = analogRead(CURRENT_SENSOR_PIN);
  float current = (raw / 4095.0) * 3.3 * 10; // Contoh kalibrasi
  return current;
}

float readOilPressure() {
  // Kalibrasi sesuai sensor oil pressure
  int raw = analogRead(OIL_PRESSURE_PIN);
  float pressure = (raw / 4095.0) * 100; // 0-100 PSI
  return pressure;
}

float readCoolantTemp() {
  // Kalibrasi sesuai sensor temperature
  int raw = analogRead(COOLANT_TEMP_PIN);
  float temp = (raw / 4095.0) * 150; // 0-150°C
  return temp;
}

int calculateRPM() {
  unsigned long currentTime = millis();
  unsigned long timeDiff = currentTime - lastRpmTime;
  
  if (timeDiff >= 1000) { // Hitung RPM setiap 1 detik
    noInterrupts();
    unsigned long pulseCount = rpmPulseCount;
    rpmPulseCount = 0;
    interrupts();
    
    // Asumsi: 2 pulse per revolution (sesuaikan dengan sensor Anda)
    float rpm = (pulseCount / 2.0) * (60000.0 / timeDiff);
    lastRpmTime = currentTime;
    return (int)rpm;
  }
  return engineData.rpm; // Return nilai sebelumnya jika belum waktunya
}

void readSensorData() {
  // Baca data dari sensor nyata
  engineData.volt = readVoltage();
  engineData.amp = readCurrent();
  engineData.power = engineData.volt * engineData.amp;
  engineData.rpm = calculateRPM();
  engineData.oil = readOilPressure();
  engineData.coolant = readCoolantTemp();
  
  // Untuk sensor yang tidak tersedia, gunakan nilai default
  engineData.freq = 50.0 + (random(-10, 10) / 100.0);
  engineData.iat = 25.0 + random(-5, 5);
  engineData.fuel = max(0.0, engineData.fuel - 0.1);
  engineData.afr = 14.7 + (random(-20, 20) / 100.0);
  engineData.map = 100.0 + random(-10, 10);
  engineData.tps = 25.0 + random(-5, 5);
  
  updateActiveTime();
}

void updateActiveTime() {
  static unsigned long startTime = millis();
  unsigned long currentTime = millis();
  unsigned long elapsedHours = (currentTime - startTime) / 3600000;
  unsigned long elapsedMinutes = ((currentTime - startTime) % 3600000) / 60000;
  engineData.activeTime = String(elapsedHours) + "h " + String(elapsedMinutes) + "m";
}

void sendData() {
  DynamicJsonDocument doc(1024);
  
  doc["volt"] = engineData.volt;
  doc["amp"] = engineData.amp;
  doc["power"] = engineData.power;
  doc["freq"] = engineData.freq;
  doc["rpm"] = engineData.rpm;
  doc["oil"] = engineData.oil;
  doc["coolant"] = engineData.coolant;
  doc["iat"] = engineData.iat;
  doc["fuel"] = engineData.fuel;
  doc["phase"] = engineData.phase;
  doc["afr"] = engineData.afr;
  doc["map"] = engineData.map;
  doc["tps"] = engineData.tps;
  doc["sync"] = engineData.sync;
  doc["activeTime"] = engineData.activeTime;
  doc["timestamp"] = millis();

  String jsonString;
  serializeJson(doc, jsonString);

  if (client.publish(mqtt_topic, jsonString.c_str())) {
    Serial.println("Data sent:");
    Serial.println(jsonString);
  } else {
    Serial.println("Failed to send data");
  }
}

void setup() {
  Serial.begin(115200);
  
  // Setup pin sensor
  pinMode(VOLTAGE_SENSOR_PIN, INPUT);
  pinMode(CURRENT_SENSOR_PIN, INPUT);
  pinMode(OIL_PRESSURE_PIN, INPUT);
  pinMode(COOLANT_TEMP_PIN, INPUT);
  pinMode(RPM_SENSOR_PIN, INPUT_PULLUP);
  
  // Attach interrupt untuk RPM sensor
  attachInterrupt(digitalPinToInterrupt(RPM_SENSOR_PIN), rpmPulse, RISING);
  
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  randomSeed(analogRead(0));
  
  Serial.println("ESP32 Engine Monitor with Real Sensors Started");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long currentTime = millis();
  
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    readSensorData();
    sendData();
    lastSendTime = currentTime;
  }
  
  delay(100);
}