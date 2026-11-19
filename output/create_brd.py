from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION

OUT = r"C:\Users\DELL\Desktop\ECOMMERCE\Ecommerce-360-main\output\Ecommerce_Analytics_BRD.docx"

doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(.68); sec.bottom_margin = Inches(.68)
sec.left_margin = Inches(.78); sec.right_margin = Inches(.78)

styles = doc.styles
styles['Normal'].font.name = 'Aptos'; styles['Normal'].font.size = Pt(9.4); styles['Normal'].font.color.rgb = RGBColor(43,55,70)
styles['Normal']._element.rPr.rFonts.set(qn('w:ascii'),'Aptos'); styles['Normal']._element.rPr.rFonts.set(qn('w:hAnsi'),'Aptos')
for nm, size, color in [('Title',27,'17324D'),('Heading 1',16,'17324D'),('Heading 2',11.5,'236B73'),('Heading 3',10,'236B73')]:
    st=styles[nm]; st.font.name='Aptos Display'; st.font.size=Pt(size); st.font.bold=True; st.font.color.rgb=RGBColor.from_string(color)
    st._element.rPr.rFonts.set(qn('w:ascii'),'Aptos Display'); st._element.rPr.rFonts.set(qn('w:hAnsi'),'Aptos Display')
styles['Heading 1'].paragraph_format.space_before=Pt(12); styles['Heading 1'].paragraph_format.space_after=Pt(5)
styles['Heading 2'].paragraph_format.space_before=Pt(7); styles['Heading 2'].paragraph_format.space_after=Pt(3)

def shade(cell, fill):
    tcPr=cell._tc.get_or_add_tcPr(); shd=OxmlElement('w:shd'); shd.set(qn('w:fill'),fill); tcPr.append(shd)
def set_cell(cell, text, bold=False, color=None, size=8.1):
    cell.text=''; p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(1); p.paragraph_format.space_before=Pt(1)
    r=p.add_run(str(text)); r.bold=bold; r.font.name='Aptos'; r.font.size=Pt(size)
    if color: r.font.color.rgb=RGBColor.from_string(color)
    cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
def table(headers, rows, widths=None, size=8.0):
    t=doc.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.style='Table Grid'; t.autofit=False
    if widths:
        for c,w in zip(t.columns,widths): c.width=Inches(w)
    for i,h in enumerate(headers): set_cell(t.rows[0].cells[i],h,True,'FFFFFF',size); shade(t.rows[0].cells[i],'17324D')
    for idx,row in enumerate(rows):
        cells=t.add_row().cells
        if widths:
            for c,w in zip(cells,widths): c.width=Inches(w)
        for i,val in enumerate(row):
            set_cell(cells[i],val,False,None,size)
            if idx%2==1: shade(cells[i],'F1F5F7')
    doc.add_paragraph().paragraph_format.space_after=Pt(0)
    return t
def p(text='', style=None):
    return doc.add_paragraph(text, style)
def bullet(text):
    x=doc.add_paragraph(style='List Bullet'); x.paragraph_format.space_after=Pt(1); x.add_run(text); return x
def req(id, title, desc, priority='Must'):
    x=doc.add_paragraph(); x.paragraph_format.space_after=Pt(3)
    r=x.add_run(f'{id}  {title} ({priority}) '); r.bold=True; r.font.color.rgb=RGBColor(35,107,115)
    x.add_run(desc)

# footer
foot=sec.footer.paragraphs[0]; foot.alignment=WD_ALIGN_PARAGRAPH.RIGHT
rr=foot.add_run('Ecommerce Analytics BRD  |  CLASPO + Monkeyman  |  18 November 2026'); rr.font.size=Pt(8); rr.font.color.rgb=RGBColor(100,115,128)

