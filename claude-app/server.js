import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, 'public')));
app.use((req, res, next) => {
    req.setTimeout(900_000);
    res.setTimeout(900_000);
    next();
});

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 900_000,  // 15 min explicit — timeout:0 is falsy and falls back to SDK default 600s
    maxRetries: 0,     // we handle retries ourselves
});

const SYSTEM_PROMPT = `You are an elite sales strategist for HCLTech Digital Business Services (DBS), ANZ region. You help the HCLTech ANZ sales team identify, prioritise, and win digital transformation opportunities by mapping client needs to HCLTech's specific partner ecosystem.

━━━ HCLTech DBS Service Lines ━━━
• Application Modernisation & Migration
• Cloud & Infrastructure (AWS Advanced Partner)
• Data, Analytics & AI
• Intelligent Automation & Process Excellence
• Digital Experience & Commerce
• Enterprise Integration & API Management
• ERP, SAP & Core Systems
• Cybersecurity & Compliance
• IoT & Engineering Services

━━━ ANZ DBS Partner Ecosystem ━━━

STRATEGIC FY27 PARTNERS (highest priority — lead every GTM motion):
┌─────────────┬────────────────────────────┬──────────┬──────────────────────────────────────────────────┐
│ Partner     │ Tier / Level               │ Resell   │ Key Value Proposition                            │
├─────────────┼────────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ Pega        │ Specialised, Second Tier   │ Yes      │ Intelligent BPM, CX transformation, low-code     │
│ Workato     │ Diamond, Top Tier          │ Yes+Ref  │ Enterprise iPaaS, hyperautomation, no-code       │
│ Palantir    │ Strategic                  │ No       │ AI/ML platforms, defence & public sector AI      │
│ Databricks  │ Silver SI & Reseller       │ Yes      │ Data Lakehouse, MLOps, Generative AI             │
│ Snowflake   │ Elite, Top Tier            │ Ref only │ Data Cloud, analytics, data sharing              │
│ Camunda     │ Strategic                  │ Yes      │ Process orchestration, BPMN automation           │
└─────────────┴────────────────────────────┴──────────┴──────────────────────────────────────────────────┘

TRENDING PARTNERS (strong momentum — pursue actively):
┌─────────────┬──────────────────────────────┬──────────────────────────────────────────────────────────┐
│ Partner     │ Level                        │ Key Value Proposition                                    │
├─────────────┼──────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Appian      │ Global Prof Services, Ref    │ Low-code BPM, insurance & public sector automation       │
│ Denodo      │ Strategic                    │ Data virtualisation, logical data fabric                 │
│ Kong        │ Strategic                    │ API gateway & management, microservices                  │
│ TIBCO       │ Strategic                    │ Integration, event streaming, analytics                  │
│ Qlik/Talend │ Strategic                    │ BI/analytics, data integration & quality                 │
│ Sitecore    │ Strategic                    │ Digital experience, headless CMS, personalisation        │
└─────────────┴──────────────────────────────┴──────────────────────────────────────────────────────────┘

OTHER ACTIVE PARTNERS:
Adobe (Platinum/Top Tier, CX & marketing), MuleSoft (Strategic NA, tied to SFDC), Boomi (Gold/Second Tier, Resell+Ref),
Alteryx (Premier/Top Tier, Resell+Ref), Informatica (Platinum/Top Tier, Resell+Ref), Software AG (positive RAG),
OutSystems (low-code), BlueYonder (supply chain), Solace (event mesh), DataRobot (AI/ML), Acquia (DXP),
MongoDB (NoSQL/document DB), Confluent (streaming), Cornerstone (HCM/learning)

━━━ POWER OF THREE — AWS + HCLTech + Partner ━━━
A core GTM motion in ANZ is the "Power of Three": HCLTech services + AWS cloud + a strategic partner, creating
a combined proposition stronger than any individual vendor. Key Power of Three combinations:

• AWS + Databricks       → "AI Lakehouse on AWS" — migrate/modernise data estate, build GenAI use-cases
• AWS + Snowflake        → "Modern Data Cloud on AWS" — CBA-style migration, data monetisation
• AWS + Pega             → "Intelligent Operations on AWS" — CX automation, decisioning at scale
• AWS + Workato          → "Hyperautomation on AWS" — enterprise integration + automation
• AWS + Camunda          → "Process Intelligence on AWS" — orchestrate complex workflows on cloud
• AWS + Palantir         → "AI-Powered Operations on AWS" — operational AI, defence & government
• AWS + Informatica      → "Intelligent Data Management on AWS" — MDM, data governance at scale
• AWS + MuleSoft/Boomi   → "Connected Enterprise on AWS" — API-led integration modernisation

Always flag when a Power of Three proposition is applicable. It amplifies deal size, brings AWS funding/support,
and differentiates HCLTech from pure-play integrators.

━━━ ANZ Known Accounts (do not propose for greenfield — focus on expansion/upsell) ━━━
Pega accounts: DTP, CBA, TfNSW | Workato: SRG, AGQS | Databricks: TfNSW, CBA | Snowflake: Elders
Camunda: Coles, Telstra, NAB (target) | Appian: AIA | TIBCO: AusPost, Metcash | Qlik: Toll

━━━ Analysis Instructions ━━━
For every opportunity you identify:
1. Assign it to a partner tier: "Strategic FY27", "Trending", or "Other"
2. Identify whether a Power of Three (AWS + partner) proposition applies and name the combination
3. Note whether HCLTech can RESELL the partner licence (generates additional revenue) or referral only
4. Quantify business value and urgency with specifics from the research data
5. Identify the economic buyer and technical buyer by title
6. Flag if a competitor (Infosys, TCS, Wipro, Accenture, Deloitte, IBM) is likely already engaged
7. Prioritise: Strategic FY27 opportunities first, then Trending, then Other

Be commercially sharp. Vague recommendations have no value to a sales team.`;


