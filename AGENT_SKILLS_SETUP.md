# Multi-Agent Development Skills Setup

**Created:** 2026-11-18  
**Purpose:** Define 12 specialized agent skills for comprehensive software development workflow  
**Location:** `c:\Users\Shivani Babar\InterviewCopilot\AGENT_SKILLS_SETUP.md`

---

## Overview

This document defines 12 specialized agent roles, each with specific capabilities, installation instructions, and source references. These skills can be implemented as VS Code Copilot custom agents (`.agent.md`), custom instructions (`.instructions.md`), or skills (`SKILL.md` in `.claude/skills/`).

---

## 1. Senior Reverse Engineer

### Role Definition
Expert in binary analysis, decompilation, protocol reverse engineering, and legacy system understanding.

### Capabilities
- Binary analysis (IDA Pro, Ghidra, radare2)
- Decompilation and pseudo-code reconstruction
- Protocol analysis (network, IPC, custom protocols)
- Anti-debugging/anti-tamper bypass techniques
- Firmware/embedded system reverse engineering
- Malware analysis and behavior profiling
- Patch diffing and vulnerability research

### Installation
```bash
# Core tools
winget install Ghidra.Ghidra
winget install IDAPro.IDAPro
# Or download from: https://ghidra-sre.org/, https://hex-rays.com/ida-pro/

# Python packages for scripting
pip install pwntools capstone keystone-engine unicorn lief

# VS Code Extensions
code --install-extension ms-vscode.hexeditor
code --install-extension bierner.github-markdown-preview
```

### Sources
- **Ghidra:** https://ghidra-sre.org/ (NSA open-source)
- **IDA Pro:** https://hex-rays.com/ida-pro/
- **radare2:** https://rada.re/n/
- **pwntools:** https://docs.pwntools.com/
- **LIEF:** https://lief-project.github.io/

### Agent Configuration (`.agent.md`)
```markdown
---
name: senior-reverse-engineer
description: Binary analysis, decompilation, protocol RE, vulnerability research
tools: [read_file, grep_search, run_in_terminal, fetch_webpage]
model: gpt-4o
---
```

---

## 2. Senior Architect

### Role Definition
System design, architecture patterns, scalability planning, technology selection, and technical strategy.

### Capabilities
- System architecture design (microservices, monolith, serverless)
- Architecture decision records (ADRs)
- Scalability and performance modeling
- Technology evaluation and selection
- Domain-driven design (DDD)
- Event-driven architecture
- CQRS/Event Sourcing
- API design (REST, GraphQL, gRPC)
- Cloud architecture (AWS, Azure, GCP)
- Security architecture (zero trust, threat modeling)

### Installation
```bash
# Documentation tools
pip install mkdocs mkdocs-material plantuml

# Architecture modeling
# Structurizr: https://structurizr.com/
# Mermaid: built into VS Code markdown

# VS Code Extensions
code --install-extension jebbs.plantuml
code --install-extension bierner.markdown-mermaid
code --install-extension formulahendry.code-runner
```

### Sources
- **Software Architecture Patterns:** https://martinfowler.com/architecture/
- **DDD Reference:** https://domainlanguage.com/ddd/
- **AWS Well-Architected:** https://aws.amazon.com/architecture/well-architected/
- **Azure Architecture Center:** https://learn.microsoft.com/azure/architecture/
- **Google Cloud Architecture:** https://cloud.google.com/architecture
- **ADR Template:** https://adr.github.io/

### Agent Configuration (`.agent.md`)
```markdown
---
name: senior-architect
description: System design, architecture patterns, scalability, tech selection
tools: [read_file, create_file, grep_search, fetch_webpage, run_in_terminal]
model: gpt-4o
---
```

---

## 3. Senior Backend Developer

### Role Definition
API development, database design, distributed systems, performance optimization, and backend best practices.

### Capabilities
- REST/GraphQL/gRPC API design and implementation
- Database design (SQL: PostgreSQL, MySQL; NoSQL: MongoDB, Redis)
- ORM/ODM usage (Prisma, TypeORM, Drizzle, SQLAlchemy)
- Authentication/Authorization (OAuth2, OIDC, JWT, RBAC)
- Message queues (RabbitMQ, Kafka, NATS, Redis Streams)
- Caching strategies (Redis, Memcached, CDN)
- Background jobs (Bull, Celery, Temporal)
- Testing (unit, integration, contract, load)
- Observability (OpenTelemetry, Prometheus, Grafana, ELK)
- CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)

