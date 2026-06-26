const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Groq = require('groq-sdk');

dotenv.config();

// Database Connection
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/startupsim';
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB at', mongoUri))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Define Schema
const simulationSchema = new mongoose.Schema({
  idea: String,
  audience: String,
  budget: String,
  metrics: {
    cash: { type: Number, default: 150000 },
    staffHours: { type: Number, default: 100 },
    reputation: { type: Number, default: 50 },
    investorTrust: { type: Number, default: 50 }
  },
  history: [{
    stageName: String,
    stageObjective: String,
    decisionTitle: String,
    decisionDescription: String,
    narrative: String,
    impact: { cash: Number, staffHours: Number, reputation: Number, investorTrust: Number },
    stakeholderImpact: { riskTaker: Number, conservative: Number, trendFollower: Number, dataDriven: Number },
    insight: String,
    createdAt: { type: Date, default: Date.now }
  }],
  castState: {
    riskTaker: { type: Number, default: 50 },
    conservative: { type: Number, default: 50 },
    trendFollower: { type: Number, default: 50 },
    dataDriven: { type: Number, default: 50 }
  },
  createdAt: { type: Date, default: Date.now }
});
const Simulation = mongoose.model('Simulation', simulationSchema);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static project files directly from the current directory
app.use(express.static(path.join(__dirname)));

const generatedComicsDir = path.join(__dirname, 'generated', 'comics');
fs.mkdirSync(generatedComicsDir, { recursive: true });

async function generateAIContent(systemPrompt, userPrompt = null, forceJson = true) {
  let groqFailed = false;
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const messages = [{ role: "system", content: systemPrompt }];
      if (userPrompt) messages.push({ role: "user", content: userPrompt });
      const options = { messages, model: "llama-3.3-70b-versatile" };
      if (forceJson) options.response_format = { type: "json_object" };
      const chatCompletion = await groq.chat.completions.create(options);
      return chatCompletion.choices[0].message.content.trim();
    } catch (err) {
      console.warn("Groq API Failed, falling back to Pollinations AI. Error:", err.message);
      groqFailed = true;
    }
  }
  
  if (!process.env.GROQ_API_KEY || groqFailed) {
    console.log("Using Pollinations AI for text generation...");
    const messages = [{ role: "system", content: systemPrompt }];
    if (userPrompt) messages.push({ role: "user", content: userPrompt });
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: "openai", jsonMode: forceJson })
    });
    if (!res.ok) throw new Error(`Pollinations API failed: ${res.statusText}`);
    return await res.text();
  }
}


function buildFallbackJourney(idea = 'startup idea', audience = 'target users', budget = 'Unspecified') {
  const cleanedIdea = String(idea).trim() || 'startup idea';
  const cleanedAudience = String(audience).trim() || 'target users';
  const cleanedBudget = String(budget).trim() || 'Unspecified';

  return [
    {
      stage: 1,
      type: "normal",
      features: ["realtime"],
      title: `Stage 1: Problem Validation for ${cleanedIdea}`,
      objective: `Understand the core problem your ${cleanedIdea} solves for ${cleanedAudience} and validate its importance.`,
      tasks: [
        `Research and document the problem ${cleanedIdea} addresses.`,
        `Interview potential ${cleanedAudience} to confirm the problem exists.`
      ],
      locked: false
    },
    {
      stage: 2,
      type: "normal",
      features: ["roleplay"],
      title: `Stage 2: Market Analysis`,
      objective: `Analyze the market opportunity for ${cleanedIdea} targeting ${cleanedAudience}.`,
      tasks: [
        'Identify competitors and market size.',
        `Assess ${cleanedAudience} needs and willingness to pay.`
      ],
      locked: true
    },
    {
      stage: 3,
      type: "normal",
      features: ["artifact"],
      title: `Stage 3: Solution Design`,
      objective: `Design a viable solution for ${cleanedIdea} that meets ${cleanedAudience} requirements.`,
      tasks: [
        'Create wireframes or prototypes.',
        `Test initial concepts with ${cleanedAudience}.`
      ],
      locked: true
    },
    {
      stage: 4,
      type: "normal",
      features: ["negotiation"],
      title: `Stage 4: MVP Development`,
      objective: `Build a minimum viable product for ${cleanedIdea} within ${cleanedBudget}.`,
      tasks: [
        'Develop core features.',
        'Ensure the MVP solves the key problem.'
      ],
      locked: true
    },
    {
      stage: 5,
      type: "critical",
      features: ["decision"],
      title: `Stage 5: Testing & Iteration`,
      objective: `Test ${cleanedIdea} with ${cleanedAudience} and iterate based on feedback.`,
      tasks: [
        'Run user tests.',
        'Refine the product based on results.'
      ],
      locked: true
    },
    {
      stage: 6,
      type: "critical",
      features: ["decision"],
      title: `Stage 6: Launch Preparation`,
      objective: `Prepare to launch ${cleanedIdea} to ${cleanedAudience}.`,
      tasks: [
        'Develop a go-to-market strategy.',
        `Plan marketing within ${cleanedBudget}.`
      ],
      locked: true
    },
    {
      stage: 7,
      type: "final",
      features: ["decision"],
      title: `Stage 7: Growth & Scaling`,
      objective: `Grow ${cleanedIdea} beyond initial ${cleanedAudience}.`,
      tasks: [
        'Analyze launch metrics.',
        'Plan for scaling the business.'
      ],
      locked: true
    }
  ];
}