title=doc.add_paragraph(style='Title'); title.add_run('Ecommerce Analytics Business Requirements')
sub=doc.add_paragraph(); sub.paragraph_format.space_after=Pt(8)
r=sub.add_run('Business requirements document'); r.bold=True; r.font.size=Pt(12); r.font.color.rgb=RGBColor(35,107,115)
p('Proposed analytics module for the existing Vercel commerce command center')
table(['Document control','Value'],[
 ['Business / product','CLASPO + Monkeyman'],['Source basis','Ecommerce Analytics Developer Handoff, dated 16 November 2026'],
 ['Document date','18 November 2026'],['Status','Requirements baseline for stakeholder review'],
 ['Purpose','Define business outcomes, scope, data and reporting rules, workflows, and acceptance conditions for ecommerce analytics.']
],[1.65,5.75],8.5)
doc.add_heading('Executive summary',1)
p('The business needs one reliable view of ecommerce performance across Amazon, Flipkart, and Shopify that explains revenue, contribution after advertising, inventory and operational exposure, settlements, and recommended next actions. The system will turn reconciled source data into period-based reporting and traceable tasks for business owners.')
p('The supplied visual is a mockup: its figures and recommendations are illustrative, and no seller accounts are connected. This BRD describes the proposed production scope; it does not treat the mockup as evidence of working integrations or validated metrics.')
doc.add_heading('1. Business context and objectives',1)
p('The current handoff proposes an analytics module inside the existing Vercel command center. The intended users need comparable reporting across brands and channels, transparent metric definitions, operational alerts, settlement investigation, and follow-up measurement.')
table(['ID','Business objective','Success evidence'],[
 ['BO-01','Provide trustworthy, comparable performance reporting for selected brands, channels, and periods.','Selected-period totals reconcile to source exports with documented timing, tax, attribution, and processing differences.'],
 ['BO-02','Explain the drivers of contribution and operational risk.','Users can trace KPI and table values to source records and supporting calculations.'],
 ['BO-03','Detect actionable advertising, stock, returns, dispatch, and settlement exceptions.','Configured rules produce evidence-backed recommendations and suppress unsupported conclusions.'],
 ['BO-04','Assign and measure improvement work.','Tasks retain owner, due date, status, audit history, and a comparable follow-up outcome.']
],[.65,3.0,3.75],7.9)
doc.add_heading('2. Stakeholders and users',1)
table(['Role','Interest / responsibility'],[
 ['Business leadership / brand owner','Review performance, priorities, and outcomes across brands.'],
 ['Finance','Approve metric definitions, costs, refund and settlement basis; investigate payout differences.'],
 ['Marketing / ads operator','Review spend, attribution, ROAS/ACoS, and campaign-level recommendations.'],
 ['Operations / inventory owner','Monitor stock cover, supplier lead time, fulfilment delays, returns, and RTO.'],
 ['Analyst / data administrator','Map source accounts and SKUs, validate imports, reconcile reports, and monitor freshness.'],
 ['Developer / platform administrator','Implement integrations, access controls, resilient imports, calculations, and system monitoring.']
],[2.15,5.25],8.0)
doc.add_heading('3. Scope',1)
doc.add_heading('In scope',2)
for s in ['Overview reporting for net revenue, orders, units, average order value, contribution after advertising, spend, returns, and RTO.','SKU, variant, bundle, and channel reporting for Amazon, Flipkart, and Shopify, with drill-through to underlying records.','Advertising performance and attribution-aware comparisons.','Inventory and operations reporting, including dated stock snapshots, stock cover, incoming inventory, slow stock, return reasons, RTO, and dispatch delays.','Expected versus received settlements, deductions, unmatched transactions, and finance investigation tasks.','Evidence-backed recommendation and task lifecycle with assignment, due dates, audit history, and follow-up measurement.','Source health, data freshness, import validation, reconciliation support, and role-based access.']:
    bullet(s)
doc.add_heading('Out of scope / constraints',2)
for s in ['The mockup itself is not a production feature or validated data source.','Automated campaign, pricing, or other commercial changes; human approval is required.','Calling contribution after ads “net profit”; overheads are excluded.','Summing platform-attributed revenue as unique sales across platforms.','Unverified seller integrations, target values, threshold values, refresh service levels, or user-role policies; these require kickoff decisions.']:
    bullet(s)
