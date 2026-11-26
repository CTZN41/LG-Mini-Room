"""Read-only device inventory for the local Mini Room server."""
import asyncio
import hashlib
import json
import os
import sys
import uuid

from aiohttp import ClientSession
from thinqconnect.thinq_api import ThinQApi


CATEGORIES = {
    "DEVICE_REFRIGERATOR": "냉장고", "DEVICE_AIR_PURIFIER": "공기청정기",
    "DEVICE_WASHER": "세탁기", "DEVICE_WASHTOWER": "세탁기",
    "DEVICE_WASHTOWER_WASHER": "세탁기", "DEVICE_DRYER": "건조기",
    "DEVICE_STICK_CLEANER": "무선청소기", "DEVICE_ROBOT_CLEANER": "로봇청소기",
    "DEVICE_HUMIDIFIER": "가습기", "DEVICE_DEHUMIDIFIER": "제습기", "DEVICE_TV": "TV",
    "DEVICE_LIGHT": "조명",
}


async def inventory():
    async with ClientSession() as session:
        api = ThinQApi(session=session, access_token=os.environ["THINQ_PAT"],
                       country_code=os.getenv("THINQ_COUNTRY", "KR").upper(),
                       client_id=uuid.uuid5(uuid.NAMESPACE_DNS, f"miniroom-{uuid.getnode()}").hex)
        rows = await api.async_get_device_list()
    if not isinstance(rows, list):
        raise ValueError("Invalid device list")
    devices = {}
    for row in rows:
        info = row["deviceInfo"]
        identifier = hashlib.sha256(row["deviceId"].encode()).hexdigest()
        devices[identifier] = {"id": "thinq-" + identifier,
                               "category": CATEGORIES.get(info["deviceType"]),
                               "modelCode": info.get("modelName") or info.get("modelCode"),
                               "name": info.get("alias") or info["deviceType"]}
    return list(devices.values())


if __name__ == "__main__":
    try:
        print(json.dumps(asyncio.run(inventory()), ensure_ascii=True))
    except Exception:
        sys.exit(1)
