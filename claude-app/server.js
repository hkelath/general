import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 5 * 60 * 1000,  // 5 minutes — adaptive thinking can be slow
});

// Extend request/response timeouts for long-running SSE streams
app.use((req, res, next) => {
    req.setTimeout(300_000);
    res.setTimeout(300_000);
    next();
});

// Cached system prompt content for prompt caching
const SYSTEM_PROMPT = `You are an expert GSI (Global Systems Integrator) sales strategist at HCLTech, specializing in Digital Business Services. Your role is to identify high-value digital transformation opportunities for organizations by analyzing their technology landscape, business challenges, and strategic priorities.

You have deep knowledge of:
- Enterprise technology platforms and vendors: Appian, Pega, OutSystems, Unqork, MuleSoft, Boomi, Snaplogic, Informatica, Databricks, Snowflake, UiPath, Automation Anywhere, Blue Prism, MongoDB, Collibra, Celonis, Atlassian, and 50+ more
- HCLTech's service capabilities: Application Modernization, Cloud Migration, Data & AI, Intelligent Automation, Digital Experience, Integration Services
- Hyperscaler ecosystems: AWS, Microsoft Azure, Google Cloud Platform
- AI platforms: Databricks, Snowflake, OpenAI, Google Vertex AI, Amazon SageMaker
- Industry-specific digital transformation patterns and maturity models
- Funding mechanisms: CapEx/OpEx models, innovation funds, regulatory compliance budgets, cost-avoidance programs

When analyzing organizations, you:
1. Identify the most compelling, specific digital transformation opportunities based on the organization's industry and scale
2. Map those opportunities to relevant technology vendors from the provided list
3. Quantify business value and urgency where possible
4. Flag competitive pressures or regulatory drivers that create urgency
5. Suggest specific HCLTech service lines that should lead the engagement

Always respond with valid JSON in the exact schema requested. Be specific, commercial, and focused on creating genuine sales value.`;

