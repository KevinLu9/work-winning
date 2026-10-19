"""Hand-written case studies based on project pages published on ventia.com (data_source = public).
Summarised in our own words; figures are as stated on the source page. Added after the generated
content and without the shared RNG, so they never shift the rest of the seeded data.

`media` lists (role, file) pairs from featured_media/<id without "ca-">/, photos taken from the same page."""
from pathlib import Path

MEDIA_DIR = Path(__file__).parent / "featured_media"

FEATURED = [
    {
        "id": "ca-auckland-council-assets",
        "title": "Case Study: Managing Auckland's Diverse Assets",
        "summary": "Integrated facilities, streetscape, open space and fleet services for Auckland Council across the Tahi and "
                   "Wha regions, caring for around 77,000 community assets since 2017.",
        "sector": "Defence & Social Infrastructure",
        "business_unit": "Social Infrastructure",
        "service_line": "Social Infrastructure - Local Government",
        "client": "Auckland Council",
        "geography": "NZ North",
        "media": [("hero", "streetsweeper.jpg"), ("image", "park-maintenance.jpg"), ("image", "working-team.jpg")],
        "tags": ["Facilities Management", "Open Space", "Streetscapes", "Fleet", "Local Government", "Sustainability"],
        "created_at": "2017-07-01T09:00:00",
        "updated_at": "2026-09-15T09:00:00",
        "body": {
            "challenge": "Auckland Council needed one partner to look after a large and varied asset base across its Tahi and Wha "
                         "regions: community buildings, town centres, parks, playgrounds and a vehicle fleet, around 77,000 assets "
                         "in all. The work also had to advance the council's sustainability goals and keep local communities, "
                         "including Māori communities, involved in how their places are cared for.",
            "solution": "Since July 2017 we have delivered an integrated service covering facilities maintenance for council "
                        "buildings and public toilets; streetscape services such as garden and vegetation care, urban cleaning and "
                        "town-centre litter collection; maintenance and renewal of parks, playgrounds and BMX tracks; and "
                        "servicing of the council fleet. Regular inspections check compliance and surface improvements, while "
                        "electric mowers, AI-guided equipment and eco-friendly materials reduce environmental impact. We work "
                        "through local boards and community groups, buy and hire locally, and engage Māori communities and "
                        "businesses in a way that supports kaitiakitanga (guardianship).",
            "scope": "Facilities maintenance, streetscapes, open space management and fleet services across the Tahi and Wha "
                     "regions of Auckland.",
            "service_offering": "Facilities Management",
            "outcomes": [
                "Around 77,000 council assets managed across the Tahi and Wha regions",
                "650 council buildings maintained, including more than 340 public toilets",
                "About 1,500 open spaces, 386 playgrounds and 5 BMX tracks maintained",
                "A 55-vehicle council fleet kept on the road",
                "Contract extended beyond its original four-year term, now running to June 2027",
            ],
            "location": "Auckland",
            "duration_months": 120,
            "start_date": "2017-07-01",
            "end_date": "2027-06-30",
            "outcome_status": "won",
            "source_url": "https://www.ventia.com/what-we-do/projects/managing-aucklands-diverse-assets",
        },
    },
]
