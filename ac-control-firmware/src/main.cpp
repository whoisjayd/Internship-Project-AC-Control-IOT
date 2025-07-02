#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <IRremoteESP8266.h>
#include <IRac.h>
#include <PubSubClient.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266httpUpdate.h>
#include <DNSServer.h>
#include <vector>

// Configuration constants
const char* CONFIG_FILE = "/config.json";
const char* AC_STATE_FILE = "/ac_state.json";
const char* AP_PASSWORD = "password123";
const uint16_t IR_LED_PIN = 4;  // GPIO4 (D2)
const char* MQTT_BROKER = "13cc21a598da48498cbc4ecab9ba9c6d.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char* MQTT_USERNAME = "MyACControl";
const char* MQTT_PASSWORD = "MyAC@Control1";
const char* API_KEY = "123dasd12313dsasdas";
const char* API_BASE_URL = "https://accontrolapi-922006260296.us-central1.run.app";
const char* FIRMWARE_VERSION = "1.0.2";
const unsigned long TELEMETRY_INTERVAL = 30000;  // 30 seconds
const unsigned long RECONNECT_INTERVAL = 5000;   // Initial reconnect delay
const unsigned long MAX_RECONNECT_INTERVAL = 30000; // Max reconnect delay
const int HTTP_TIMEOUT = 20000; // 5 seconds timeout for HTTP requests
const int MQTT_BUFFER_SIZE = 1024; // Increased MQTT buffer size

// Global objects
ESP8266WebServer server(80);
DNSServer dnsServer;
IRac ac(IR_LED_PIN);
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// Configuration structure
struct Config {
  String wifi_ssid;
  String wifi_password;
  String customer_id;
  String zone_id;
  String ac_brand;
  String ac_protocol;
  String firmware_version;
};

// AC state structure
struct ACState {
  bool power = false;
  stdAc::opmode_t mode = stdAc::opmode_t::kCool;
  int degrees = 25;
  stdAc::fanspeed_t fanspeed = stdAc::fanspeed_t::kMedium;
};

// Brand-protocol mapping
struct BrandProtocol {
  const char* brand;
  std::vector<decode_type_t> protocols;
};

const std::vector<BrandProtocol> brandProtocols = {
  {"airton", {decode_type_t::AIRTON}},
  {"airwell", {decode_type_t::AIRWELL}},
  {"amcor", {decode_type_t::AMCOR}},
  {"argo", {decode_type_t::ARGO}},
  {"bosch", {decode_type_t::BOSCH144}},
  {"carrier", {decode_type_t::CARRIER_AC, decode_type_t::CARRIER_AC40, decode_type_t::CARRIER_AC64, decode_type_t::CARRIER_AC84, decode_type_t::CARRIER_AC128}},
  {"climabutler", {decode_type_t::CLIMABUTLER}},
  {"coolix", {decode_type_t::COOLIX, decode_type_t::COOLIX48}},
  {"corona", {decode_type_t::CORONA_AC}},
  {"daikin", {decode_type_t::DAIKIN, decode_type_t::DAIKIN2, decode_type_t::DAIKIN64, decode_type_t::DAIKIN128, decode_type_t::DAIKIN152, decode_type_t::DAIKIN160, decode_type_t::DAIKIN176, decode_type_t::DAIKIN200, decode_type_t::DAIKIN216, decode_type_t::DAIKIN312}},
  {"delonghi", {decode_type_t::DELONGHI_AC}},
  {"ecoclim", {decode_type_t::ECOCLIM}},
  {"electra", {decode_type_t::ELECTRA_AC}},
  {"fujitsu", {decode_type_t::FUJITSU_AC}},
  {"goodweather", {decode_type_t::GOODWEATHER}},
  {"gorenje", {decode_type_t::GORENJE}},
  {"gree", {decode_type_t::GREE}},
  {"haier", {decode_type_t::HAIER_AC, decode_type_t::HAIER_AC_YRW02, decode_type_t::HAIER_AC160, decode_type_t::HAIER_AC176}},
  {"hitachi", {decode_type_t::HITACHI_AC, decode_type_t::HITACHI_AC1, decode_type_t::HITACHI_AC2, decode_type_t::HITACHI_AC3, decode_type_t::HITACHI_AC264, decode_type_t::HITACHI_AC296, decode_type_t::HITACHI_AC344, decode_type_t::HITACHI_AC424}},
  {"kelon", {decode_type_t::KELON, decode_type_t::KELON168}},
  {"kelvinator", {decode_type_t::KELVINATOR}},
  {"lg", {decode_type_t::LG}},
  {"midea", {decode_type_t::MIDEA, decode_type_t::MIDEA24}},
  {"mirage", {decode_type_t::MIRAGE}},
  {"mitsubishi", {decode_type_t::MITSUBISHI_AC, decode_type_t::MITSUBISHI112, decode_type_t::MITSUBISHI136, decode_type_t::MITSUBISHI_HEAVY_88, decode_type_t::MITSUBISHI_HEAVY_152}},
  {"neoclima", {decode_type_t::NEOCLIMA}},
  {"panasonic", {decode_type_t::PANASONIC_AC, decode_type_t::PANASONIC_AC32}},
  {"rhoss", {decode_type_t::RHOSS}},
  {"samsung", {decode_type_t::SAMSUNG_AC}},
  {"sanyo", {decode_type_t::SANYO_AC, decode_type_t::SANYO_AC88, decode_type_t::SANYO_AC152}},
  {"sharp", {decode_type_t::SHARP_AC}},
  {"tcl", {decode_type_t::TCL96AC, decode_type_t::TCL112AC}},
  {"technibel", {decode_type_t::TECHNIBEL_AC}},
  {"teco", {decode_type_t::TECO}},
  {"teknopoint", {decode_type_t::TEKNOPOINT}},
  {"toshiba", {decode_type_t::TOSHIBA_AC}},
  {"transcold", {decode_type_t::TRANSCOLD}},
  {"trotec", {decode_type_t::TROTEC, decode_type_t::TROTEC_3550}},
  {"truma", {decode_type_t::TRUMA}},
  {"vestel", {decode_type_t::VESTEL_AC}},
  {"voltas", {decode_type_t::VOLTAS}},
  {"whirlpool", {decode_type_t::WHIRLPOOL_AC}},
  {"york", {decode_type_t::YORK}}
};