function randomizeStageIdeas(stages = [], idea = 'startup idea', audience = 'target users') {
  if (!Array.isArray(stages) || stages.length === 0) return stages;

  const coreIdea = String(idea).trim() || 'startup idea';
  const coreAudience = String(audience).trim() || 'target users';
  const genericIdeaPool = [
    `AI note-taking coach for ${coreAudience}`,
    `community marketplace for ${coreAudience}`,
    `micro-SaaS analytics tool for ${coreAudience}`,
    `peer mentorship network for ${coreAudience}`,
    `B2B workflow automation product`,
    `local services booking platform`,
    `creator monetization toolkit`,
    `wellness habit companion app`,
    `career upskilling platform`,
    `sustainability tracking assistant`
  ];

  const availableIdeas = genericIdeaPool.filter(item => item.toLowerCase() !== coreIdea.toLowerCase());
  const totalStages = stages.length;
  const coreIdeaStageIndex = Math.floor(Math.random() * totalStages);
  const pickedIdeas = [];

  for (let i = 0; i < totalStages; i += 1) {
    if (i === coreIdeaStageIndex) {
      pickedIdeas.push(coreIdea);
      continue;
    }
    if (availableIdeas.length === 0) {
      pickedIdeas.push(coreIdea);
      continue;
    }
    const randomIndex = Math.floor(Math.random() * availableIdeas.length);
    pickedIdeas.push(availableIdeas.splice(randomIndex, 1)[0]);
  }

  return stages.map((stage, index) => {
    const stageIdea = pickedIdeas[index] || coreIdea;
    const safeStage = stage || {};
    const existingTasks = Array.isArray(safeStage.tasks) ? safeStage.tasks : [];
    const remixedTasks = [
      `Apply this stage to: ${stageIdea}.`,
      ...existingTasks.slice(0, 2)
    ].slice(0, 3);

    return {
      ...safeStage,
      title: String(safeStage.title || `Stage ${index + 1}`).replace(/Stage\s*\d+\s*:\s*/i, `Stage ${index + 1}: `),
      objective: `${safeStage.objective || 'Advance this stage with clear strategic intent.'} Focus idea: ${stageIdea}.`,
      tasks: remixedTasks,
      stageIdea
    };
  });
}

// Crisis Scenarios Data
const crisisScenarios = [
  {
    id: "funding_dry_up",
    title: "Funding Crisis",
    description: "Your lead investor suddenly pulls out due to personal financial issues. You have 2 weeks to find alternative funding or face shutdown.",
    options: [
      {
        title: "Pivot to Bootstrapping",
        description: "Cut costs aggressively and focus on revenue generation.",
        impact: { budget: -20, trust: -10, users: 5 }
      },
      {
        title: "Emergency Fundraising",
        description: "Reach out to angel investors and pitch urgently.",
        impact: { budget: 30, trust: -5, users: 0 }
      },
      {
        title: "Strategic Partnership",
        description: "Seek a partnership with a larger company for quick capital.",
        impact: { budget: 15, trust: 5, users: 10 }
      }
    ]
  },
  {
    id: "key_employee_quits",
    title: "Key Talent Loss",
    description: "Your CTO announces they're leaving to join a competitor. This threatens your technical roadmap and team morale.",
    options: [
      {
        title: "Counteroffer Aggressively",
        description: "Offer significant salary increase and equity to retain them.",
        impact: { budget: -25, trust: 10, users: 0 }
      },
      {
        title: "Rapid Replacement",
        description: "Hire a replacement quickly and redistribute responsibilities.",
        impact: { budget: -10, trust: -5, users: -10 }
      },
      {
        title: "Promote from Within",
        description: "Identify and train an internal candidate for the role.",
        impact: { budget: 0, trust: 15, users: -5 }
      }
    ]
  },
  {
    id: "product_bug_crisis",
    title: "Major Product Failure",
    description: "A critical bug in your product goes live, causing data loss for customers and negative press.",
    options: [
      {
        title: "Full Transparency",
        description: "Publicly acknowledge the issue and provide compensation.",
        impact: { budget: -15, trust: 10, users: -5 }
      },
      {
        title: "Silent Fix",
        description: "Fix quietly and hope customers don't notice.",
        impact: { budget: 0, trust: -20, users: -10 }
      },
      {
        title: "Blame External Factors",
        description: "Attribute the issue to third-party services.",
        impact: { budget: 5, trust: -15, users: 0 }
      }
    ]
  },
  {
    id: "market_shift",
    title: "Market Disruption",
    description: "A major competitor launches a similar product at half your price, causing immediate market share loss.",
    options: [
      {
        title: "Price Match",
        description: "Reduce prices to compete directly.",
        impact: { budget: -30, trust: 5, users: 10 }
      },
      {
        title: "Differentiation Focus",
        description: "Emphasize unique features and target niche market.",
        impact: { budget: -5, trust: 0, users: 15 }
      },
      {
        title: "Acquisition Talks",
        description: "Explore being acquired by a larger player.",
        impact: { budget: 20, trust: -10, users: 5 }
      }
    ]
  },
  {
    id: "regulatory_hurdle",
    title: "Regulatory Challenge",
    description: "New regulations are introduced that could make your business model illegal or heavily restricted.",
    options: [
      {
        title: "Legal Challenge",
        description: "Hire lawyers to fight the regulations in court.",
        impact: { budget: -40, trust: 5, users: 0 }
      },
      {
        title: "Compliance Pivot",
        description: "Modify your product to comply with new rules.",
        impact: { budget: -20, trust: 0, users: -15 }
      },
      {
        title: "Lobbying Effort",
        description: "Work with industry groups to influence policy.",
        impact: { budget: -10, trust: 10, users: 5 }
      }
    ]
  },
  {
    id: "supply_chain_breakdown",
    title: "Supply Chain Crisis",
    description: "Your key supplier goes bankrupt, leaving you without essential components for your product.",
    options: [
      {
        title: "Emergency Procurement",
        description: "Find alternative suppliers at premium prices.",
        impact: { budget: -25, trust: -5, users: -10 }
      },
      {
        title: "Inventory Diversification",
        description: "Build relationships with multiple suppliers proactively.",
        impact: { budget: -15, trust: 5, users: 10 }
      },
      {
        title: "Product Redesign",
        description: "Redesign product to use different, more available components.",
        impact: { budget: -30, trust: 0, users: 20 }
      }
    ]
  }
];