### Installation
```bash
# Language runtimes
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.12
winget install GoLang.Go

# Databases (local dev)
winget install PostgreSQL.PostgreSQL
winget install Redis.Redis
winget install MongoDB.Server

# Tools
npm install -g @prisma/cli typescript ts-node
pip install sqlalchemy alembic fastapi uvicorn

# VS Code Extensions
code --install-extension prisma.prisma
code --install-extension ms-python.python
code --install-extension golang.go
code --install-extension ms-azuretools.vscode-docker
```

### Sources
- **FastAPI:** https://fastapi.tiangolo.com/
- **Prisma:** https://www.prisma.io/docs
- **PostgreSQL:** https://www.postgresql.org/docs/
- **Redis:** https://redis.io/documentation
- **Kafka:** https://kafka.apache.org/documentation/
- **OpenTelemetry:** https://opentelemetry.io/docs/
- **12 Factor App:** https://12factor.net/

### Agent Configuration (`.agent.md`)
```markdown
---
name: senior-backend-developer
description: API development, databases, distributed systems, performance
tools: [read_file, create_file, edit_file, run_in_terminal, grep_search, get_errors]
model: gpt-4o
---
```

---

## 4. Senior UI/UX Designer Analyzer

### Role Definition
User experience analysis, interface design, usability testing, design systems, and accessibility.

### Capabilities
- User research and persona development
- Journey mapping and flow analysis
- Wireframing and prototyping (Figma, Sketch, Adobe XD)
- Design system creation and maintenance
- Accessibility auditing (WCAG 2.1/2.2)
- Usability testing and heuristic evaluation
- Interaction design and micro-animations
- Responsive/adaptive design
- Design tokens and theming
- Developer handoff (Zeplin, Figma DevMode)

### Installation
```bash
# Design tools (manual install)
# Figma: https://figma.com/downloads/
# Sketch: https://www.sketch.com/ (macOS only)
# Adobe XD: https://adobe.com/products/xd.html

# Accessibility testing
npm install -g @axe-core/cli pa11y

# VS Code Extensions
code --install-extension figma.figma-vscode-extension
code --install-extension streetsidesoftware.code-spell-checker
code --install-extension mkxml.colorize
```

### Sources
- **Nielsen Norman Group:** https://www.nngroup.com/
- **WCAG Guidelines:** https://www.w3.org/WAI/standards-guidelines/wcag/
- **Material Design:** https://m3.material.io/
- **Human Interface Guidelines:** https://developer.apple.com/design/human-interface-guidelines/
- **Figma Community:** https://www.figma.com/community
- **Axe Core:** https://github.com/dequelabs/axe-core

### Agent Configuration (`.agent.md`)
```markdown
---
name: senior-ui-ux-designer
description: UX analysis, interface design, accessibility, design systems
tools: [read_file, create_file, view_image, fetch_webpage, grep_search]
model: gpt-4o
---
```

---

## 5. Senior Frontend Developer

### Role Definition
Modern frontend frameworks, performance optimization, state management, testing, and developer experience.

### Capabilities
- React 18+ (Server Components, Suspense, Concurrent Features)
- Next.js 14+ (App Router, Server Actions, Middleware)
- TypeScript strict mode mastery
- State management (Zustand, Jotai, Redux Toolkit, TanStack Query)
- Styling (Tailwind CSS, CSS Modules, Styled Components, Panda CSS)
- Build tools (Vite, Turbopack, Webpack, Rspack)
- Testing (Vitest, Playwright, React Testing Library, Storybook)
- Performance (Core Web Vitals, Bundle Analysis, Lighthouse)
- Animation (Framer Motion, CSS Animations, GSAP)
- PWA and offline-first patterns

### Installation
```bash
# Core tooling
npm install -g pnpm@latest
npm install -g create-vite@latest
npm install -g @storybook/cli

# VS Code Extensions
code --install-extension bradlc.vscode-tailwindcss
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-playwright.playwright
code --install-extension vitest.explorer
```