// Global variables
Config config;
ACState acState;
bool isAPMode = false;
unsigned long lastTelemetryTime = 0;
bool testingProtocol = false;
size_t currentProtocolIndex = 0;
std::vector<decode_type_t> protocolsToTest;
unsigned long lastReconnectAttempt = 0;
unsigned long reconnectDelay = RECONNECT_INTERVAL;

// Function prototypes
void loadConfig();
void saveConfig();
void loadACState();
void saveACState();
void enterAPMode();
void handleWiFiSetupPage();
void handleWiFiSubmit();
void handleConfigPage();
void handleConfigSubmit();
void handleTestProtocol();
void handleTestResult();
void connectToWiFi();
void startNormalWebServer();
void handleNormalPage();
void handleReset();
void connectToMQTT();
void publishStatus();
void publishTelemetry();
void publishError(const String& errorType, const String& errorMessage);
void mqttCallback(char* topic, byte* payload, unsigned int length);
void sendIRSignal(const String& command, const String& value);
void performOTAUpdate(const String& url, const String& newVersion);
String getMACAddress();
bool validateZoneID(const String& customerId, const String& zoneId);
bool registerDevice();
decode_type_t getProtocolFromString(const String& protocolStr);
void testNextProtocol();
String generateUniqueSSID();

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  Serial.println("[SETUP] Starting ESP8266 AC Control...");

  if (!LittleFS.begin()) {
    Serial.println("[SETUP] Failed to mount LittleFS");
    return;
  }
  Serial.println("[SETUP] LittleFS mounted successfully");

  // Set MQTT buffer size
  mqttClient.setBufferSize(MQTT_BUFFER_SIZE);
  Serial.println("[SETUP] MQTT buffer size set to " + String(MQTT_BUFFER_SIZE) + " bytes");

  loadConfig();
  loadACState();

  if (config.wifi_ssid.isEmpty()) {
    Serial.println("[SETUP] No Wi-Fi config found, entering AP mode");
    enterAPMode();
  } else {
    Serial.println("[SETUP] Attempting to connect to Wi-Fi: " + config.wifi_ssid);
    connectToWiFi();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("[SETUP] Wi-Fi connected, starting normal operation");
      startNormalWebServer();
      connectToMQTT();
    } else {
      Serial.println("[SETUP] Wi-Fi connection failed, entering AP mode");
      enterAPMode();
    }
  }
}

void loop() {
  if (isAPMode) {
    dnsServer.processNextRequest();
    server.handleClient();
  } else {
    server.handleClient();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[LOOP] Wi-Fi disconnected, attempting to reconnect");
      connectToWiFi();
    }
    if (WiFi.status() == WL_CONNECTED) {
      if (!mqttClient.connected()) {
        unsigned long currentTime = millis();
        if (currentTime - lastReconnectAttempt >= reconnectDelay) {
          lastReconnectAttempt = currentTime;
          Serial.println("[LOOP] MQTT disconnected, attempting to reconnect");
          connectToMQTT();
          reconnectDelay = min(reconnectDelay * 2, MAX_RECONNECT_INTERVAL);
        }
      } else {
        mqttClient.loop();
        reconnectDelay = RECONNECT_INTERVAL;
      }
    }

    unsigned long currentTime = millis();
    if (currentTime - lastTelemetryTime >= TELEMETRY_INTERVAL && mqttClient.connected()) {
      lastTelemetryTime = currentTime;
      Serial.println("[LOOP] Publishing periodic telemetry");
      publishTelemetry();
    }
  }
}

String generateUniqueSSID() {
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  String uniquePart = mac.substring(mac.length() - 6);
  String ssid = "AC_Control_" + uniquePart;
  Serial.println("[SSID] Generated unique SSID: " + ssid);
  return ssid;
}

void loadConfig() {
  Serial.println("[CONFIG] Loading configuration from " + String(CONFIG_FILE));
  if (LittleFS.exists(CONFIG_FILE)) {
    File file = LittleFS.open(CONFIG_FILE, "r");
    if (file) {
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, file);
      if (!error) {
        config.wifi_ssid = doc["wifi_ssid"] | "";
        config.wifi_password = doc["wifi_password"] | "";
        config.customer_id = doc["customer_id"] | "";
        config.zone_id = doc["zone_id"] | "";
        config.ac_brand = doc["ac_brand"] | "";
        config.ac_protocol = doc["ac_protocol"] | "";
        config.firmware_version = doc["firmware_version"] | FIRMWARE_VERSION;
        Serial.println("[CONFIG] Configuration loaded: SSID=" + config.wifi_ssid + ", CustomerID=" + config.customer_id);
      } else {
        Serial.println("[CONFIG] Failed to parse config file: " + String(error.c_str()));
      }
      file.close();
    } else {
      Serial.println("[CONFIG] Failed to open config file");
    }
  } else {
    Serial.println("[CONFIG] Config file does not exist");
  }
}

