# PartFinder — AI-Powered Part Tracer

**Find. Compare. Verify.**

PartFinder is a proposed AI-powered spare-parts discovery and compatibility intelligence platform for **industrial machinery, electronics, and automotive** applications.

Finding a replacement part is easy; verifying whether it is actually compatible is not. PartFinder aims to simplify this process by discovering product information from manufacturer and supplier websites, extracting technical specifications, and comparing them against required constraints.

## Problem Statement

Spare-part research is often time-consuming because:

- Product specifications are scattered across manufacturer and supplier websites.
- Part numbers, naming conventions, and measurement units are inconsistent.
- Small differences in dimensions, electrical ratings, or vehicle fitment can make a replacement unsuitable.
- Manual verification makes it difficult to trace the evidence behind compatibility decisions.

## Proposed Solution

PartFinder brings product discovery, specification extraction, and compatibility assessment into one workflow.

### Key Features

- **Smart Part Search:** Search for components using part numbers, descriptions, equipment models, or vehicle information.
- **AI-Powered Data Extraction:** Retrieve technical specifications from product listings and datasheets.
- **Cross-Domain Compatibility:** Support industrial, electronic, and automotive components through domain-specific rules.
- **Automated Comparison:** Compare dimensions, ratings, electrical characteristics, and other required parameters.
- **Evidence-Linked Results:** Preserve source URLs and extracted values for traceability.
- **Compatibility Status:** Classify findings as Potential Match, Mismatch, or Unverified.

> **Safety principle:** A potential match is not a guarantee of safe installation. Critical substitutions require qualified human approval.

## How It Works

1. **Identify a Part** — Enter a part number, description, model, or relevant requirements.
2. **Discover Products** — Search manufacturer and supplier websites for relevant components and alternatives.
3. **Extract Specifications** — Retrieve product details and supporting datasheets.
4. **Compare Requirements** — Normalize units and evaluate specifications using domain-specific compatibility rules.
5. **Review Evidence** — Inspect matches, mismatches, missing information, and their supporting sources.

## Technology Stack

The following stack is proposed for the MVP and may evolve during development.

| Component | Technology |
|---|---|
| Frontend | React.js, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |
| API Validation | Pydantic |
| Web Discovery | TinyFish Search, Fetch, and Agent APIs |
| Database | PostgreSQL |
| Unit Normalization | Pint |
| HTTP Requests | httpx |
| Deployment | Docker and cloud hosting |
| Version Control | Git and GitHub |

## TinyFish Integration

TinyFish provides the proposed live-web discovery and retrieval layer.

- **Search API:** Discover relevant product pages and datasheets.
- **Fetch API:** Retrieve page content for specification extraction.
- **Agent API:** Navigate more complex or interactive catalogues when needed.

The backend will validate and normalize retrieved data, apply compatibility rules, and retain source links. Missing information should remain explicitly unverified rather than being inferred as fact.

## Target Users

- Industrial engineers and maintenance teams
- Electronics engineers and hardware designers
- Automotive mechanics and spare-parts dealers
- Procurement teams and parts distributors

## Proposed MVP

The initial MVP aims to demonstrate:

- Spare-part discovery across representative product categories
- Extraction of source-backed technical specifications
- Side-by-side comparison of required and discovered specifications
- Identification of potential matches, mismatches, and missing information
- Traceable evidence through product pages and datasheets

## Getting Started

Setup instructions will be added as the application structure and dependencies are finalized.

### Environment Configuration

Create a local `.env` file for the required configuration. Never commit real API keys or credentials.

Example `.env.example`:

```env
PORT=8000
TINYFISH_API_KEY=
DATABASE_URL=
```

Keep `.env` in `.gitignore` and use environment variables for secrets.

## Team CODSTER

- **Kumar Atharv** — Backend
- **Divyansh Mishra** — AI & ML
- **Abhishek Mishra** — Frontend
- **Ayush Thakur** — Research & Presentation

## Project Status

Hackathon project in development. Features, integrations, and deployment will be documented as they are implemented and tested.

---

*PartFinder — Find. Compare. Verify.*
