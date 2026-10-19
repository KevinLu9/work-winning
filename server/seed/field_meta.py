"""Label, group and type metadata for the 284 Salesforce Opportunity columns.

The UI renders opportunity detail pages from this table (sf_field_meta) so every
populated field is shown with a readable label in a sensible group.
"""
import re

GROUPS = [
    "Overview",
    "Outcome & Strategy",
    "Commercial",
    "Forecast by Financial Year",
    "Geography",
    "Timeline",
    "People",
    "Delivery & JV",
    "Risk & Compliance",
    "System",
]

DATE_FIELDS = {
    "CloseDate", "LastActivityDate", "LastStageChangeDate", "Client_Advised_Award_Date__c",
    "Commence_On_Site_Date__c", "Contract_End_Date_formula__c", "Contract_Start_Date__c",
    "Gold_ORB_Date__c", "Initial_Tender_Close_Date__c", "Proposal_Closing_Date__c",
    "Proposal_Final_Review_Date__c", "Proposal_Start_Date__c", "Submitted_to_Sector_Date__c",
    "Tender_Closing_Date__c", "Tender_Review_Date_Final__c", "Tender_Start_Date__c",
    "Tender_Validity_Expiry_Date__c", "Warranty_Completion_Date__c", "Win_Loss_Month__c",
}
DATETIME_FIELDS = {
    "CreatedDate", "LastModifiedDate", "LastReferencedDate", "LastViewedDate",
    "SystemModstamp", "Next_Steps_Last_Modified__c",
}

PEOPLE_FIELDS = {
    "Proposal_Manager__c": "Proposal Manager",
    "Bid_Writer__c": "Bid Writer",
    "Tender_Manager__c": "Tender Manager",
    "Tender_Co_ordinator__c": "Tender Co-ordinator",
    "Lead_Estimator__c": "Lead Estimator",
    "Commercial_Lead_Rev1__c": "Commercial Lead",
    "Legal_Lead__c": "Legal Lead",
    "SHEQ_Lead__c": "SHEQ Lead",
    "Tender_Review_Personnel__c": "Tender Review Personnel",
    "Next_Steps_Last_Modified_By__c": "Next Steps Last Modified By",
}

LABEL_OVERRIDES = {
    "Name": "Opportunity Name",
    "Amount": "Amount",
    "StageName": "Stage",
    "IsWon": "Won",
    "IsClosed": "Closed",
    "IsDeleted": "Deleted",
    "Id": "Salesforce Id",
    "ItemInternalId": "Internal Item Id",
    "@odata.etag": "OData ETag",
    "TCV_Converted__c": "Total Contract Value (TCV)",
    "ACV_Converted__c": "Annual Contract Value (ACV, converted)",
    "Opportunity_Parent_Account_Name__c": "Client (Parent Account)",
    "Division__c": "Sector (Division)",
    "Contract_Period_monthsRev1__c": "Contract Period (months)",
    "Contract_End_Date_formula__c": "Contract End Date",
    "Commercial_Lead_Rev1__c": "Commercial Lead",
    "CV_Group_Rev1__c": "CV Group",
    "Margin_as_of_CostsRev1__c": "Margin as % of Costs",
    "Margin_as_of_Revenue__c": "Margin as % of Revenue",
    "Commercial_Profile_is_Acceptable_c__c": "Commercial Profile Acceptable",
    "Client_s_Proposal_Number__c": "Client's Proposal Number",
    "Client_s_Tender_Number__c": "Client's Tender Number",
    "DoA_Level__c": "DoA Level",
    "DoA_Level_CR_PPP__c": "DoA Level (CR / PPP)",
    "PPP_Project__c": "PPP Project",
    "BRS_Opportunity_Number__c": "BRS Opportunity Number",
    "BRS_Rig__c": "BRS Rig",
    "JDE_Job_Number__c": "JDE Job Number",
    "Bid_Costs_JDE_Reference__c": "Bid Costs JDE Reference",
    "SHEQ_Lead__c": "SHEQ Lead",
    "SAC_PC__c": "SAC / PC",
    "WIH_Comments__c": "WIH Comments",
    "Included_in_WIH__c": "Included in WIH",
    "VES_Service_Lines__c": "VES Service Lines",
    "VES_Total__c": "VES Total",
    "X2016_Building_Code_Compliance_Required__c": "2016 Building Code Compliance Required",
    "Gate_1_OBP_Required__c": "Gate 1 OBP Required",
    "Gold_ORB_Date__c": "Gold ORB Date",
    "IT_Comments__c": "IT Comments",
    "IT_Complexity__c": "IT Complexity",
    "IT_Solution__c": "IT Solution",
    "Digital_TCV__c": "Digital TCV",
    "Digital_Engagement_2__c": "Digital Engagement",
    "Initial_Meeting_with_Client_cbx__c": "Initial Meeting with Client",
    "Funding_Proposed_or_Approved_cbx__c": "Funding Proposed or Approved",
    "mh_Associated_Blue_Sheet__c": "Associated Blue Sheet",
    "mh_Associated_Scorecard__c": "Associated Scorecard",
    "mh_Scorecard_Total__c": "Scorecard Total",
    "Go_Get__c": "Go / Get",
    "Won_Lost_Reason__c": "Won / Lost Reasons",
    "Reason_Won_Lost__c": "Reason Won / Lost",
    "Proposal_Teamsite__c": "Proposal Teamsite (SharePoint)",
    "Location_of_Project__c": "Location of Project",
    "New_Zealand_North__c": "New Zealand North %",
    "New_Zealand_South__c": "New Zealand South %",
}

