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
import math

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
            if (str(e) == "Unbekannter Fehler 1" ):
                microcontroller.reset()
            printDisplay(str(e), EXDURATION)

def drawPercentbar(x, y, width, height, progress):
    if (progress > 100):
        progress = 100
    else:
        progress = progress

    if (progress < 0):
        progress = 0
    else:
        progress = progress

    bar = ((width-4) / 100) * progress; 
    display.rect(x, y, width, height, 1)
    display.fill_rect(x+2, y+2, bar, height-4, 1)

    if (height >= 15):
        if (progress >= 50):
            display.text(str(progress), int((width/2) - 3), y + 5, 0, size=1)
        else:
            display.text(str(progress), int((width/2) - 3), y + 5, 1, size=1)

def drawPercentbarPlus(x, y, width, height, progress):
    bar = ((width-4) / 100) * progress; 
    display.rect(x, y, width, height, 1)

    if (progress < 0):
        _bar = abs(bar)     

        _x = (width/2)-_bar+2
        if (_x < 2):
            _x = 2
            _bar = (width/2)-2
        display.fill_rect(int(_x), y+2, int(_bar), height-4, 1)
    else:
        _x = (width/2)
        if (bar > (width/2)):
            bar = (width/2)-2
        display.fill_rect(int(_x), y+2, int(bar), height-4, 1)

    if (height >= 15):
        if (progress >= 0):
            display.text(str(progress), int(width/8), y+5, 1, size=1)
        else:
            display.text(str(progress), int(width/1.5), y+5, 1, size=1)
    display.vline(int(width/2), y-1, height+2, 1)




def drawValuebar(x, y, width, height, valueMin, valueMax, value, vlineValue):
    roundValue = round(value, 2)
    valueRange = valueMax - valueMin
    pxPerValue = (width - 4) / valueRange
    pxPositionVline = int(pxPerValue * (vlineValue - valueMin) + 2)
    
    pxPositionValue = int(pxPerValue * (roundValue - valueMin) + 2)
    start = min(pxPositionValue, pxPositionVline)
    end = max(pxPositionValue, pxPositionVline)

    display.rect(x, y, width, height, 1)
    display.fill_rect(x+start, y+2, end-start, height-4, 1) 

    # if (value <= vlineValue):       
    #     display.fill_rect(int(x+pxPositionValue+2), y+2, int(math.fabs(pxPositionValue-pxPositionVline)), height-4, 1) 
    # else:
    #     display.fill_rect(int(x+pxPositionVline+3), y+2, int(math.fabs(pxPositionValue-pxPositionVline)), height-4, 1)

    if (height >= 15):
        if (value >= vlineValue):
            display.text(str(f"{roundValue:.2f}"), int(width/8), y+5, 1, size=1)
        else:
            display.text(str(f"{roundValue:.2f}"), int(width/1.5), y+5, 1, size=1)
        
    display.vline(int(pxPositionVline), y-1, height+2, 1)



v1 = -80
v1_min = -80
v1_max = 120
v1_vline = 0
v2 = 0.60
v2_min = 0.6
v2_max = 1.4
v2_vline = 1.0

v1Increase = True
v2Increase = True

while True:
    if (v1 >= v1_max):
        v1Increase = False
    
    if (v1 <= v1_min):
        v1Increase = True

    if (v2 >= v2_max):
        v2Increase = False
    
    if (v2 <= v2_min):
        v2Increase = True

    if (v1Increase):
        v1 = v1 + 1
    else:
        v1 = v1 - 1
    if (v2Increase):
        v2 = v2 + 0.05
    else:
        v2 = v2 - 0.05
    
    display.fill(0)
    drawValuebar(0, 1, 128, 16, v1_min, v1_max, v1, v1_vline)
    drawValuebar(0, 20, 128, 16, v2_min, v2_max, v2, v2_vline)
    display.show()

    time.sleep(0.01)


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
        #drawPercentbarPlus(0, 1, 128, 16, float(data['sensor1']))
        #drawPercentbarPlus(0, 20, 128, 16, float(data['sensor2']))
    except Exception as e:
        printDisplay(str(e), EXDURATION)

    heartBeat = not heartBeat
    led_onboard.value = not led_onboard.value
    
    if (heartBeat):
        display.pixel(display.width - 1, display.height - 1, 1)
    
    display.text(str(reconnectCount), 0, 56, 1)
    display.show()