### Sources
- **React Docs:** https://react.dev/
- **Next.js Docs:** https://nextjs.org/docs
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **TanStack Query:** https://tanstack.com/query/latest
- **Vitest:** https://vitest.dev/
- **Playwright:** https://playwright.dev/
- **Web Vitals:** https://web.dev/vitals/

### Agent Configuration (`.agent.md`)
```markdown
---
name: senior-frontend-developer
description: React, Next.js, TypeScript, performance, testing, state management
tools: [read_file, create_file, edit_file, run_in_terminal, get_errors, grep_search, open_browser_page]
model: gpt-4o
---
```

---

## 6. Senior Scrum Master / Manager

### Role Definition
Agile facilitation, sprint planning, team dynamics, metrics, stakeholder management, and delivery optimization.

### Capabilities
- Scrum/Kanban facilitation
- Sprint planning and refinement
- Retrospective techniques
- Team velocity and flow metrics
- Release planning and roadmapping
- Stakeholder communication
- Risk management and mitigation
- Continuous improvement (Kaizen)
- Jira/Linear/GitHub Projects administration
- Developer productivity metrics (DORA, SPACE)

### Installation
```bash
# CLI tools for metrics
npm install -g @linear/cli
# GitHub CLI: winget install GitHub.cli

# VS Code Extensions
code --install-extension github.vscode-pull-request-github
code --install-extension github.vscode-github-actions
code --install-extension ms-vscode.azure-repos
```

### Sources
- **Scrum Guide:** https://scrumguides.org/
- **Kanban Guide:** https://kanbanguides.org/
- **DORA Metrics:** https://dora.dev/
- **SPACE Framework:** https://queue.acm.org/detail.cfm?id=3454124
- **Atlassian Agile Coach:** https://www.atlassian.com/software/jira/agile
- **GitHub Projects:** https://docs.github.com/en/issues/planning-and-tracking-with-projects

### Agent Configuration (`.agent.md`)
```markdown
---
name: senior-scrum-master
description: Agile facilitation, sprint planning, metrics, team dynamics
tools: [read_file, create_file, run_in_terminal, fetch_webpage, grep_search]
model: gpt-4o
---
```

---

## 7. Web Scraper

### Role Definition
Data extraction, crawling, anti-bot bypass, structured data parsing, and ethical scraping practices.

### Capabilities
- Static scraping (BeautifulSoup, lxml, selectolax)
- Dynamic scraping (Playwright, Puppeteer, Selenium)
- API reverse engineering
- Rate limiting and polite crawling
- Proxy rotation and management
- CAPTCHA handling (2captcha, anticaptcha)
- Data cleaning and normalization
- Structured output (JSON, CSV, Parquet, SQL)
- Monitoring and alerting
- Legal/ethical compliance (robots.txt, ToS)

### Installation
```bash
# Python ecosystem
pip install httpx selectolax beautifulsoup4 lxml
pip install playwright && playwright install
pip install scrapy scrapy-playwright
pip install pandas polars

# Node.js ecosystem
npm install -g puppeteer
npm install cheerio got

# VS Code Extensions
code --install-extension ms-playwright.playwright
code --install-extension formulahendry.code-runner
```

### Sources
- **Playwright:** https://playwright.dev/python/
- **Scrapy:** https://scrapy.org/
- **Selectolax:** https://selectolax.readthedocs.io/
- **Ethical Scraping:** https://www.robotstxt.org/
- **Public APIs:** https://github.com/public-apis/public-apis
- **Proxy Providers:** https://www.scraperapi.com/, https://brightdata.com/

### Agent Configuration (`.agent.md`)
```markdown
---
name: web-scraper
description: Data extraction, crawling, anti-bot bypass, structured parsing
tools: [read_file, create_file, run_in_terminal, fetch_webpage, open_browser_page, click_element, type_in_page]
model: gpt-4o
---
```

---

## 8. Senior Tester

### Role Definition
Test strategy, automation, quality assurance, test architecture, and continuous testing.

