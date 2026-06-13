"""
Local JSON persistence for templates used by the MVP Agent workflow.
"""

from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Optional

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_TEMPLATE_PATH = _BASE_DIR / "data" / "templates.json"

_template_lock = Lock()


DEFAULT_TEMPLATES: list[dict] = [
    {
        "id": "contract_key_points",
        "name": "合同关键条款提取",
        "description": "从上传文档中提取关键条款、风险点和待确认事项。",
        "default_prompt": "请从文档中提取合同关键条款、风险点、金额、期限、违约责任和待确认事项。",
        "workflow_id": "document_summary",
    },
    {
        "id": "document_summary",
        "name": "文档摘要",
        "description": "快速概括文档核心内容和结论。",
        "default_prompt": "请用简洁的结构化方式总结这份文档的核心内容、结论和重点。",
        "workflow_id": "document_summary",
    },
    {
        "id": "finance_review",
        "name": "财报要点分析",
        "description": "提取财报中的营收、利润、现金流和主要变化。",
        "default_prompt": "请提取财报中的营收、利润、现金流、同比变化和核心风险。",
        "workflow_id": "document_summary",
    },
    {
        "id": "meeting_notes",
        "name": "会议纪要生成",
        "description": "生成结构化会议纪要和行动项。",
        "default_prompt": "请把这段内容整理成会议纪要，包含议题、结论、行动项和负责人。",
        "workflow_id": "document_summary",
    },
    {
        "id": "mind_map",
        "name": "思维导图稿",
        "description": "把文档整理成适合做思维导图的层级大纲。",
        "default_prompt": "请把文档整理成适合思维导图的层级大纲，分出一级、二级、三级节点。",
        "workflow_id": "document_summary",
    },
    {
        "id": "report_outline",
        "name": "报告大纲生成",
        "description": "根据材料生成可直接写作的报告大纲。",
        "default_prompt": "请根据文档生成一份报告大纲，按章节列出可直接写作的结构。",
        "workflow_id": "document_summary",
    },
    {
        "id": "image_poster",
        "name": "配图生成",
        "description": "基于描述生成一张视觉化配图。",
        "default_prompt": "生成一张适合配图的高质量插画，风格清晰、构图明确、适合文档展示。",
        "workflow_id": "image_generation",
    },
    {
        "id": "project_plan",
        "name": "项目规划",
        "description": "对输入需求做多步整理，输出执行计划。",
        "default_prompt": "请把用户需求整理成清晰的项目计划，包含目标、步骤、风险和里程碑。",
        "workflow_id": "assistant_plan",
    },
]


def _read_templates() -> list[dict]:
    if not _TEMPLATE_PATH.exists():
        return []
    try:
        data = json.loads(_TEMPLATE_PATH.read_text(encoding="utf-8"))
        return data.get("templates", [])
    except (json.JSONDecodeError, KeyError):
        return []


def _write_templates(templates: list[dict]) -> None:
    _TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _TEMPLATE_PATH.write_text(
        json.dumps({"templates": templates}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def ensure_templates() -> list[dict]:
    with _template_lock:
        templates = _read_templates()
        if not templates:
            templates = DEFAULT_TEMPLATES.copy()
            _write_templates(templates)
        return templates


def list_templates() -> list[dict]:
    with _template_lock:
        return _read_templates() or DEFAULT_TEMPLATES.copy()


def get_template(template_id: str) -> Optional[dict]:
    for item in list_templates():
        if item.get("id") == template_id:
            return item
    return None