doc.add_heading('4. Business requirements',1)
doc.add_heading('4.1 Reporting and navigation',2)
req('FR-01','Reporting periods','Provide the last 7, 15, and 30 completed days and a custom date range. Use Asia/Kolkata midnight boundaries. Display exact selected dates and immediately preceding equal-length comparison dates.','Must')
req('FR-02','Provisional current day','Show today separately as provisional and distinguish it from completed-day results.','Must')
req('FR-03','Filters','Provide brand, channel, SKU, category, campaign, and fulfilment-method filters. Period and brand changes update all period-based KPIs, product rows, and recommendations.','Must')
req('FR-04','Comparisons','Show absolute and percentage changes. If the comparison denominator is zero, show “No comparable baseline.” Mark promotions, stockouts, and incomplete source data.','Must')
req('FR-05','Drill-through','KPI and table drill-throughs show underlying evidence and retain the selected filters.','Must')
req('FR-06','Inventory snapshot','Present inventory as a current, dated snapshot and disclose the sales-velocity lookback used for stock cover.','Must')
doc.add_heading('4.2 Required screens and information',2)
table(['Screen','Business information required'],[
 ['Overview','Net product revenue, orders, units, average order value, contribution after ads, ad spend, returns, and RTO.'],
 ['Products and channels','SKU / variant / bundle results; Amazon, Flipkart, and Shopify comparison; drill-through to records.'],
 ['Advertising','Spend, impressions, clicks, CPC, attributed orders and revenue, ROAS, and ACoS. Preserve each platform attribution window and basis.'],
 ['Inventory and operations','Stock cover, incoming inventory, supplier lead time, slow stock, return reasons, RTO, and dispatch delays.'],
 ['Settlements','Expected and received payouts, deductions, unmatched transactions, and finance tasks.'],
 ['Action centre','Priority, evidence, recommended action, confidence, owner, due date, status, and follow-up outcome.']
],[1.65,5.75],8.0)
doc.add_heading('4.3 Metric and business rules',2)
table(['Metric','Business definition / rule'],[
 ['Net product revenue','Product revenue after discounts and refunds, excluding GST and cancelled sales. Do not double-count source net totals and separate refund events.'],
 ['Contribution before ads','Net revenue minus attributable product costs, packaging, and variable selling costs.'],
 ['Contribution after ads','Contribution before ads minus advertising spend. Overheads are excluded; do not label this as net profit.'],
 ['Contribution margin','Contribution after ads divided by net revenue. Return N/A when net revenue is zero.'],
 ['ROAS / ACoS','Platform-attributed ad revenue divided by spend; spend divided by platform-attributed ad revenue. Preserve platform attribution basis/window.'],
 ['Stock cover','Sellable units divided by average daily units over a declared lookback. Return N/A when demand is zero.'],
 ['Cohort and cash dates','Keep order-cohort performance separate from refund and settlement cash dates; flag recent cohorts provisional.'],
 ['Returned stock','Cost recovery depends on item condition and restocking; do not assume every return restores sellable inventory.'],
 ['Shared ad costs','Label allocations explicitly. Do not add attributed sales across platforms as unique sales.']
],[1.7,5.7],7.7)
doc.add_heading('5. Recommendation and action workflow',1)
p('Recommendations use deterministic, versioned rules over verified results. An AI explanation may summarize the evidence, but must not replace the underlying calculation or create unsupported facts. Potential causes are presented as hypotheses where the evidence does not prove causation.')
table(['Trigger','Expected response'],[
 ['Ad spend exceeds allowable level','Review bids, targets, price, and conversion; apply minimum sample-size and attribution-maturity checks.'],
 ['Stock cover falls below lead time plus safety stock','Request replenishment, check purchase orders, and avoid scaling campaigns into a likely stockout.'],
 ['Conversion falls while clicks rise','Investigate price, delivery promise, content, reviews, and availability; label causes as hypotheses.'],
 ['Returns or RTO exceed approved threshold','Inspect SKU, reason, and channel patterns; compare cohorts of similar maturity.'],
 ['Sales rise while contribution falls','Decompose product mix, costs, fees, discounts, and advertising.'],
 ['Settlement differs from expected payout','Create a finance investigation linked to affected transactions.']
],[2.85,4.55],7.8)
req('FR-07','Recommendation record','Store rule ID and version, period, affected entity, supporting numbers, data freshness, confidence, proposed action, owner, due date, and status.','Must')
req('FR-08','Impact estimate','Show assumptions with any estimated financial impact. Suppress strong recommendations if costs or source data are missing.','Must')
req('FR-09','Task audit','Persist owner, due date, status, change history, original recommendation baseline, and follow-up measurement.','Must')
req('FR-10','Human approval','Keep campaign and pricing changes human-approved.','Must')
doc.add_heading('6. Data and integration requirements',1)
table(['Business input','Required details'],[
 ['Accounts and access','Brand, seller account, store, and ad-account inventory; authorized access; representative sample exports.'],
 ['Product master','Internal SKU, channel listing IDs, variant, brand, category, and bundle bill of materials.'],
 ['Costs and inventory','Effective-dated landed and packaging costs, variable fees; sellable, reserved, damaged, and incoming stock.'],
 ['Targets and operations','Margin target, ad budget, return/RTO thresholds, supplier lead times, safety stock, promotions, and owners.'],
 ['History','At least 90 days recommended; ideally 12 months. Retain raw orders, line items, returns, refunds, fees, settlements, and ad reports.']
],[1.8,5.6],7.9)
p('The proposed data flow is source APIs and CSV imports, raw records, normalized database, deterministic metrics, rule engine, AI explanation, then dashboard and tasks. Vercel remains the application layer. Durable storage and resumable background jobs support imports.')
p('Core records include brand, channel account, SKU, listing mapping, bundle component, effective-dated cost, order, line item, refund/return, fee, settlement, campaign daily result, inventory snapshot, purchase order, sync run, and recommendation/task.')
for s in ['Join records by source account and source identifiers, not product titles.','Validate CSV schema and currency; keep raw records for reconciliation.','Use decimal-safe arithmetic for money. Handle pagination, rate limits, retries, checkpoints, deduplication, monitoring, and late data refresh.','Show freshness per source. Keep credentials server-side and enforce role-based access.']:
    bullet(s)
