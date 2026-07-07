import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.react_parser import parse_react_output


def test_parse_standard_action():
    parsed = parse_react_output(
        "THOUGHT: 需要查文档\nACTION: document_search\nACTION_INPUT: 收入增长率"
    )

    assert parsed["type"] == "action"
    assert parsed["thought"] == "需要查文档"
    assert parsed["tool"] == "document_search"
    assert parsed["tool_input"] == "收入增长率"


def test_parse_deepseek_think_tag_action():
    parsed = parse_react_output(
        "<think>内部推理不应影响格式解析</think>\n"
        "THOUGHT: 需要检索\nACTION: document_search\nACTION_INPUT: 合同期限"
    )

    assert parsed["type"] == "action"
    assert parsed["thought"] == "需要检索"
    assert parsed["tool"] == "document_search"
    assert parsed["tool_input"] == "合同期限"


def test_parse_markdown_heading_labels():
    parsed = parse_react_output(
        "## Thought\n"
        "需要更广泛检索。\n"
        "## Action\n"
        "document_deep_search\n"
        "## Action Input\n"
        "利润和现金流趋势"
    )

    assert parsed["type"] == "action"
    assert parsed["thought"] == "需要更广泛检索。"
    assert parsed["tool"] == "document_deep_search"
    assert parsed["tool_input"] == "利润和现金流趋势"


def test_parse_bold_labels_final_answer():
    parsed = parse_react_output(
        "**THOUGHT:** 信息已经足够。\n"
        "**FINAL_ANSWER:** 结论是收入增长稳定。"
    )

    assert parsed["type"] == "final"
    assert parsed["thought"] == "信息已经足够。"
    assert parsed["answer"] == "结论是收入增长稳定。"


def test_parse_action_with_extra_explanation_after_action():
    parsed = parse_react_output(
        "THOUGHT: 需要生成图像\n"
        "ACTION: image_generate\n"
        "我将用图像工具生成海报。\n"
        "ACTION_INPUT: 科技风蓝色发布会海报"
    )

    assert parsed["type"] == "action"
    assert parsed["tool"] == "image_generate"
    assert parsed["tool_input"] == "科技风蓝色发布会海报"
