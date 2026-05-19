/*
 * MediTrack IoT Scanner — ESP32-CAM Firmware v2.0
 * 
 * Architecture: ESP32 captures JPEG → sends to backend → backend decodes QR
 * No quirc library needed! All QR decoding happens server-side.
 * 
 * Hardware: ESP32-CAM (AI Thinker) + OV3660 Camera
 * Wiring:
 *   GPIO 15 → Green LED (+ 220Ω → GND)
 *   GPIO 13 → Red LED   (+ 220Ω → GND)
 *   GPIO 14 → Active Buzzer (+), GND → Buzzer (-)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"

// ==============================================
// CONFIGURATION
// ==============================================
const char* WIFI_SSID     = "Yahoo";
const char* WIFI_PASSWORD = "ENTER_PASSWORD";
const char* SERVER_URL    = "http://10.149.219.172:5000/api/scanner/scan-image?deviceId=SCANNER-001";
const char* REGISTER_URL  = "http://10.149.219.172:5000/api/scanner/register";
const char* DEVICE_ID     = "SCANNER-001";

// ==============================================
// PIN DEFINITIONS
// ==============================================
#define GREEN_LED_PIN  15
#define RED_LED_PIN    13
#define BUZZER_PIN     14
#define FLASH_LED_PIN  4

// ==============================================
// CAMERA PINS — AI Thinker ESP32-CAM
// ==============================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ==============================================
// GLOBAL VARIABLES
// ==============================================
bool cameraReady = false;
unsigned long lastScanTime = 0;
const unsigned long SCAN_INTERVAL = 2000;  // Send frame every 2 seconds

// ==============================================
// SETUP
// ==============================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n========================================");
  Serial.println("  MediTrack IoT Scanner v2.0");
  Serial.println("  Server-side QR decoding");
  Serial.println("========================================\n");

  // Initialize pins
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(FLASH_LED_PIN, OUTPUT);

  startupAnimation();

  // Initialize camera
  if (initCamera()) {
    Serial.println("[OK] Camera initialized");
    cameraReady = true;
  } else {
    Serial.println("[ERROR] Camera init failed!");
    errorBlink();
    return;
  }

  Serial.printf("[MEM] Free heap: %d bytes\n", ESP.getFreeHeap());

  // Connect to WiFi
  connectWiFi();

  // Register scanner
  registerScanner();

  Serial.println("\n[READY] Scanner active — sending frames to server for QR decoding...\n");
  indicateReady();
}

// ==============================================
// MAIN LOOP — Capture JPEG and send to server
// ==============================================
void loop() {
  if (!cameraReady) {
    delay(1000);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi disconnected, reconnecting...");
    connectWiFi();
  }

  // Only send frames every SCAN_INTERVAL ms
  if (millis() - lastScanTime < SCAN_INTERVAL) {
    delay(50);
    return;
  }
  lastScanTime = millis();

  // Capture JPEG frame
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[ERROR] Camera capture failed");
    return;
  }

  // Send to server
  bool qrFound = sendFrameToServer(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  if (!qrFound) {
    // Blink red LED dimly to show it's scanning
    digitalWrite(RED_LED_PIN, HIGH);
    delay(30);
    digitalWrite(RED_LED_PIN, LOW);
  }
}

// ==============================================
// SEND JPEG TO SERVER
// ==============================================
bool sendFrameToServer(uint8_t *jpegData, size_t jpegLen) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "image/jpeg");
  http.setTimeout(5000);


  
  int httpCode = http.POST(jpegData, jpegLen);

  if (httpCode == 200) {
    String response = http.getString();

    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (!error) {
      bool found = doc["data"]["found"] | false;

      if (found) {
        bool valid = doc["data"]["valid"] | false;
        const char* signal = doc["data"]["scannerSignal"] | "RED";
        const char* message = doc["data"]["message"] | "Unknown";
        const char* qrData = doc["data"]["qrData"] | "";

        Serial.println("-----------------------------------");
        Serial.print("[SCAN] QR detected: ");
        Serial.println(qrData);
        Serial.print("[RESULT] ");
        Serial.println(message);

        if (valid) {
          Serial.println("[STATUS] ✅ GENUINE MEDICINE");
          genuineSignal();
        } else {
          Serial.println("[STATUS] ❌ COUNTERFEIT / SUSPICIOUS");
          fakeSignal();
        }

        http.end();
        return true;
      }
    }
  } else if (httpCode < 0) {
    Serial.printf("[ERROR] HTTP failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return false;
}

// ==============================================
// CAMERA INITIALIZATION (JPEG mode now!)
// ==============================================
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;     // JPEG mode — much lighter on RAM
  config.frame_size = FRAMESIZE_QVGA;       // 320x240 — good for QR
  config.jpeg_quality = 10;                 // Quality 10 = good QR readability
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Camera init error: 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);
    s->set_contrast(s, 2);       // High contrast helps QR
    s->set_whitebal(s, 1);
    s->set_gain_ctrl(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);

    Serial.printf("[INFO] Camera sensor PID: 0x%x\n", s->id.PID);
  }

  return true;
}

// ==============================================
// WIFI
// ==============================================
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setSleep(false);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
    digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
  }
  digitalWrite(RED_LED_PIN, LOW);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" Connected!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
    tone(BUZZER_PIN, 1000, 100);
  } else {
    Serial.println(" FAILED!");
    errorBlink();
  }
}

// ==============================================
// REGISTER
// ==============================================
void registerScanner() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(REGISTER_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["deviceName"] = "ESP32-CAM Scanner v2";
  doc["actorId"] = "SCANNER";

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  Serial.printf("[REG] Registration: %s\n", httpCode == 200 ? "OK" : "Failed (non-critical)");
  http.end();
}

// ==============================================
// LED & BUZZER
// ==============================================
void genuineSignal() {
  digitalWrite(GREEN_LED_PIN, HIGH);
  digitalWrite(RED_LED_PIN, LOW);
  tone(BUZZER_PIN, 1500, 150);
  delay(200);
  tone(BUZZER_PIN, 2000, 150);
  delay(2000);
  digitalWrite(GREEN_LED_PIN, LOW);
}

void fakeSignal() {
  digitalWrite(GREEN_LED_PIN, LOW);
  for (int i = 0; i < 3; i++) {
    digitalWrite(RED_LED_PIN, HIGH);
    tone(BUZZER_PIN, 800, 400);
    delay(500);
    digitalWrite(RED_LED_PIN, LOW);
    delay(200);
  }
  digitalWrite(RED_LED_PIN, HIGH);
  delay(3000);
  digitalWrite(RED_LED_PIN, LOW);
}

void startupAnimation() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    delay(150);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, HIGH);
    delay(150);
    digitalWrite(RED_LED_PIN, LOW);
  }
  tone(BUZZER_PIN, 1000, 100);
  delay(150);
  tone(BUZZER_PIN, 1500, 100);
}

void indicateReady() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    delay(100);
    digitalWrite(GREEN_LED_PIN, LOW);
    delay(100);
  }
}

void errorBlink() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(RED_LED_PIN, HIGH);
    delay(100);
    digitalWrite(RED_LED_PIN, LOW);
    delay(100);
  }
}
