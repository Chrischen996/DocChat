"""Generate a mock financial report PDF for testing FinAnalyzer RAG Pro."""

from fpdf import FPDF
import os

class FinancialReportPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "TechVision Inc. - 2024 Annual Financial Report", align="C")
        self.ln(10)
        self.set_draw_color(0, 102, 204)
        self.set_line_width(0.5)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title: str):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(0, 51, 102)
        self.cell(0, 12, title)
        self.ln(10)

    def sub_title(self, title: str):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(51, 51, 51)
        self.cell(0, 10, title)
        self.ln(8)

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(33, 33, 33)
        self.multi_cell(0, 6, text)
        self.ln(4)

    def add_table(self, headers: list[str], rows: list[list[str]]):
        col_w = (self.w - 20) / len(headers)
        # Header row
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(0, 102, 204)
        self.set_text_color(255, 255, 255)
        for h in headers:
            self.cell(col_w, 8, h, border=1, fill=True, align="C")
        self.ln()
        # Data rows
        self.set_font("Helvetica", "", 9)
        self.set_text_color(33, 33, 33)
        fill = False
        for row in rows:
            if fill:
                self.set_fill_color(240, 245, 255)
            else:
                self.set_fill_color(255, 255, 255)
            for cell in row:
                self.cell(col_w, 7, cell, border=1, fill=True, align="C")
            self.ln()
            fill = not fill
        self.ln(6)


