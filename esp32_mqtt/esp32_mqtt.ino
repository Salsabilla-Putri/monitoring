#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "hai";
const char* password = "hello123";
const int mqtt_port = 1883;
const char* mqtt_server = "10.28.88.227";
const char* mqtt_user = "/TA20:TA20";
const char* mqtt_pass = "TA242501020";
// const char* ssid = "Cloudpath. Lt 2";
// const char* password = "findyourpath.";
// const char* mqtt_server = "generatorta20.cloud.shiftr.io";
// const char* mqtt_user = "generatorta20";
// const char* mqtt_pass = "TA252601020";

WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
  Serial.print("Connecting to WiFi");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  int count = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
    if (++count > 40) { Serial.println("\nFailed to connect WiFi, restarting..."); ESP.restart(); }
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
}

void callback(char* topic, byte* payload, unsigned int length) {
  String data = "";
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    data += String((char)payload[i]);
  }
  Serial.println(data);

}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP8266Client-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("connected!");
      client.subscribe("generator");
      client.publish("gen/status", "CONNECTED");
    } else {
      Serial.print("failed, rc="); 
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // --- Simulasi data generator ---
  float volt = 220.0 + random(-10, 10);
  float amp = 5.0 + random(-2, 2);
  float power = volt * amp / 1000.0; // kW
  float freq = 49.5 + random(-5, 5) * 0.1;
  float temp = 75.0 + random(-3, 3);
  float fuel = random(30, 100);
  int rpm = 2900 + random(-200, 200);

  // Sinkronisasi status: ON-GRID jika RPM > 2800
  String sync = (rpm > 2800) ? "ON-GRID" : "OFF-GRID";

  // --- Kirim ke MQTT ---
  client.publish("gen/rpm", String(rpm).c_str());
  client.publish("gen/volt", String(volt, 1).c_str());
  client.publish("gen/amp", String(amp, 1).c_str());
  client.publish("gen/power", String(power, 2).c_str());
  client.publish("gen/freq", String(freq, 1).c_str());
  client.publish("gen/temp", String(temp, 1).c_str());
  client.publish("gen/fuel", String(fuel, 1).c_str());
  client.publish("gen/sync", sync.c_str());
  client.publish("gen/status", "RUNNING");

  Serial.println("Data sent to broker:");
  Serial.printf("RPM: %d | Volt: %.1f | Amp: %.1f | Power: %.2f | Freq: %.1f | Temp: %.1f | Fuel: %.1f%% | %s\n",
                rpm, volt, amp, power, freq, temp, fuel, sync.c_str());

  delay(5000);
}

