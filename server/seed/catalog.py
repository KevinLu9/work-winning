"""Reference data used to generate realistic synthetic opportunities and content."""


REGIONS = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA", "NZ North", "NZ South"]
REGION_PREFIX = {r: f"Australia_{r}" for r in REGIONS[:8]} | {"NZ North": "New_Zealand_North", "NZ South": "New_Zealand_South"}
REGION_NAMES = {
    "ACT": "Australian Capital Territory", "NSW": "New South Wales", "NT": "Northern Territory",
    "QLD": "Queensland", "SA": "South Australia", "TAS": "Tasmania", "VIC": "Victoria", "WA": "Western Australia",
    "NZ North": "New Zealand (North Island)", "NZ South": "New Zealand (South Island)", "National": "Australia - National",
}
CITY = {
    "ACT": "Canberra", "NSW": "Sydney", "NT": "Darwin", "QLD": "Brisbane", "SA": "Adelaide", "TAS": "Hobart",
    "VIC": "Melbourne", "WA": "Perth", "NZ North": "Auckland", "NZ South": "Christchurch", "National": "Sydney",
}

SECTORS = [
    {
        "id": "dsi", "name": "Defence & Social Infrastructure", "short": "D&SI",
        "description": "Estate, facilities and asset services for defence, health, education and justice clients.",
        "offerings": [
            {
                "bu": "Defence Estate Services", "lob": "Defence - Estate Maintenance", "discipline": "Estate & Facilities Maintenance",
                "clients": [("Department of Defence", ["NT", "QLD", "NSW", "SA", "WA", "ACT"], True)],
                "names": ["{region} Estate Maintenance and Operations Services", "Defence Base Services - {region} Region",
                          "Garrison Support Services {region}", "Estate Works Program - {city} Bases"],
                "scope": ["Integrated estate maintenance, minor works and garrison support services across Defence bases in {region_name} for a {months} month term.",
                          "Delivery of hard and soft facilities management, hazardous materials management and emergency response across {n} Defence sites in {region_name}."],
            },
            {
                "bu": "Social Infrastructure", "lob": "Social Infrastructure - Health", "discipline": "Facilities Management",
                "clients": [("NSW Health Infrastructure", ["NSW"], True), ("Queensland Health", ["QLD"], True),
                            ("Department of Health Victoria", ["VIC"], True), ("Te Whatu Ora", ["NZ North", "NZ South"], True)],
                "names": ["{city} Hospital Facilities Management Services", "{client_short} Hospital PPP Hard Services",
                          "Regional Health Facilities Maintenance - {region}"],
                "scope": ["Hard and soft facilities management services across {n} hospital and health facilities in {region_name}, including biomedical engineering support and 24/7 helpdesk.",
                          "Lifecycle, maintenance and facility services for a public hospital PPP in {city} over a {months} month concession period."],
            },
            {
                "bu": "Social Infrastructure", "lob": "Social Infrastructure - Justice & Education", "discipline": "Facilities Management",
                "clients": [("Department of Justice and Community Safety", ["VIC"], True), ("Victorian Department of Education", ["VIC"], True),
                            ("NSW Department of Education", ["NSW"], True), ("Department of Corrections NZ", ["NZ North"], True)],
                "names": ["{region} Correctional Facilities Maintenance", "Schools Maintenance Program - {region}",
                          "Courts and Justice Precinct FM Services {city}"],
                "scope": ["Planned and reactive maintenance across {n} correctional centres in {region_name} with secure-site workforce and escort protocols.",
                          "Routine and capital maintenance for {n} schools across {region_name}, including school-holiday works delivery."],
            },
        ],
    },
    {
        "id": "transport", "name": "Transport", "short": "Transport",
        "description": "Road, rail and tolling operations and maintenance across Australia and New Zealand.",
        "offerings": [
            {
                "bu": "Transport Operations Australia", "lob": "Transport Ops Aust - QTSC", "discipline": "Minor Capital Works",
                "clients": [("Queensland Department of Transport and Main Roads", ["QLD"], True), ("Transport for NSW", ["NSW"], True),
                            ("Main Roads Western Australia", ["WA"], True), ("Department of Transport and Planning Victoria", ["VIC"], True)],
                "names": ["{client_short} Road Maintenance Performance Contract - {region}", "{highway} Targeted Safety Upgrade Program",
                          "{city} Network Resurfacing Program", "{highway} Intersection Upgrades Package"],
                "scope": ["Road rehabilitation, resurfacing and intersection improvements along the {highway} in {region_name} for a {months} month program term.",
                          "Routine maintenance, incident response and minor capital works across {n} km of state-controlled road network in {region_name}."],
            },
            {
                "bu": "Rail Services", "lob": "Rail - Maintenance", "discipline": "Rail Systems",
                "clients": [("Sydney Trains", ["NSW"], True), ("Queensland Rail", ["QLD"], True), ("Metro Trains Melbourne", ["VIC"], False),
                            ("KiwiRail", ["NZ North", "NZ South"], True)],
                "names": ["{client_short} Track and Civil Maintenance", "{city} Rail Signalling Maintenance Services",
                          "Rail Corridor Vegetation and Drainage Program - {region}"],
                "scope": ["Track, civil and signalling maintenance across the {city} metropolitan rail network including possession planning and night works.",
                          "Corridor maintenance, drainage remediation and structures inspection over {n} km of rail corridor in {region_name}."],
            },
            {
                "bu": "Transport NZ", "lob": "NZ Roads Maintenance", "discipline": "Road Maintenance",
                "clients": [("Waka Kotahi NZ Transport Agency", ["NZ North", "NZ South"], True), ("Auckland Transport", ["NZ North"], True),
                            ("Christchurch City Council", ["NZ South"], True)],
                "names": ["{region} Network Outcomes Contract", "{city} Local Roads Maintenance", "State Highway Resilience Works - {region}"],
                "scope": ["Network outcomes contract covering maintenance, renewals and emergency response for state highways in {region_name}.",
                          "Local road maintenance and footpath renewals for council networks around {city} over {months} months."],
            },
            {
                "bu": "Tolling & ITS", "lob": "Tolling Operations", "discipline": "Tolling & ITS",
                "clients": [("Transurban", ["NSW", "VIC", "QLD"], False), ("Transport for NSW", ["NSW"], True)],
                "names": ["{city} Motorway Operations and Maintenance", "{client_short} Tunnel Systems Maintenance"],
                "scope": ["Operations, incident response and electrical/mechanical maintenance of motorway tunnels and ITS assets in {city}."],
            },
        ],
    },
    {
        "id": "telco", "name": "Telecommunications", "short": "Telco",
        "description": "Fixed, wireless and core network design, construction, operations and maintenance.",
        "offerings": [
            {
                "bu": "Telco Access Networks", "lob": "Telco AN - NBN O&M", "discipline": "Telco",
                "clients": [("NBN Co Limited", ["National", "NSW", "VIC", "QLD", "WA"], False)],
                "names": ["NBN - Unify Network - {region} Extension", "NBN Fibre Upgrade Program - {region}",
                          "NBN Fixed Wireless Maintenance {region}", "NBN Network Assurance Services - {region}"],
                "scope": ["Assurance, activation and maintenance of the nbn fixed-line network across {region_name} under the Unify framework.",
                          "Fibre-to-the-premises upgrade construction for {n},000 premises across {region_name}."],
            },
            {
                "bu": "Telco Core Networks", "lob": "Telco CN - Third Party", "discipline": "Telco",
                "clients": [("Optus Networks", ["National", "QLD", "NSW"], False), ("Telstra", ["National", "VIC", "WA"], False),
                            ("TPG Telecom", ["National"], False), ("Chorus NZ", ["NZ North", "NZ South"], False)],
                "names": ["{client_short} Core Network O&M Renewal", "{client_short} Data Centre Field Services",
                          "{client_short} Regional Exchange Maintenance - {region}"],
                "scope": ["Operate and maintain core transmission and exchange infrastructure for {client} across {region_name}.",
                          "Field services for data centre and core network sites including power, cooling and fibre patching."],
            },
            {
                "bu": "Telco Wireless", "lob": "Telco Wireless - Mobile Sites", "discipline": "Mobile Network Deployment",
                "clients": [("Telstra", ["National", "VIC", "WA"], False), ("TPG Telecom", ["National"], False),
                            ("Spark NZ", ["NZ North", "NZ South"], False), ("Optus Networks", ["National"], False)],
                "names": ["{client_short} 5G Small Cell Rollout - {city}", "{client_short} Mobile Site Maintenance {region}",
                          "Regional Mobile Black Spot Program - {region}"],
                "scope": ["Design, acquisition and construction of {n} 5G small cell sites across {city} with traffic management and council approvals.",
                          "Preventive and corrective maintenance of mobile tower sites across {region_name}."],
            },
        ],
    },
    {
        "id": "is", "name": "Infrastructure Services", "short": "IS",
        "description": "Water, environment, energy and resources infrastructure services.",
        "offerings": [
            {
                "bu": "Water & Environment", "lob": "Water Operations", "discipline": "Water Treatment Operations",
                "clients": [("SEQ Water", ["QLD"], True), ("Yarra Valley Water", ["VIC"], True), ("Sydney Water", ["NSW"], True),
                            ("Melbourne Water", ["VIC"], True), ("Watercare Services", ["NZ North"], True),
                            ("Logan City Council", ["QLD"], True), ("Brisbane City Council", ["QLD"], True)],
                "names": ["{client_short} Water Treatment Plant Operations and Maintenance", "{client_short} STP Sludge Management Services",
                          "{city} Water Network Maintenance Alliance", "{client_short} Wastewater Treatment Upgrade",
                          "{client_short} Reservoir and Pump Station Maintenance"],
                "scope": ["Operation and maintenance of {n} water treatment plants and associated reticulation across {region_name} for a {months} month term.",
                          "Sewage treatment plant sludge handling, dewatering and transportation services across {n} sites.",
                          "Planned and reactive maintenance of water and wastewater networks for {client} including leak detection and main renewals."],
            },
            {
                "bu": "Water & Environment", "lob": "Environment", "discipline": "Deconstruction, Decommission, Demolition, Remediation",
                "clients": [("Department of Industry, Tourism and Trade", ["NT", "VIC"], True), ("NSW Environment Protection Authority", ["NSW"], True),
                            ("Department of Environment and Science QLD", ["QLD"], True)],
                "names": ["{region} Legacy Mine Site Remediation", "{city} Contaminated Land Remediation Works",
                          "Acid Mine Drainage Water Treatment - {region}"],
                "scope": ["Liming, aerating and dewatering legacy mine pits with active water treatment and environmental monitoring over {months} months.",
                          "Remediation of contaminated land including PFAS management, soil treatment and site validation in {region_name}."],
            },
            {
                "bu": "Energy & Resources", "lob": "Mining Services", "discipline": "Electrical, Instrumentation and Controls",
                "clients": [("Rio Tinto Iron Ore", ["WA"], False), ("BHP", ["WA", "SA", "QLD"], False), ("Fortescue", ["WA"], False),
                            ("South32", ["WA", "NT"], False)],
                "names": ["{client_short} Electrical Instrumentation and Controls Services", "{client_short} Shutdown Maintenance Services - {region}",
                          "{client_short} Fixed Plant Maintenance"],
                "scope": ["Electrical, instrumentation and control maintenance and shutdown services across {client} mine sites in {region_name}.",
                          "Fixed plant maintenance and shutdown labour for processing facilities in the {region_name} region."],
            },
            {
                "bu": "Asset Services", "lob": "Vertical Transport", "discipline": "Vertical Transport",
                "clients": [("SEQ Water", ["QLD"], True), ("Brisbane City Council", ["QLD"], True), ("City of Melbourne", ["VIC"], True)],
                "names": ["{client_short} Lifts Renewal Package", "{city} Building Services Maintenance"],
                "scope": ["Renewal and maintenance of lifts and escalators across {n} public facilities in {region_name}."],
            },
        ],
    },
    {
        "id": "corporate", "name": "Corporate Services", "short": "Corporate",
        "description": "Group-wide capability: digital, advisory, sustainability and shared services.",
        "offerings": [
            {
                "bu": "Ventia Digital", "lob": "Digital Services", "discipline": "Digital & Asset Intelligence",
                "clients": [("Service NSW", ["NSW"], True), ("Department of Finance", ["ACT"], True), ("City of Melbourne", ["VIC"], True),
                            ("Auckland Council", ["NZ North"], True)],
                "names": ["{client_short} Asset Management System Implementation", "{client_short} Digital Twin Pilot",
                          "{city} Smart Asset Monitoring Program"],
                "scope": ["Implementation of an enterprise asset management platform with IoT sensor integration and predictive maintenance analytics.",
                          "Digital twin and asset data advisory services for {client} across {n} facilities."],
            },
            {
                "bu": "Corporate Services", "lob": "Sustainability Advisory", "discipline": "Advisory",
                "clients": [("Department of Finance", ["ACT"], True), ("NSW Treasury", ["NSW"], True), ("Brisbane City Council", ["QLD"], True)],
                "names": ["{client_short} Net Zero Facilities Advisory", "{client_short} Energy Efficiency Retrofit Program"],
                "scope": ["Decarbonisation roadmap, energy audits and retrofit delivery across {n} government buildings in {region_name}."],
            },
        ],
    },
]