def generate_report(output_path: str):
    pdf = FinancialReportPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)

    # ── Page 1: Cover + Executive Summary ──
    pdf.add_page()
    pdf.ln(30)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(0, 51, 102)
    pdf.cell(0, 15, "TechVision Inc.", align="C")
    pdf.ln(18)
    pdf.set_font("Helvetica", "", 18)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 12, "Annual Financial Report", align="C")
    pdf.ln(10)
    pdf.cell(0, 12, "Fiscal Year 2024", align="C")
    pdf.ln(20)
    pdf.set_font("Helvetica", "I", 11)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 8, "Prepared for Shareholders and Investors", align="C")
    pdf.ln(6)
    pdf.cell(0, 8, "Published: March 15, 2025", align="C")

    # ── Page 2: Executive Summary ──
    pdf.add_page()
    pdf.section_title("1. Executive Summary")
    pdf.body_text(
        "TechVision Inc. delivered strong financial performance in fiscal year 2024, "
        "achieving total revenue of $2.85 billion, representing a year-over-year growth "
        "of 23.4%. This growth was primarily driven by our cloud services division, which "
        "saw a 41% increase in recurring subscription revenue. Net income reached $412 million, "
        "up from $298 million in FY2023, reflecting a 38.3% improvement."
    )
    pdf.body_text(
        "Operating margins expanded to 18.6% from 15.2% in the prior year, demonstrating "
        "the scalability of our platform and effective cost management. Free cash flow "
        "generation was $523 million, enabling continued investment in R&D while returning "
        "$180 million to shareholders through dividends and share repurchases."
    )
    pdf.body_text(
        "Key strategic milestones included the acquisition of DataStream Analytics for $340 million, "
        "the launch of our AI-powered analytics platform TechVision Insight, and expansion "
        "into three new international markets (Japan, Brazil, and Germany). Our customer "
        "base grew to over 12,500 enterprise clients, a 28% increase from the prior year."
    )

    # ── Page 3: Income Statement ──
    pdf.add_page()
    pdf.section_title("2. Consolidated Income Statement")
    pdf.body_text("All figures in USD millions for the fiscal year ended December 31.")
    pdf.add_table(
        ["Item", "FY2024", "FY2023", "Change (%)"],
        [
            ["Total Revenue",       "$2,850",  "$2,310",  "+23.4%"],
            ["Cost of Revenue",     "$1,425",  "$1,201",  "+18.7%"],
            ["Gross Profit",        "$1,425",  "$1,109",  "+28.5%"],
            ["R&D Expenses",        "$456",    "$392",    "+16.3%"],
            ["Sales & Marketing",   "$312",    "$278",    "+12.2%"],
            ["G&A Expenses",        "$128",    "$118",    "+8.5%"],
            ["Operating Income",    "$530",    "$351",    "+51.0%"],
            ["Interest Expense",    "($42)",   "($38)",   "+10.5%"],
            ["Income Tax",          "$76",     "$45",     "+68.9%"],
            ["Net Income",          "$412",    "$298",    "+38.3%"],
            ["EPS (Diluted)",       "$4.12",   "$2.98",   "+38.3%"],
        ],
    )
    pdf.body_text(
        "Gross margin improved to 50.0% from 48.0% year-over-year, reflecting higher-margin "
        "cloud revenue mix and operational efficiencies in our data center operations."
    )

    # ── Page 4: Balance Sheet ──
    pdf.add_page()
    pdf.section_title("3. Consolidated Balance Sheet")
    pdf.body_text("As of December 31 (USD millions).")
    pdf.sub_title("Assets")
    pdf.add_table(
        ["Item", "FY2024", "FY2023"],
        [
            ["Cash & Equivalents",       "$1,230",  "$980"],
            ["Accounts Receivable",      "$385",    "$312"],
            ["Short-term Investments",   "$450",    "$380"],
            ["Total Current Assets",     "$2,180",  "$1,760"],
            ["Property & Equipment",     "$890",    "$720"],
            ["Goodwill & Intangibles",   "$1,150",  "$810"],
            ["Total Assets",             "$4,520",  "$3,580"],
        ],
    )
    pdf.sub_title("Liabilities & Equity")
    pdf.add_table(
        ["Item", "FY2024", "FY2023"],
        [
            ["Accounts Payable",         "$198",    "$165"],
            ["Short-term Debt",          "$150",    "$120"],
            ["Total Current Liabilities","$520",    "$430"],
            ["Long-term Debt",           "$680",    "$580"],
            ["Total Liabilities",        "$1,340",  "$1,120"],
            ["Total Equity",             "$3,180",  "$2,460"],
            ["Total Liab. & Equity",     "$4,520",  "$3,580"],
        ],
    )

    # ── Page 5: Cash Flow ──
    pdf.add_page()
    pdf.section_title("4. Cash Flow Statement")
    pdf.body_text("For the fiscal year ended December 31 (USD millions).")
    pdf.add_table(
        ["Category", "FY2024", "FY2023"],
        [
            ["Net Income",                    "$412",    "$298"],
            ["Depreciation & Amortization",   "$145",    "$118"],
            ["Changes in Working Capital",    "($38)",   "($25)"],
            ["Cash from Operations",          "$668",    "$485"],
            ["Capital Expenditures",          "($145)",  "($120)"],
            ["Acquisitions",                  "($340)",  "($85)"],
            ["Cash from Investing",           "($470)",  "($195)"],
            ["Debt Issuance / (Repayment)",   "$100",    "$50"],
            ["Share Repurchases",             "($120)",  "($80)"],
            ["Dividends Paid",                "($60)",   "($45)"],
            ["Cash from Financing",           "($52)",   "($62)"],
            ["Net Change in Cash",            "$250",    "$228"],
            ["Free Cash Flow",                "$523",    "$365"],
        ],
    )

    # ── Page 6: Segment Breakdown ──
    pdf.add_page()
    pdf.section_title("5. Business Segment Performance")
    pdf.sub_title("5.1 Cloud Services (52% of Revenue)")
    pdf.body_text(
        "Cloud services revenue reached $1.48 billion, growing 41% year-over-year. "
        "Annual recurring revenue (ARR) crossed the $1.6 billion mark. Customer retention "
        "rate remained best-in-class at 97.2%. The segment's operating margin was 24.1%, "
        "up from 19.8% in FY2023, driven by economies of scale and infrastructure optimization."
    )
    pdf.sub_title("5.2 Enterprise Software (31% of Revenue)")
    pdf.body_text(
        "Enterprise software generated $883 million in revenue, a 12% increase. "
        "License revenue declined 5% as customers migrated to subscription models, "
        "while subscription revenue grew 28%. The segment contributed an operating margin of 22.3%."
    )
    pdf.sub_title("5.3 Professional Services (17% of Revenue)")
    pdf.body_text(
        "Professional services revenue was $487 million, up 8% year-over-year. "
        "Utilization rates improved to 78% from 74%. The segment is increasingly focused "
        "on AI implementation consulting, which accounted for 35% of new service engagements."
    )

    # ── Page 7: Risk Factors & Outlook ──
    pdf.add_page()
    pdf.section_title("6. Risk Factors")
    pdf.body_text(
        "Key risks include: (1) Intense competition in cloud infrastructure from major providers; "
        "(2) Cybersecurity threats and data privacy regulatory changes (GDPR, CCPA expansions); "
        "(3) Foreign currency exposure from expanding international operations (now 34% of revenue); "
        "(4) Integration risks from the DataStream Analytics acquisition; "
        "(5) Macroeconomic uncertainty affecting enterprise IT spending budgets; "
        "(6) Talent acquisition challenges in AI/ML engineering roles."
    )
    pdf.section_title("7. FY2025 Outlook")
    pdf.body_text(
        "Management provides the following guidance for fiscal year 2025:\n"
        "- Total revenue: $3.40 - $3.55 billion (19-25% growth)\n"
        "- Operating margin: 19.5% - 20.5%\n"
        "- EPS (Diluted): $4.80 - $5.10\n"
        "- Capital expenditures: $180 - $200 million\n"
        "- Free cash flow: $600 - $650 million\n\n"
        "Growth is expected to be led by continued cloud services expansion, the full-year "
        "contribution of DataStream Analytics, and the commercial launch of TechVision Insight "
        "AI platform scheduled for Q2 2025."
    )

    # ── Save ──
    pdf.output(output_path)
    print(f"Generated: {output_path} ({os.path.getsize(output_path):,} bytes, {pdf.pages_count} pages)")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "TechVision_Annual_Report_2024.pdf")
    generate_report(out)