// Real-World Opportunities Data (Targeted at Stage 4)
const opportunitiesData = [
  {
    id: "startup_india_seed",
    title: "Startup India Seed Fund",
    type: "Grant",
    description: "Government-backed funding to support early-stage startups with prototype development and market entry.",
    benefit: "Up to ₹20L funding",
    requirement: "Strong pitch + MVP",
    cta: "Apply For Grant",
    taskType: "QUICK_QUESTIONS", // Mini-task format
    questions: [
      "What is the core problem your product solves?",
      "How exactly will you utilize the ₹20L grant?"
    ]
  },
  {
    id: "ycombinator_interview",
    title: "Top-Tier Accelerator Pitch",
    type: "Investor",
    description: "A 60-second immediate pitch opportunity with a partner from a leading accelerator program.",
    benefit: "$500k Investment & Network",
    requirement: "Fast growth + Clarity",
    cta: "Pitch Now",
    taskType: "MICRO_PITCH" // Pitch input box
  },
  {
    id: "tech_bank_loan",
    title: "Venture Debt Loan",
    type: "Loan",
    description: "Quick capital injection without giving up equity, but requires strict repayment terms.",
    benefit: "₹50L Liquid Cash",
    requirement: "Revenue/Traction Proof",
    cta: "Request Loan",
    taskType: "DECISION_CHOICE",
    options: [
      "Secured Loan: Offer collateral for lower interest rate.",
      "Unsecured Growth Debt: Higher interest, fast capital.",
      "Revenue-Based Financing: Repay a % of future monthly revenue."
    ]
  }
];

// Endpoint to fetch real-world opportunities based on stage
app.get('/api/get-opportunities', (req, res) => {
  const { stage } = req.query;
  const currentStage = Number(stage) || 1;
  
  // Feature constraint: Only show opportunities on Stage 4
  if (currentStage === 4) {
    // Randomize and pick 1-2 opportunities
    const shuffled = opportunitiesData.sort(() => 0.5 - Math.random());
    const count = Math.floor(Math.random() * 2) + 1; // 1 or 2 cards
    return res.json(shuffled.slice(0, count));
  }
  
  res.json([]);
});

// Endpoint to resolve a real-world opportunity using Groq AI
app.post('/api/resolve-opportunity', async (req, res) => {
  try {
    const { sessionId, opportunityId, userInput, currentMetrics, currentCastState } = req.body;
    const opp = opportunitiesData.find(o => o.id === opportunityId);
    
    if (!opp) {
      return res.status(400).json({ error: "Opportunity not found." });
    }

    const safeMetrics = currentMetrics || { cash: 150000, reputation: 50, investorTrust: 50, staffHours: 100 };
    const safeCast = currentCastState || { riskTaker: 50, conservative: 50, trendFollower: 50, dataDriven: 50 };

    let finalOutcomeData = {
      result: "Conditional Approval",
      impact: { cash: 10000, reputation: 5, investorTrust: 0, staffHours: 0 },
      stakeholderImpact: { riskTaker: 2, conservative: 6, trendFollower: 0, dataDriven: 0 },
      explanation: "Your application showed promise but lacked aggressive growth targets. They approved partial funding."
    };

    const systemPrompt = `You are an expert evaluator for a Real-World Startup Opportunity: "${opp.title}" (Type: ${opp.type}).
The benefit they are trying to get: "${opp.benefit}".
The requirement is: "${opp.requirement}".

The founder submitted this input for their application/pitch (${opp.taskType}):
"${userInput}"

Evaluate the logic, clarity, and realism of their input. 
Produce EXACTLY a JSON object matching this schema:
{
  "result": "[Must be exactly one of: 'Accepted', 'Rejected', 'Conditional Approval']",
  "impact": {
    "cash": [Integer: Big boost if grant/loan/investor Accepted, 0 if rejected, minor if conditional. E.g. +20000, +50000],
    "reputation": [Integer: Change to market reputation. E.g. +10, -5],
    "investorTrust": [Integer: Change to investor trust. E.g. +10, -5],
    "staffHours": [Integer: usually 0 for funding, unless it directly costs time]
  },
  "stakeholderImpact": {
    "riskTaker": [Integer: e.g., +5 if bold plan, -5 if reckless],
    "conservative": [Integer: e.g., +15 if safe plan, -10 if risky],
    "trendFollower": [Integer: varies],
    "dataDriven": [Integer: varies]
  },
  "explanation": "[A sharp, context-aware 2-3 sentence explanation of WHY they got this result, specifically referencing their input.]"
}

RULES:
- Be strict but fair. If the input is generic, vague, or empty, REJECT it immediately with harsh stakeholder penalties (e.g. Investor -15, Trust -10) and no budget increase.
- If it's a solid, reasonable answer but lacks extreme ambition or detail, give CONDITIONAL APPROVAL (e.g. half the budget, slight investor boost).
- If it's excellent, ACCEPT it fully (e.g. full budget boost, high investor trust +15).`;
    try {
      const text = await generateAIContent(systemPrompt, null, true);
      finalOutcomeData = JSON.parse(text);
    } catch (e) {
      console.error("Opportunity parse/API error:", e);
    }

    // Save to DB if session exists
    if (sessionId) {
      const sim = await Simulation.findById(sessionId);
      if (sim) {
        sim.history.push({
          stageName: "Opportunity: " + opp.title,
          stageObjective: opp.description,
          decisionTitle: "Opportunity Applied",
          decisionDescription: `User applied with input: ${userInput}`,
          narrative: `Result: ${finalOutcomeData.result}. ${finalOutcomeData.explanation}`,
          impact: finalOutcomeData.impact,
          stakeholderImpact: finalOutcomeData.stakeholderImpact,
          insight: finalOutcomeData.result === "Accepted" ? "Strong applications drive real growth." : "Capital must be earned, not just asked for."
        });

        sim.metrics.cash = Math.max(0, sim.metrics.cash + (finalOutcomeData.impact.cash || 0));
        sim.metrics.staffHours = Math.max(0, sim.metrics.staffHours + (finalOutcomeData.impact.staffHours || 0));
        sim.metrics.reputation = Math.max(0, Math.min(100, sim.metrics.reputation + (finalOutcomeData.impact.reputation || 0)));
        sim.metrics.investorTrust = Math.max(0, Math.min(100, sim.metrics.investorTrust + (finalOutcomeData.impact.investorTrust || 0)));
        
        sim.castState = {
          riskTaker: Math.max(0, Math.min(100, safeCast.riskTaker + (finalOutcomeData.stakeholderImpact?.riskTaker || 0))),
          conservative: Math.max(0, Math.min(100, safeCast.conservative + (finalOutcomeData.stakeholderImpact?.conservative || 0))),
          trendFollower: Math.max(0, Math.min(100, safeCast.trendFollower + (finalOutcomeData.stakeholderImpact?.trendFollower || 0))),
          dataDriven: Math.max(0, Math.min(100, safeCast.dataDriven + (finalOutcomeData.stakeholderImpact?.dataDriven || 0)))
        };
        
        await sim.save();
      }
    }

    res.json(finalOutcomeData);
  } catch (err) {
    console.error("Opportunity Resolve Error:", err);
    res.status(500).json({ error: "Opportunity resolution failed." });
  }
});


