"""Read-only device inventory for the local Mini Room server."""
import asyncio
import hashlib
import json
import os
import sys
import uuid

from aiohttp import ClientSession
from thinqconnect.thinq_api import ThinQApi


# These are representative room sprites, not exact model or colour matches.
SPRITES = {
    "DEVICE_REFRIGERATOR": "fridge_sg",
    "DEVICE_AIR_CONDITIONER": "tower_ac",
    "DEVICE_AIR_PURIFIER": "puri_p",
    "DEVICE_STYLER": "styler",
    "DEVICE_WASHTOWER": "wash_m",
    "DEVICE_WASHTOWER_WASHER": "wash_m",
    "DEVICE_STICK_CLEANER": "vacuum",
    "DEVICE_TV": "tvset",
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
                               "k": SPRITES.get(info["deviceType"]),
                               "name": info.get("alias") or info["deviceType"]}
    return list(devices.values())


if __name__ == "__main__":
    try:
        print(json.dumps(asyncio.run(inventory()), ensure_ascii=True))
    except Exception:
        sys.exit(1)