HIGHWAYS = {"QLD": ["Bruce Highway", "Warrego Highway", "Pacific Motorway"], "NSW": ["Pacific Highway", "Hume Motorway", "Princes Highway"],
            "VIC": ["Monash Freeway", "Western Highway", "Calder Freeway"], "WA": ["Great Northern Highway", "Kwinana Freeway"],
            "SA": ["South Eastern Freeway"], "TAS": ["Midland Highway"], "NT": ["Stuart Highway"], "ACT": ["Monaro Highway"],
            "NZ North": ["State Highway 1"], "NZ South": ["State Highway 6"], "National": ["National Highway"]}

# People pool. (name, sector, title, extra_sector). The first eight appear in the real export;
# synthetic opportunities never reuse them (see seed.people_for).
PEOPLE = [
    ("Amrit Acharya", "Transport", "Senior Proposal Manager", None),
    ("Samantha Bray", "Infrastructure Services", "Proposal Manager", None),
    ("Kavita Singh", "Telecommunications", "Bid Manager", None),
    ("Therese OLeary", "Telecommunications", "Tender Manager", None),
    ("Andrea Webster", "Infrastructure Services", "Proposal Manager", None),
    ("Kate Couston", "Telecommunications", "Proposal Manager", None),
    ("Joy Tanios", "Infrastructure Services", "Tender Manager", None),
    ("Sara Adly", "Infrastructure Services", "Tender Manager", None),
    ("Liam O'Connor", "Transport", "Bid Manager", "Defence & Social Infrastructure"),
    ("Mei Chen", "Transport", "Proposal Writer", None),
    ("Aroha Ngata", "Transport", "Proposal Manager", None),
    ("Hannah Walsh", "Defence & Social Infrastructure", "Senior Bid Manager", None),
    ("Marcus Thompson", "Defence & Social Infrastructure", "Proposal Writer", None),
    ("Olivia Bennett", "Defence & Social Infrastructure", "Proposal Manager", "Corporate Services"),
    ("Priyanka Desai", "Telecommunications", "Proposal Writer", None),
    ("Jessica Huang", "Infrastructure Services", "Proposal Writer", None),
    ("Callum McKenzie", "Infrastructure Services", "Bid Manager", None),
    ("Sophie Laurent", "Corporate Services", "Proposal Manager", None),
    ("Grace Fitzgerald", "Corporate Services", "Bid Manager", "Infrastructure Services"),
    ("Chloe Anderson", "Telecommunications", "Bid Writer", None),
    ("Noah Williams", "Defence & Social Infrastructure", "Bid Writer", None),
    ("Zara Ali", "Transport", "Bid Writer", None),
    ("Lucas Martin", "Infrastructure Services", "Bid Writer", None),
    ("Emma Clarke", "Corporate Services", "Bid Writer", None),
    ("Hamish Grant", "Telecommunications", "Proposal Manager", None),
    ("Leila Haddad", "Telecommunications", "Bid Manager", None),
    ("Owen Fletcher", "Infrastructure Services", "Proposal Manager", None),
    ("Bianca Moretti", "Infrastructure Services", "Tender Manager", None),
]