void saveConfig() {
  Serial.println("[CONFIG] Saving configuration to " + String(CONFIG_FILE));
  File file = LittleFS.open(CONFIG_FILE, "w");
  if (file) {
    StaticJsonDocument<512> doc;
    doc["wifi_ssid"] = config.wifi_ssid;
    doc["wifi_password"] = config.wifi_password;
    doc["customer_id"] = config.customer_id;
    doc["zone_id"] = config.zone_id;
    doc["ac_brand"] = config.ac_brand;
    doc["ac_protocol"] = config.ac_protocol;
    doc["firmware_version"] = config.firmware_version;
    if (serializeJson(doc, file) == 0) {
      Serial.println("[CONFIG] Failed to write config file");
    } else {
      Serial.println("[CONFIG] Configuration saved successfully");
    }
    file.close();
  } else {
    Serial.println("[CONFIG] Failed to open config file for writing");
  }
}

void loadACState() {
  Serial.println("[AC_STATE] Loading AC state from " + String(AC_STATE_FILE));
  if (LittleFS.exists(AC_STATE_FILE)) {
    File file = LittleFS.open(AC_STATE_FILE, "r");
    if (file) {
      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, file);
      if (!error) {
        acState.power = doc["power"] | false;
        String modeStr = doc["mode"] | "cool";
        if (modeStr == "auto") acState.mode = stdAc::opmode_t::kAuto;
        else if (modeStr == "cool") acState.mode = stdAc::opmode_t::kCool;
        else if (modeStr == "heat") acState.mode = stdAc::opmode_t::kHeat;
        else if (modeStr == "dry") acState.mode = stdAc::opmode_t::kDry;
        else if (modeStr == "fan") acState.mode = stdAc::opmode_t::kFan;
        acState.degrees = doc["degrees"] | 25;
        String fanStr = doc["fanspeed"] | "medium";
        if (fanStr == "auto") acState.fanspeed = stdAc::fanspeed_t::kAuto;
        else if (fanStr == "min") acState.fanspeed = stdAc::fanspeed_t::kMin;
        else if (fanStr == "medium") acState.fanspeed = stdAc::fanspeed_t::kMedium;
        else if (fanStr == "max") acState.fanspeed = stdAc::fanspeed_t::kMax;
        Serial.println("[AC_STATE] AC state loaded: Power=" + String(acState.power) + ", Mode=" + modeStr + ", Temp=" + String(acState.degrees));
      } else {
        Serial.println("[AC_STATE] Failed to parse AC state file: " + String(error.c_str()));
      }
      file.close();
    } else {
      Serial.println("[AC_STATE] Failed to open AC state file");
    }
  } else {
    Serial.println("[AC_STATE] AC state file does not exist");
  }
}

void saveACState() {
  Serial.println("[AC_STATE] Saving AC state to " + String(AC_STATE_FILE));
  File file = LittleFS.open(AC_STATE_FILE, "w");
  if (file) {
    StaticJsonDocument<256> doc;
    doc["power"] = acState.power;
    switch (acState.mode) {
      case stdAc::opmode_t::kAuto: doc["mode"] = "auto"; break;
      case stdAc::opmode_t::kCool: doc["mode"] = "cool"; break;
      case stdAc::opmode_t::kHeat: doc["mode"] = "heat"; break;
      case stdAc::opmode_t::kDry: doc["mode"] = "dry"; break;
      case stdAc::opmode_t::kFan: doc["mode"] = "fan"; break;
      default: doc["mode"] = "cool";
    }
    doc["degrees"] = acState.degrees;
    switch (acState.fanspeed) {
      case stdAc::fanspeed_t::kAuto: doc["fanspeed"] = "auto"; break;
      case stdAc::fanspeed_t::kMin: doc["fanspeed"] = "min"; break;
      case stdAc::fanspeed_t::kMedium: doc["fanspeed"] = "medium"; break;
      case stdAc::fanspeed_t::kMax: doc["fanspeed"] = "max"; break;
      default: doc["fanspeed"] = "medium";
    }
    String payload;
    serializeJson(doc, payload);
    Serial.println("[AC_STATE] Saving payload: " + payload);
    if (serializeJson(doc, file) == 0) {
      Serial.println("[AC_STATE] Failed to write AC state file");
    } else {
      Serial.println("[AC_STATE] AC state saved successfully");
    }
    file.close();
  } else {
    Serial.println("[AC_STATE] Failed to open AC state file for writing");
  }
}

void enterAPMode() {
  isAPMode = true;
  String apSSID = generateUniqueSSID();
  WiFi.softAP(apSSID.c_str(), AP_PASSWORD);
  Serial.println("[AP_MODE] Started AP Mode. SSID: " + apSSID + ", IP: " + WiFi.softAPIP().toString());

  dnsServer.start(53, "*", WiFi.softAPIP());

  server.on("/", HTTP_GET, handleWiFiSetupPage);
  server.on("/submit", HTTP_POST, handleWiFiSubmit);
  server.onNotFound([]() {
    Serial.println("[WEB_SERVER] Redirecting unknown request to /");
    server.sendHeader("Location", "/", true);
    server.send(302, "text/plain", "");
  });

  server.begin();
  Serial.println("[AP_MODE] Web server started in AP mode");
}

void handleWiFiSetupPage() {
  Serial.println("[WEB_SERVER] Serving Wi-Fi setup page");
  String html = "<html><body><h1>Wi-Fi Setup</h1><form action='/submit' method='POST'>";
  html += "<label>Wi-Fi SSID:</label><select name='ssid'>";
  int n = WiFi.scanNetworks();
  Serial.println("[WEB_SERVER] Found " + String(n) + " Wi-Fi networks");
  for (int i = 0; i < n; ++i) {
    html += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) + "</option>";
  }
  html += "</select><br>";
  html += "<label>Wi-Fi Password:</label><input type='password' name='password'><br>";
  html += "<input type='submit' value='Save Wi-Fi Settings'>";
  html += "</form></body></html>";
  server.send(200, "text/html", html);
}

