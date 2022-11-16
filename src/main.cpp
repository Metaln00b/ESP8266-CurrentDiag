#include "Wire.h"
#include "LittleFS.h"
#include "Adafruit_INA219.h"
#include <ESP8266WiFi.h>
#include <ESP8266WiFiAP.h>
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
unsigned long webTimerDelay = 500;
unsigned long udpTimerDelay = 40;

Adafruit_INA219 ina219;

IPAddress broadcastIP(192, 168, 4, 255);
constexpr uint16_t PORT = 8266;
char packetBuffer[255];

WiFiUDP Udp;

String getSensorReadings()
{
  readings["sensor1"] = String(ina219.getCurrent_mA());

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
  Udp.beginPacket(broadcastIP, PORT);
  String data = getSensorReadings();
  Udp.print(data);
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

void showClients() 
{
  unsigned char number_client;
  struct station_info *stat_info;
  
  struct ip4_addr *IPaddress;
  IPAddress address;
  int cnt=1;
  
  number_client = wifi_softap_get_station_num();
  stat_info = wifi_softap_get_station_info();
  
  Serial.print("Connected clients: ");
  Serial.println(number_client);

  while (stat_info != NULL)
  {
      IPaddress = &stat_info->ip;
      address = IPaddress->addr;

      Serial.print(cnt);
      Serial.print(": IP: ");
      Serial.print((address));
      Serial.print(" MAC: ");

      uint8_t *p = stat_info->bssid;
      Serial.printf("%02X:%02X:%02X:%02X:%02X:%02X", p[0], p[1], p[2], p[3], p[4], p[5]);

      stat_info = STAILQ_NEXT(stat_info, next);
      cnt++;
      Serial.println();
  }
}

void eventCb(System_Event_t *evt)
{
    switch (evt->event)
    {
      case WIFI_EVENT_SOFTAPMODE_DISTRIBUTE_STA_IP:
      case WIFI_EVENT_SOFTAPMODE_STADISCONNECTED:
      showClients();
      break;
      
    default:
        break;
    }
}

void initWiFi()
{
  Serial.println("Setting soft-AP ... ");
  wifi_set_event_handler_cb(eventCb);

  IPAddress apIP(192, 168, 4, 1);

  if (WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0)))
    Serial.println("softAPConfig: True");
  else
    Serial.println("softAPConfig: False");

  if (WiFi.softAP(ssid, "123456789", 8))
    Serial.println("softAP: True");
  else
    Serial.println("softAP: False");
  
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
    lastTime = lastTime + webTimerDelay;
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

  Udp.begin(PORT);
}

void loop() {
  if ((millis() - lastTime) > webTimerDelay) {
    events.send(getSensorReadings().c_str(),"new_readings" ,millis());
    lastTime = millis();
    sendUdp();
  }
}