PROPOSAL_TEAM = "Proposal Central Tender Collateral Team"

PERSONAS = [
    ("u-transport-bm", "Alex Morgan", "Bid Manager", "bid_manager", "Transport"),
    ("u-transport-admin", "Priya Nair", "Sector Content Administrator", "sector_admin", "Transport"),
    ("u-telco-pw", "Jordan Lee", "Proposal Writer", "proposal_writer", "Telecommunications"),
    ("u-telco-admin", "Ravi Menon", "Sector Content Administrator", "sector_admin", "Telecommunications"),
    ("u-is-bm", "Sam Taylor", "Bid Manager", "bid_manager", "Infrastructure Services"),
    ("u-is-admin", "Elena Petrova", "Sector Content Administrator", "sector_admin", "Infrastructure Services"),
    ("u-dsi-bm", "Kiri Walker", "Bid Manager", "bid_manager", "Defence & Social Infrastructure"),
    ("u-dsi-admin", "Mohammed Aziz", "Sector Content Administrator", "sector_admin", "Defence & Social Infrastructure"),
    ("u-corp-admin", "Natalie Brooks", "Sector Content Administrator", "sector_admin", "Corporate Services"),
    ("u-enterprise-admin", "Chris Walker", "Enterprise Work Winning Lead", "enterprise_admin", "Corporate Services"),
]

