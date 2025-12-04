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

// Interval pengiriman data (dalam milidetik)
const unsigned long SEND_INTERVAL = 2000; // Kirim data setiap 2 detik
unsigned long lastSendTime = 0;

// Objek WiFi dan MQTT
WiFiClient espClient;
PubSubClient client(espClient);

// Data sensor engine dengan nilai default
struct EngineData {
  float volt = 220.0;          // Voltage (V)
  float amp = 15.0;            // Current (A)
  float power = 3300.0;        // Power (W) - calculated
  float freq = 50.0;           // Frequency (Hz)
  int rpm = 1500;              // RPM
  float oil = 45.0;            // Oil Pressure (PSI)
  float coolant = 85.0;        // Coolant Temp (°C)
  float iat = 35.0;            // Intake Air Temp (°C)
  float fuel = 75.0;           // Fuel Level (%)
  String phase = "SEFASA";     // Phase status
  float afr = 14.7;            // Air Fuel Ratio
  float map = 95.0;            // MAP (kPa)
  float tps = 20.0;            // Throttle Position (%)
  String sync = "ON-GRID";     // Sync Status
  String activeTime = "0h 0m"; // Active Time
  int engineStatus = 1;        // 1 = Running, 0 = Stopped
};

EngineData engineData;

// Variabel untuk simulasi kondisi engine
unsigned long engineStartTime = 0;
bool engineRunning = true;
float fuelConsumptionRate = 0.05; // % per data send

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("");
    Serial.println("Failed to connect to WiFi. Restarting...");
    ESP.restart();
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  // Handle incoming MQTT messages if needed
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // You can add command processing here if needed
  if (message == "START") {
    engineRunning = true;
    engineStartTime = millis();
  } else if (message == "STOP") {
    engineRunning = false;
  }
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    // Attempt to connect
    String clientId = "ESP32-Engine-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      
      // Once connected, publish an announcement...
      String connectMsg = "ESP32 Engine Simulator Connected";
      client.publish("engine/status", connectMsg.c_str());
      
      // Subscribe to commands topic if needed
      client.subscribe("engine/commands");
      
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void generateRealisticData() {
  if (!engineRunning) {
    // Engine is stopped - set minimal values
    engineData.rpm = 0;
    engineData.volt = 12.5 + random(0, 10) / 10.0; // Battery voltage
    engineData.amp = 0.5 + random(0, 5) / 10.0;    // Minimal current
    engineData.power = 0;
    engineData.oil = 0;
    engineData.coolant = 25.0 + random(0, 10);     // Ambient temperature
    engineData.iat = 25.0 + random(0, 10);
    engineData.afr = 0;
    engineData.map = 101.3;                        // Atmospheric pressure
    engineData.tps = 0;
    engineData.sync = "OFF";
    engineData.phase = "STOPPED";
    engineData.engineStatus = 0;
    return;
  }

  // Engine is running - generate realistic data with variations
  engineData.engineStatus = 1;
  
  // Voltage: 220V ± 5V with small fluctuations
  engineData.volt = 218.0 + random(0, 15) / 10.0;
  
  // Current: 10A-30A range with load variations
  float loadVariation = sin(millis() / 10000.0); // Slow oscillation
  engineData.amp = 15.0 + loadVariation * 5.0 + random(0, 10) / 10.0;
  
  // Power: calculated from voltage and current
  engineData.power = engineData.volt * engineData.amp;
  
  // Frequency: 50Hz ± 0.2Hz
  engineData.freq = 49.9 + random(0, 40) / 100.0;
  
  // RPM: 1200-1800 with variations (simulating load changes)
  float rpmVariation = sin(millis() / 8000.0); // Different frequency
  engineData.rpm = 1500 + rpmVariation * 300 + random(-20, 20);
  
  // Oil Pressure: 40-60 PSI
  engineData.oil = 45.0 + random(-8, 8) + (sin(millis() / 15000.0) * 3);
  
  // Coolant Temperature: 80-95°C (warming up and stabilizing)
  unsigned long runningTime = millis() - engineStartTime;
  float targetTemp = 85.0;
  if (runningTime < 300000) { // First 5 minutes - warming up
    targetTemp = 25.0 + (runningTime / 300000.0) * 60.0;
  }
  engineData.coolant = targetTemp + random(-3, 3);
  
  // Intake Air Temperature: 25-45°C (affected by engine heat)
  engineData.iat = 30.0 + (engineData.coolant - 80.0) * 0.1 + random(-5, 5);
  
  // Fuel Level: gradually decreasing
  engineData.fuel = max(0.0, engineData.fuel - fuelConsumptionRate);
  if (engineData.fuel < 5.0) {
    engineData.fuel = 100.0; // Auto-refill for simulation
  }
  
  // Air Fuel Ratio: 13.5-15.5 (stoichiometric around 14.7)
  engineData.afr = 14.5 + random(-10, 10) / 10.0;
  
  // MAP: 90-110 kPa (manifold absolute pressure)
  engineData.map = 95.0 + random(-8, 8) + (loadVariation * 3);
  
  // Throttle Position: 15-35% (simulating small adjustments)
  engineData.tps = 20.0 + random(-8, 8) + (sin(millis() / 12000.0) * 5);
  
  // Randomly change sync status occasionally (2% chance)
  if (random(0, 100) < 2) {
    engineData.sync = (engineData.sync == "ON-GRID") ? "OFF-GRID" : "ON-GRID";
  }
  
  // Randomly change phase status occasionally (1% chance)
  if (random(0, 100) < 1) {
    engineData.phase = (engineData.phase == "SEFASA") ? "TIDAK SEFASA" : "SEFASA";
  }
  
  // Add occasional anomalies (1% chance for each)
  if (random(0, 100) < 1) {
    // Simulate voltage spike/dip
    if (random(0, 2) == 0) {
      engineData.volt += 15.0; // Spike
    } else {
      engineData.volt -= 20.0; // Dip
    }
  }
  
  if (random(0, 100) < 1) {
    // Simulate RPM anomaly
    engineData.rpm += random(200, 500);
  }
  
  if (random(0, 100) < 1 && engineData.coolant > 70) {
    // Simulate overheating
    engineData.coolant += 10.0;
  }
}