doc.add_heading('7. Nonfunctional requirements',1)
table(['ID','Requirement'],[
 ['NFR-01 Reliability','Imports are resumable and retry-safe; re-imports do not duplicate transactions. Late updates amend the correct records.'],
 ['NFR-02 Data integrity','Raw records remain available for reconciliation; money uses decimal-safe calculations; currency and schema are validated.'],
 ['NFR-03 Security','Credentials remain server-side; access is role-based and limited to authorized accounts and users.'],
 ['NFR-04 Transparency','Display freshness by source and identify incomplete feeds, provisional cohorts, and assumptions.'],
 ['NFR-05 Usability','Filters persist into drill-throughs; empty results, zero denominators, and mobile layout are handled clearly.'],
 ['NFR-06 Extensibility','Support source API and CSV input paths and refresh recent history for late refunds, fees, and attribution updates.']
],[1.4,6.0],8.0)
doc.add_heading('8. Delivery approach and acceptance',1)
table(['Stage','Deliverable / exit condition'],[
 ['1. Reliable reporting','Validate source access; load history; approve SKU mapping and metric contract; deliver overview and product/channel reports; reconcile a selected period to source exports.'],
 ['2. Business controls','Add advertising, inventory, returns/RTO, and settlements; configure rules and source-health alerts; implement evidence drill-through.'],
 ['3. Action workflow','Add grounded AI summaries, assignment, due dates, audit history, and before/after measurement. Campaign and pricing changes remain human-approved.']
],[1.65,5.75],8.0)
doc.add_heading('Acceptance criteria',2)
for s in ['7-, 15-, and 30-day windows use IST midnight boundaries and correct equal-length comparison windows.','Identical file imports and job retries do not duplicate transactions; late updates amend the correct records.','Partial refunds, cancellations, bundle components, stock recovery, and effective-dated cost changes follow finance-approved outcomes.','Missing costs or incomplete feeds cannot produce a false profitable status or a confident recommendation.','Channel totals reconcile to account exports; differences are documented for time zones, tax, attribution, and processing delays.','Every recommendation exposes its evidence and rule; configurable thresholds include minimum sample size and maturity checks.','Filters, zero-denominator cases, empty results, mobile layout, and role-based access work correctly.','Tasks persist with owner, due date, status, and history; follow-up measurement retains the original recommendation baseline.']:
    bullet(s)
