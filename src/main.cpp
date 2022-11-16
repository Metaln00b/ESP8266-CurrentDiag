#include "Wire.h"
#include "LittleFS.h"
#include "Adafruit_INA219.h"
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <Arduino_JSON.h>
#include <AsyncElegantOTA.h>
#include <WiFiUdp.h>

const char* ssid = "CurrentDiag";

AsyncWebServer server(80);
AsyncEventSource events("/events");

JSONVar readings;

unsigned long lastTime = 0;
unsigned long timerDelay = 500;

Adafruit_INA219 ina219;

IPAddress multicastIP(230, 120, 10, 1);
constexpr uint16_t PORT = 8266;
char packetBuffer[255];

WiFiUDP Udp;

String getSensorReadings()
{
  //readings["sensor1"] = String(ina219.getCurrent_mA());
  readings["sensor1"] = String(22);

  // Values from afr gauge documentation
  // minLambda = 0.683 (and offset)
  // maxLambda = 1.356
  // lambdaRange = 0.673
  // adcRange = 1024 (0 - 5V with 180k resistor) 0.0049/V
  // 0.673 / 1024 = 0.000657227
  double lambda = ( (analogRead(A0) * 0.000657227) + 0.683 );
  readings["sensor2"] = String(lambda);

  String jsonString = JSON.stringify(readings);
  return jsonString;
}

void sendUdp() {
  Udp.beginPacketMulticast(multicastIP, PORT, WiFi.localIP());
  Udp.print(getSensorReadings());
  Udp.endPacket();
}

void initLittleFS()
{
  if (!LittleFS.begin())
  {
    Serial.println("An error has occurred while mounting LittleFS");
  }
  else
  {
    Serial.println("LittleFS mounted successfully");
  }
}

void initWiFi()
{
  WiFi.mode(WIFI_AP);
  Serial.print("Setting soft-AP ... ");
  
  WiFi.softAP(ssid, NULL, 8);
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
}

void setup() {
  Serial.begin(115200);
  while (!Serial)
  {
    ; // Needed for native USB port only
  }

  if (!ina219.begin())
  {
    Serial.println("Failed to find INA219 chip");
    // while (true)
    // {
    //   delay(10);
    // }
  }

  initWiFi();
  initLittleFS();

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
  {
    request->send(LittleFS, "/index.html", "text/html");
  });

  server.serveStatic("/", LittleFS, "/");

  server.on("/readings", HTTP_GET, [](AsyncWebServerRequest *request)
  {
    lastTime = lastTime + timerDelay;
    request->send(200, "text/plain", "OK!");
  });

  events.onConnect([](AsyncEventSourceClient *client)
  {
    if(client->lastId())
    {
      Serial.printf("Client reconnected! Last message ID that it got is: %u\n", client->lastId());
    }
    // send event with message "hello!", id current millis
    // and set reconnect delay to 1 second
    client->send("Hello!", NULL, millis(), 10000);
  });
  server.addHandler(&events);

  AsyncElegantOTA.begin(&server);

  server.begin();

  Udp.beginMulticast(WiFi.softAPIP(), multicastIP, PORT);
}

void loop() {
  if ((millis() - lastTime) > timerDelay) {
    events.send(getSensorReadings().c_str(),"new_readings" ,millis());
    lastTime = millis();
    sendUdp();
  }
}