STAGES_OPEN = [("Prospecting", 10, "Pipeline", "Pipeline"), ("Qualification", 25, "Pipeline", "Pipeline"),
               ("Proposal/Price Quote", 50, "BestCase", "Best Case"), ("Negotiation/Review", 75, "Commit", "Commit")]
OPEN_STATUS = {"Prospecting": "Active - Live", "Qualification": "Active - Live",
               "Proposal/Price Quote": "Current - in progress", "Negotiation/Review": "Submitted pending outcome"}
WIN_REASONS = ["Incumbent", "Price", "Technical Solution", "Client Relationship", "Safety Performance", "Local Presence", "Innovation"]
LOSS_REASONS = ["Price", "Competitor Incumbent", "Technical Score", "Client Cancelled", "Scope Change", "Resourcing"]
PROSPECT_SOURCES = ["Proactive (Development)", "Proactive (Development)", "Reactive (Tender)", "Client Invitation", "Existing Contract"]

CONTENT_REVIEW_MONTHS = {
    "case_study": 12, "project_profile": 12, "bid_submission": 24, "template": 12,
    "good_news_story": 12, "capability_statement": 12, "image": 24, "cv": 6,
}

VALUE_RANGES = [("<$1m", 0, 1e6), ("$1–10m", 1e6, 1e7), ("$10–50m", 1e7, 5e7), ("$50–100m", 5e7, 1e8), (">$100m", 1e8, float("inf"))]

CONTRACT_VALUE_OPTIONS = [v[0] for v in VALUE_RANGES] + ["Not applicable"]


def value_range(v):
    if v is None:
        return None
    for label, lo, hi in VALUE_RANGES:
        if lo <= v < hi:
            return label
    return VALUE_RANGES[-1][0]