app.get('/api/get-crisis', (req, res) => {
  const randomCrisis = crisisScenarios[Math.floor(Math.random() * crisisScenarios.length)];
  res.json(randomCrisis);
});

// Endpoint to resolve a crisis and update metrics
app.post('/api/resolve-crisis', async (req, res) => {
  try {
    const { sessionId, crisisId, optionIndex } = req.body;
    const crisis = crisisScenarios.find(c => c.id === crisisId);
    if (!crisis || !crisis.options[optionIndex]) {
      return res.status(400).json({ error: "Invalid crisis or option." });
    }

    const selectedOption = crisis.options[optionIndex];
    const impact = selectedOption.impact;

    // Save to DB if session exists
    if (sessionId) {
      const sim = await Simulation.findById(sessionId);
      if (sim) {
        sim.history.push({
          stageName: "Crisis: " + crisis.title,
          stageObjective: crisis.description,
          decisionTitle: selectedOption.title,
          decisionDescription: selectedOption.description,
          narrative: `You chose to ${selectedOption.title.toLowerCase()}. ${crisis.description}`,
          impact: impact,
          insight: "Crises test true leadership and adaptability."
        });

        sim.metrics.budget = Math.max(0, sim.metrics.budget + impact.budget);
        sim.metrics.trust = Math.max(0, Math.min(100, sim.metrics.trust + impact.trust));
        sim.metrics.users = Math.max(0, Math.min(100, sim.metrics.users + impact.users));
        
        await sim.save();
      }
    }

    res.json({
      title: selectedOption.title,
      narrative: `You chose to ${selectedOption.title.toLowerCase()}. The crisis unfolds with these consequences.`,
      impact: impact,
      insight: "Crises test true leadership and adaptability."
    });

  } catch (error) {
    console.error("Crisis Resolution Error:", error);
    return res.status(500).json({ error: "Internal Server Error during crisis resolution." });
  }
});

// Endpoint to generate customized startup journey
app.post('/api/generate-journey', async (req, res) => {
  try {
    const { idea, audience, budget } = req.body;
    const fallbackJourney = randomizeStageIdeas(buildFallbackJourney(idea, audience, budget), idea, audience);
    
    const systemPrompt = `You are an expert startup advisor simulator. 
The user is building a startup.
Your goal is to generate a custom 7-stage roadmap tailored distinctly to their specific idea.
You MUST return ONLY a raw JSON object with a "stages" key containing the array. Do not wrap in markdown formatting blocks. 

Format exactly like this:
{
  "stages": [
    {
      "stage": 1,
      "type": "normal",
      "features": ["budgeting"],
      "title": "Stage 1: [Specific Title based on Idea]",
      "objective": "[Short specific objective sentence]",
      "tasks": ["[Specific task 1]", "[Specific task 2]"],
      "locked": false
    },
    ...
  ]
}
Note: Stage 1 must have locked: false. Stages 2-7 must have locked: true. Make the titles, objectives, and tasks extremely tailored to their exact idea, audience, and budget, so it doesn't sound generic.
CRITICAL STAGE RULES:
- "type" should be "normal" for stages 1-4, "critical" for 5-6, and "final" exactly for stage 7.
- "features" must be an array. Distribute exactly ONE of these string values randomly across the stages: "budgeting", "menu_builder", "market_quiz", "debate", "strategy".
- Make sure at least one stage has "budgeting" and one has "debate".`;
    const userPrompt = `${systemPrompt}\n\nUSER IDEA: ${idea}\nTARGET AUDIENCE: ${audience}\nBUDGET: ${budget || 'Unspecified'}`;
    console.log("Generating AI journey for idea:", idea);
    let text;
    try {
      text = await generateAIContent(systemPrompt, userPrompt, true);
    } catch (apiError) {
      console.warn("API Error, using fallback journey.", apiError);
      return res.json(fallbackJourney);
    }
    
    let data;
    try {
      data = JSON.parse(text);
      // Extract the stages array
      if (data.stages && Array.isArray(data.stages)) {
        data = data.stages;
      } else if (Array.isArray(data)) {
        // Fallback if it returns array directly
        // But according to prompt, it should be object
      } else {
        throw new Error("AI returned JSON, but missing 'stages' array.");
      }
    } catch (parseError) {
      console.error("Failed to parse JSON response from Groq:", text);
      return res.status(500).json({ error: "AI generated invalid data format." });
    }

    const remixedJourney = randomizeStageIdeas(data, idea, audience);
    res.json(remixedJourney);

  } catch (error) {
    console.error("AI Generation Error:", error);
    if (error?.status === 429) {
      console.warn(`Groq quota hit. Using fallback journey.`);
      return res.json(
        randomizeStageIdeas(
          buildFallbackJourney(req.body?.idea, req.body?.audience, req.body?.budget),
          req.body?.idea,
          req.body?.audience
        )
      );
    }
    return res.json(
      randomizeStageIdeas(
        buildFallbackJourney(req.body?.idea, req.body?.audience, req.body?.budget),
        req.body?.idea,
        req.body?.audience
      )
    );
  }
});