void handleWiFiSubmit() {
  config.wifi_ssid = server.arg("ssid");
  config.wifi_password = server.arg("password");
  Serial.println("[WEB_SERVER] Wi-Fi setup submitted: SSID=" + config.wifi_ssid);

  if (config.wifi_ssid.isEmpty()) {
    Serial.println("[WEB_SERVER] Error: Wi-Fi SSID is required");
    server.send(400, "text/plain", "Wi-Fi SSID is required");
    return;
  }

  saveConfig();
  WiFi.softAPdisconnect(true);
  dnsServer.stop();
  Serial.println("[WEB_SERVER] AP mode disabled, attempting Wi-Fi connection");
  connectToWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WEB_SERVER] Wi-Fi setup complete, rebooting...");
    server.send(200, "text/plain", "Wi-Fi setup complete. Rebooting...");
    delay(1000);
    ESP.restart();
  } else {
    Serial.println("[WEB_SERVER] Failed to connect to Wi-Fi");
    server.send(500, "text/plain", "Failed to connect to Wi-Fi. Please try again.");
  }
}

void handleConfigPage() {
  Serial.println("[WEB_SERVER] Serving device configuration page");
  String html = "<html><body><h1>Device Configuration</h1><form action='/config' method='POST'>";
  html += "<label>Customer ID:</label><input type='text' name='customer_id'><br>";
  html += "<label>Zone ID:</label><input type='text' name='zone_id'><br>";
  html += "<label>AC Brand:</label><select name='ac_brand'>";
  for (const auto& bp : brandProtocols) {
    html += "<option value='" + String(bp.brand) + "'>" + String(bp.brand) + "</option>";
  }
  html += "</select><br>";
  html += "<label><input type='checkbox' name='skip_testing' value='true'> Skip AC protocol testing (uses first available protocol)</label><br>";
  html += "<input type='submit' value='Save and Proceed'>";
  html += "</form></body></html>";
  server.send(200, "text/html", html);
}

void handleConfigSubmit() {
  config.customer_id = server.arg("customer_id");
  config.zone_id = server.arg("zone_id");
  config.ac_brand = server.arg("ac_brand");
  bool skipTesting = server.arg("skip_testing") == "true";
  Serial.println("[WEB_SERVER] Configuration submitted: CustomerID=" + config.customer_id + ", ZoneID=" + config.zone_id + ", ACBrand=" + config.ac_brand + ", SkipTesting=" + String(skipTesting));

  if (config.customer_id.isEmpty() || config.zone_id.isEmpty() || config.ac_brand.isEmpty()) {
    Serial.println("[WEB_SERVER] Error: Missing required fields");
    server.send(400, "text/plain", "Please fill in all required fields");
    return;
  }

  if (!validateZoneID(config.customer_id, config.zone_id)) {
    Serial.println("[WEB_SERVER] Error: Invalid Zone ID or not related to Customer ID");
    server.send(400, "text/plain", "Invalid Zone ID or not related to Customer ID");
    return;
  }

  protocolsToTest.clear();
  for (const auto& bp : brandProtocols) {
    if (config.ac_brand.equalsIgnoreCase(bp.brand)) {
      protocolsToTest = bp.protocols;
      Serial.println("[WEB_SERVER] Found " + String(protocolsToTest.size()) + " protocols for brand " + config.ac_brand);
      break;
    }
  }

  if (protocolsToTest.empty()) {
    Serial.println("[WEB_SERVER] Error: Selected brand is not supported");
    server.send(400, "text/plain", "Selected brand is not supported");
    return;
  }

  if (skipTesting) {
    for (size_t i = 0; i < protocolsToTest.size(); i++) {
      if (ac.isProtocolSupported(protocolsToTest[i])) {
        config.ac_protocol = String((int)protocolsToTest[i]);
        config.firmware_version = FIRMWARE_VERSION;
        saveConfig();
        if (registerDevice()) {
          Serial.println("[WEB_SERVER] Setup complete, rebooting...");
          server.send(200, "text/plain", "Setup complete. Rebooting...");
          delay(1000);
          ESP.restart();
        } else {
          Serial.println("[WEB_SERVER] Error: Failed to register device");
          server.send(500, "text/plain", "Failed to register device. Please try again.");
        }
        return;
      }
    }
    Serial.println("[WEB_SERVER] Error: No supported protocols found for brand");
    server.send(400, "text/plain", "No supported protocols found for the selected brand");
    return;
  }

  testingProtocol = true;
  currentProtocolIndex = 0;
  Serial.println("[WEB_SERVER] Starting protocol testing");
  testNextProtocol();
}

void handleTestProtocol() {
  if (!testingProtocol) {
    Serial.println("[WEB_SERVER] Error: No protocol testing in progress");
    server.send(400, "text/plain", "No protocol testing in progress");
    return;
  }

  Serial.println("[WEB_SERVER] Serving protocol test page for protocol " + String(currentProtocolIndex + 1));
  String html = "<html><body><h1>Testing AC Protocol</h1>";
  html += "<p>Brand: " + config.ac_brand + "</p>";
  html += "<p>Testing protocol " + String(currentProtocolIndex + 1) + " of " + String(protocolsToTest.size()) + "</p>";
  html += "<p>Please check if your AC turned on. Did it respond?</p>";
  html += "<form action='/result' method='POST'>";
  html += "<input type='hidden' name='success' value='yes'><input type='submit' value='Yes, it worked'>";
  html += "</form>";
  html += "<form action='/result' method='POST'>";
  html += "<input type='hidden' name='success' value='no'><input type='submit' value='No, try next'>";
  html += "</form></body></html>";
  server.send(200, "text/html", html);
}