STATE_RE = re.compile(r"^(Australia_(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)|New_Zealand_(North|South))(_Weighted)?(_Revenue)?__c$")

# (pattern, group) evaluated in order; first match wins.
GROUP_RULES = [
    (r"^(@odata|ItemInternalId$|Id$|AccountId$|ContactId$|.*ById$|RecordTypeId$|SystemModstamp$|Last(Activity|Referenced|Viewed|Modified)Date$|Last.*HistoryId$|Has|IsDeleted$|PushCount$|Push_Counter__c$|.*@odata\.type$|mh_|JDE_|BRS_|Bid_Costs_JDE|Unique_Opportunity_Identifier__c$|Parent_Opp_ID__c$|Opportunity_Parent__c$|Parent_Account__c$|Tender_Number_CATS__c$|Client_s_|SAC_PC__c$|Next_Steps_Last_Modified__c$|OwnerId$|CreatedById$|LastStageChangeDate$)", "System"),
    (r"^Estimated_FY\d\d_", "Forecast by Financial Year"),
    (r"^(Australia_|New_Zealand_|Country__c$|Location_of_Project__c$|Project_Location__c$|Unallocated)", "Geography"),
    (r"(Date|Date__c|Date_formula__c|Date_Final__c|Month__c)$|^Contract_Period|^Opportunity_Age__c$|^Defects_Liability|^Within_6_Months__c$", "Timeline"),
    (r"^(" + "|".join(PEOPLE_FIELDS) + r")$", "People"),
    (r"^(StageName|IsWon|IsClosed|Binary_Win__c|Opportunity_Status__c|Won_Lost_Reason__c|Reason_Won_Lost__c|Win_Strategy__c|Competitor_Analysis__c|Incumbent|Strategic_|Scope_market_aligned|Project_Awarded_to__c|Award_Conversion__c|Go_Get__c|Solution__c|NextStep$|Last_Approved_Gate__c|Gate_1)", "Outcome & Strategy"),
    (r"(JV|Joint_Pursuit|Subcontractor|Ventia_|Design_O_M_Partner|PPP_|Equity|Third_Party_Funding|Digital_|IT_|VES_|Total_Equity_Value)", "Delivery & JV"),
    (r"(Bonding|Building_Code|Cash|Liquidated|Legal_Liability|Parent_Company_Guarantee|Critical_Risk|Foreign|Corporate_Limits|Due_Diligence|Probity|Binding_Proposal|Escalation|Contingency|Visibility_Classification|Capex|Form_of_security|Payment_Type|Commercial_Profile|DoA_Level|Building|X2016|Cashflow|Opportunity_Parent_Risk|Warranty)", "Risk & Compliance"),
    (r"(Amount|Value|Revenue|Margin|Cost|Price|Probability|Forecast|Fiscal|Currency|TCV|ACV|Bid_Costs|Escalation|Scorecard|Phasing|Include_In_New_Work_Forecast|Included_in_WIH|WIH_)", "Commercial"),
]