void updateActiveTime() {
  if (!engineRunning) {
    engineData.activeTime = "0h 0m";
    return;
  }
  
  unsigned long currentTime = millis();
  unsigned long elapsedTime = currentTime - engineStartTime;
  unsigned long elapsedHours = elapsedTime / 3600000;
  unsigned long elapsedMinutes = (elapsedTime % 3600000) / 60000;
  
  engineData.activeTime = String(elapsedHours) + "h " + String(elapsedMinutes) + "m";
}

void sendData() {
  // Create JSON document
  DynamicJsonDocument doc(1024);
  
  // Add all sensor data to JSON
  doc["volt"] = round(engineData.volt * 10) / 10.0; // 1 decimal
  doc["amp"] = round(engineData.amp * 10) / 10.0;
  doc["power"] = round(engineData.power);
  doc["freq"] = round(engineData.freq * 100) / 100.0; // 2 decimals
  doc["rpm"] = engineData.rpm;
  doc["oil"] = round(engineData.oil);
  doc["coolant"] = round(engineData.coolant);
  doc["iat"] = round(engineData.iat);
  doc["fuel"] = round(engineData.fuel);
  doc["phase"] = engineData.phase;
  doc["afr"] = round(engineData.afr * 10) / 10.0;
  doc["map"] = round(engineData.map);
  doc["tps"] = round(engineData.tps);
  doc["sync"] = engineData.sync;
  doc["activeTime"] = engineData.activeTime;
  doc["engineStatus"] = engineData.engineStatus;
  doc["timestamp"] = millis();

  // Serialize JSON to string
  String jsonString;
  serializeJson(doc, jsonString);

  // Publish to MQTT
  if (client.publish(mqtt_topic, jsonString.c_str())) {
    Serial.println("Data sent successfully:");
    Serial.println(jsonString);
    
    // Also send to debug topic
    client.publish("engine/debug", jsonString.c_str());
  } else {
    Serial.println("Failed to send data");
  }
}

void printStatus() {
  Serial.println("=== Engine Status ===");
  Serial.println("Voltage: " + String(engineData.volt) + " V");
  Serial.println("Current: " + String(engineData.amp) + " A");
  Serial.println("Power: " + String(engineData.power) + " W");
  Serial.println("Frequency: " + String(engineData.freq) + " Hz");
  Serial.println("RPM: " + String(engineData.rpm));
  Serial.println("Oil Pressure: " + String(engineData.oil) + " PSI");
  Serial.println("Coolant Temp: " + String(engineData.coolant) + " °C");
  Serial.println("IAT: " + String(engineData.iat) + " °C");
  Serial.println("Fuel Level: " + String(engineData.fuel) + " %");
  Serial.println("Phase: " + engineData.phase);
  Serial.println("AFR: " + String(engineData.afr));
  Serial.println("MAP: " + String(engineData.map) + " kPa");
  Serial.println("TPS: " + String(engineData.tps) + " %");
  Serial.println("Sync: " + engineData.sync);
  Serial.println("Active Time: " + engineData.activeTime);
  Serial.println("Engine Status: " + String(engineData.engineStatus ? "RUNNING" : "STOPPED"));
  Serial.println("=====================");
}

void setup() {
  Serial.begin(115200);
  
  // Initialize random seed
  randomSeed(analogRead(0));
  
  // Set engine start time
  engineStartTime = millis();
  
  // Initialize WiFi
  setup_wifi();
  
  // Configure MQTT server and callback
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  
  Serial.println("ESP32 Engine Data Generator Started");
  Serial.println("Generating random engine data...");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long currentTime = millis();
  
  // Send data at regular intervals
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    generateRealisticData();
    updateActiveTime();
    sendData();
    printStatus();
    lastSendTime = currentTime;
  }
  
  // Small delay to prevent watchdog timer issues
  delay(100);
}