// Endpoint to start a new simulation tracking session
app.post('/api/simulation/start', async (req, res) => {
  try {
    const { idea, audience, budget } = req.body;
    const newSim = new Simulation({ idea, audience, budget });
    await newSim.save();
    res.json({ sessionId: newSim._id });
  } catch (error) {
    console.error("Start Sim Error:", error);
    res.status(500).json({ error: "Failed to start simulation session" });
  }
});

// Endpoint to generate single stage decision outcomes and save to DB
app.post('/api/generate-outcome', async (req, res) => {
  try {
    const { sessionId, idea, stageName, stageObjective, decisionTitle, decisionDescription, currentMetrics, currentCastState } = req.body;
    
    // Provide a valid fallback castState
    const safeCast = currentCastState || { riskTaker: 50, conservative: 50, trendFollower: 50, dataDriven: 50 };

    let finalOutcomeData = {
        title: "Calculated Move",
        narrative: "You executed the plan, but resources were drained faster than anticipated.",
        impact: { cash: -5000, staffHours: -10, reputation: 5, investorTrust: 2 },
        stakeholderImpact: { riskTaker: 5, conservative: -5, trendFollower: 2, dataDriven: 0 },
        reactions: [
          "Risk-Taker: Finally, some bold action!",
          "Conservative: This burn rate is concerning.",
          "Trend-Follower: People are noticing this.",
          "Data-Driven: Let's see the ROI on this sprint."
        ],
        insight: "Every move costs resources. Watch your burn rate."
    };

    const systemPrompt = `You are an expert game master for a dynamic startup simulator.
The user runs a startup: "${idea || 'Tech Startup'}".
They are in the stage: "${stageName || 'Unknown Stage'}".

They just made a crucial decision to progress.
Decision Title: ${decisionTitle}
Decision Strategy: ${decisionDescription}

Current Status Constraints:
Cash: $${currentMetrics?.cash || 150000}
Staff Hours: ${currentMetrics?.staffHours || 100} hrs
Reputation: ${currentMetrics?.reputation || 50}/100
Investor Trust: ${currentMetrics?.investorTrust || 50}/100

Current Investor Archetype Approval Levels (0-100):
Risk-Taker: ${safeCast.riskTaker}
Conservative: ${safeCast.conservative}
Trend-Follower: ${safeCast.trendFollower}
Data-Driven: ${safeCast.dataDriven}

Generate the immediate consequence of their action in this specific stage.
Return a RAW JSON object matching exactly this schema:
{
  "title": "[A punchy 2-4 word title of the outcome]",
  "narrative": "[A fast-paced, highly engaging 1-2 sentence explanation of the immediate outcome. Expose BOTH positive consequences and resource drains/trade-offs.]",
  "impact": {
    "cash": [Integer representing change to Cash. Negative for spending. E.g. -15000, +5000],
    "staffHours": [Integer representing change to Staff Hours. Negative for effort spent. E.g. -20, -50],
    "reputation": [Integer representing change to Reputation. E.g. -10, +15],
    "investorTrust": [Integer representing change to Global Investor Trust. E.g. -5, +10]
  },
  "stakeholderImpact": {
    "riskTaker": [Integer],
    "conservative": [Integer],
    "trendFollower": [Integer],
    "dataDriven": [Integer]
  },
  "taskFeedback": {
    "strengths": "[If Decision Title is 'Founder Task Submitted', highlight strengths here.]",
    "missing": "[Identify missing elements here.]",
    "suggestions": "[Suggest concrete improvements here.]"
  },
  "boardroomFeedback": {
    "scores": {
      "clarity": [Integer 0-10],
      "justification": [Integer 0-10],
      "riskAwareness": [Integer 0-10],
      "confidence": [Integer 0-10]
    },
    "strengths": "[A sharp analysis of what worked in their pitch]",
    "weaknesses": "[A sharp critique of their strategic gaps]"
  },
  "reactions": [
    "Risk-Taker: [1 short sentence reacting to the decision's boldness]",
    "Conservative: [1 short sentence reacting to the decision's risk/cost]",
    "Trend-Follower: [1 short sentence reacting to the decision's hype/reputation impact]",
    "Data-Driven: [1 short sentence reacting to the decision's logic/metrics]"
  ],
  "insight": "[A single, profound sentence giving a mentor's takeaway lesson on why this decision led to this outcome.]"
}

CRITICAL RULES:
- STAKEHOLDER IMPACT SCALE (MANDATORY): You MUST assign a specific numerical change for EACH archetype in "stakeholderImpact". 
  - Minor decisions: ±5
  - Medium decisions: ±10
  - Major decisions: ±15
- ACCURACY & FAIRNESS (CRITICAL): Your evaluation MUST be logically accurate. Reward well-thought-out strategies with positive trust/reputation but accurate cash/hours drain. Penalize careless strategies.
- BOARDROOM & TASK EVALUATION: If it is a Founder Task or Boardroom Pitch, evaluate the raw text heavily.
- CONSEQUENCE TRIGGERS: If any archetype drops below 40 approval, YOU MUST WARN OF FAILURE in their reaction.
- REALISTIC METRICS: Ground the narrative in hard business reality. Using staff costs hours, campaigns cost cash.
- TONE FOR REACTIONS: The 4 reactions MUST strictly reflect the 4 archetypes in order (EXACTLY 4 strings in the array).`;
    try {
      const text = await generateAIContent(systemPrompt, null, true);
      finalOutcomeData = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse JSON response from Outcome API:", parseError);
      return res.status(500).json({ error: "AI generated invalid data format." });
    }

    // Clamp new castState values correctly
    const newCastState = {
      riskTaker: Math.max(0, Math.min(100, Number(safeCast.riskTaker) + Number(finalOutcomeData.stakeholderImpact?.riskTaker || 0))),
      conservative: Math.max(0, Math.min(100, Number(safeCast.conservative) + Number(finalOutcomeData.stakeholderImpact?.conservative || 0))),
      trendFollower: Math.max(0, Math.min(100, Number(safeCast.trendFollower) + Number(finalOutcomeData.stakeholderImpact?.trendFollower || 0))),
      dataDriven: Math.max(0, Math.min(100, Number(safeCast.dataDriven) + Number(finalOutcomeData.stakeholderImpact?.dataDriven || 0))),
    };

    // Save history to DB if session exists
    if (sessionId) {
      const sim = await Simulation.findById(sessionId);
      if (sim) {
        sim.history.push({
          stageName,
          stageObjective,
          decisionTitle,
          decisionDescription,
          narrative: finalOutcomeData.narrative,
          impact: finalOutcomeData.impact,
          stakeholderImpact: finalOutcomeData.stakeholderImpact,
          insight: finalOutcomeData.insight
        });

        sim.metrics.cash = Math.max(0, sim.metrics.cash + (finalOutcomeData.impact.cash || 0));
        sim.metrics.staffHours = Math.max(0, sim.metrics.staffHours + (finalOutcomeData.impact.staffHours || 0));
        sim.metrics.reputation = Math.max(0, Math.min(100, sim.metrics.reputation + (finalOutcomeData.impact.reputation || 0)));
        sim.metrics.investorTrust = Math.max(0, Math.min(100, sim.metrics.investorTrust + (finalOutcomeData.impact.investorTrust || 0)));
        
        sim.castState = newCastState;
        await sim.save();
      }
    }

    // Attach updated castState for frontend
    finalOutcomeData.updatedCastState = newCastState;
    res.json(finalOutcomeData);

  } catch (error) {
    console.error("Outcome Generation Error:", error);
    return res.status(500).json({ error: "Internal Server Error during outcome generation." });
  }
});