// ── Tavily search ────────────────────────────────────────────────────────────
async function tavilySearch(query, maxResults = 5) {
    try {
        const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: process.env.TAVILY_API_KEY,
                query,
                search_depth: 'advanced',
                max_results: maxResults,
                include_answer: true,
                include_raw_content: false,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            answer: data.answer,
            results: data.results?.map(r => ({
                title: r.title,
                url: r.url,
                content: r.content?.slice(0, 600),
                published_date: r.published_date,
            })),
        };
    } catch {
        return null;
    }
}

// ── Apollo.io organisation enrichment ────────────────────────────────────────
async function apolloEnrich(orgName) {
    if (!process.env.APOLLO_API_KEY) return null;
    try {
        const res = await fetch(
            `https://api.apollo.io/api/v1/organizations/enrich?name=${encodeURIComponent(orgName)}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': process.env.APOLLO_API_KEY,
                    'Cache-Control': 'no-cache',
                },
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const org = data.organization;
        if (!org) return null;
        return {
            name: org.name,
            website: org.website_url,
            description: org.short_description,
            employees: org.estimated_num_employees,
            revenue: org.annual_revenue_printed,
            industry: org.industry,
            hq: [org.city, org.state, org.country].filter(Boolean).join(', '),
            founded: org.founded_year,
            technologies: org.technologies?.slice(0, 25) || [],
            keywords: org.keywords?.slice(0, 12) || [],
            linkedin: org.linkedin_url,
            logo: org.logo_url,
        };
    } catch {
        return null;
    }
}

// ── Apollo.io people search (key contacts) ────────────────────────────────────
async function apolloPeople(orgName) {
    if (!process.env.APOLLO_API_KEY) return null;
    try {
        const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': process.env.APOLLO_API_KEY,
            },
            body: JSON.stringify({
                organization_names: [orgName],
                titles: [
                    'CTO', 'CIO', 'CDO', 'CISO',
                    'Chief Technology Officer', 'Chief Information Officer',
                    'Chief Digital Officer', 'Chief Data Officer',
                    'VP Technology', 'VP Engineering', 'VP IT',
                    'Head of Digital', 'Head of Technology',
                    'SVP Technology', 'Director of IT', 'Director Technology',
                ],
                per_page: 10,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.people?.slice(0, 8).map(p => ({
            name: p.name,
            title: p.title,
            linkedin: p.linkedin_url,
            email: p.email,
        })) || [];
    } catch {
        return null;
    }
}

// ── Parallel research for one org ─────────────────────────────────────────────
async function researchOrg(name) {
    const [news, tech, leadership, ma, strategy, [apollo, people]] = await Promise.all([
        tavilySearch(`"${name}" news announcements strategy 2024 2025`, 5),
        tavilySearch(`"${name}" technology stack cloud platform software infrastructure`, 4),
        tavilySearch(`"${name}" CTO CIO CDO digital leadership executives`, 3),
        tavilySearch(`"${name}" acquisition merger partnership 2024 2025`, 3),
        tavilySearch(`"${name}" digital transformation challenges business growth`, 5),
        Promise.all([apolloEnrich(name), apolloPeople(name)]),
    ]);
    return { news, tech, leadership, ma, strategy, apollo, people };
}

function buildResearchContext(name, r) {
    const parts = [];
    if (r.apollo) {
        parts.push(`## Apollo.io Company Data
Name: ${r.apollo.name} | Employees: ${r.apollo.employees || '?'} | Revenue: ${r.apollo.revenue || '?'}
Industry: ${r.apollo.industry || '?'} | HQ: ${r.apollo.hq || '?'} | Founded: ${r.apollo.founded || '?'}
Description: ${r.apollo.description || 'N/A'}
Technologies: ${r.apollo.technologies?.join(', ') || 'unknown'}
Keywords: ${r.apollo.keywords?.join(', ') || 'N/A'}`);
    }
    if (r.people?.length) {
        parts.push(`## Key Contacts (Apollo.io)\n${r.people.map(p => `- ${p.name} — ${p.title}`).join('\n')}`);
    }
    const sections = [
        ['Recent News', r.news],
        ['Technology & Infrastructure', r.tech],
        ['Leadership', r.leadership],
        ['M&A Activity', r.ma],
        ['Business Strategy & Challenges', r.strategy],
    ];
    for (const [label, d] of sections) {
        if (d?.answer) {
            parts.push(`## ${label} (Tavily)\n${d.answer}\nSources: ${d.results?.map(x => x.title).slice(0, 3).join('; ')}`);
        }
    }
    return parts.join('\n\n') || 'No research data available.';
}

// ── JSON repair helper ────────────────────────────────────────────────────────
function countUnclosed(s) {
    let depth = 0, inStr = false, esc = false;
    for (const ch of s) {
        if (esc) { esc = false; continue; }
        if (ch === '\\' && inStr) { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') depth--;
    }
    return Math.max(depth * 2, 0); // each unclosed level needs 2 chars: ]}
}

// ── SSE helper ────────────────────────────────────────────────────────────────
function sendEvent(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── POST /api/analyze ─────────────────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
    const { mode, orgs, industry, region, vendors } = req.body;
    const targets = mode === 'industry' ? null : (orgs || []).map(o => o.trim()).filter(Boolean);

    if (!targets?.length && mode !== 'industry') {
        return res.status(400).json({ error: 'Provide at least one organisation name.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering on Render
    res.flushHeaders();

    // Global keepalive — starts immediately so Render's proxy never sees an idle connection
    const globalKa = setInterval(() => res.write(': ping\n\n'), 10_000);

    const vendorList = vendors || 'STRATEGIC FY27: Pega, Workato, Palantir, Databricks, Snowflake, Camunda | TRENDING: Appian, Denodo, Kong, TIBCO, Qlik/Talend, Sitecore | OTHER: Adobe, MuleSoft, Boomi, Alteryx, Informatica, Software AG, OutSystems, BlueYonder, Solace, DataRobot, Acquia, MongoDB, Confluent, Cornerstone | CLOUD: AWS (Power of Three anchor)';

    try {
        let orgList = targets;

        // Industry mode: discover companies first
        if (mode === 'industry') {
            sendEvent(res, 'status', { message: `Discovering top companies in ${industry}${region ? ` · ${region}` : ''}…` });
            const discovery = await tavilySearch(
                `largest most important companies in ${industry} industry${region ? ` ${region}` : ''} 2024 digital transformation leaders`,
                8
            );
            try {
                const msg = await anthropic.messages.create({
                    model: 'claude-opus-4-7',
                    max_tokens: 600,
                    system: 'Extract company names from the text. Return ONLY a JSON array of strings, no markdown, no explanation.',
                    messages: [{
                        role: 'user',
                        content: `List up to 20 distinct company names from this text about the ${industry} industry.\n\n${discovery?.answer || ''}\n\n${discovery?.results?.map(r => r.content).join('\n') || ''}`,
                    }],
                });
                const text = msg.content.find(b => b.type === 'text')?.text || '[]';
                const match = text.match(/\[[\s\S]*\]/);
                orgList = JSON.parse(match ? match[0] : '[]').slice(0, 20);
            } catch {
                orgList = [];
            }
            if (!orgList.length) orgList = [`${industry} sector`];
            sendEvent(res, 'discovered', { orgs: orgList });
        }

        sendEvent(res, 'start', { total: orgList.length });

        // Process in batches of 3 (parallel within batch)
        for (let i = 0; i < orgList.length; i += 3) {
            await Promise.all(orgList.slice(i, i + 3).map(async (orgName) => {
                sendEvent(res, 'progress', { org: orgName, status: 'researching' });
                const research = await researchOrg(orgName);
                sendEvent(res, 'progress', { org: orgName, status: 'analysing' });

                let result;
                const callClaude = async (prompt) => {
                    const stream = await anthropic.messages.stream({
                        model: 'claude-opus-4-7',
                        max_tokens: 8000,
                        thinking: { type: 'adaptive' },
                        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
                        messages: [{ role: 'user', content: prompt }],
                    });
                    return stream.finalMessage();
                };
                try {
                    const prompt = `Analyse "${orgName}" and produce a complete GTM intelligence brief for HCLTech.

Partner/vendor list to draw from: ${vendorList}

RESEARCH DATA:
${buildResearchContext(orgName, research)}

Return a single JSON object (no markdown fences) with this exact schema:
{
  "orgName": "string",
  "logoUrl": "url or null",
  "website": "url or null",
  "executiveSummary": "2-3 sentence commercial GTM thesis",
  "overallScore": 1-10,
  "profile": {
    "description": "string",
    "industry": "string",
    "employees": "string",
    "revenue": "string",
    "hq": "string",
    "founded": "string or null",
    "website": "string or null"
  },
  "techStack": ["tech1", "tech2"],
  "leadership": [
    { "name": "string", "title": "string", "linkedin": "url or null" }
  ],
  "recentNews": [
    { "headline": "string", "date": "string or null", "significance": "string", "url": "string or null" }
  ],
  "maActivity": [
    { "event": "string", "date": "string or null", "implication": "string" }
  ],
  "opportunities": [
    {
      "title": "string",
      "score": 1-10,
      "partnerTier": "Strategic FY27 | Trending | Other",
      "description": "string",
      "businessValue": "string",
      "vendors": ["string — must be from HCLTech ANZ partner list"],
      "hclServices": ["string"],
      "powerOfThree": {
        "applicable": true or false,
        "combination": "AWS + Partner name or null",
        "proposition": "one sentence Power of Three pitch or null"
      },
      "resellOpportunity": true or false,
      "economicBuyer": "string",
      "technicalBuyer": "string",
      "urgencyDriver": "string",
      "fundingSource": "string",
      "competitiveRisk": "string"
    }
  ],
  "talkingPoints": ["string"],
  "nextActions": ["string"]
}

IMPORTANT: Sort opportunities array — Strategic FY27 first, then Trending, then Other.
Return ONLY the JSON object.`;

                    let message;
                    try {
                        message = await callClaude(prompt);
                    } catch (firstErr) {
                        // Retry once on idle timeout — thinking phase can go silent longer than expected
                        if (firstErr.message?.toLowerCase().includes('idle timeout') || firstErr.message?.toLowerCase().includes('stream')) {
                            sendEvent(res, 'progress', { org: orgName, status: 'retrying' });
                            await new Promise(r => setTimeout(r, 3000));
                            message = await callClaude(prompt);
                        } else {
                            throw firstErr;
                        }
                    }
                    const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
                    const match = raw.match(/\{[\s\S]*\}/);
                    const jsonStr = match ? match[0] : raw;
                    try {
                        result = JSON.parse(jsonStr);
                    } catch {
                        // Truncated JSON — close any open arrays/objects and retry parse
                        const repaired = jsonStr
                            .replace(/,\s*$/, '')           // trailing comma
                            .replace(/"\s*$/, '"')           // unclosed string → close it
                            + ']}]}]}]}]}]}]}]}]}]}]}]}'     // close nested arrays/objects
                                .slice(0, countUnclosed(jsonStr));
                        result = JSON.parse(repaired);
                    }
                } catch (err) {
                    result = {
                        orgName,
                        executiveSummary: `Analysis error: ${err.message}`,
                        overallScore: 0,
                        profile: {},
                        techStack: [],
                        leadership: [],
                        recentNews: [],
                        maActivity: [],
                        opportunities: [],
                        talkingPoints: [],
                        nextActions: [],
                    };
                }
                sendEvent(res, 'result', { org: orgName, data: result });
            }));
        }

        sendEvent(res, 'done', { total: orgList.length });
    } catch (err) {
        sendEvent(res, 'error', { message: err.message });
    } finally {
        clearInterval(globalKa);
    }
    res.end();
});

// ── POST /api/export/excel ─────────────────────────────────────────────────────
app.post('/api/export/excel', async (req, res) => {
    const { results } = req.body;
    if (!results?.length) return res.status(400).json({ error: 'No results to export.' });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'HCLTech Sales Intelligence';
    wb.created = new Date();

    const HCL_NAVY = 'FF001A3A';
    const HCL_ORANGE = 'FFF37021';
    const HCL_BLUE = 'FF00ADEF';
    const WHITE = 'FFFFFFFF';
    const LIGHT_GRAY = 'FFF9FAFB';

    const headerStyle = (fgColor) => ({
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
        font: { bold: true, color: { argb: WHITE }, size: 11 },
        alignment: { wrapText: true, vertical: 'middle', horizontal: 'center' },
        border: { bottom: { style: 'medium', color: { argb: HCL_ORANGE } } },
    });

    function styleSheet(sheet, headerColor) {
        sheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle(headerColor)));
        sheet.eachRow((row, i) => {
            if (i === 1) return;
            row.eachCell(cell => {
                cell.alignment = { wrapText: true, vertical: 'top' };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
                if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
            });
        });
    }

    // Sheet 1: Summary
    const ws1 = wb.addWorksheet('Summary');
    ws1.columns = [
        { header: 'Organisation', key: 'org', width: 28 },
        { header: 'Industry', key: 'industry', width: 22 },
        { header: 'Employees', key: 'employees', width: 14 },
        { header: 'Revenue', key: 'revenue', width: 14 },
        { header: 'HQ', key: 'hq', width: 22 },
        { header: 'Opp Score', key: 'score', width: 12 },
        { header: 'Executive Summary', key: 'summary', width: 65 },
        { header: 'Top Opportunity', key: 'topOpp', width: 40 },
        { header: 'Key Vendors', key: 'vendors', width: 35 },
        { header: 'Tech Stack', key: 'tech', width: 40 },
    ];
    for (const r of results) {
        const top = r.opportunities?.[0];
        ws1.addRow({
            org: r.orgName, industry: r.profile?.industry || '',
            employees: r.profile?.employees || '', revenue: r.profile?.revenue || '',
            hq: r.profile?.hq || '', score: r.overallScore,
            summary: r.executiveSummary,
            topOpp: top?.title || '', vendors: top?.vendors?.join(', ') || '',
            tech: r.techStack?.slice(0, 10).join(', ') || '',
        });
    }
    styleSheet(ws1, HCL_NAVY);

    // Sheet 2: Opportunities
    const ws2 = wb.addWorksheet('Opportunities');
    ws2.columns = [
        { header: 'Organisation', key: 'org', width: 25 },
        { header: 'Opportunity', key: 'opp', width: 38 },
        { header: 'Score', key: 'score', width: 9 },
        { header: 'Description', key: 'desc', width: 55 },
        { header: 'Business Value', key: 'value', width: 38 },
        { header: 'Vendors', key: 'vendors', width: 32 },
        { header: 'HCLTech Services', key: 'services', width: 32 },
        { header: 'Economic Buyer', key: 'buyer', width: 22 },
        { header: 'Urgency Driver', key: 'urgency', width: 38 },
        { header: 'Funding Source', key: 'funding', width: 28 },
        { header: 'Competitive Risk', key: 'comp', width: 35 },
    ];
    for (const r of results) {
        for (const o of (r.opportunities || [])) {
            ws2.addRow({
                org: r.orgName, opp: o.title, score: o.score,
                desc: o.description, value: o.businessValue,
                vendors: o.vendors?.join(', '), services: o.hclServices?.join(', '),
                buyer: o.economicBuyer, urgency: o.urgencyDriver,
                funding: o.fundingSource, comp: o.competitiveRisk,
            });
        }
    }
    styleSheet(ws2, HCL_ORANGE);

    // Sheet 3: Leadership
    const ws3 = wb.addWorksheet('Key Contacts');
    ws3.columns = [
        { header: 'Organisation', key: 'org', width: 25 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Title', key: 'title', width: 38 },
        { header: 'LinkedIn', key: 'linkedin', width: 45 },
    ];
    for (const r of results) {
        for (const p of (r.leadership || [])) {
            ws3.addRow({ org: r.orgName, name: p.name, title: p.title, linkedin: p.linkedin || '' });
        }
    }
    styleSheet(ws3, HCL_BLUE);

    // Sheet 4: News & Intelligence
    const ws4 = wb.addWorksheet('Market Intelligence');
    ws4.columns = [
        { header: 'Organisation', key: 'org', width: 25 },
        { header: 'Headline', key: 'headline', width: 55 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Significance', key: 'sig', width: 55 },
        { header: 'Source URL', key: 'url', width: 45 },
    ];
    for (const r of results) {
        for (const n of (r.recentNews || [])) {
            ws4.addRow({ org: r.orgName, headline: n.headline, date: n.date || '', sig: n.significance, url: n.url || '' });
        }
    }
    styleSheet(ws4, HCL_NAVY);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="HCLTech-Sales-Intelligence-${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
});

// ── POST /api/export/brief ────────────────────────────────────────────────────
app.post('/api/export/brief', (req, res) => {
    const { result, format } = req.body;
    if (!result) return res.status(400).json({ error: 'No result data.' });

    if (format === 'text') {
        const text = buildTextBrief(result);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.orgName}-Brief.txt"`);
        return res.send(text);
    }

    const html = buildSlideHTML(result);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.orgName}-Slides.html"`);
    res.send(html);
});

function buildTextBrief(r) {
    const line = '═'.repeat(60);
    return `HCLTech Sales Intelligence Brief
Generated: ${new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}
${line}

ORGANISATION: ${r.orgName}
OPPORTUNITY SCORE: ${r.overallScore}/10

EXECUTIVE SUMMARY
${r.executiveSummary}

COMPANY PROFILE
Industry: ${r.profile?.industry || 'N/A'}
Employees: ${r.profile?.employees || 'N/A'}
Revenue: ${r.profile?.revenue || 'N/A'}
HQ: ${r.profile?.hq || 'N/A'}
Founded: ${r.profile?.founded || 'N/A'}
Website: ${r.profile?.website || 'N/A'}

${r.profile?.description || ''}

TECHNOLOGY STACK
${r.techStack?.join(', ') || 'N/A'}

KEY LEADERSHIP
${r.leadership?.map(p => `• ${p.name} — ${p.title}`).join('\n') || 'N/A'}

RECENT NEWS & DEVELOPMENTS
${r.recentNews?.map(n => `• [${n.date || 'Recent'}] ${n.headline}\n  → ${n.significance}`).join('\n\n') || 'N/A'}

M&A ACTIVITY
${r.maActivity?.map(m => `• ${m.event} (${m.date || 'Recent'})\n  → ${m.implication}`).join('\n\n') || 'None identified'}

GTM OPPORTUNITIES
${r.opportunities?.map((o, i) => `
${i + 1}. ${o.title} [Score: ${o.score}/10]
   ${o.description}

   Business Value:   ${o.businessValue}
   Vendors:          ${o.vendors?.join(', ')}
   HCLTech Services: ${o.hclServices?.join(', ')}
   Economic Buyer:   ${o.economicBuyer}
   Technical Buyer:  ${o.technicalBuyer}
   Urgency Driver:   ${o.urgencyDriver}
   Funding Source:   ${o.fundingSource}
   Competitive Risk: ${o.competitiveRisk}`).join('\n') || 'N/A'}

TALKING POINTS
${r.talkingPoints?.map((t, i) => `${i + 1}. ${t}`).join('\n') || 'N/A'}

NEXT ACTIONS
${r.nextActions?.map((a, i) => `${i + 1}. ${a}`).join('\n') || 'N/A'}

${line}
Confidential — HCLTech Digital Business Services`;
}

function buildSlideHTML(r) {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const oppSlides = (r.opportunities || []).map((o, i) => `
<div class="slide">
  <div class="slide-header">
    <span class="slide-num">0${i + 2}</span>
    <span class="slide-title">${o.title}</span>
    <span class="badge orange">${o.score}/10</span>
  </div>
  <p class="desc">${o.description}</p>
  <div class="grid2">
    <div class="info-card"><div class="info-label">Business Value</div><div>${o.businessValue}</div></div>
    <div class="info-card"><div class="info-label">Urgency Driver</div><div>${o.urgencyDriver}</div></div>
    <div class="info-card"><div class="info-label">Economic Buyer</div><div>${o.economicBuyer}</div></div>
    <div class="info-card"><div class="info-label">Funding Source</div><div>${o.fundingSource}</div></div>
  </div>
  <div class="tags-row"><strong>Vendors: </strong>${o.vendors?.map(v => `<span class="tag t-orange">${v}</span>`).join('') || 'N/A'}</div>
  <div class="tags-row" style="margin-top:6px;"><strong>HCLTech Services: </strong>${o.hclServices?.map(s => `<span class="tag t-blue">${s}</span>`).join('') || 'N/A'}</div>
  ${o.competitiveRisk ? `<div class="alert">⚠ Competitive Risk: ${o.competitiveRisk}</div>` : ''}
  <div class="footer"><span>HCLTech — Confidential</span><span>${date}</span></div>
</div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>HCLTech — ${r.orgName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;color:#111827}
.print-btn{position:fixed;top:16px;right:16px;background:#F37021;color:#fff;border:none;padding:10px 22px;border-radius:6px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(243,112,33,.45);z-index:99}
@media print{.print-btn{display:none}.slide{page-break-after:always;box-shadow:none;margin:0}}
.slide{width:270mm;min-height:160mm;background:#fff;margin:0 auto 20px;padding:38px 48px;box-shadow:0 2px 20px rgba(0,0,0,.1);position:relative}
.slide-header{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #F37021}
.slide-num{font-size:2.2rem;font-weight:900;color:#F37021;opacity:.35;line-height:1}
.slide-title{flex:1;font-size:1.45rem;font-weight:700;color:#001A3A}
.badge{padding:4px 14px;border-radius:20px;font-weight:700;font-size:1rem;white-space:nowrap}
.badge.orange{background:#F37021;color:#fff}
.badge.navy{background:#001A3A;color:#fff}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}
.stat-card{background:#001A3A;color:#fff;padding:16px;border-radius:8px;text-align:center}
.stat-val{font-size:1.4rem;font-weight:800;color:#F37021}
.stat-lbl{font-size:.72rem;color:#9CA3AF;margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
.desc{color:#374151;font-size:.95rem;line-height:1.65;margin-bottom:18px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.info-card{background:#f9fafb;border-left:3px solid #F37021;padding:12px 14px;border-radius:0 8px 8px 0}
.info-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;margin-bottom:4px;font-weight:600}
.tags-row{font-size:.85rem;color:#374151;margin-bottom:4px}
.tag{display:inline-block;padding:2px 9px;border-radius:10px;font-size:.75rem;margin:2px}
.t-orange{background:#FFF0E6;color:#C05500;border:1px solid #F37021}
.t-blue{background:#EFF6FF;color:#1D4ED8;border:1px solid #3B82F6}
.t-green{background:#F0FDF4;color:#166534;border:1px solid #22C55E}
.alert{background:#FFF8E1;border:1px solid #F59E0B;padding:10px 14px;border-radius:6px;font-size:.85rem;color:#92400E;margin-top:12px}
.section-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;font-weight:600;margin:14px 0 6px}
ul{padding-left:18px}li{margin-bottom:6px;color:#374151;font-size:.88rem;line-height:1.5}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.footer{position:absolute;bottom:22px;left:48px;right:48px;display:flex;justify-content:space-between;font-size:.72rem;color:#9CA3AF;border-top:1px solid #e5e7eb;padding-top:10px}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>

<div class="slide">
  <div style="display:flex;align-items:center;gap:18px;margin-bottom:28px">
    <img src="https://www.hcltech.com/themes/custom/hcltech/images/hcltech-new-logo.svg" style="height:38px" onerror="this.style.display='none'">
    <div>
      <div style="font-size:.8rem;color:#F37021;text-transform:uppercase;letter-spacing:1.5px">Digital Business Services</div>
      <div style="font-size:.85rem;color:#6b7280">Sales Intelligence Brief</div>
    </div>
  </div>
  <div style="font-size:.8rem;color:#F37021;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Account Analysis</div>
  <h1 style="font-size:2.8rem;font-weight:900;color:#001A3A;line-height:1.1;margin-bottom:14px">${r.orgName}</h1>
  <p style="font-size:1.05rem;color:#4B5563;max-width:580px;line-height:1.65">${r.executiveSummary}</p>
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-val">${r.overallScore}/10</div><div class="stat-lbl">Opp Score</div></div>
    <div class="stat-card"><div class="stat-val">${r.opportunities?.length || 0}</div><div class="stat-lbl">Opportunities</div></div>
    <div class="stat-card"><div class="stat-val">${r.profile?.employees || '—'}</div><div class="stat-lbl">Employees</div></div>
    <div class="stat-card"><div class="stat-val">${r.profile?.revenue || '—'}</div><div class="stat-lbl">Revenue</div></div>
  </div>
  <div class="footer"><span>Confidential — HCLTech Digital Business Services</span><span>${date}</span></div>
</div>

<div class="slide">
  <div class="slide-header"><span class="slide-num">01</span><span class="slide-title">Company Profile & Market Intelligence</span></div>
  <div class="two-col">
    <div>
      <div class="section-label">Overview</div>
      <p class="desc">${r.profile?.description || 'N/A'}</p>
      <div class="grid2">
        <div class="info-card"><div class="info-label">Industry</div><div>${r.profile?.industry || 'N/A'}</div></div>
        <div class="info-card"><div class="info-label">HQ</div><div>${r.profile?.hq || 'N/A'}</div></div>
        <div class="info-card"><div class="info-label">Founded</div><div>${r.profile?.founded || 'N/A'}</div></div>
        <div class="info-card"><div class="info-label">Revenue</div><div>${r.profile?.revenue || 'N/A'}</div></div>
      </div>
      <div class="section-label">Technology Stack</div>
      <div>${r.techStack?.map(t => `<span class="tag t-blue">${t}</span>`).join('') || 'N/A'}</div>
    </div>
    <div>
      <div class="section-label">Key Leadership</div>
      <ul>${r.leadership?.map(p => `<li><strong>${p.name}</strong> — ${p.title}</li>`).join('') || '<li>N/A</li>'}</ul>
      <div class="section-label">Recent News</div>
      <ul>${r.recentNews?.slice(0, 3).map(n => `<li><strong>${n.headline}</strong> — ${n.significance}</li>`).join('') || '<li>N/A</li>'}</ul>
      ${r.maActivity?.length ? `<div class="section-label">M&A Activity</div><ul>${r.maActivity.map(m => `<li>${m.event} — ${m.implication}</li>`).join('')}</ul>` : ''}
    </div>
  </div>
  <div class="footer"><span>Confidential — HCLTech Digital Business Services</span><span>${date}</span></div>
</div>

${oppSlides}

<div class="slide">
  <div class="slide-header">
    <span class="slide-num">0${(r.opportunities?.length || 0) + 2}</span>
    <span class="slide-title">Talking Points & Next Actions</span>
  </div>
  <div class="two-col">
    <div>
      <div class="section-label">Conversation Starters</div>
      <ul>${r.talkingPoints?.map(t => `<li>${t}</li>`).join('') || '<li>N/A</li>'}</ul>
    </div>
    <div>
      <div class="section-label">Recommended Next Actions</div>
      <ul>${r.nextActions?.map(a => `<li>${a}</li>`).join('') || '<li>N/A</li>'}</ul>
    </div>
  </div>
  <div class="footer"><span>Confidential — HCLTech Digital Business Services</span><span>${date}</span></div>
</div>

</body>
</html>`;
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        tavily: !!process.env.TAVILY_API_KEY,
        apollo: !!process.env.APOLLO_API_KEY,
    });
});

app.listen(PORT, () => {
    console.log(`\n  HCLTech Sales Intelligence  →  http://localhost:${PORT}\n`);
    if (!process.env.ANTHROPIC_API_KEY) console.warn('  ⚠  ANTHROPIC_API_KEY not set');
    if (!process.env.TAVILY_API_KEY)    console.warn('  ⚠  TAVILY_API_KEY not set');
    if (!process.env.APOLLO_API_KEY)    console.warn('  ⚠  APOLLO_API_KEY not set');
});