### Capabilities
- Test strategy and planning
- Unit testing (Vitest, Jest, pytest, Go test)
- Integration testing (Testcontainers, Testcontainers-go)
- E2E testing (Playwright, Cypress, Puppeteer)
- Contract testing (Pact, Spring Cloud Contract)
- Performance testing (k6, Artillery, Locust, JMeter)
- Chaos engineering (Litmus, Chaos Mesh, Gremlin)
- Visual regression (Chromatic, Percy, Playwright)
- Accessibility testing (axe-core, pa11y)
- Mutation testing (Stryker, mutmut)
- Property-based testing (fast-check, hypothesis)
- Test data management and fixtures

### Installation
```bash
# JavaScript/TypeScript
npm install -g vitest @playwright/test playwright
npm install -g @axe-core/cli
npm install -g stryker-mutator

# Python
pip install pytest pytest-asyncio pytest-cov hypothesis
pip install playwright && playwright install
pip install locust

# Go
go install github.com/onsi/ginkgo/v2/ginkgo@latest
go install github.com/onsi/gomega@latest

# Performance
# k6: https://k6.io/docs/getting-started/installation/

# VS Code Extensions
code --install-extension vitest.explorer
code --install-extension ms-playwright.playwright
code --install-extension orta.vscode-jest
```

### Sources
- **Testing Trophy:** https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications
- **Playwright:** https://playwright.dev/
- **Vitest:** https://vitest.dev/
- **k6:** https://k6.io/docs/
- **Pact:** https://docs.pact.io/
- **Mutation Testing:** https://stryker-mutator.io/

### Agent Configuration (`.agent.md`)
```markdown
---
name: senior-tester
description: Test strategy, automation, quality assurance, continuous testing
tools: [read_file, create_file, edit_file, run_in_terminal, get_errors, grep_search, open_browser_page, click_element]
model: gpt-4o
---
```

---

## 9. Senior Root Cause Analyzer / Problem Solver

### Role Definition
Systematic debugging, root cause analysis, incident response, and preventive measures.

### Capabilities
- Structured problem solving (5 Whys, Fishbone, Fault Tree Analysis)
- Debugging methodologies (scientific method, binary search, divide & conquer)
- Log analysis and correlation (ELK, Loki, Datadog)
- Distributed tracing (Jaeger, Zipkin, Tempo)
- Memory/CPU profiling (py-spy, perf, pprof, clinic.js)
- Crash dump analysis (WinDbg, lldb, gdb)
- Regression bisecting (git bisect)
- Incident response and postmortems
- Runbook creation and maintenance
- Blameless postmortem culture

### Installation
```bash
# Profiling tools
pip install py-spy memray
npm install -g clinic 0x

# Debugging
winget install Microsoft.WinDbg
# lldb/gdb: usually pre-installed or via package manager

# Observability
# Grafana Loki: https://grafana.com/oss/loki/
# Jaeger: https://www.jaegertracing.io/

# VS Code Extensions
code --install-extension ms-vscode.cpptools
code --install-extension vadimcn.vscode-lldb
code --install-extension grapecity.gc-excelviewer
```

### Sources
- **Debugging Book:** https://www.debuggingbook.org/
- **Systems Performance:** https://www.brendangregg.com/systems-performance-book.html
- **Google SRE Book:** https://sre.google/books/
- **Incident Response:** https://incidentresponse.com/
- **Blameless Postmortems:** https://www.atlassian.com/incident-management/postmortem
- **5 Whys:** https://www.mindtools.com/pages/article/newTMC_5W.htm

### Agent Configuration (`.agent.md`)
```markdown
---
name: senior-root-cause-analyzer
description: Systematic debugging, RCA, incident response, profiling
tools: [read_file, grep_search, run_in_terminal, get_errors, get_terminal_output, fetch_webpage]
model: gpt-4o
---
```

---

## 10. New Tool Teacher (from Internet/Web/GitHub)

### Role Definition
Technology radar, tool evaluation, learning resource curation, and knowledge transfer.

### Capabilities
- Technology trend monitoring (GitHub Trending, HN, Reddit, Twitter/X)
- Tool evaluation frameworks (criteria matrices, POCs)
- Learning path creation
- Documentation and tutorial authoring
- Workshop and training delivery
- Community engagement (conferences, meetups, Discord)
- Open source contribution guidance
- Vendor evaluation and negotiation
- Proof-of-concept development
- Knowledge base maintenance