void handleTestResult() {
  if (!testingProtocol) {
    Serial.println("[WEB_SERVER] Error: No protocol testing in progress");
    server.send(400, "text/plain", "No protocol testing in progress");
    return;
  }

  String success = server.arg("success");
  Serial.println("[WEB_SERVER] Protocol test result: " + success);
  if (success == "yes") {
    config.ac_protocol = String((int)protocolsToTest[currentProtocolIndex]);
    config.firmware_version = FIRMWARE_VERSION;
    saveConfig();
    testingProtocol = false;
    if (registerDevice()) {
      Serial.println("[WEB_SERVER] Protocol test successful, setup complete, rebooting...");
      server.send(200, "text/plain", "Setup complete. Rebooting...");
      delay(1000);
      ESP.restart();
    } else {
      Serial.println("[WEB_SERVER] Error: Failed to register device");
      server.send(500, "text/plain", "Failed to register device. Please try again.");
    }
  } else {
    currentProtocolIndex++;
    if (currentProtocolIndex < protocolsToTest.size()) {
      testNextProtocol();
    } else {
      testingProtocol = false;
      Serial.println("[WEB_SERVER] Error: No working protocol found for " + config.ac_brand);
      String html = "<html><body><h1>No Working Protocol Found</h1>";
      html += "<p>No protocol worked for " + config.ac_brand + ".</p>";
      html += "<p>Please check your AC brand or ensure the device is pointed at the AC.</p>";
      html += "<a href='/config'>Try again</a></body></html>";
      server.send(400, "text/html", html);
    }
  }
}

void testNextProtocol() {
  if (currentProtocolIndex >= protocolsToTest.size()) {
    testingProtocol = false;
    Serial.println("[IR_TEST] No more protocols to test for " + config.ac_brand);
    String html = "<html><body><h1>No More Protocols</h1>";
    html += "<p>All protocols tested for " + config.ac_brand + ". None worked.</p>";
    html += "<p>Please check your AC brand or try again.</p>";
    html += "<a href='/config'>Back to setup</a></body></html>";
    server.send(400, "text/html", html);
    return;
  }

  decode_type_t protocol = protocolsToTest[currentProtocolIndex];
  Serial.println("[IR_TEST] Testing protocol " + String(currentProtocolIndex + 1) + " of " + String(protocolsToTest.size()) + ": " + String((int)protocol));
  if (!ac.isProtocolSupported(protocol)) {
    Serial.println("[IR_TEST] Protocol " + String((int)protocol) + " not supported, skipping");
    currentProtocolIndex++;
    testNextProtocol();
    return;
  }

  ac.next.protocol = protocol;
  ac.next.model = 1;
  ac.next.power = true;
  ac.next.mode = stdAc::opmode_t::kCool;
  ac.next.degrees = 25;
  ac.next.fanspeed = stdAc::fanspeed_t::kMedium;

  if (ac.sendAc()) {
    Serial.println("[IR_TEST] IR signal sent successfully for protocol " + String((int)protocol));
    handleTestProtocol();
  } else {
    Serial.println("[IR_TEST] Failed to send IR signal for protocol " + String((int)protocol));
    currentProtocolIndex++;
    testNextProtocol();
  }
}

void connectToWiFi() {
  Serial.println("[WIFI] Connecting to Wi-Fi: " + config.wifi_ssid);
  WiFi.begin(config.wifi_ssid.c_str(), config.wifi_password.c_str());
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Connected to Wi-Fi: " + config.wifi_ssid + ", IP: " + WiFi.localIP().toString() + ", RSSI: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println("[WIFI] Failed to connect to Wi-Fi");
    publishError("WiFi", "Failed to connect to " + config.wifi_ssid);
  }
}

void startNormalWebServer() {
  isAPMode = false;
  Serial.println("[WEB_SERVER] Starting normal web server");
  if (config.customer_id.isEmpty() || config.zone_id.isEmpty() || config.ac_brand.isEmpty() || config.ac_protocol.isEmpty()) {
    Serial.println("[WEB_SERVER] Configuration incomplete, serving config page");
    server.on("/", HTTP_GET, handleConfigPage);
    server.on("/config", HTTP_POST, handleConfigSubmit);
    server.on("/test", HTTP_GET, handleTestProtocol);
    server.on("/result", HTTP_POST, handleTestResult);
  } else {
    Serial.println("[WEB_SERVER] Configuration complete, serving status page");
    server.on("/", HTTP_GET, handleNormalPage);
    server.on("/reset", HTTP_POST, handleReset);
  }
  server.begin();
  Serial.println("[WEB_SERVER] Normal web server started on port 80");
}

void handleNormalPage() {
  Serial.println("[WEB_SERVER] Serving device status page");
  String html = "<html><body><h1>Device Status</h1>";
  html += "<p>Wi-Fi SSID: " + config.wifi_ssid + "</p>";
  html += "<p>RSSI: " + String(WiFi.RSSI()) + " dBm</p>";
  html += "<p>Customer ID: " + config.customer_id + "</p>";
  html += "<p>AC Brand: " + config.ac_brand + "</p>";
  html += "<p>AC Protocol: " + config.ac_protocol + "</p>";
  html += "<p>Zone ID: " + config.zone_id + "</p>";
  html += "<p>MQTT Status: " + String(mqttClient.connected() ? "Connected" : "Disconnected") + "</p>";
  html += "<p>Firmware Version: " + config.firmware_version + "</p>";
  html += "<form action='/reset' method='POST'><input type='submit' value='Reset Device'></form>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleReset() {
  Serial.println("[WEB_SERVER] Device reset requested");
  LittleFS.remove(CONFIG_FILE);
  LittleFS.remove(AC_STATE_FILE);
  server.send(200, "text/plain", "Configuration reset. Rebooting...");
  Serial.println("[WEB_SERVER] Configuration reset, rebooting...");
  delay(1000);
  ESP.restart();
}

