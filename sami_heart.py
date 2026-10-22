# -*- coding: utf-8 -*-
"""
Sami | Colorful Star Heart
ساخته شده توسط Sami 💚

اجرا:
    python sami_heart.py

نیازمندی: Python 3 با ماژول turtle (معمولاً همراه نصب پایتون است).
نکته: turtle به محیط گرافیکی نیاز دارد و در ترمینال ساده‌ی Termux معمولاً
مستقیم نمایش داده نمی‌شود؛ روی کامپیوتر یا محیطی با پشتیبانی GUI اجرا کنید.
"""

import math
import random
import turtle

# رنگ‌های نئونی
COLORS = [
    "#ff1744", "#ff9100", "#ffea00", "#76ff03",
    "#00e5ff", "#2979ff", "#d500f9", "#ff4081",
    "#ffffff", "#00ffc8"
]

random.seed()  # هر بار ترکیب رنگی تازه

screen = turtle.Screen()
screen.setup(width=1000, height=760)
screen.bgcolor("#050509")
screen.title("Sami | Colorful Star Heart")
screen.tracer(0)

pen = turtle.Turtle()
pen.hideturtle()
pen.speed(0)
pen.penup()

# تیتر و امضای سازنده
title = turtle.Turtle()
title.hideturtle()
title.penup()
title.color("#76ff03")
title.goto(0, 305)
title.write("SAMI", align="center", font=("Arial", 30, "bold"))

subtitle = turtle.Turtle()
subtitle.hideturtle()
subtitle.penup()
subtitle.color("#f5f5f5")
subtitle.goto(0, 270)
subtitle.write("Colorful Star Heart  |  Made by Sami", align="center",
               font=("Arial", 14, "normal"))

# منحنی قلب؛ هر خط از مرکز به یک نقطه‌ی منحنی کشیده می‌شود.
# معادله‌ی قلب با مقیاس‌بندی برای جا شدن روی صفحه
N = 180
SCALE = 15.5

for i in range(N):
    t = 2 * math.pi * i / N

    x = 16 * (math.sin(t) ** 3)
    y = (
        13 * math.cos(t)
        - 5 * math.cos(2 * t)
        - 2 * math.cos(3 * t)
        - math.cos(4 * t)
    )

    x *= SCALE
    y *= SCALE
    color = random.choice(COLORS)

    # پرتو رنگی از مرکز تا لبه‌ی قلب
    pen.goto(0, -15)
    pen.pencolor(color)
    pen.pensize(1.3)
    pen.pendown()
    pen.goto(x, y)
    pen.penup()

    # ستاره‌ی کوچک روی لبه‌ی قلب
    pen.goto(x, y)
    pen.dot(random.randint(5, 10), color)

# قلب کوچک در مرکز
pen.goto(0, -15)
pen.dot(13, "#ff4081")
pen.dot(6, "#ffffff")

# امضای پایین تصویر
signature = turtle.Turtle()
signature.hideturtle()
signature.penup()
signature.color("#bdbdbd")
signature.goto(0, -315)
signature.write("♥  Created with Python by Sami  ♥", align="center",
                font=("Arial", 13, "bold"))

screen.update()
turtle.done()