### Installation
```bash
# Content curation tools
npm install -g @githubnext/github-copilot-cli
# GitHub CLI for trending
winget install GitHub.cli

# Learning platforms (manual)
# Coursera, Udemy, Pluralsight, Frontend Masters, egghead.io

# VS Code Extensions
code --install-extension github.vscode-pull-request-github
code --install-extension github.copilot
code --install-extension github.copilot-chat
```

### Sources
- **GitHub Trending:** https://github.com/trending
- **Hacker News:** https://news.ycombinator.com/
- **Dev.to:** https://dev.to/
- **CSS-Tricks:** https://css-tricks.com/
- **Smashing Magazine:** https://www.smashingmagazine.com/
- **Frontend Masters:** https://frontendmasters.com/
- **GitHub Explore:** https://github.com/explore
- **Awesome Lists:** https://github.com/sindresorhus/awesome

### Agent Configuration (`.agent.md`)
```markdown
---
name: new-tool-teacher
description: Technology radar, tool evaluation, learning resources, knowledge transfer
tools: [fetch_webpage, grep_search, read_file, create_file, run_in_terminal]
model: gpt-4o
---
```

---

## 11. Deep UI Inspector

### Role Definition
Pixel-perfect analysis, component inspection, design token extraction, and visual regression detection.

### Capabilities
- DOM/CSS inspection and analysis
- Computed style extraction
- Design token reverse engineering
- Component library documentation
- Visual regression testing
- Cross-browser compatibility analysis
- Performance paint analysis
- Accessibility tree inspection
- Animation timeline analysis
- Responsive breakpoint testing

### Installation
```bash
# Browser automation
npm install -g playwright
playwright install

# Visual regression
npm install -g @chromatic/cli
# Percy: https://percy.io/

# Design token tools
npm install -g style-dictionary
npm install -g @figma/rest-api-spec

# VS Code Extensions
code --install-extension ms-playwright.playwright
code --install-extension pflannery.vscode-versionlens
code --install-extension mkxml.colorize
```

### Sources
- **Playwright Inspector:** https://playwright.dev/docs/inspector
- **Chrome DevTools Protocol:** https://chromedevtools.github.io/devtools-protocol/
- **Style Dictionary:** https://amzn.github.io/style-dictionary/
- **Chromatic:** https://www.chromatic.com/
- **Storybook:** https://storybook.js.org/
- **Figma API:** https://www.figma.com/developers/api

### Agent Configuration (`.agent.md`)
```markdown
---
name: deep-ui-inspector
description: Pixel-perfect analysis, component inspection, visual regression
tools: [read_file, view_image, open_browser_page, click_element, hover_element, screenshot_page, run_playwright_code]
model: gpt-4o
---
```

---

## 12. BA for Requirements Analyzer

### Role Definition
Business analysis, requirements elicitation, specification writing, stakeholder management, and acceptance criteria.

### Capabilities
- Requirements elicitation techniques (interviews, workshops, observation)
- User story writing (INVEST criteria)
- Acceptance criteria (Gherkin/BDD)
- Process modeling (BPMN, flowcharts)
- Data modeling (ERD, data dictionaries)
- Gap analysis and impact assessment
- Traceability matrices
- Stakeholder mapping and communication
- Prioritization frameworks (MoSCoW, WSJF, RICE)
- Functional and non-functional requirements
- UAT planning and execution

### Installation
```bash
# Documentation
pip install mkdocs mkdocs-material
npm install -g @mermaid-js/mermaid-cli

# Diagramming
# draw.io: https://app.diagrams.net/
# PlantUML: https://plantuml.com/
# Mermaid: built into GitHub/VS Code

# VS Code Extensions
code --install-extension bierner.markdown-mermaid
code --install-extension jebbs.plantuml
code --install-extension hediet.vscode-drawio
```

### Sources
- **BABOK Guide:** https://www.iiba.org/babok-guide/
- **User Stories:** https://www.mountaingoatsoftware.com/agile/user-stories
- **Gherkin:** https://cucumber.io/docs/gherkin/
- **BPMN:** https://www.omg.org/spec/BPMN/
- **MoSCoW:** https://www.agilebusiness.org/page/moscowprioritisation
- **WSJF:** https://www.scaledagileframework.com/wsjf/
- **RICE:** https://www.intercom.com/blog/rice-prioritization/