// Common Room API helper
async function fetchCommonRoomSignals(orgName) {
    if (!process.env.COMMON_ROOM_API_KEY) return null;
    try {
        const res = await fetch('https://api.commonroom.io/community/v1/activities/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.COMMON_ROOM_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filter: { organization: orgName },
                limit: 10,
                fields: ['activityType', 'source', 'createdAt', 'member.organization']
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.activities || null;
    } catch {
        return null;
    }
}

// SSE helper — writes one JSON event to the response stream
function sendEvent(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// POST /api/analyze — streams analysis for a list of organizations
app.post('/api/analyze', async (req, res) => {
    const { organizations, vendors, hyperscaler, aiPlatform, industryVertical, region } = req.body;

    if (!organizations?.length && !industryVertical) {
        return res.status(400).json({ error: 'Provide organizations or an industryVertical.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const targets = industryVertical
        ? [`${industryVertical} sector${region ? ` in ${region}` : ''}`]
        : organizations;

    const vendorList = vendors || 'Acceldata, Acquia, Adobe, Alteryx, Appian, Atlassian, Automation Anywhere, Boomi, Camunda, Celonis, Cloudera, Collibra, Databricks, DataRobot, Denodo, Informatica, MuleSoft, MongoDB, OpenText, OutSystems, Pega, Qlik, Snowflake, TIBCO, UiPath, Workato';
    const hyperscalerNote = hyperscaler && hyperscaler !== 'None' ? ` Emphasize ${hyperscaler} cloud services where relevant.` : '';
    const aiNote = aiPlatform && aiPlatform !== 'None' ? ` Highlight ${aiPlatform} AI platform use-cases.` : '';

    sendEvent(res, 'start', { total: targets.length });

    for (const target of targets) {
        sendEvent(res, 'progress', { target, status: 'analyzing' });

        // Enrich with Common Room signals if available
        const signals = await fetchCommonRoomSignals(target);
        const signalsContext = signals?.length
            ? `\n\nCommon Room signals for this org (recent community/product activity):\n${JSON.stringify(signals.slice(0, 5), null, 2)}`
            : '';

        const userPrompt = `Analyze "${target}" and identify the top 3 high-value digital transformation opportunities for HCLTech to pursue.

Vendor list to map to: ${vendorList}${hyperscalerNote}${aiNote}${signalsContext}

Return a JSON array (not wrapped in markdown) with exactly this schema for each opportunity:
[
  {
    "opportunity": "Brief 6-8 word title",
    "description": "2-3 sentence explanation of the business pain and transformation potential",
    "vendors": ["Vendor1", "Vendor2"],
    "targetBuyer": "Job title(s) of the economic buyer",
    "justification": "Why this is urgent now — market, competitive, or regulatory driver",
    "fundingSource": "Budget source (e.g., IT modernization capex, compliance budget, innovation fund)",
    "priorityScore": 1-10,
    "hclServices": ["Service line 1", "Service line 2"]
  }
]

Return ONLY the JSON array. No markdown, no explanation.`;

        try {
            const keepalive = setInterval(() => res.write(': keepalive\n\n'), 15_000);
            let message;
            try {
                const stream = await anthropic.messages.stream({
                    model: 'claude-opus-4-7',
                    max_tokens: 2000,
                    thinking: { type: 'adaptive' },
                    system: [
                        {
                            type: 'text',
                            text: SYSTEM_PROMPT,
                            cache_control: { type: 'ephemeral' },
                        }
                    ],
                    messages: [{ role: 'user', content: userPrompt }],
                });
                message = await stream.finalMessage();
            } finally {
                clearInterval(keepalive);
            }
            const rawText = message.content
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('');

            let opportunities;
            try {
                const jsonMatch = rawText.match(/\[[\s\S]*\]/);
                opportunities = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
            } catch {
                opportunities = [{ opportunity: 'Parse error', description: rawText, vendors: [], targetBuyer: '', justification: '', fundingSource: '', priorityScore: 0, hclServices: [] }];
            }

            sendEvent(res, 'result', { target, opportunities });
        } catch (err) {
            sendEvent(res, 'error', { target, message: err.message });
        }
    }

    sendEvent(res, 'done', { total: targets.length });
    res.end();
});

// POST /api/campaigns — generate marketing campaign suggestions
app.post('/api/campaigns', async (req, res) => {
    const { analysisResults, vendors } = req.body;
    if (!analysisResults?.length) {
        return res.status(400).json({ error: 'No analysis results provided.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const summary = analysisResults.map(r =>
        `${r.target}: ${r.opportunities.map(o => o.opportunity).join(', ')}`
    ).join('\n');

    const prompt = `Based on these HCLTech GSI opportunity findings, generate marketing campaign recommendations:

${summary}

Return a JSON object (no markdown) with exactly this schema:
{
  "groupCampaign": {
    "title": "Campaign name",
    "theme": "Unifying message",
    "targetAudience": "Persona description",
    "channels": ["Channel 1", "Channel 2"],
    "keyMessages": ["Message 1", "Message 2", "Message 3"],
    "callToAction": "Specific CTA",
    "assets": ["Asset type 1", "Asset type 2"]
  },
  "abmCampaigns": [
    {
      "target": "Org name",
      "headline": "Personalized message",
      "hook": "Specific pain point or signal",
      "offer": "What HCLTech proposes",
      "channel": "Outreach channel"
    }
  ]
}`;

    try {
        const keepalive = setInterval(() => res.write(': keepalive\n\n'), 15_000);
        let message;
        try {
            const stream = await anthropic.messages.stream({
                model: 'claude-opus-4-7',
                max_tokens: 3000,
                thinking: { type: 'adaptive' },
                system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
                messages: [{ role: 'user', content: prompt }],
            });
            message = await stream.finalMessage();
        } finally {
            clearInterval(keepalive);
        }
        const rawText = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const campaigns = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        sendEvent(res, 'campaigns', campaigns);
    } catch (err) {
        sendEvent(res, 'error', { message: err.message });
    }

    sendEvent(res, 'done', {});
    res.end();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        claude: !!process.env.ANTHROPIC_API_KEY,
        commonRoom: !!process.env.COMMON_ROOM_API_KEY,
    });
});

app.listen(PORT, () => {
    console.log(`GSI Opportunity Analyzer (Claude) running on http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('WARNING: ANTHROPIC_API_KEY not set — copy .env.example to .env');
    }
});