// Endpoint to evaluate the entire startup history and generate a Dashboard post-mortem
app.post('/api/generate-dashboard', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "No session ID provided." });

    const sim = await Simulation.findById(sessionId);
    if (!sim) return res.status(404).json({ error: "Simulation not found in DB." });

    if (!process.env.GROQ_API_KEY) {
      return res.json({
        metrics: sim.metrics,
        history: sim.history,
        evaluation: {
          founderType: "Founding Team",
          finalScore: "N/A",
          letterHtml: "<h3>Missing API Key</h3><p>Could not generate the investor report.</p>",
          resources: {
            ngos: [],
            stakeholders: [],
            grants: [],
            communities: []
          }
        },
      });
    }

    const historyTimeline = sim.history.map(h => 
      `Stage: ${h.stageName}\nDecision: ${h.decisionTitle}\nOutcome: ${h.narrative}`
    ).join("\n\n");

    const prompt = `You are a Tier 1 Silicon Valley Venture Capitalist reviewing the culmination of a startup trajectory.
Startup Idea: "${sim.idea}"
Total Stages Played: ${sim.history.length}
Final Metrics - Cash: $${sim.metrics.cash}, Staff Hours: ${sim.metrics.staffHours}, Reputation: ${sim.metrics.reputation}/100, Investor Trust: ${sim.metrics.investorTrust}/100

FINAL INVESTOR ARCHETYPE APPROVAL (Out of 100):
Risk-Taker: ${sim.castState?.riskTaker || 50}
Conservative: ${sim.castState?.conservative || 50}
Trend-Follower: ${sim.castState?.trendFollower || 50}
Data-Driven: ${sim.castState?.dataDriven || 50}

Historical Timeline of their decisions:
${historyTimeline}

Write a formal, realistic "Investor Letter / Board Report" assessing their journey. 
Call out their critical strategic errors and their brilliant moments based on the timeline. 
Grade their overall execution.

CRITICAL IMPACT RULE: You MUST adjust the final assessment based on Final Investor Archetype Approval:
- High Approval (>80 in multiple): Praise their excellent relationship management. High chance of investment.
- If Conservative < 40 and Cash < 20000: Emphasize severe bankruptcy risk. Pass on the investment.
- If Trend-Follower < 40 and Reputation < 40: Emphasize product/retention failure. The market has rejected them.
- If Data-Driven < 40: Emphasize lack of clear metrics and poor ROI.
- If Risk-Taker < 40: Emphasize lack of ambition and safe, boring choices.

Respond EXACTLY with this JSON schema:
{
  "finalScore": "[A grade like A-, B+, C, D-]",
  "letterHtml": "[A 3-padagraph HTML string (do not include body tags, just h2, p, ul) formatted elegantly summarizing the journey. Use professional VC vocabulary. Highlight the 1 biggest strength and 1 biggest weakness. End with a decisive final verdict on whether you would invest your firm's money or pass.]",
  "founderType": "[A 2-3 word archetype, e.g. 'The Cautious Visionary', 'The Move-Fast Hacker']",
  "resources": {
    "ngos": [
      { "name": "[NGO or nonprofit name relevant to idea]", "whyRelevant": "[1 short sentence]", "action": "[specific next step for founder]", "website": "[https://...]", "contact": "[mailto:... or https://contact-page]" }
    ],
    "stakeholders": [
      { "name": "[Stakeholder group or org]", "role": "[why they matter]", "action": "[how to engage them]", "website": "[https://...]", "contact": "[mailto:... or https://contact-page]" }
    ],
    "grants": [
      { "name": "[Grant or funding program]", "fit": "[why it fits]", "nextStep": "[application next step]", "website": "[https://...]", "contact": "[mailto:... or https://contact-page]" }
    ],
    "communities": [
      { "name": "[Community/network/incubator]", "value": "[benefit]", "joinPath": "[how to join or reach out]", "website": "[https://...]", "contact": "[mailto:... or https://contact-page]" }
    ]
  }
}`
    let data;
    try {
      const text = await generateAIContent(prompt, null, true);
      data = JSON.parse(text);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "API generation failed." });
    }
    if (!data.resources || typeof data.resources !== "object") {
      data.resources = { ngos: [], stakeholders: [], grants: [], communities: [] };
    }

    res.json({
      metrics: sim.metrics,
      history: sim.history,
      evaluation: data
    });

  } catch (error) {
    console.error("Dashboard DB Error:", error);
    res.status(500).json({ error: "Failed to generate dashboard" });
  }
});

