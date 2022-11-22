# SPDX-FileCopyrightText: 2021 ladyada for Adafruit Industries
# SPDX-FileCopyrightText: 2021 Mark Olsson <mark@markolsson.se>
# SPDX-License-Identifier: MIT

import microcontroller
import board
import busio
import digitalio
import json
import socketpool
from st7565 import ST7565
import time
import wifi

EXDURATION = 2
TIMEOUT = 2
PORT = 8266

led_onboard = digitalio.DigitalInOut(board.LED)
led_onboard.direction = digitalio.Direction.OUTPUT

# Turn on the Backlight LED
backlight = digitalio.DigitalInOut(board.GP21)  # backlight
backlight.switch_to_output()
backlight.value = True

# Initialize SPI bus and control pins
spi = busio.SPI(clock=board.GP18, MOSI=board.GP19)
dc = digitalio.DigitalInOut(board.GP17)  # data/command
cs = digitalio.DigitalInOut(board.GP16)  # Chip select
reset = digitalio.DigitalInOut(board.GP20)  # reset

display = ST7565(spi, dc, cs, reset)
display.contrast = 3

reconnectCount = 0
heartBeat = True

def wrap(string, max_width):
    s=''
    for i in range(0,len(string),max_width):
        s+=string[i:i+max_width]
        s+='\n'
    return s

def printDisplay(string, duration_s):
    display.fill(0)
    display.text(wrap(string, 20), 0, 0, 1)
    display.show()
    time.sleep(duration_s)

def connectWifi():
    while True:
        try:
            wifi.radio.connect("CurrentDiag", "123456789")
            break
        except Exception as e:
            if(str(e) == "Unbekannter Fehler 1" ):
                microcontroller.reset()
            printDisplay(str(e), EXDURATION)

printDisplay("Connecting to wifi", 1)
connectWifi()
pool = socketpool.SocketPool(wifi.radio)
buff = bytearray(255)

printDisplay("Creating socket", 1)

socket = pool.socket(pool.AF_INET, pool.SOCK_DGRAM)
socket.settimeout(TIMEOUT)
printDisplay("Connecting", 1)
socket.bind((str(wifi.radio.ipv4_address), PORT))
printDisplay("Receiving", 1)

while True:
    while True:
        try:
            buff = bytearray(255)
            size, addr = socket.recvfrom_into(buff)
            break
        except Exception as e:
            printDisplay(str(e), EXDURATION)
            printDisplay("Try Reconnecting", 1)
            reconnectCount = reconnectCount+1
            socket.close()
            connectWifi()
            pool = socketpool.SocketPool(wifi.radio)
            socket = pool.socket(pool.AF_INET, pool.SOCK_DGRAM)
            socket.settimeout(TIMEOUT)
            socket.bind((str(wifi.radio.ipv4_address), PORT))
    
    msg = buff.decode('utf-8')
    try:
        data = json.loads(msg)
    except Exception as e:
        printDisplay(str(e), EXDURATION)
    
    display.fill(0)
    
    try:
        display.text(data['sensor1'], 0, 0, 1, size=3)
        display.text(data['sensor2'], 0, 24, 1, size=3)
    except Exception as e:
        printDisplay(str(e), EXDURATION)
    
    heartBeat = not heartBeat
    led_onboard.value = not led_onboard.value
    
    if (heartBeat):
        display.pixel(display.width - 1, display.height - 1, 1)
    
    display.text(str(reconnectCount), 0, 56, 1)
    display.show()