void connectToMQTT() {
  if (config.customer_id.isEmpty() || config.zone_id.isEmpty() || config.ac_brand.isEmpty() || config.ac_protocol.isEmpty()) {
    Serial.println("[MQTT] Cannot connect: Configuration incomplete");
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[MQTT] Cannot connect: Wi-Fi not connected");
    connectToWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[MQTT] Wi-Fi connection failed, cannot connect to MQTT");
      return;
    }
  }

  espClient.setInsecure(); // TODO: Use proper TLS certificates in production
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  String deviceId = getMACAddress();
  String clientId = "Wemos-" + deviceId;
  String lwtTopic = "node/" + config.customer_id + "/" + deviceId + "/status";
  String lwtPayload = "offline";

  Serial.println("[MQTT] Attempting connection with Client ID: " + clientId);
  // Use connect method with LWT parameters: clientId, username, password, willTopic, willQoS, willRetain, willMessage
  if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD, lwtTopic.c_str(), 1, true, lwtPayload.c_str())) {
    Serial.println("[MQTT] Connected to broker: " + String(MQTT_BROKER));
    String baseTopic = "node/" + config.customer_id + "/" + deviceId;
    mqttClient.subscribe((baseTopic + "/command/power").c_str());
    mqttClient.subscribe((baseTopic + "/command/mode").c_str());
    mqttClient.subscribe((baseTopic + "/command/temperature").c_str());
    mqttClient.subscribe((baseTopic + "/command/fanspeed").c_str());
    mqttClient.subscribe((baseTopic + "/ota/update").c_str());
    Serial.println("[MQTT] Subscribed to command topics under: " + baseTopic);
    publishStatus();
    publishTelemetry();
  } else {
    Serial.println("[MQTT] Connection failed, state: " + String(mqttClient.state()));
    publishError("MQTT", "Connection failed, state: " + String(mqttClient.state()));
  }
}

void publishStatus() {
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Cannot publish status: Not connected");
    return;
  }
  String topic = "node/" + config.customer_id + "/" + getMACAddress() + "/status";
  String payload = WiFi.status() == WL_CONNECTED ? "online" : "offline";
  Serial.println("[MQTT] Publishing status to " + topic + ": " + payload);
  if (mqttClient.publish(topic.c_str(), payload.c_str(), true)) {
    Serial.println("[MQTT] Status published successfully");
  } else {
    Serial.println("[MQTT] Failed to publish status, state: " + String(mqttClient.state()));
    publishError("MQTT", "Failed to publish status");
  }
}

void publishTelemetry() {
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Cannot publish telemetry: Not connected");
    connectToMQTT();
    return;
  }
  String topic = "node/" + config.customer_id + "/" + getMACAddress() + "/telemetry";
  StaticJsonDocument<256> doc;
  doc["device_id"] = getMACAddress();
  doc["customer_id"] = config.customer_id;
  doc["zone_id"] = config.zone_id;
  doc["ac_brand"] = config.ac_brand;
  doc["ac_protocol"] = config.ac_protocol;
  doc["firmware_version"] = config.firmware_version;
  doc["wifi_ssid"] = config.wifi_ssid;
  doc["rssi"] = WiFi.RSSI();
  doc["ac_power"] = acState.power;
  switch (acState.mode) {
    case stdAc::opmode_t::kAuto: doc["ac_mode"] = "auto"; break;
    case stdAc::opmode_t::kCool: doc["ac_mode"] = "cool"; break;
    case stdAc::opmode_t::kHeat: doc["ac_mode"] = "heat"; break;
    case stdAc::opmode_t::kDry: doc["ac_mode"] = "dry"; break;
    case stdAc::opmode_t::kFan: doc["ac_mode"] = "fan"; break;
    default: doc["ac_mode"] = "cool";
  }
  doc["ac_temperature"] = acState.degrees;
  switch (acState.fanspeed) {
    case stdAc::fanspeed_t::kAuto: doc["ac_fanspeed"] = "auto"; break;
    case stdAc::fanspeed_t::kMin: doc["ac_fanspeed"] = "min"; break;
    case stdAc::fanspeed_t::kMedium: doc["ac_fanspeed"] = "medium"; break;
    case stdAc::fanspeed_t::kMax: doc["ac_fanspeed"] = "max"; break;
    default: doc["ac_fanspeed"] = "medium";
  }
  String payload;
  serializeJson(doc, payload);
  Serial.println("[MQTT] Publishing telemetry to " + topic + ", payload size: " + String(payload.length()) + " bytes");
  Serial.println("[MQTT] Telemetry payload: " + payload);
  if (mqttClient.publish(topic.c_str(), payload.c_str(), true)) {
    Serial.println("[MQTT] Telemetry published successfully");
  } else {
    Serial.println("[MQTT] Failed to publish telemetry, state: " + String(mqttClient.state()));
    publishError("MQTT", "Failed to publish telemetry, state: " + String(mqttClient.state()));
  }
}

