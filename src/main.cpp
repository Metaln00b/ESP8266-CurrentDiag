#include "Wire.h"
#include "LittleFS.h"
#include "Adafruit_INA219.h"
#include <ESP8266WiFi.h>
#include <ESP8266WiFiAP.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <ElegantOTA.h>
#include <WiFiUdp.h>

const char *ssid = "CurrentDiag";
const char *pass = "123456789";

AsyncWebServer server(80);
AsyncEventSource events("/events");

unsigned long lastWebTime = 0;
unsigned long lastUdpTime = 0;
unsigned long lastDataTime = 0;
unsigned long webTimerDelay = 500;
//unsigned long udpTimerDelay = 50;
unsigned long dataTimerDelay = 50;

#ifndef DEBUG
Adafruit_INA219 ina219;
#endif

IPAddress broadcastIP(192, 168, 4, 255);
constexpr uint16_t PORT = 8266;
char packetBuffer[255];
char sensorData[128];

WiFiUDP Udp;

// The ESP8266 SoftAP driver queues broadcast/multicast frames and only
// releases them aligned to its beacon/DTIM interval, regardless of the
// station's own sleep settings - that's what made UDP packets arrive at the
// receiver in ~300ms bursts instead of steadily. Sending unicast to the
// known receiver IP instead skips that batching. Falls back to broadcast
// until a station has actually connected.
IPAddress receiverIP = broadcastIP;
bool haveReceiverIP = false;

void getSensorReadings(char *output, size_t outputSize)
{
    StaticJsonDocument<64> readings;
#ifndef DEBUG
    float current_mA = ina219.getCurrent_mA();
    // Values from afr gauge documentation
    // minLambda = 0.683 (and offset)
    // maxLambda = 1.356
    // lambdaRange = 0.673
    // adcRange = 1024 (0 - 5V with 180k resistor) 0.0049/V
    // 0.673 / 1024 = 0.000657227
    float lambda = ((analogRead(A0) * 0.000657227) + 0.683);
#else
    // Endless cycle: full min -> max -> min sweep, then 5s of random values
    constexpr float CURRENT_MIN = -80.0, CURRENT_MAX = 120.0;
    constexpr float LAMBDA_MIN = 0.6, LAMBDA_MAX = 1.3;
    constexpr unsigned long SWEEP_MS = 20000;
    constexpr unsigned long RANDOM_MS = 5000;
    static bool sweeping = true;
    static unsigned long phaseStart = millis();

    unsigned long elapsed = millis() - phaseStart;
    float current_mA;
    float lambda;

    if (sweeping)
    {
        if (elapsed >= SWEEP_MS)
        {
            sweeping = false;
            phaseStart = millis();
        }
        float frac = (elapsed >= SWEEP_MS) ? 1.0 : (float)elapsed / SWEEP_MS;
        float tri = (frac < 0.5) ? frac * 2.0 : (1.0 - frac) * 2.0; // 0 -> 1 -> 0
        current_mA = CURRENT_MIN + tri * (CURRENT_MAX - CURRENT_MIN);
        lambda = LAMBDA_MIN + tri * (LAMBDA_MAX - LAMBDA_MIN);
    }
    else
    {
        if (elapsed >= RANDOM_MS)
        {
            sweeping = true;
            phaseStart = millis();
        }
        current_mA = random(-80, 120);
        lambda = random(6, 14) / 10.0;
    }
#endif
    char sensor1ValueStr[10];
    char sensor2ValueStr[10];
    dtostrf(current_mA, 6, 2, sensor1ValueStr);
    dtostrf(lambda, 3, 2, sensor2ValueStr);

    readings["sensor1"] = sensor1ValueStr;
    readings["sensor2"] = sensor2ValueStr;

    serializeJson(readings, output, outputSize);
}

void sendUdp(const char *data)
{
    Udp.beginPacket(haveReceiverIP ? receiverIP : broadcastIP, PORT);
    Udp.print(data);
    Udp.endPacket();
}

void initLittleFS()
{
    if (!LittleFS.begin())
    {
        Serial.println(F("An error has occurred while mounting LittleFS"));
    }
    else
    {
        Serial.println(F("LittleFS mounted successfully"));
    }
}

void showClients()
{
    unsigned char number_client;
    struct station_info *stat_info;

    struct ip4_addr *IPaddress;
    IPAddress address;
    int cnt = 1;

    number_client = wifi_softap_get_station_num();
    stat_info = wifi_softap_get_station_info();

    Serial.print(F("Connected clients: "));
    Serial.println(number_client);

    haveReceiverIP = false;

    while (stat_info != NULL)
    {
        IPaddress = &stat_info->ip;
        address = IPaddress->addr;

        if (!haveReceiverIP)
        {
            receiverIP = address;
            haveReceiverIP = true;
        }

        Serial.print(cnt);
        Serial.print(F(": IP: "));
        Serial.print((address));
        Serial.print(F(" MAC: "));

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
    Serial.println(F("Setting soft-AP ... "));
    wifi_set_event_handler_cb(eventCb);

    IPAddress apIP(192, 168, 4, 1);

    if (WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0)))
        Serial.println(F("softAPConfig: True"));
    else
        Serial.println(F("softAPConfig: False"));

    if (WiFi.softAP(ssid, pass, 8))
        Serial.println(F("softAP: True"));
    else
        Serial.println(F("softAP: False"));

    IPAddress IP = WiFi.softAPIP();
    Serial.print(F("AP IP address: "));
    Serial.println(IP);
}

void setup()
{
    Serial.begin(115200);
    while (!Serial)
    {
        ; // Needed for native USB port only
    }
#ifndef DEBUG
    if (!ina219.begin())
    {
        Serial.println(F("Failed to find INA219 chip"));
    }
#endif

    initWiFi();
    initLittleFS();

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
              { request->send(LittleFS, "/index.html", "text/html"); });

    server.serveStatic("/", LittleFS, "/");

    server.on("/readings", HTTP_GET, [](AsyncWebServerRequest *request)
              { request->send(200, "text/plain", "OK!"); });

    events.onConnect([](AsyncEventSourceClient *client)
                     {
    if (client->lastId())
    {
      Serial.printf("Client reconnected! Last message ID that it got is: %u\n", client->lastId());
    }
    // send event with message "hello!", id current millis
    // and set reconnect delay to 1 second
    client->send("Hello!", NULL, millis(), 10000);
    Serial.println("Client connected!"); });

    server.addHandler(&events);

    ElegantOTA.begin(&server);

    server.begin();

    Udp.begin(PORT);

    getSensorReadings(sensorData, sizeof(sensorData));
}

void loop()
{
    unsigned long currentMillis = millis();

    if ((currentMillis - lastDataTime) > dataTimerDelay)
    {
        getSensorReadings(sensorData, sizeof(sensorData));
        sendUdp(sensorData);
        lastDataTime += dataTimerDelay;
    }

    if ((currentMillis - lastWebTime) > webTimerDelay)
    {
        events.send(sensorData, "new_readings", millis());
        lastWebTime += webTimerDelay;
    }

    /* if ((currentMillis - lastUdpTime) > udpTimerDelay) {
      sendUdp(sensorData);
      lastUdpTime += udpTimerDelay;
    } */
    ElegantOTA.loop();

    yield();
}