doc.add_heading('9. Assumptions, dependencies, risks',1)
table(['Type','Statement / response'],[
 ['Assumption','The existing Vercel command center remains the application layer; exact hosting limits and background-job design must be confirmed by engineering.'],
 ['Dependency','Business supplies authorized account access, sample exports, product mappings, effective-dated cost ownership, targets, thresholds, and owners.'],
 ['Dependency','Finance approves definitions, refund basis, shared-cost allocation, tax treatment, and reconciliation tolerances before implementation.'],
 ['Risk','Incomplete mappings or costs can make profitability and recommendations misleading; suppress strong conclusions and surface gaps.'],
 ['Risk','Late refunds, fees, and ad attribution changes can alter recent periods; refresh recent history and flag immature cohorts.'],
 ['Risk','Platform attribution windows differ; preserve each basis and avoid summing attributed revenue as unique sales.'],
 ['Risk','Inventory quantity alone does not guarantee sellable stock; distinguish sellable, reserved, damaged, and incoming units.']
],[1.25,6.15],7.7)
doc.add_heading('10. Decisions required at kickoff',1)
table(['Decision','Owner(s) to confirm','Status'],[
 ['Brands, accounts, stores, ad accounts, and authorized access','Business / account owners','Open'],
 ['Source availability, priority channels, and refresh cadence','Business + engineering','Open'],
 ['SKU, listing, variant, and bundle mappings','Product / data owner','Open'],
 ['Cost ownership and effective dates','Finance / operations','Open'],
 ['Reporting basis, refund handling, tax treatment, and settlement reconciliation','Finance','Open'],
 ['Shared advertising cost allocation','Finance + marketing','Open'],
 ['Targets, thresholds, sample sizes, and attribution maturity rules','Business owners + finance','Open'],
 ['Inventory velocity lookback, supplier lead times, and safety stock','Operations','Open'],
 ['User roles, permissions, and task ownership','Business + administrator','Open']
],[3.65,2.55,1.2],7.8)
doc.add_heading('11. Glossary',1)
table(['Term','Meaning'],[
 ['ACoS','Advertising cost of sales: platform ad spend divided by platform-attributed ad revenue.'],
 ['AOV','Average order value; the specific order and revenue basis must follow the approved metric contract.'],
 ['RTO','Return to origin; orders returned before successful delivery.'],
 ['ROAS','Return on ad spend: platform-attributed ad revenue divided by ad spend.'],
 ['IST','India Standard Time; reporting boundaries use Asia/Kolkata.'],
 ['Contribution after ads','Contribution before ads less advertising spend; excludes overheads and is not net profit.']
],[1.75,5.65],8.0)
doc.add_heading('Source basis',1)
p('This BRD reorganizes the requirements and constraints in Ecommerce_Analytics_Developer_Handoff.pdf (5 pages, dated 16 November 2026). Its linked technical references are preserved here for implementation planning:')
for s in ['Vercel Functions duration: https://vercel.com/docs/functions/configuring-functions/duration','Shopify orders API: https://shopify.dev/docs/api/admin-graphql/latest/queries/orders','Amazon settlement report types: https://developer-docs.amazon/sp-api/docs/report-type-values-settlement']:
    bullet(s)

doc.core_properties.title='Ecommerce Analytics Business Requirements'
doc.core_properties.subject='BRD for the proposed ecommerce analytics module'
doc.core_properties.author='CLASPO + Monkeyman'
doc.save(OUT)
print(OUT)