void publishError(const String& errorType, const String& errorMessage) {
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Cannot publish error: Not connected");
    return;
  }
  String topic = "node/" + config.customer_id + "/" + getMACAddress() + "/error";
  StaticJsonDocument<256> doc;
  doc["type"] = errorType;
  doc["message"] = errorMessage;
  doc["origin"] = "firmware";
  String payload;
  serializeJson(doc, payload);
  Serial.println("[MQTT] Publishing error to " + topic + ": " + payload);
  if (mqttClient.publish(topic.c_str(), payload.c_str(), true)) {
    Serial.println("[MQTT] Error published successfully");
  } else {
    Serial.println("[MQTT] Failed to publish error, state: " + String(mqttClient.state()));
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  String deviceId = getMACAddress();
  String baseTopic = "node/" + config.customer_id + "/" + deviceId;
  Serial.println("[MQTT] Received message on topic: " + String(topic) + ", payload: " + message);

  if (String(topic) == baseTopic + "/command/power") {
    sendIRSignal("power", message);
  } else if (String(topic) == baseTopic + "/command/mode") {
    sendIRSignal("mode", message);
  } else if (String(topic) == baseTopic + "/command/temperature") {
    sendIRSignal("temperature", message);
  } else if (String(topic) == baseTopic + "/command/fanspeed") {
    sendIRSignal("fanspeed", message);
  } else if (String(topic) == baseTopic + "/ota/update") {
    int commaIndex = message.indexOf(',');
    if (commaIndex != -1) {
      String url = message.substring(0, commaIndex);
      String newVersion = message.substring(commaIndex + 1);
      Serial.println("[MQTT] OTA update requested: URL=" + url + ", Version=" + newVersion);
      performOTAUpdate(url, newVersion);
    } else {
      Serial.println("[MQTT] Error: Invalid OTA message format");
      publishError("OTA", "Invalid OTA message format");
    }
  }
}

void sendIRSignal(const String& command, const String& value) {
  decode_type_t protocol = getProtocolFromString(config.ac_protocol);
  Serial.println("[IR] Sending IR signal: Command=" + command + ", Value=" + value + ", Protocol=" + String((int)protocol));
  if (!ac.isProtocolSupported(protocol)) {
    Serial.println("[IR] Error: Unsupported protocol: " + config.ac_protocol);
    publishError("IR", "Unsupported protocol: " + config.ac_protocol);
    return;
  }
  ac.next.protocol = protocol;
  ac.next.model = 1;

  ac.next.power = acState.power;
  ac.next.mode = acState.mode;
  ac.next.degrees = acState.degrees;
  ac.next.fanspeed = acState.fanspeed;

  if (command == "power") {
    if (value == "on") {
      ac.next.power = true;
    } else if (value == "off") {
      ac.next.power = false;
    } else if (value == "toggle") {
      ac.next.power = !ac.next.power;
    } else {
      Serial.println("[IR] Error: Invalid power command: " + value);
      publishError("IR", "Invalid power command: " + value);
      return;
    }
    acState.power = ac.next.power;
  } else if (command == "mode") {
    if (value == "auto") ac.next.mode = stdAc::opmode_t::kAuto;
    else if (value == "cool") ac.next.mode = stdAc::opmode_t::kCool;
    else if (value == "heat") ac.next.mode = stdAc::opmode_t::kHeat;
    else if (value == "dry") ac.next.mode = stdAc::opmode_t::kDry;
    else if (value == "fan") ac.next.mode = stdAc::opmode_t::kFan;
    else {
      Serial.println("[IR] Error: Invalid mode command: " + value);
      publishError("IR", "Invalid mode command: " + value);
      return;
    }
    ac.next.power = true;
    acState.power = ac.next.power;
    acState.mode = ac.next.mode;
  } else if (command == "temperature") {
    int temp = value.toInt();
    if (temp < 16 || temp > 30) {
      Serial.println("[IR] Error: Invalid temperature value: " + value);
      publishError("IR", "Invalid temperature value: " + value);
      return;
    }
    ac.next.degrees = temp;
    ac.next.power = true;
    acState.power = ac.next.power;
    acState.degrees = ac.next.degrees;
  } else if (command == "fanspeed") {
    if (value == "auto") ac.next.fanspeed = stdAc::fanspeed_t::kAuto;
    else if (value == "low") ac.next.fanspeed = stdAc::fanspeed_t::kMin;
    else if (value == "medium") ac.next.fanspeed = stdAc::fanspeed_t::kMedium;
    else if (value == "high") ac.next.fanspeed = stdAc::fanspeed_t::kMax;
    else {
      Serial.println("[IR] Error: Invalid fanspeed command: " + value);
      publishError("IR", "Invalid fanspeed command: " + value);
      return;
    }
    ac.next.power = true;
    acState.power = ac.next.power;
    acState.fanspeed = ac.next.fanspeed;
  }

  if (!ac.sendAc()) {
    Serial.println("[IR] Error: Failed to send IR signal");
    publishError("IR", "Failed to send IR signal");
  } else {
    Serial.println("[IR] IR signal sent successfully");
    saveACState();
    publishStatus();
    publishTelemetry();
  }
}

void performOTAUpdate(const String& url, const String& newVersion) {
  Serial.println("[OTA] Starting OTA update from URL: " + url + ", New Version: " + newVersion);
  espClient.setTimeout(HTTP_TIMEOUT);
  t_httpUpdate_return ret = ESPhttpUpdate.update(espClient, url);
  switch (ret) {
    case HTTP_UPDATE_OK:
      config.firmware_version = newVersion;
      saveConfig();
      publishStatus();
      publishTelemetry();
      Serial.println("[OTA] Update successful, rebooting...");
      ESP.restart();
      break;
    case HTTP_UPDATE_FAILED:
      Serial.println("[OTA] Update failed: " + String(ESPhttpUpdate.getLastErrorString()));
      publishError("OTA", "Update failed: " + String(ESPhttpUpdate.getLastErrorString()));
      break;
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("[OTA] No update available");
      publishError("OTA", "No update available");
      break;
  }
}

String getMACAddress() {
  String mac = WiFi.macAddress();
  Serial.println("[DEVICE] MAC Address: " + mac);
  return mac;
}