// Endpoint to generate full stage scenario (moments & choices)
app.post('/api/generate-scenario', async (req, res) => {
  try {
    const { sessionId, idea, stageName, stageObjective, pastHistory } = req.body;
    
    if (!process.env.GROQ_API_KEY) {
      return res.status(400).json({ error: "Missing GROQ_API_KEY" });
    }

    // Inject branching context based on history
    let historyContext = "";
    let historyToUse = pastHistory;

    if (sessionId && (!historyToUse || historyToUse.length === 0)) {
        const sim = await Simulation.findById(sessionId);
        if (sim && sim.history) {
            historyToUse = sim.history;
        }
    }

    if (historyToUse && historyToUse.length > 0) {
      const pastStr = historyToUse.map(h => `- Chose: "${h.decisionTitle}" -> Outcome: ${h.narrative}`).join("\n");
      historyContext = `\nPAST HISTORY (CRITICAL: You MUST branch the scenario to reflect these past choices):\n${pastStr}\n`;
    }

    const systemPrompt = `You are the narrative engine for a realistic startup simulator.
The user is building: "${idea || 'A scalable tech startup'}".
Current Stage: "${stageName || 'Early Stage'}".
Stage Objective: "${stageObjective || 'Find product market fit'}".${historyContext}

Generate the scenario dialogue and decisions for this exact stage. 
If past history is provided, explicitly reference the consequences of those past actions in the scenario dialogue and ensure the new choices logically branch from that state.
Return EXACTLY a JSON object matching this schema:
{
  "scene": { "promptSeed": "[A cinematic single-sentence visual prompt describing the tension of this moment related to the stage]" },
  "moments": [
    { "voice": "[Character Name/Title]", "role": "[Role like CTO, Investor, User]", "side": "left", "line": "[Their dialogue voicing a realistic concern or opportunity, reacting to past choices if any]" },
    { "voice": "You", "role": "Founder", "side": "right", "line": "[Your internal thought or response]" }
  ],
  "choices": [
    { "id": "A", "title": "[2-4 word action title]", "description": "[Strictly formatted: Benefit, but Drawback. Example: 'Fast to build, but limited scalability']", "consequenceHint": "[Additional context if necessary]" },
    { "id": "B", "title": "[...]", "description": "[...]", "consequenceHint": "[...]" }
  ]
}

CRITICAL RULES:
- The moments array should have 2 or 3 dramatic dialogue lines that set up the decision.
- DIALOGUE CONSTRAINTS: Write natural, engaging dialogue sentences (10-25 words each).
- The choices array MUST contain between 3 and 4 distinct, strategic choices.
- EVERY option MUST include BOTH a clear advantage and a clear drawback using THIS EXACT structure: '[Strong advantage], but [clear drawback]'.
- Options must feel like real founder-level strategic decisions (e.g., Speed vs Quality, Growth vs Control).
- If the current stage involves a DEBATE, the choices should represent 'Talking Points' (e.g. 'Highlight market research', 'Emphasize customer buzz') rather than standard actions.`;
    console.log("Generating scenario for:", stageName);
    const text = await generateAIContent(systemPrompt, null, true);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Parse error scenarios:", text);
      return res.status(500).json({ error: "Invalid AI JSON" });
    }

    res.json(data);
  } catch (error) {
    console.error("Scenario Generation Error:", error);
    res.status(500).json({ error: "Failed to generate scenario." });
  }
});