### Agent Configuration (`.agent.md`)
```markdown
---
name: ba-requirements-analyzer
description: Business analysis, requirements elicitation, specifications, acceptance criteria
tools: [read_file, create_file, fetch_webpage, grep_search, run_in_terminal]
model: gpt-4o
---
```

---

## Unified Setup Instructions

### Option 1: VS Code Copilot Custom Agents (Recommended)

Create `.agent.md` files in `.github/copilot/agents/`:

```bash
mkdir -p .github/copilot/agents
```

Then create each agent file (e.g., `senior-reverse-engineer.agent.md`) with the agent configuration shown above.

### Option 2: VS Code Custom Instructions

Create `.instructions.md` files in `.github/copilot/instructions/`:

```bash
mkdir -p .github/copilot/instructions
```

### Option 3: Claude Skills (for Claude Code)

Create `SKILL.md` files in `.claude/skills/`:

```bash
mkdir -p .claude/skills
```

Each skill needs:
```
.claude/skills/
├── senior-reverse-engineer/
│   └── SKILL.md
├── senior-architect/
│   └── SKILL.md
... (12 directories)
```

### Option 4: Unified Prompt File

Create a single `.prompt.md` that can invoke any role:

```markdown
---
name: multi-agent-dev-team
description: Invoke any of 12 specialized development roles
---
# Multi-Agent Development Team

Select a role to activate:

1. **Senior Reverse Engineer** - Binary analysis, decompilation, protocol RE
2. **Senior Architect** - System design, architecture patterns, scalability
3. **Senior Backend Developer** - APIs, databases, distributed systems
4. **Senior UI/UX Designer Analyzer** - UX analysis, accessibility, design systems
5. **Senior Frontend Developer** - React, Next.js, TypeScript, performance
6. **Senior Scrum Master/Manager** - Agile, sprint planning, metrics
7. **Web Scraper** - Data extraction, crawling, anti-bot bypass
8. **Senior Tester** - Test strategy, automation, quality assurance
9. **Senior Root Cause Analyzer** - Debugging, RCA, incident response
10. **New Tool Teacher** - Tech radar, tool evaluation, learning resources
11. **Deep UI Inspector** - Pixel-perfect analysis, visual regression
12. **BA Requirements Analyzer** - Requirements, specs, acceptance criteria

**Usage:** "Activate [role name] and help me with [task]"
```

---

## Quick Reference Matrix

| Role | Primary Tools | Best For |
|------|--------------|----------|
| Reverse Engineer | Ghidra, IDA, radare2, pwntools | Binary analysis, malware, protocols |
| Architect | ADRs, Mermaid, Structurizr | System design, tech decisions |
| Backend Dev | FastAPI, Prisma, PostgreSQL, Kafka | APIs, data, distributed systems |
| UI/UX Designer | Figma, axe-core, Storybook | UX, accessibility, design systems |
| Frontend Dev | React, Next.js, Tailwind, Vitest | UI, performance, state management |
| Scrum Master | Jira, Linear, GitHub Projects | Agile, planning, team health |
| Web Scraper | Playwright, Scrapy, httpx | Data extraction, automation |
| Tester | Playwright, Vitest, k6, Pact | Quality, automation, performance |
| Root Cause Analyzer | py-spy, WinDbg, Jaeger, Loki | Debugging, incidents, profiling |
| Tool Teacher | GitHub Trending, HN, Awesome Lists | Learning, evaluation, trends |
| UI Inspector | Playwright, Chromatic, Style Dictionary | Visual QA, design tokens |
| BA Analyst | BPMN, Gherkin, Mermaid, MkDocs | Requirements, specs, stakeholders |

---

## Maintenance

- **Review quarterly:** Update tool versions, add new sources
- **Version control:** Commit this file to your repo
- **Team onboarding:** Share with new team members
- **Customization:** Adapt roles to your tech stack

---

*Generated for InterviewCopilot project - 2026-11-18*  
*Current stack addendum (this project): Electron 28 + React 18 + Tailwind 3 + Vite 5 + esbuild; single-installer NSIS packaging; whisper.cpp Base model bundled; OpenAI-compatible custom-provider architecture; IPC contract between main/preload/renderer with byte-identical types (`src/shared/types.ts` ↔ `src/preload/types.ts`). See ENGINEERING_GUIDE.md for full update playbook.*