bool validateZoneID(const String& customerId, const String& zoneId) {
  Serial.println("[API] Validating Zone ID: CustomerID=" + customerId + ", ZoneID=" + zoneId);
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API] Error: Wi-Fi not connected");
    publishError("WiFi", "Wi-Fi not connected before zone validation");
    return false;
  }

  IPAddress resolvedIP;
  if (!WiFi.hostByName("accontrolapi-922006260296.us-central1.run.app", resolvedIP)) {
    Serial.println("[API] Error: DNS resolution failed");
    publishError("DNS", "Failed to resolve API hostname");
    return false;
  }
  Serial.println("[API] DNS resolved to: " + resolvedIP.toString());

  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT);
  String url = String(API_BASE_URL) + "/validate-zone";
  
  Serial.println("[API] Free heap before HTTP: " + String(ESP.getFreeHeap()));
  if (!http.begin(secureClient, url)) {
    Serial.println("[API] Error: Failed to initialize HTTP client for zone validation");
    publishError("API", "Failed to initialize HTTP client for zone validation");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Secret", API_KEY);

  StaticJsonDocument<256> doc;
  doc["customer_id"] = customerId;
  doc["zone_id"] = zoneId;
  String payload;
  serializeJson(doc, payload);
  Serial.println("[API] Sending validation payload: " + payload);

  int httpCode = http.POST(payload);
  bool success = false;
  if (httpCode > 0) { // Positive codes indicate a server response
    if (httpCode == 200) {
      String response = http.getString();
      Serial.println("[API] Raw response: " + response);
      StaticJsonDocument<256> respDoc;
      DeserializationError error = deserializeJson(respDoc, response);
      if (!error) {
        success = respDoc["valid"] | false;
        Serial.println("[API] Zone validation result: " + String(success));
      } else {
        Serial.println("[API] Error: Failed to parse zone validation response: " + String(error.c_str()));
        publishError("API", "Failed to parse zone validation response: " + String(error.c_str()));
      }
    } else {
      Serial.println("[API] Error: Zone validation failed with HTTP code: " + String(httpCode));
      publishError("API", "Zone validation failed with HTTP code: " + String(httpCode));
    }
  } else { // Negative codes indicate client-side errors
    Serial.println("[API] Error: HTTP client error with code: " + String(httpCode));
    if (httpCode == HTTPC_ERROR_READ_TIMEOUT) {
      Serial.println("[API] Error: HTTP read timeout occurred");
      publishError("API", "HTTP read timeout occurred");
    } else {
      publishError("API", "HTTP client error with code: " + String(httpCode));
    }
  }
  http.end();
  Serial.println("[API] Free heap after HTTP: " + String(ESP.getFreeHeap()));
  return success;
}

bool registerDevice() {
  Serial.println("[API] Registering device for CustomerID=" + config.customer_id);
  
  // Check Wi-Fi status
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API] Error: Wi-Fi not connected");
    publishError("WiFi", "Wi-Fi not connected before device registration");
    return false;
  }

  // Test DNS resolution
  IPAddress resolvedIP;
  if (!WiFi.hostByName("accontrolapi-922006260296.us-central1.run.app", resolvedIP)) {
    Serial.println("[API] Error: DNS resolution failed");
    publishError("DNS", "Failed to resolve API hostname");
    return false;
  }
  Serial.println("[API] DNS resolved to: " + resolvedIP.toString());

  // Initialize secure client
  WiFiClientSecure secureClient;
  secureClient.setInsecure(); // TODO: Replace with proper certificate validation
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT);
  String url = String(API_BASE_URL) + "/customers/" + config.customer_id + "/devices";
  
  Serial.println("[API] Free heap before HTTP: " + String(ESP.getFreeHeap()));
  if (!http.begin(secureClient, url)) {
    Serial.println("[API] Error: Failed to initialize HTTP client for device registration");
    Serial.println("[API] URL: " + url);
    publishError("API", "Failed to initialize HTTP client for device registration");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Secret", API_KEY);

  StaticJsonDocument<256> doc;
  doc["device_id"] = getMACAddress();
  doc["zone_id"] = config.zone_id;
  doc["ac_brand_name"] = config.ac_brand;
  doc["ac_brand_protocol"] = config.ac_protocol;
  doc["firmware_version"] = config.firmware_version;
  String payload;
  serializeJson(doc, payload);
  Serial.println("[API] Sending registration payload: " + payload);

  int httpCode = http.POST(payload);
  bool success = (httpCode == 201);
  if (httpCode > 0) { // Server responded
    if (!success) {
      String response = http.getString();
      Serial.println("[API] Error: Device registration failed with code: " + String(httpCode));
      Serial.println("[API] Raw response: " + response);
      publishError("API", "Device registration failed with code: " + String(httpCode) + ", response: " + response);
    } else {
      Serial.println("[API] Device registered successfully");
    }
  } else { // Client-side error
    Serial.println("[API] Error: HTTP client error with code: " + String(httpCode));
    if (httpCode == HTTPC_ERROR_READ_TIMEOUT) {
      Serial.println("[API] Error: HTTP read timeout occurred");
      publishError("API", "HTTP read timeout occurred");
    } else {
      publishError("API", "HTTP client error with code: " + String(httpCode));
    }
  }
  http.end();
  Serial.println("[API] Free heap after HTTP: " + String(ESP.getFreeHeap()));
  return success;
}

decode_type_t getProtocolFromString(const String& protocolStr) {
  decode_type_t protocol = (decode_type_t)protocolStr.toInt();
  Serial.println("[IR] Converting protocol string: " + protocolStr + " to decode_type_t: " + String((int)protocol));
  return protocol;
}