import base64
import os
from time import perf_counter

import httpx


async def generate_image(
    prompt: str,
    model: str = "agnes-image-2.0-flash",
    n: int = 1,
    size: str = "1024x1024",
) -> dict:
    """
    调用 Agnes Image API 生成图片

    Args:
        prompt: 图片描述
        model: 模型名称，默认 agnes-image-2.0-flash
        n: 生成数量
        size: 图片尺寸，支持 1024x1024

    Returns:
        {"images": [{"b64_json": "...", "url": "...", "revised_prompt": "..."}], "total_ms": N}
    """
    api_key = os.getenv("AGNES_API_KEY")
    if not api_key:
        raise ValueError("缺少 AGNES_API_KEY，请在 .env 中配置")

    started_at = perf_counter()

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            "https://apihub.agnes-ai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "prompt": prompt,
                "n": n,
                "size": size,
            },
        )
        response.raise_for_status()
        data = response.json()

    total_ms = int((perf_counter() - started_at) * 1000)

    images = []
    for item in data.get("data", []):
        url = item.get("url", "")
        b64 = item.get("b64_json", "")
        # 如果没有 b64_json，下载图片后 base64 编码
        if not b64 and url:
            async with httpx.AsyncClient(timeout=60) as dl_client:
                dl_resp = await dl_client.get(url)
                dl_resp.raise_for_status()
                b64 = base64.b64encode(dl_resp.content).decode("utf-8")

        images.append(
            {
                "b64_json": b64,
                "url": url,
                "revised_prompt": item.get("revised_prompt", prompt),
            }
        )

    return {"images": images, "total_ms": total_ms}
