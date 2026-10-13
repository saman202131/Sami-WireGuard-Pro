"""نمونه آموزشی برای اتصال ربات پایتون به API سایت.
این فایل ربات کامل نیست و عمداً توکن ربات را در خود نگه نمی‌دارد.
تنظیم متغیرهای محیطی در هاست ربات: SAMI_SITE_URL و SAMI_SITE_API_KEY
"""
import os
import requests

BASE_URL = os.environ["SAMI_SITE_URL"].rstrip("/")
API_KEY = os.environ["SAMI_SITE_API_KEY"]


def site_request(method: str, path: str, **kwargs):
    headers = kwargs.pop("headers", {})
    headers["X-Secret-Key"] = API_KEY
    headers.setdefault("Content-Type", "application/json")
    response = requests.request(method, BASE_URL + path, headers=headers, timeout=15, **kwargs)
    response.raise_for_status()
    return response.json()


def get_catalog():
    return site_request("GET", "/api/integration/catalog")


def create_site_order(external_order_id, service_id, plan_id, telegram_user_id, username=""):
    payload = {
        "externalOrderId": str(external_order_id),
        "serviceId": service_id,
        "planId": plan_id,
        "telegramUserId": str(telegram_user_id),
        "username": username,
    }
    return site_request(
        "POST", "/api/integration/orders", json=payload,
        headers={"Idempotency-Key": str(external_order_id)},
    )


def update_order_status(site_order_id, status):
    allowed = {"pending", "approved", "rejected", "fulfilled"}
    if status not in allowed:
        raise ValueError("Unsupported order status")
    return site_request("POST", f"/api/integration/orders/{site_order_id}/status", json={"status": status})