CURRENCY_RE = re.compile(r"(Amount|Value|Revenue|Margin__c|Margin$|Cost|Price|TCV|ACV|Bid_Costs__c|Liability_Value|Damages_cap|daily_rate|Foreign_Exposure_Amount|Bonding_Requirement_Amount|Capex_requirement|Total_Equity_Value|VES_Total)")
PERCENT_RE = re.compile(r"(Probability|Portion|^Australia_(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)__c$|^New_Zealand_(North|South)__c$|^Unallocated__c$|Margin_as_of|Subcontractor_of_Revenue|Cash_Retention__c|Contingency__c)")
BOOL_FIELDS = {"IsWon", "IsClosed", "IsDeleted", "HasOpenActivity", "HasOpportunityLineItem", "HasOverdueTask", "Binary_Win__c"}

KEY_FIELDS = [
    "Name", "Opportunity_Parent_Account_Name__c", "Division__c", "Business_Unit__c", "Line_of_Business__c",
    "Discipline__c", "StageName", "Opportunity_Status__c", "Scope_of_Works__c", "TCV_Converted__c",
    "Annual_Contract_Value__c", "Probability", "Project_Location__c", "Proposal_Manager__c",
]


def label_for(col: str) -> str:
    if col in LABEL_OVERRIDES:
        return LABEL_OVERRIDES[col]
    if col in PEOPLE_FIELDS:
        return PEOPLE_FIELDS[col]
    m = STATE_RE.match(col)
    if m:
        region = (m.group(2) or ("NZ " + m.group(3)))
        if m.group(5):
            return f"{region} {'Weighted ' if m.group(4) else ''}Revenue"
        return f"{region} Revenue Split %"
    base = col.replace("__c@odata.type", " (OData type)").removesuffix("__c")
    base = re.sub(r"Rev1$|_Rev$|_cbx$|_formula$", "", base)
    base = base.replace("_", " ")
    base = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", base)  # camelCase
    base = re.sub(r"\bFY(\d\d)\b", r"FY\1", base)
    return re.sub(r"\s+", " ", base).strip()


def group_for(col: str) -> str:
    for pattern, group in GROUP_RULES:
        if re.search(pattern, col):
            return group
    return "Overview"


def type_for(col: str) -> str:
    if col in DATE_FIELDS:
        return "date"
    if col in DATETIME_FIELDS:
        return "datetime"
    if col in BOOL_FIELDS:
        return "boolean"
    if col in PEOPLE_FIELDS:
        return "person"
    if col == "Proposal_Teamsite__c":
        return "link"
    if col in ("Won_Lost_Reason__c", "VES_Service_Lines__c", "Bonding_Type__c"):
        return "multiselect"
    if PERCENT_RE.search(col):
        return "percent"
    if CURRENCY_RE.search(col) and not col.endswith("Method__c") and "Comments" not in col and "explanation" not in col:
        return "currency"
    return "text"


def build_field_meta(columns: list[str]) -> list[dict]:
    rows = []
    for i, col in enumerate(columns):
        group = group_for(col)
        rows.append({
            "column_name": col,
            "label": label_for(col),
            "field_group": group,
            "field_type": type_for(col),
            "sort_order": i,
            "is_key": 1 if col in KEY_FIELDS else 0,
            # System plumbing (odata types, history ids) is hidden unless "show all fields" is on.
            "display": 0 if col.endswith("@odata.type") or col == "@odata.etag" or "HistoryId" in col else 1,
        })
    return rows