app.post('/api/generate-stage-comic', async (req, res) => {
  try {
    const { stage, title, objective, tasks = [], idea, audience, sceneSeed, moments = [] } = req.body || {};
    const fallbackImageUrl = '/startup_scenario_comic.png';

    const stageNumber = Number(stage) || 1;
    const safeTitle = String(title || `stage-${stageNumber}`).trim();
    const ideaHash = idea ? idea.substring(0, 15).toLowerCase().replace(/[^a-z0-9]+/g, '') : 'default';
    const titleSlug = safeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || `stage-${stageNumber}`;

    const dialogueSource = Array.isArray(moments)
      ? moments
          .slice(0, 3)
          .map(moment => `${moment?.voice || "Speaker"}|${moment?.side || "left"}|${moment?.line || ""}`)
          .join("||")
      : "";
    const promptFingerprint = `notextv2|${safeTitle}|${sceneSeed || ""}`;
    let checksum = 0;
    for (let i = 0; i < promptFingerprint.length; i += 1) {
      checksum = (checksum * 31 + promptFingerprint.charCodeAt(i)) >>> 0;
    }
    const promptHash = checksum.toString(16).slice(0, 8) || "00000000";

    const fileName = `stage-${stageNumber}-${titleSlug}-${ideaHash}-${promptHash}.jpg`;
    const outputPath = path.join(generatedComicsDir, fileName);

    if (fs.existsSync(outputPath)) {
      return res.json({
        imageUrl: `/generated/comics/${fileName}`,
        cached: true,
      });
    }

    const taskList = Array.isArray(tasks) && tasks.length
      ? tasks.map(task => `- ${task}`).join('\n')
      : '- Clarify the situation\n- Surface stakeholder tension';

    const dialogueLines = Array.isArray(moments) && moments.length
      ? moments.slice(0, 3).map((moment, index) => {
          const speaker = String(moment?.voice || `Speaker ${index + 1}`).trim();
          const role = String(moment?.role || "").trim();
          const side = moment?.side === "right" ? "RIGHT" : "LEFT";
          const lineWords = String(moment?.line || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
          const line = lineWords.length > 10 ? `${lineWords.slice(0, 10).join(" ")}...` : lineWords.join(" ");
          const label = role ? `${speaker} (${role})` : speaker;
          return `${index + 1}. ${label} [${side}] says: "${line}"`;
        }).join('\n')
      : `1. CFO [LEFT] says: "Runway is shrinking fast."
2. Co-founder [RIGHT] says: "We need traction now!"
3. Founder [LEFT] thinks: "What should we do next?"`;

    const imagePrompt = [
      'Use case: illustration-story',
      'Asset type: web startup simulation stage visual',
      `Primary request: Create a single, completely unified scene illustration (NO PANELS) for a startup simulation game - Stage: ${stageNumber}.`,
      `Scene/backdrop: A beautiful, modern, semi-realistic startup setting perfectly matching the stage title: "${safeTitle}". Minimalist and ultra-clean.`,
      `Story Context: The startup idea is "${idea || 'stealth startup'}" for "${audience || 'B2B/B2C'}".`,
      `Objective: "${objective || 'Make a high-stakes startup decision.'}"`,
      `Immediate scenario: ${sceneSeed || 'A difficult decision must be made.'}`,
      `Subject Focus:`,
      `- Emphasize human stakeholders (founders, team, investors, or customers).`,
      `- Characters should be engaged in meaningful interaction fitting the scenario context without speech bubbles.`,
      `- Maintain a clean, uncluttered central area to ensure UI overlays remain highly readable.`,
      `Text rendering rules (CRITICAL & ABSOLUTE):`,
      `- DO NOT include any text whatsoever. NO WORDS, NO LETTERS, NO NUMBERS, NO UI DASHBOARD SCREENS.`,
      `- Replace all posters, laptop screens, or documents with blank glowing surfaces or simple geometric shapes.`,
      `Art Style:`,
      `- Modern, minimal, premium semi-realistic digital illustration.`,
      `- Completely avoid clutter, noisy lighting, and messy backgrounds. Keep the composition simple.`
    ].join(' ');

    const replicateApiToken = process.env.REPLICATE_API_TOKEN;
    let imageBuffer = null;
    let replicateFailed = false;

    if (replicateApiToken) {
      try {
        console.log("Attempting Replicate API...");
        const Replicate = require("replicate");
        const replicate = new Replicate({ auth: replicateApiToken });
        
        const output = await replicate.run(
          "black-forest-labs/flux-schnell",
          {
            input: {
              prompt: imagePrompt,
              aspect_ratio: "1:1",
              output_format: "webp",
              output_quality: 80
            }
          }
        );
        
        if (output && output[0]) {
          const fetchRes = await fetch(output[0]);
          if (fetchRes.ok) {
            imageBuffer = await fetchRes.arrayBuffer();
          } else {
            throw new Error("Failed to fetch image from Replicate URL");
          }
        } else {
          throw new Error("Replicate returned no output");
        }
      } catch (err) {
        console.warn("Replicate API Failed, falling back to Pollinations AI. Error:", err.message);
        replicateFailed = true;
      }
    }

    if (!replicateApiToken || replicateFailed) {
      try {
        console.log("Using Pollinations AI for image generation...");
        const imageResponse = await fetch("https://image.pollinations.ai/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: imagePrompt,
            width: 1024,
            height: 1024,
            model: "flux",
            nologo: true,
            enhance: true
          }),
          signal: AbortSignal.timeout(15000)
        });
        if (!imageResponse.ok) {
          throw new Error(`Pollinations API failed: ${imageResponse.statusText}`);
        }
        imageBuffer = await imageResponse.arrayBuffer();
      } catch (err) {
        console.error("Pollinations API Error:", err);
        throw err;
      }
    }

    if (imageBuffer) {
      fs.writeFileSync(outputPath, Buffer.from(imageBuffer));
      console.log("Comic generated successfully:", fileName);
      return res.json({
        imageUrl: `/generated/comics/${fileName}`,
      });
    } else {
      throw new Error("Failed to generate image from any source.");
    }

  } catch (error) {
    console.error("Comic Generation API Error:", error);
    return res.status(500).json({ 
      error: "Failed to generate comic.", 
      imageUrl: '/startup_scenario_comic.png' 
    });
  }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
