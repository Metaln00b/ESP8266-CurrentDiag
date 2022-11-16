# SPDX-FileCopyrightText: 2021 ladyada for Adafruit Industries
# SPDX-FileCopyrightText: 2021 Mark Olsson <mark@markolsson.se>
# SPDX-License-Identifier: MIT

import time
import board
import busio
import digitalio
from st7565 import ST7565
import math
from math import cos, sin
import json

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
display.contrast = 0

print("Pixel test")
# Clear the display.  Always call show after changing pixels to make the display
# update visible!
display.fill(0)
display.show()

# Set a pixel in the origin 0,0 position.
display.pixel(0, 0, 1)
# Set a pixel in the middle position.
display.pixel(display.width // 2, display.height // 2, 1)
# Set a pixel in the opposite corner position.
display.pixel(display.width - 1, display.height - 1, 1)
display.show()
time.sleep(2)

import wifi
import socketpool
import ssl
import time

TIMEOUT = None
PORT = 8266

print("Connecting to wifi")

wifi.radio.connect("CurrentDiag", "123456789")
pool = socketpool.SocketPool(wifi.radio)
buff = bytearray(255)

print("Creating socket")

with pool.socket(pool.AF_INET, pool.SOCK_DGRAM) as s:
    s.settimeout(TIMEOUT)
    print("Connecting")
    s.bind((str(wifi.radio.ipv4_address), PORT))
    print("Receiving")
    hb = True
    while True:
        size, addr = s.recvfrom_into(buff)
        msg = buff.decode('utf-8')
        #print(f"Received message from {addr[0]}:", msg)
        data = json.loads(msg)
        display.fill(0)
        display.text(data['sensor1'], 0, 0, 1)
        display.text(data['sensor2'], 0, 8, 1)
        hb = not hb
        led_onboard.value = not led_onboard.value
        if (hb):
            display.pixel(display.width - 1, display.height - 1, 1)
        display.show()

print("Lines test")
# we'll draw from corner to corner, lets define all the pair coordinates here
corners = (
    (0, 0),
    (0, display.height - 1),
    (display.width - 1, 0),
    (display.width - 1, display.height - 1),
)

display.fill(0)
for corner_from in corners:
    for corner_to in corners:
        display.line(corner_from[0], corner_from[1], corner_to[0], corner_to[1], 1)
display.show()
time.sleep(2)

print("Rectangle test")
display.fill(0)
w_delta = display.width / 10
h_delta = display.height / 10
for i in range(11):
    display.rect(0, 0, int(w_delta * i), int(h_delta * i), 1)
display.show()
time.sleep(2)

print("Text test")
display.fill(0)
display.text("hello world", 0, 0, 1)
display.text("this is the", 0, 8, 1)
display.text("CircuitPython", 0, 16, 1)
display.text("adafruit lib-", 0, 24, 1)
display.text("rary for the", 0, 32, 1)
display.text("ST7565! :) ", 0, 40, 1)

display.show()

time.sleep(2)

class Point3D:
    def __init__(self, x = 0, y = 0, z = 0):
        self.x, self.y, self.z = x, y, z
 
    def rotateX(self, angle):
        """ Rotates this point around the X axis the given number of degrees. """
        rad = angle * math.pi / 180
        cosa = math.cos(rad)
        sina = math.sin(rad)
        y = self.y * cosa - self.z * sina
        z = self.y * sina + self.z * cosa
        return Point3D(self.x, y, z)
 
    def rotateY(self, angle):
        """ Rotates this point around the Y axis the given number of degrees. """
        rad = angle * math.pi / 180
        cosa = math.cos(rad)
        sina = math.sin(rad)
        z = self.z * cosa - self.x * sina
        x = self.z * sina + self.x * cosa
        return Point3D(x, self.y, z)
 
    def rotateZ(self, angle):
        """ Rotates this point around the Z axis the given number of degrees. """
        rad = angle * math.pi / 180
        cosa = math.cos(rad)
        sina = math.sin(rad)
        x = self.x * cosa - self.y * sina
        y = self.x * sina + self.y * cosa
        return Point3D(x, y, self.z)
 
    def project(self, win_width, win_height, fov, viewer_distance):
        """ Transforms this 3D point to 2D using a perspective projection. """
        factor = fov / (viewer_distance + self.z)
        x = self.x * factor + win_width / 2
        y = -self.y * factor + win_height / 2
        return Point3D(x, y, self.z)



class Simulation:
    def __init__(
            self, 
            width=128, 
            height=64, 
            fov=64, 
            distance=4, 
            rotateX=5, 
            rotateY=5, 
            rotateZ=5
            ):
 
        self.vertices = [
            Point3D(-1,1,-1),
            Point3D(1,1,-1),
            Point3D(1,-1,-1),
            Point3D(-1,-1,-1),
            Point3D(-1,1,1),
            Point3D(1,1,1),
            Point3D(1,-1,1),
            Point3D(-1,-1,1)
        ]
        
        # Define the edges, the numbers are indices to the vertices above.
        self.edges  = [
            # Back
            (0, 1),
            (1, 2),
            (2, 3),
            (3, 0),
            # Front
            (5, 4),
            (4, 7),
            (7, 6),
            (6, 5),
            # Front-to-back
            (0, 4),
            (1, 5),
            (2, 6),
            (3, 7),
        ]
 
        # Dimensions
        self.projection = [width, height, fov, distance]
        
        # Rotational speeds
        self.rotateX = rotateX
        self.rotateY = rotateY
        self.rotateZ = rotateZ
 
    def run(self):
        # Starting angle (unrotated in any dimension)
        angleX, angleY, angleZ = 0, 0, 0
        
        while 1:
            # It will hold transformed vertices.
            t = []
            
 
            for v in self.vertices:
                # Rotate the point around X axis, then around Y axis, and finally around Z axis.
                r = v.rotateX(angleX).rotateY(angleY).rotateZ(angleZ)

                # Transform the point from 3D to 2D
                p = r.project(*self.projection)
                
                # Put the point in the list of transformed vertices
                t.append(p)
            
            display.fill(0)

            for e in self.edges:
                display.line(*to_int(t[e[0]].x, t[e[0]].y, t[e[1]].x, t[e[1]].y, 1))
            
            display.show()
            
            # Continue the rotation
            angleX += self.rotateX
            angleY += self.rotateY
            angleZ += self.rotateZ

    def run2(self):

        pixel_width = 2
        pixel_height = 1

        x_pixel = 0
        y_pixel = 0

        screen_width = display.width // pixel_width
        screen_height = display.height // pixel_height
        screen_size = screen_width * screen_height

        A, B = 0, 0

        theta_spacing = 5
        phi_spacing = 1

        chars = ".,-~:;=!*#$@"

        R1 = 1
        R2 = 2
        K2 = 20
        K1 = screen_height * K2 * 3 / (8 * (R1 + R2))

        k = 0

        while 1:
            display.fill(0)

            output = [' '] * screen_size
            zbuffer = [0] * screen_size

            for theta in range(0, 32, theta_spacing):  # theta goes around the cross-sectional circle of a torus, from 0 to 2pi
                for phi in range(0, 32, phi_spacing):  # phi goes around the center of revolution of a torus, from 0 to 2pi

                    cosA = cos(A)
                    sinA = sin(A)
                    cosB = cos(B)
                    sinB = sin(B)

                    costheta = cos(theta)
                    sintheta = sin(theta)
                    cosphi = cos(phi)
                    sinphi = sin(phi)

                    # x, y coordinates before revolving
                    circlex = R2 + R1 * costheta
                    circley = R1 * sintheta

                    # 3D (x, y, z) coordinates after rotation
                    x = circlex * (cosB * cosphi + sinA * sinB * sinphi) - circley * cosA * sinB
                    y = circlex * (sinB * cosphi - sinA * cosB * sinphi) + circley * cosA * cosB
                    z = K2 + cosA * circlex * sinphi + circley * sinA
                    ooz = 1 / z  # one over z

                    # x, y projection
                    xp = int(screen_width / 2 + K1 * ooz * x)
                    yp = int(screen_height / 2 - K1 * ooz * y)

                    position = xp + screen_width * yp

                    # luminance (L ranges from -sqrt(2) to sqrt(2))
                    L = cosphi * costheta * sinB - cosA * costheta * sinphi - sinA * sintheta + cosB * (
                                cosA * sintheta - costheta * sinA * sinphi)

                    if ooz > zbuffer[position]:
                        zbuffer[position] = ooz  # larger ooz means the pixel is closer to the viewer than what's already plotted
                        luminance_index = int(L * 8)  # we multiply by 8 to get luminance_index range 0..11 (8 * sqrt(2) = 11)
                        output[position] = chars[luminance_index if luminance_index > 0 else 0]

            for i in range(screen_height):
                y_pixel += pixel_height
                for j in range(screen_width):
                    x_pixel += pixel_width
                    display.text(output[k], x_pixel, y_pixel, 1)
                    k += 1
                x_pixel = 0
            y_pixel = 0
            k = 0

            A += 0.15
            B += 0.035

            display.show()


def to_int(*args):
    return [int(v) for v in args]

s = Simulation()
s.run()

""" 
while True:
    display.invert = True
    time.sleep(0.5)
    display.invert = False
    time.sleep(0.5)
"""
