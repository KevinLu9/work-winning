# Business Requirements Document

## One Work Winning Hub (OWWH)

### Enterprise Work Winning Knowledge & Collaboration Platform

**Version:** Draft v0.1  
**Prepared by:** Innovation Challenge Team 03  
**Date:** October 2026

## 1. Executive Summary

The One Work Winning Hub (OWWH) is a proposed enterprise platform designed to centralise work-winning knowledge, improve collaboration across sectors, reduce duplicated effort, and provide a governed source of reusable bid content and experience across the organisation. The solution will support:

- Defence & Social Infrastructure (D&SI)
- Transport
- Telecommunications
- Infrastructure Services (IS)
- Corporate Services

The proposed solution will leverage existing investments in SharePoint, Salesforce, Power Platform, and Microsoft AI technologies rather than replacing them. The platform will provide a unified interface for discovering, sharing, governing, and reusing work-winning information across sectors while respecting contractual, commercial, and confidentiality obligations.

## 2. Problem Statement

Currently, work-winning information is fragmented across:

- SharePoint sites
- Sector-specific repositories
- Tender sites
- Teams chats
- Email conversations
- Individual knowledge holders

Users often:

- Cannot find relevant past submissions.
- Do not know who to contact for sector-specific experience.
- Recreate collateral already developed elsewhere.
- Experience access issues when content owners are unavailable.
- Miss opportunities to leverage experience from other sectors.
- Operate without a consistent source of truth.

The lack of discoverability and governance reduces bid efficiency and prevents organisational knowledge from being fully utilised.

## 3. Vision

Create a single enterprise gateway for work-winning knowledge that enables employees to:

Find relevant experience, content, contacts, case studies, project information, and tender responses across the organisation within minutes rather than hours or days.

The system should become the recognised source of truth for reusable work-winning content while maintaining sector ownership and confidentiality controls.

## 4. Business Objectives

### Primary Objectives

1. Increase visibility of reusable work-winning knowledge.
2. Improve cross-sector collaboration.
3. Reduce duplication of effort.
4. Improve speed of bid preparation.
5. Capture knowledge from completed tenders.
6. Establish a consistent content governance model.
7. Improve searchability of experience and expertise.
8. Create a foundation for future AI-assisted bidding capabilities.

### Success Measures

| **Objective** | **Measure** |
|---|---|
| Improve content discovery | Users locate relevant content in <5 minutes |
| Increase reuse | Increase usage of historical bid material |
| Improve collaboration | Increased cross-sector content access |
| Reduce rework | Fewer duplicated case studies and templates |
| Improve governance | All content has assigned owner and review cycle |
| AI readiness | Standardised metadata available across content |

## 5. Stakeholders

### Primary Users

- Bid Managers
- Proposal Coordinators
- Proposal Writers
- Estimators
- Commercial Managers
- Project Managers
- Business Development Managers
- General Managers
- Sector Leaders

### Content Owners

- Sector Work Winning Teams
- Bid Coordinators
- Marketing Teams
- Corporate Communications

### Governance Stakeholders

- Sector Executives
- Legal
- Commercial
- Information Security
- Salesforce Administrators

## 6. Core Functional Requirements

### 6.1 Enterprise Search

#### Requirement

Users shall be able to search work-winning content from a single interface.

#### Search Scope

- Case studies
- Project profiles
- Bid submissions
- Tender responses
- Templates
- Good-news stories
- Photos
- Graphics
- Capability statements
- Key contacts
- Salesforce opportunity metadata

#### Search Features

- Keyword search
- Natural language search
- Sector filters
- Client filters
- Region filters
- Service filters
- Contract-value filters
- Content-type filters

Search quality was identified as the most critical success factor for the solution.

### 6.2 Content Repository

The platform shall provide access to:

#### Case Studies

Including:

- Client
- Contract value
- Location
- Scope
- Service offering
- Outcomes
- Photos
- Reference contacts
- Confidentiality classification

#### Project Profiles

Including:

- Project description
- Contract value
- Duration
- Sector
- Services delivered

Project profiles were repeatedly identified as more valuable than broad CV sharing.

#### Bid Content

Including:

- Executive summaries
- Methodologies
- Client responses
- Successful submissions
- Lessons learned

Final submissions were highlighted as one of the most valuable forms of organisational intellectual property.

### 6.3 Contact Discovery

Users shall be able to identify:

- Technical experts
- Operational experts
- Commercial experts
- Work-winning contacts
- Sector specialists

For each item of content the platform should expose relevant internal contacts.

### 6.4 Content Submission Workflow

Users shall be able to submit new content through guided forms.

#### Example Upload Types

- Case study
- Project profile
- Bid submission
- Image
- Good-news story

#### Mandatory Metadata

- Sector
- Business unit
- Service line
- Contract value range
- Client
- Geography
- Confidentiality level
- Owner
- Review date

## 7. Security & Permissions

### Sector-First Access Model

All uploaded content shall default to:

Visible only within the originating sector.

Users may explicitly mark content as:

#### Sector Only

Visible only to the originating sector.

#### Shared

Visible to approved sectors.

#### Enterprise

Visible organisation-wide.

This approach was consistently recommended across Transport, D&SI, and Infrastructure Services.

### Restricted Content

The platform must support additional controls for:

- Pricing information
- Current tender responses
- Government contracts
- NDA-protected information
- Client-sensitive information
- Referee information
- Employee CVs

## 8. Content Governance

### Ownership Model

Each sector shall nominate:

- Sector Content Owner
- Sector Administrator
- Backup Administrator

Several stakeholders noted that repositories fail when ownership is not defined.

### Review Requirements

Content must support:

- Review dates
- Expiry dates
- Approval status
- Content versioning

Examples:

- Case studies annually
- CVs every 6 months
- Project profiles annually

## 9. Integrations

### Phase 1

#### SharePoint

Primary document repository.

#### Salesforce

Opportunity and contract metadata.

#### Microsoft Entra ID

Authentication and user permissions.

#### Microsoft Teams

Collaboration and notifications.

## 10. AI & Future-State Capabilities

The initial release should focus on content quality and discoverability.

Future capabilities may include:

### AI Search

Users ask:

"Show me water-treatment projects completed in local government."

### AI Proposal Assistance

Users upload:

- Tender documents
- Client questions

The system suggests:

- Relevant case studies
- Similar answers
- Applicable project examples
- Supporting graphics

### Content Classification

AI automatically:

- Tags documents
- Generates keywords
- Suggests categories

### Knowledge Extraction

AI identifies:

- Reusable answers
- Frequently asked client questions
- Winning methodologies

## 11. Non-Functional Requirements

### Usability

- Simple website-style experience
- Minimal SharePoint navigation
- Mobile responsive

### Performance

- Search results under 5 seconds
- Support enterprise-wide user base

### Security

- Role-based access controls
- Audit logging
- Data classification support

### Scalability

- Support all sectors
- Support future AI expansion

### Maintainability

- Low-code administration
- Configurable metadata

## 12. Recommended MVP Scope

To maximise adoption and minimise complexity, the MVP should focus on:

### Included

✅ Enterprise search  
✅ Case study repository  
✅ Project profiles  
✅ Contact directory  
✅ Metadata-driven tagging  
✅ Sector-first permissions  
✅ SharePoint integration  
✅ Content submission forms

### Deferred

❌ AI proposal generation  
❌ Chatbot assistant  
❌ Advanced analytics  
❌ Automated document rewriting  
❌ Full tender lifecycle management

## 13. Key Design Principles

1. Search first, AI second.
2. Sector ownership with enterprise discoverability.
3. Confidential by default.
4. Leverage existing Microsoft platforms.
5. Standardise metadata before introducing AI.
6. Capture knowledge once and reuse many times.
7. Minimise additional administrative burden.
8. Make finding expertise as important as finding documents.

### Proposed Product Statement

**One Work Winning Hub is an enterprise knowledge platform that enables employees across Defence & Social Infrastructure, Transport, Telecommunications, Infrastructure Services, and Corporate Services to discover, share, govern, and reuse work-winning content through a secure, searchable, and sector-controlled experience built on the Microsoft ecosystem.**
