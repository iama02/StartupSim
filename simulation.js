const fallbackSimulationData = {
    metrics: { cash: 150000, staffHours: 100, reputation: 50, investorTrust: 50 },
    scene: { promptSeed: "startup runway pressure..." },
    moments: [
        { voice: "System", role: "Simulation Offline", side: "left", line: "The AI Scenario Engine is unreachable. Make sure your GEMINI_API_KEY is configured in .env and the server is restarted." }
    ],
    choices: [
        { id: "A", title: "Proceed Anyway", description: "Move forward instantly to keep momentum, but risk playing without deep AI insights." },
        { id: "B", title: "Review Logs", description: "Secure a robust simulation backend, but delay your immediate gameplay gratification." }
    ]
};

let currentMetrics = { cash: 150000, staffHours: 100, reputation: 50, investorTrust: 50 };
let currentStageData = null;
let currentStageMeta = { stage: 1, total: 7, title: "Problem Discovery", objective: "Validate your core assumptions before building.", tasks: [] };
const fallbackComicImage = "startup_scenario_comic.png";
const METRICS_STORAGE_KEY = "simulationCurrentMetrics";
const CAST_STATE_KEY = "simulationCastState";
const DELAYED_EFFECTS_KEY = "simulationDelayedEffects";
let selectedDecision = null;
let outcomeInProgress = false;
let scenarioComplete = false;
let proceedGateArmed = false;
let crisisResolvedThisStage = false;
let tickerIntervalRef = null;
let boardroomTimerRef = null;
let currentLiveEvent = "Market is calm.";
const OUTCOME_TIMEOUT_MS = 8000;

const stageModeMap = {
    1: "realtime",
    2: "roleplay",
    3: "artifact",
    4: "negotiation",
    5: "boardroom",
    6: "delayed",
    7: "strategy"
};

function loadPersistedMetrics() {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(METRICS_STORAGE_KEY) || "{}");
        if (Number.isFinite(parsed.cash) && Number.isFinite(parsed.reputation) && Number.isFinite(parsed.impact)) {
            currentMetrics = {
                cash: parsed.cash,
                trust: parsed.reputation,
                users: parsed.investorTrust
            };
        }
    } catch (error) {
        // Ignore malformed storage and continue with defaults
    }
}

function persistMetrics() {
    sessionStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(currentMetrics));
}

function getCurrentStageMode() {
    return stageModeMap[currentStageMeta.stage] || "strategy";
}

function stopStageTimers() {
    if (tickerIntervalRef) {
        clearInterval(tickerIntervalRef);
        tickerIntervalRef = null;
    }
    if (boardroomTimerRef) {
        clearInterval(boardroomTimerRef);
        boardroomTimerRef = null;
    }
}

function setDecisionAndEnableEvaluate(decision) {
    selectedDecision = decision;
    const evaluateBtn = document.getElementById("evaluate-btn");
    if (evaluateBtn) evaluateBtn.disabled = false;
}

function normalizeImpact(raw = {}) {
    return {
        cash: Number.isFinite(Number(raw.cash)) ? Math.round(Number(raw.cash)) : 0,
        trust: Number.isFinite(Number(raw.trust)) ? Math.round(Number(raw.trust)) : 0,
        users: Number.isFinite(Number(raw.users)) ? Math.round(Number(raw.users)) : 0
    };
}

function getDecisionQualityPenalty(chosen = {}) {
    const mode = getCurrentStageMode();
    const title = String(chosen.title || "").toLowerCase();
    const description = String(chosen.description || "");
    const lowerDesc = description.toLowerCase();
    let score = 70;
    const reasons = [];

    if (mode === "artifact") {
        const payload = lowerDesc.replace("founder artifact:", "").trim();
        const words = payload.split(/\s+/).filter(Boolean);
        if (words.length < 18) {
            score -= 32;
            reasons.push("Artifact is too short to be actionable.");
        }
        if (!/(price|pricing|plan|kpi|metric|timeline|milestone|trendFollower|user|cash|risk)/i.test(payload)) {
            score -= 24;
            reasons.push("Artifact misses measurable business details.");
        }
        if (/(asdf|test|lorem|random|abc|wrong|idk|blah)/i.test(payload)) {
            score -= 28;
            reasons.push("Artifact includes placeholder or low-signal text.");
        }
    } else if (mode === "boardroom") {
        const words = lowerDesc.split(/\s+/).filter(Boolean).length;
        if (words < 15) {
            score -= 25;
            reasons.push("Pitch lacks enough substance.");
        }
        if (!/(because|therefore|data|trendFollower|cost|risk|timeline|revenue)/i.test(lowerDesc)) {
            score -= 18;
            reasons.push("Pitch lacks evidence-based reasoning.");
        }
    } else if (mode === "negotiation") {
        if (title.toLowerCase().includes("defensive")) {
            score -= 10;
            reasons.push("Offer is overly defensive.");
        }
        if (title.toLowerCase().includes("aggressive")) {
            score -= 6;
            reasons.push("Offer carries high execution risk.");
        }
    }

    if (/(proceed anyway|silent fix|blame)/i.test(`${title} ${lowerDesc}`)) {
        score -= 14;
        reasons.push("Decision signals avoidant leadership.");
    }

    return {
        score: Math.max(0, Math.min(100, score)),
        reasons
    };
}

function buildLocalOutcome(chosen = {}) {
    const quality = getDecisionQualityPenalty(chosen);
    const deltaFromNeutral = quality.score - 60;
    
    const fallbackImpact = {
        cash: Math.round(Math.max(-28, Math.min(18, deltaFromNeutral / 3))),
        trust: Math.round(Math.max(-18, Math.min(14, deltaFromNeutral / 4))),
        users: Math.round(Math.max(-16, Math.min(18, deltaFromNeutral / 3.2)))
    };

    if (quality.score < 40) {
        fallbackImpact.cash = Math.min(fallbackImpact.cash, -12);
        fallbackImpact.reputation = Math.min(fallbackImpact.reputation, -10);
        fallbackImpact.investorTrust = Math.min(fallbackImpact.investorTrust, -9);
    }
    
    const shImpact = Math.round(fallbackImpact.reputation / 2);
    const stakeholderImpact = {
        riskTaker: shImpact, conservative: shImpact, trendFollower: shImpact, dataDriven: 0
    };

    const isBad = quality.score < 45;
    const insight = isBad
        ? "Poor execution burns runway faster than it buys growth."
        : "Steady execution prevents catastrophic technical and financial debt.";
        
    const reactions = isBad
        ? [
            "We incurred heavy technical debt trying to deploy this so hastily.",
            "I'm increasingly worried about the burn rate generated by this maneuver.",
            "The product feels inconsistent. We need better quality control.",
            "Compliance parameters remain under standard review."
          ]
        : [
            "Solid execution. Systems architecture is holding steady.",
            "Capital deployment looks reasonable based on strategic projections.",
            "Our user experience remains stable following this rollout.",
            "No direct compliance red flags identified."
          ];

    return {
        title: isBad ? "Execution Strain" : "Strategic Progression",
        narrative: isBad
            ? "Your chosen approach struggled during implementation. Core business metrics suffered due to execution inefficiencies."
            : "The strategy was executed without major incident. Operations are scaling as projected.",
        impact: fallbackImpact,
        stakeholderImpact,
        reactions,
        insight,
        qualityScore: quality.score,
        qualityReasons: quality.reasons
    };
}

function applyOutcomeVisualState(data = {}) {
    const qualityScore = Number.isFinite(Number(data.qualityScore)) ? Number(data.qualityScore) : 65;
    const isRedAlert = qualityScore < 45 || (data.impact?.trust || 0) < -8;
    const container = document.querySelector("#outcome-dashboard .outcome-container");
    if (!container) return;
    container.classList.toggle("outcome-alert", isRedAlert);
}

function loadCastState() {
    const defaults = {
        riskTaker: 50,
        conservative: 50,
        trendFollower: 50,
        dataDriven: 50
    };
    try {
        const parsed = JSON.parse(sessionStorage.getItem(CAST_STATE_KEY) || "{}");
        if (parsed && typeof parsed === "object") {
            return {
                ...defaults,
                riskTaker: Number.isFinite(Number(parsed.riskTaker)) ? Math.max(0, Math.min(100, Number(parsed.riskTaker))) : defaults.riskTaker,
                conservative: Number.isFinite(Number(parsed.conservative)) ? Math.max(0, Math.min(100, Number(parsed.conservative))) : defaults.conservative,
                trendFollower: Number.isFinite(Number(parsed.trendFollower)) ? Math.max(0, Math.min(100, Number(parsed.trendFollower))) : defaults.trendFollower,
                dataDriven: Number.isFinite(Number(parsed.dataDriven)) ? Math.max(0, Math.min(100, Number(parsed.dataDriven))) : defaults.dataDriven
            };
        }
    } catch (error) {}
    return defaults;
}

function saveCastState(state) {
    sessionStorage.setItem(CAST_STATE_KEY, JSON.stringify(state));
}

function loadDelayedEffects() {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(DELAYED_EFFECTS_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveDelayedEffects(effects) {
    sessionStorage.setItem(DELAYED_EFFECTS_KEY, JSON.stringify(effects));
}

function applyDueDelayedEffects() {
    const effects = loadDelayedEffects();
    if (effects.length === 0) return;

    const due = effects.filter(item => Number(item.dueStage) === currentStageMeta.stage);
    const pending = effects.filter(item => Number(item.dueStage) !== currentStageMeta.stage);

    if (due.length === 0) return;

    due.forEach(item => {
        const impact = item.impact || {};
        currentMetrics.cash = Math.max(0, currentMetrics.cash + (impact.cash || 0));
        currentMetrics.reputation = Math.max(0, Math.min(100, currentMetrics.reputation + (impact.reputation || 0)));
        currentMetrics.impact = Math.max(0, Math.min(100, currentMetrics.impact + (impact.impact || 0)));
        alert(`Delayed consequence triggered: ${item.reason || "Earlier strategic tradeoff"}`);
    });

    saveDelayedEffects(pending);
    persistMetrics();
    updateMetricsUI();
}

document.addEventListener("DOMContentLoaded", () => {
    const currentStageObjStr = sessionStorage.getItem("currentStageData");
    const currentStageIndex = Number(sessionStorage.getItem("currentStageIndex"));
    const totalStages = Number(sessionStorage.getItem("totalStages"));

    if (Number.isFinite(currentStageIndex) && currentStageIndex >= 0) {
        currentStageMeta.stage = currentStageIndex + 1;
    }

    if (Number.isFinite(totalStages) && totalStages > 0) {
        currentStageMeta.total = totalStages;
    }

    if (currentStageObjStr) {
        try {
            const parsedStage = JSON.parse(currentStageObjStr);
            const stageFromIndex = Number.isFinite(currentStageIndex) && currentStageIndex >= 0
                ? currentStageIndex + 1
                : currentStageMeta.stage;
            currentStageMeta = {
                // Source of truth is currentStageIndex; AI payload stage can be noisy
                stage: stageFromIndex,
                total: currentStageMeta.total,
                title: parsedStage.title || currentStageMeta.title,
                objective: parsedStage.objective || currentStageMeta.objective,
                tasks: Array.isArray(parsedStage.tasks) ? parsedStage.tasks : []
            };
        } catch (error) {
            console.error("Error parsing stage data", error);
        }
    }

    loadPersistedMetrics();
    applyDueDelayedEffects();
    renderStageShell();
    updateMetricsUI();
    // Show Loading state
    document.getElementById("story-dialogues").innerHTML = `<div style="text-align: center; color: var(--sim-muted); padding: 2rem;"><i class="ph-bold ph-spinner ph-spin" style="font-size: 2.5rem; color: var(--sim-purple);"></i><p style="margin-top: 1rem;">Neural engine designing scenario...</p></div>`;
    document.getElementById("sim-decisions").innerHTML = ``;
    // Fetch scenario
    fetchScenario();

    const evaluateBtn = document.getElementById("evaluate-btn");
    if (evaluateBtn) {
        evaluateBtn.disabled = true;
        evaluateBtn.addEventListener("click", () => {
            if (selectedDecision) {
                generateOutcomeDashboard(selectedDecision);
            } else {
                alert("Select one decision option first.");
            }
        });
    }

    const proceedBtn = document.getElementById("btn-proceed");
    if (proceedBtn) {
        // Override inline onclick to enforce post-evaluation crisis gating
        proceedBtn.onclick = async () => {
            if (!scenarioComplete) return;
            if (!proceedGateArmed) {
                // No crisis gating needed; proceed immediately.
                completeScenario();
                return;
            }

            // If a crisis already happened and got resolved, proceed.
            if (crisisResolvedThisStage) {
                completeScenario();
                return;
            }

            proceedBtn.disabled = true;
            const crisisShown = await checkForCrisis();
            if (!crisisShown) {
                // No crisis this time -> continue.
                proceedGateArmed = false;
                proceedBtn.disabled = true;
                completeScenario();
            }
            // If crisis shown, resolveCrisis() will re-enable the button.
        };
    }
});

async function fetchScenario() {
    const idea = sessionStorage.getItem("startupIdea") || "";
    
    try {
        const sessionId = sessionStorage.getItem('simulationSessionId');
        const response = await fetch("/api/generate-scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId,
                idea,
                stageName: currentStageMeta.title,
                stageObjective: currentStageMeta.objective
            })
        });

        if (!response.ok) throw new Error("Scenario generation failed");

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        currentStageData = data;
        
        renderDialogueScene(currentStageData.moments);
        renderStageInteraction();
        
        // Trigger comic generation uniquely customized to this script
        requestStageComic();
        
        fetchOpportunities();
        
    } catch (err) {
        console.error("Scenario Fetch Error:", err);
        currentStageData = fallbackSimulationData;
        renderDialogueScene(currentStageData.moments);
        renderStageInteraction();
        requestStageComic();
        fetchOpportunities();
    }
}

function getStageLookupKey(title = "") {
    if (title.includes(":")) {
        return title.split(":")[1].trim();
    }
    return title.trim() || "Problem Discovery";
}

function renderStageShell() {
    document.getElementById("sim-stage-badge").textContent = `Phase ${currentStageMeta.stage}`;
    document.getElementById("sim-stage-progress").textContent = `Stage ${currentStageMeta.stage} of ${currentStageMeta.total}`;
    document.getElementById("sim-title").textContent = currentStageMeta.title;
    document.getElementById("sim-objective").textContent = createHeaderSummary(currentStageMeta.objective);
    const proceedBtn = document.getElementById("btn-proceed");
    if (proceedBtn) {
        if (currentStageMeta.stage >= currentStageMeta.total) {
            proceedBtn.innerHTML = `View Final Dashboard <i class="ph-bold ph-chart-bar"></i>`;
        } else {
            proceedBtn.innerHTML = `Proceed to Next Stage <i class="ph-bold ph-arrow-right"></i>`;
        }
    }
}

function createHeaderSummary(objective = "") {
    const cleaned = String(objective).replace(/\s+/g, " ").trim();
    if (!cleaned) {
        return "A story-driven scenario is unfolding. Read the room, weigh stakeholder pressure, and choose your next move.";
    }
    return cleaned;
}

function renderDialogueScene(moments = []) {
    const dialogueHost = document.getElementById("story-dialogues");
    if (!dialogueHost) return;

    const makeShortLine = (text = "") => {
        const words = String(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
        if (words.length <= 25) return words.join(" ");
        return `${words.slice(0, 25).join(" ")}...`;
    };

    dialogueHost.innerHTML = moments.slice(0, 3).map((moment, index) => `
        <div class="story-dialogue ${moment.side === "right" ? "right" : "left"} slot-${index + 1}">
            <div class="bubble">
                <span class="bubble-voice">${moment.voice || "Stakeholder"}${moment.role ? ` / ${moment.role}` : ""}</span>
                <p>${makeShortLine(moment.line || "")}</p>
            </div>
        </div>
    `).join("");
}

function renderChoices(choices = []) {
    const decisionsDiv = document.getElementById("sim-decisions");
    decisionsDiv.innerHTML = choices.map((choice, index) => `
        <button class="decision-card" onclick="selectDecision(${index}, this)">
            <span class="decision-letter">${choice.id || index + 1}</span>
            <h3>${choice.title || "Decision Option"}</h3>
            <p>${choice.description || ""}</p>
            ${choice.consequenceHint ? `<p class="consequence-hint" style="font-size:0.9rem; color:var(--text-muted); margin-top:0.5rem; border-top:1px solid rgba(0,0,0,0.05); padding-top:0.5rem;"><em>${choice.consequenceHint}</em></p>` : ""}
        </button>
    `).join("");
}

function renderStageInteraction() {
    stopStageTimers();
    selectedDecision = null;
    const evaluateBtn = document.getElementById("evaluate-btn");
    if (evaluateBtn) evaluateBtn.disabled = true;

    const choices = Array.isArray(currentStageData?.choices) ? currentStageData.choices : [];
    const host = document.getElementById("sim-decisions");
    if (!host) return;

    host.innerHTML = "";

    let features = currentStageMeta?.features ? [...currentStageMeta.features] : ["decision"];
    const stageType = currentStageMeta?.type || "normal";
    
    const stageStateKey = "boardroomTriggered_" + currentStageMeta.stage;
    const alreadyTriggered = sessionStorage.getItem(stageStateKey);
    const castState = loadCastState();

    if (stageType === "final" || (!alreadyTriggered && castState.conservative < 45)) {
        if (!features.includes("boardroom")) {
            features.push("boardroom");
        }
        sessionStorage.setItem(stageStateKey, "true");
    }

    features.forEach(mode => {
        const featureHost = document.createElement("div");
        featureHost.style.gridColumn = "1/-1";
        featureHost.style.marginBottom = "2rem";
        host.appendChild(featureHost);

        if (mode === "realtime" || mode === "decision") {
            featureHost.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr; gap: 1rem; width: 100%;">
                    ${choices.map((choice, index) => `
                        <button class="decision-card" onclick="selectDecision(${index}, this)">
                            <span class="decision-letter">${choice.id || index + 1}</span>
                            <h3>${choice.title || "Decision Option"}</h3>
                            <p>${choice.description || ""}</p>
                            ${choice.consequenceHint ? `<p class="consequence-hint" style="font-size:0.9rem; color:var(--text-muted); margin-top:0.5rem; border-top:1px solid rgba(0,0,0,0.05); padding-top:0.5rem;"><em>${choice.consequenceHint}</em></p>` : ""}
                        </button>
                    `).join("")}
                </div>
            `;
        }

        if (mode === "roleplay") {
            featureHost.innerHTML = `
                <div class="decision-card" style="margin-bottom:1rem;">
                    <h3>Stakeholder Trust System</h3>
                    <p>Pick your executive tone. How will you navigate stakeholder expectations?</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                    <button class="decision-card" id="cast-opt-align"><h3>Align & reassure stakeholders</h3><p>Safer path, prioritize relationship building.</p></button>
                    <button class="decision-card" id="cast-opt-push"><h3>Push speed over consensus</h3><p>Faster output, potential trust friction.</p></button>
                    <button class="decision-card" id="cast-opt-balance"><h3>Balanced compromise</h3><p>Steady progress with measured communication.</p></button>
                </div>
            `;
            const register = (id, title, description) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.onclick = () => {
                    document.querySelectorAll(".decision-card").forEach(card => card.classList.remove("selected"));
                    el.classList.add("selected");
                    setDecisionAndEnableEvaluate({ title, description });
                };
            };
            setTimeout(() => {
                register("cast-opt-align", "Stakeholder Alignment", "You prioritized trust and coalition building.");
                register("cast-opt-push", "Speed First", "You accelerated execution while straining relationships.");
                register("cast-opt-balance", "Balanced Coalition", "You negotiated tradeoffs to keep teams aligned.");
            }, 0);
        }

        if (mode === "artifact") {
            const stageContext = currentStageMeta?.objective || "Strategy execution";
            const templateText = `[Focus Area: ${currentStageMeta?.title || 'Execution'}]
Why this is critical right now:

Key Actions We Will Take:

Resources Required:

Expected Outcome:
`;
            featureHost.innerHTML = `
                <div class="decision-card">
                    <h3>Founder Task: Build Your Strategy</h3>
                    <p>Define a structured approach based on the current stage: <strong>${stageContext}</strong></p>
                    <textarea id="artifact-input" rows="8" style="width:100%;margin-top:0.8rem;padding:0.75rem;border-radius:10px;border:1px solid #cbd5e1" placeholder="Write your strategy here...">${templateText}</textarea>
                    <button id="artifact-submit" class="btn btn-outline" style="margin-top:0.8rem; width:100%;">Submit Strategy</button>
                    <p id="artifact-status" style="margin-top:0.6rem;font-weight:600;color:var(--text-muted);"></p>
                </div>
            `;
            setTimeout(() => {
                const submit = document.getElementById("artifact-submit");
                const status = document.getElementById("artifact-status");
                submit.onclick = () => {
                    const text = (document.getElementById("artifact-input")?.value || "").trim();
                    if (!text || text === templateText.trim()) return alert("Please complete the strategy structure before submitting.");
                    
                    const quality = getDecisionQualityPenalty({
                        title: "Founder Task Submitted",
                        description: `Founder artifact: ${text.slice(0, 300)}`
                    });
                    setDecisionAndEnableEvaluate({
                        title: "Founder Task Submitted",
                        description: `Founder artifact: ${text.slice(0, 300)}`
                    });
                    
                    if (status) {
                        status.textContent = quality.score < 45
                            ? "Strategy submitted. The reasoning appears weak—prepare for consequences."
                            : "Strategy locked in. Click Evaluate to run the outcome analysis.";
                        status.style.color = quality.score < 45 ? "var(--red)" : "var(--green)";
                    }
                };
            }, 0);
        }

        if (mode === "negotiation") {
            const stageContext = currentStageMeta?.objective || "a senior hire to join your startup";
            featureHost.innerHTML = `
                <div class="decision-card">
                    <h3>Negotiation Mini-Game</h3>
                    <p style="font-style:italic;color:var(--text-muted);margin-bottom:1.5rem;">Scenario: You are negotiating with ${stageContext}. Balance the terms carefully.</p>
                    
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:0.2rem;">
                        <label style="font-weight:700; color:var(--text-main);">Equity Offered: <span id="neg-equity-val">15</span>%</label>
                        <span style="font-size:0.75rem; color:var(--text-muted);">(Impacts ownership vs attractiveness)</span>
                    </div>
                    <input id="neg-equity" type="range" min="5" max="40" value="15" style="width:100%; margin-bottom:0.5rem;" />
                    <p id="hint-equity" style="font-size:0.85rem; color:var(--orange); margin-top:0; margin-bottom:1rem; height:1rem;">Moderate equity grant.</p>

                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:0.2rem;">
                        <label style="font-weight:700; color:var(--text-main);">Salary Commitment: ₹<span id="neg-salary-val">60</span>L</label>
                        <span style="font-size:0.75rem; color:var(--text-muted);">(Impacts burn rate vs success)</span>
                    </div>
                    <input id="neg-salary" type="range" min="20" max="150" value="60" style="width:100%; margin-bottom:0.5rem;" />
                    <p id="hint-salary" style="font-size:0.85rem; color:var(--orange); margin-top:0; margin-bottom:1rem; height:1rem;">Standard market salary.</p>

                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:0.2rem;">
                        <label style="font-weight:700; color:var(--text-main);">Runway Risk Appetite: <span id="neg-risk-val">40</span></label>
                        <span style="font-size:0.75rem; color:var(--text-muted);">(Impacts growth vs stability)</span>
                    </div>
                    <input id="neg-risk" type="range" min="0" max="100" value="40" style="width:100%; margin-bottom:0.5rem;" />
                    <p id="hint-risk" style="font-size:0.85rem; color:var(--orange); margin-top:0; margin-bottom:1.5rem; height:1rem;">Balanced risk approach.</p>

                    <div style="background:var(--bg-soft); padding:1rem; border-radius:var(--radius-md); text-align:center; margin-bottom:1rem; border:1px solid rgba(0,0,0,0.05);">
                        <h4 style="margin:0 0 0.5rem 0; font-size:0.9rem; text-transform:uppercase; color:var(--text-muted);">Deal Attractiveness</h4>
                        <div style="width:100%; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                            <div id="neg-attractiveness-bar" style="height:100%; width:50%; background:var(--primary); transition:width 0.3s, background 0.3s;"></div>
                        </div>
                        <strong id="neg-attractiveness-text" style="font-size:1.5rem; color:var(--primary); display:block; margin-top:0.4rem;">50%</strong>
                    </div>

                    <button id="neg-submit" class="btn btn-outline" style="width:100%;">Submit Offer</button>
                </div>
            `;

            setTimeout(() => {
                const eqSlider = document.getElementById("neg-equity");
                const salSlider = document.getElementById("neg-salary");
                const riskSlider = document.getElementById("neg-risk");
                const attrBar = document.getElementById("neg-attractiveness-bar");
                const attrText = document.getElementById("neg-attractiveness-text");
                
                let currentAttr = 50;
                const updateFeedback = () => {
                    const eq = Number(eqSlider.value);
                    const sal = Number(salSlider.value);
                    const risk = Number(riskSlider.value);

                    document.getElementById("neg-equity-val").textContent = eq;
                    document.getElementById("neg-salary-val").textContent = sal;
                    document.getElementById("neg-risk-val").textContent = risk;

                    const eqHint = document.getElementById("hint-equity");
                    if (eq < 10) eqHint.textContent = "Low equity may lead to swift rejection from top talent.";
                    else if (eq > 25) eqHint.textContent = "Warning: High equity aggressively reduces founder control.";
                    else eqHint.textContent = "Moderate equity grant.";
                    eqHint.style.color = (eq < 10 || eq > 25) ? "var(--red)" : "var(--green)";

                    const salHint = document.getElementById("hint-salary");
                    if (sal < 40) salHint.textContent = "Low salary heavily limits talent acquisition.";
                    else if (sal > 100) salHint.textContent = "Warning: Very high salary significantly accelerates burn rate.";
                    else salHint.textContent = "Standard market salary.";
                    salHint.style.color = (sal < 40 || sal > 100) ? "var(--red)" : "var(--green)";

                    const riskHint = document.getElementById("hint-risk");
                    if (risk < 30) riskHint.textContent = "Too conservative. Stifles aggressive growth objectives.";
                    else if (risk > 70) riskHint.textContent = "High risk is extremely chaotic and may spook stable hires.";
                    else riskHint.textContent = "Balanced approach to growth vs stability.";
                    riskHint.style.color = (risk < 30 || risk > 70) ? "var(--red)" : "var(--green)";

                    let eqScore = ((eq - 5) / 35) * 100;
                    let salScore = ((sal - 20) / 130) * 100;
                    let riskDev = Math.abs(risk - 50);
                    let riskScore = Math.max(0, 100 - (riskDev * 2));

                    currentAttr = Math.round((eqScore * 0.4) + (salScore * 0.4) + (riskScore * 0.2));
                    
                    attrText.textContent = `${currentAttr}%`;
                    attrBar.style.width = `${currentAttr}%`;
                    
                    if (currentAttr < 40) {
                        attrText.style.color = "var(--red)";
                        attrBar.style.background = "var(--red)";
                    } else if (currentAttr > 75) {
                        attrText.style.color = "var(--green)";
                        attrBar.style.background = "var(--green)";
                    } else {
                        attrText.style.color = "var(--primary)";
                        attrBar.style.background = "var(--primary)";
                    }
                };

                [eqSlider, salSlider, riskSlider].forEach(slider => slider.oninput = updateFeedback);
                updateFeedback();

                document.getElementById("neg-submit").onclick = () => {
                    const eq = Number(eqSlider.value);
                    const sal = Number(salSlider.value);
                    const risk = Number(riskSlider.value);
                    setDecisionAndEnableEvaluate({
                        title: "Negotiation Package Submitted",
                        description: `Offer strictly constructed with ${eq}% equity, ${sal}k salary, and risk set to ${risk}. Computed Deal Attractiveness is ${currentAttr}%. Counterparty response heavily dependent on this probabilistic attractiveness.`
                    });
                };
            }, 0);
        }

        if (mode === "boardroom") {
            const stageContext = currentStageMeta?.objective || "scaling strategy";
            const templateText = `Your Decision: \n\nJustification (market + business reasoning): \n\nRisks & Mitigation: \n\nFinal Defense: \n`;
            featureHost.innerHTML = `
                <div class="decision-card" style="border-color:var(--red); background:rgba(255, 0, 0, 0.02);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <h3 style="color:var(--red);margin:0;display:flex;align-items:center;gap:0.5rem;"><i class="ph-bold ph-warning"></i> Hostile Board Meeting</h3>
                        <div style="background:var(--red);color:white;padding:0.3rem 0.8rem;border-radius:20px;font-weight:800;font-size:0.9rem;">
                            <span id="boardroom-timer">60</span>s
                        </div>
                    </div>
                    <p style="font-weight:600;margin-top:0.8rem;color:var(--red);">Investors are heavily scrutinizing your approach. You must defend your strategy.</p>
                    
                    <div style="display:flex;gap:1.5rem;margin:1rem 0;background:#fff;padding:0.8rem;border-radius:var(--radius-md);border:1px solid #e2e8f0;">
                        <div style="flex:1;"><span style="display:block;font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Evaluation Criteria</span>
                            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.4rem;">
                                <span style="font-size:0.75rem;background:rgba(139,92,246,0.1);color:var(--primary);padding:0.2rem 0.6rem;border-radius:4px;font-weight:600;">Clarity</span>
                                <span style="font-size:0.75rem;background:rgba(14,165,233,0.1);color:var(--secondary);padding:0.2rem 0.6rem;border-radius:4px;font-weight:600;">Justification</span>
                                <span style="font-size:0.75rem;background:rgba(245,158,11,0.1);color:var(--orange);padding:0.2rem 0.6rem;border-radius:4px;font-weight:600;">Risk Awareness</span>
                                <span style="font-size:0.75rem;background:rgba(16,185,129,0.1);color:var(--green);padding:0.2rem 0.6rem;border-radius:4px;font-weight:600;">Confidence</span>
                            </div>
                        </div>
                    </div>

                    <textarea id="boardroom-pitch" rows="8" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid #cbd5e1" placeholder="Defend your position...">${templateText}</textarea>
                    <button id="boardroom-submit" class="btn" style="width:100%;margin-top:0.8rem;background:var(--red);color:white;border:none;">Submit Defense Pitch (Final)</button>
                </div>
            `;

            setTimeout(() => {
                let timeLeft = 60;
                boardroomTimerRef = setInterval(() => {
                    timeLeft -= 1;
                    const timer = document.getElementById("boardroom-timer");
                    if (timer) timer.textContent = String(timeLeft);
                    if (timeLeft <= 0) {
                        clearInterval(boardroomTimerRef);
                        boardroomTimerRef = null;
                        document.getElementById("boardroom-submit")?.click();
                    }
                }, 1000);
                
                document.getElementById("boardroom-submit").onclick = () => {
                    if (boardroomTimerRef) {
                        clearInterval(boardroomTimerRef);
                        boardroomTimerRef = null;
                    }
                    const pitch = (document.getElementById("boardroom-pitch")?.value || "").trim();
                    document.getElementById("boardroom-submit").disabled = true;
                    document.getElementById("boardroom-submit").textContent = "Pitch Locked";
                    
                    setDecisionAndEnableEvaluate({
                        title: "Boardroom Defense Pitch Submitted",
                        description: `Complete submitted defense pitch: ${pitch.slice(0, 400)}. Evaluate this stringently.`
                    });
                };
            }, 0);
        }

        if (mode === "budgeting") {
            featureHost.innerHTML = `
                <div class="decision-card" style="border-left: 4px solid var(--primary);">
                    <h3>Budgeting Puzzle</h3>
                    <p>Allocate a fixed 100% pool across Marketing, Tech, and Operations. Total allocation must equal exactly 100%.</p>
                    <div style="margin-top:1.5rem;">
                        <label style="font-weight:600; font-size:0.9rem;">Marketing: <span id="bud-mkt-val">33</span>%</label>
                        <input id="bud-mkt" type="range" min="0" max="100" value="33" style="width:100%;margin-bottom:1.5rem;"/>
                        
                        <label style="font-weight:600; font-size:0.9rem;">Tech & Product: <span id="bud-tech-val">34</span>%</label>
                        <input id="bud-tech" type="range" min="0" max="100" value="34" style="width:100%;margin-bottom:1.5rem;"/>
                        
                        <label style="font-weight:600; font-size:0.9rem;">Operations: <span id="bud-ops-val">33</span>%</label>
                        <input id="bud-ops" type="range" min="0" max="100" value="33" style="width:100%;margin-bottom:1.5rem;"/>
                        
                        <div id="bud-error" style="color:var(--red);font-weight:600;font-size:0.9rem;height:1.2rem;margin-bottom:0.5rem;"></div>
                        <button id="bud-submit" class="btn btn-outline" style="width:100%; margin-top:1rem;">Submit Budget Allocation</button>
                    </div>
                </div>
            `;
            setTimeout(() => {
                const mkt = document.getElementById("bud-mkt");
                const tech = document.getElementById("bud-tech");
                const ops = document.getElementById("bud-ops");
                const err = document.getElementById("bud-error");
                const update = () => {
                    document.getElementById("bud-mkt-val").textContent = mkt.value;
                    document.getElementById("bud-tech-val").textContent = tech.value;
                    document.getElementById("bud-ops-val").textContent = ops.value;
                    const total = Number(mkt.value) + Number(tech.value) + Number(ops.value);
                    if (total !== 100) {
                        err.textContent = `Total allocation is ${total}%. It must be exactly 100%.`;
                        document.getElementById("bud-submit").disabled = true;
                    } else {
                        err.textContent = "";
                        document.getElementById("bud-submit").disabled = false;
                    }
                };
                mkt.oninput = update; tech.oninput = update; ops.oninput = update;
                document.getElementById("bud-submit").onclick = () => {
                    setDecisionAndEnableEvaluate({
                        title: "Budget Allocation Submitted",
                        description: `Allocated budget: ${mkt.value}% Marketing, ${tech.value}% Tech, ${ops.value}% Ops.`
                    });
                    document.querySelectorAll(".decision-card").forEach(c => c.classList.remove("selected"));
                    document.getElementById("bud-submit").textContent = "Budget Locked";
                };
                update();
            }, 0);
        }

        if (mode === "menu_builder") {
            featureHost.innerHTML = `
                <div class="decision-card" style="border-left: 4px solid var(--purple);">
                    <h3>MVP Feature Builder</h3>
                    <p>Select exactly 3 core features to launch. More complex features burn more staff hours but yield higher appeal.</p>
                    <div id="menu-options" style="display:grid; gap:1rem; margin-top:1.5rem;">
                        <label style="padding:1rem; background:rgba(0,0,0,0.02); border-radius:8px; border:1px solid rgba(0,0,0,0.05); cursor:pointer;">
                            <input type="checkbox" value="Basic Profiles" data-cost="10" style="margin-right:10px;"> <strong>Basic Profiles</strong> (Cost: 10 hrs)
                        </label>
                        <label style="padding:1rem; background:rgba(0,0,0,0.02); border-radius:8px; border:1px solid rgba(0,0,0,0.05); cursor:pointer;">
                            <input type="checkbox" value="AI Recommendations" data-cost="40" style="margin-right:10px;"> <strong>AI Recommendations</strong> (Cost: 40 hrs)
                        </label>
                        <label style="padding:1rem; background:rgba(0,0,0,0.02); border-radius:8px; border:1px solid rgba(0,0,0,0.05); cursor:pointer;">
                            <input type="checkbox" value="Real-time Chat" data-cost="30" style="margin-right:10px;"> <strong>Real-time Chat</strong> (Cost: 30 hrs)
                        </label>
                        <label style="padding:1rem; background:rgba(0,0,0,0.02); border-radius:8px; border:1px solid rgba(0,0,0,0.05); cursor:pointer;">
                            <input type="checkbox" value="Payment Gateway" data-cost="25" style="margin-right:10px;"> <strong>Payment Gateway</strong> (Cost: 25 hrs)
                        </label>
                        <label style="padding:1rem; background:rgba(0,0,0,0.02); border-radius:8px; border:1px solid rgba(0,0,0,0.05); cursor:pointer;">
                            <input type="checkbox" value="Admin Dashboard" data-cost="20" style="margin-right:10px;"> <strong>Admin Dashboard</strong> (Cost: 20 hrs)
                        </label>
                    </div>
                    <div id="menu-error" style="color:var(--red);font-weight:600;font-size:0.9rem;height:1.2rem;margin-top:1rem;"></div>
                    <button id="menu-submit" class="btn btn-outline" style="width:100%;margin-top:1rem;">Launch MVP</button>
                </div>
            `;
            setTimeout(() => {
                const checks = Array.from(document.querySelectorAll("#menu-options input"));
                const submit = document.getElementById("menu-submit");
                const err = document.getElementById("menu-error");
                const update = () => {
                    const selected = checks.filter(c => c.checked);
                    if (selected.length !== 3) {
                        err.textContent = `Select exactly 3 features. You have selected ${selected.length}.`;
                        submit.disabled = true;
                    } else {
                        err.textContent = "";
                        submit.disabled = false;
                    }
                };
                checks.forEach(c => c.onchange = update);
                submit.onclick = () => {
                    const selected = checks.filter(c => c.checked).map(c => c.value);
                    setDecisionAndEnableEvaluate({
                        title: "MVP Features Selected",
                        description: `MVP features: ${selected.join(', ')}.`
                    });
                    submit.textContent = "MVP Locked";
                    submit.disabled = true;
                };
                update();
            }, 0);
        }

        if (mode === "market_quiz") {
            featureHost.innerHTML = `
                <div class="decision-card" style="border-left: 4px solid var(--orange);">
                    <h3>Market Reality Check</h3>
                    <p>Quick: You have a sudden PR crisis. What's the most reliable communication strategy?</p>
                    <div style="display:grid;grid-template-columns:1fr;gap:1rem;margin-top:1.5rem;">
                        <button class="decision-card" id="quiz-opt-1" style="text-align:left;"><h3>Deny everything</h3><p>Preserve brand image initially.</p></button>
                        <button class="decision-card" id="quiz-opt-2" style="text-align:left;"><h3>Full Transparency</h3><p>Admit the mistake and outline steps.</p></button>
                        <button class="decision-card" id="quiz-opt-3" style="text-align:left;"><h3>Ignore it</h3><p>Wait for the news cycle to pass.</p></button>
                    </div>
                </div>
            `;
            setTimeout(() => {
                const register = (id, title, description) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.onclick = () => {
                        document.querySelectorAll("#quiz-opt-1, #quiz-opt-2, #quiz-opt-3").forEach(c => c.classList.remove("selected"));
                        el.classList.add("selected");
                        setDecisionAndEnableEvaluate({ title, description });
                    };
                };
                register("quiz-opt-1", "Deny everything", "You chose to deny the PR crisis.");
                register("quiz-opt-2", "Full Transparency", "You chose to be fully transparent.");
                register("quiz-opt-3", "Ignore it", "You chose to ignore the crisis.");
            }, 0);
        }

        if (mode === "debate") {
            featureHost.innerHTML = `
                <div class="decision-card" style="border-left: 4px solid var(--red);">
                    <h3>Co-founder Debate</h3>
                    <p>Your co-founder insists on pivoting to Enterprise B2B, but you want to stay B2C. Draft your talking points to persuade them.</p>
                    <textarea id="debate-input" rows="5" style="width:100%;margin-top:1rem;padding:0.75rem;border-radius:10px;border:1px solid #cbd5e1" placeholder="Write your persuasion points here..."></textarea>
                    <button id="debate-submit" class="btn btn-outline" style="margin-top:1rem; width:100%;">Submit Argument</button>
                </div>
            `;
            setTimeout(() => {
                document.getElementById("debate-submit").onclick = () => {
                    const text = (document.getElementById("debate-input")?.value || "").trim();
                    if (!text) return alert("Write an argument.");
                    setDecisionAndEnableEvaluate({
                        title: "Debate Argument Submitted",
                        description: `Persuasion argument against Enterprise B2B pivot: ${text.slice(0, 300)}`
                    });
                    document.getElementById("debate-submit").textContent = "Argument Locked";
                    document.getElementById("debate-submit").disabled = true;
                };
            }, 0);
        }

        if (mode === "delayed") {
            featureHost.innerHTML = `
                <div class="decision-card">
                    <h3>Long-Term Tradeoff Lab</h3>
                    <p>Pick a move. It gives short-term gain but delayed cost in later stages.</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1rem;">
                    <button class="decision-card" id="delay-techdebt"><h3>Ship Fast (Technical Debt)</h3><p>Now: +users, Later: -trust/-users</p></button>
                    <button class="decision-card" id="delay-marketing"><h3>Heavy PR Push</h3><p>Now: +trust, Later: -cash</p></button>
                    <button class="decision-card" id="delay-hiring"><h3>Aggressive Hiring</h3><p>Now: +users, Later: -cash/-trust</p></button>
                </div>
            `;
            setTimeout(() => {
                const addDelayed = (id, title, description, delayedImpact, reason) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.onclick = () => {
                        const effects = loadDelayedEffects();
                        effects.push({
                            dueStage: Math.min(currentStageMeta.total, currentStageMeta.stage + 1),
                            impact: delayedImpact,
                            reason
                        });
                        saveDelayedEffects(effects);
                        document.querySelectorAll(".decision-card").forEach(card => card.classList.remove("selected"));
                        el.classList.add("selected");
                        setDecisionAndEnableEvaluate({ title, description });
                    };
                };
                addDelayed("delay-techdebt", "Technical Debt Tradeoff", "You shipped quickly and accepted future maintenance strain.", { cash: -8, trust: -6, users: -5 }, "Technical debt caught up.");
                addDelayed("delay-marketing", "PR Wave Tradeoff", "You boosted visibility now with deferred CAC burden.", { cash: -12, trust: -3, users: 0 }, "Paid growth became expensive.");
                addDelayed("delay-hiring", "Scaling Team Tradeoff", "You expanded rapidly with future coordination cost.", { cash: -10, trust: -5, users: -3 }, "Org complexity slowed execution.");
            }, 0);
        }
    });
}

async function requestStageComic() {
    const media = document.getElementById("comic-scene-media");
    const image = document.getElementById("comic-scene-image");
    if (!media || !image) return;

    media.classList.remove("ready", "error");
    media.classList.add("loading");

    try {
        const idea = sessionStorage.getItem("startupIdea") || "";
        const audience = sessionStorage.getItem("startupAudience") || "";
        const response = await fetch("/api/generate-stage-comic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                stage: currentStageMeta.stage,
                title: currentStageMeta.title,
                objective: currentStageMeta.objective,
                tasks: currentStageMeta.tasks,
                idea,
                audience,
                sceneSeed: currentStageData.scene?.promptSeed || "",
                moments: Array.isArray(currentStageData?.moments) ? currentStageData.moments.slice(0, 3) : []
            })
        });

        if (!response.ok) {
            throw new Error("Stage comic generation failed");
        }

        const data = await response.json();
        if (!data.imageUrl) {
            throw new Error("Missing generated image URL");
        }

        image.src = `${data.imageUrl}?t=${Date.now()}`;
        image.onload = () => {
            media.classList.remove("loading", "error", "fallback");
            media.classList.add("ready");
        };
        image.onerror = () => {
            showFallbackComic(media, image);
        };
    } catch (error) {
        console.error(error);
        showFallbackComic(media, image);
    }
}

function showFallbackComic(media, image) {
    image.onload = () => {
        media.classList.remove("loading", "error");
        media.classList.add("ready", "fallback");
    };

    image.onerror = () => {
        media.classList.remove("loading", "ready");
        media.classList.add("error");
    };

    image.src = `${fallbackComicImage}?t=${Date.now()}`;
}

async function selectDecision(index, button) {
    if (scenarioComplete) return;
    const allCards = document.querySelectorAll(".decision-card");
    const storyStage = document.getElementById("story-stage");
    allCards.forEach(card => {
        card.classList.remove("selected");
    });
    button.classList.add("selected");

    const chosen = currentStageData.choices[index];
    if (!chosen) return;
    const mode = getCurrentStageMode();
    selectedDecision = {
        ...chosen,
        description: chosen.description
    };

    const evaluateBtn = document.getElementById("evaluate-btn");
    if (evaluateBtn) {
        evaluateBtn.disabled = false;
    }

    if (storyStage) {
        storyStage.animate(
            [
                { transform: "translateY(0)", opacity: 1 },
                { transform: "translateY(-4px)", opacity: 0.94 },
                { transform: "translateY(0)", opacity: 1 }
            ],
            { duration: 380, easing: "ease-out" }
        );
    }

}

async function generateOutcomeDashboard(chosen) {
    if (outcomeInProgress || scenarioComplete) return;
    outcomeInProgress = true;
    stopStageTimers();

    const evaluateBtn = document.getElementById("evaluate-btn");
    if (evaluateBtn) {
        evaluateBtn.disabled = true;
    }

    const dashboard = document.getElementById("outcome-dashboard");
    dashboard.classList.remove("hidden");
    
    // Simulate loading state animation
    const idea = sessionStorage.getItem("startupIdea") || "";
    
    try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), OUTCOME_TIMEOUT_MS);
        const response = await fetch("/api/generate-outcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                sessionId: sessionStorage.getItem('simulationSessionId'),
                idea,
                stageName: currentStageMeta.title,
                stageObjective: currentStageMeta.objective,
                decisionTitle: chosen.title,
                decisionDescription: chosen.description,
                currentMetrics,
                currentCastState: loadCastState()
            })
        });
        window.clearTimeout(timeoutId);

        if (!response.ok) throw new Error("Outcome failed");

        const remoteData = await response.json();
        const baseData = {
            ...buildLocalOutcome(chosen),
            ...remoteData,
            impact: normalizeImpact(remoteData?.impact || {})
        };
        const quality = getDecisionQualityPenalty(chosen);
        const penalty = quality.score < 45
            ? {
                cash: -Math.max(8, Math.round((45 - quality.score) / 2)),
                trust: -Math.max(10, Math.round((45 - quality.score) / 1.8)),
                impact: -Math.max(8, Math.round((45 - quality.score) / 2.2))
            }
            : { cash: 0, trust: 0, impact: 0 };
        const data = {
            ...baseData,
            qualityScore: quality.score,
            qualityReasons: quality.reasons,
            impact: {
                cash: baseData.impact.cash + penalty.cash,
                trust: baseData.impact.reputation + penalty.reputation,
                users: baseData.impact.investorTrust + penalty.investorTrust
            }
        };
        if (quality.score < 45) {
            data.title = "Execution Red Flag";
            data.insight = "The input quality was weak. Scores were reduced and marked as high-risk.";
        }
        
        // Render Dashboard Data
        const titleEl = document.getElementById("outcome-title");
        titleEl.textContent = data.title || "Turn Complete";
        titleEl.setAttribute("data-text", data.title || "Turn Complete");
        titleEl.classList.add("glitch-active");

        applyOutcomeVisualState(data);
        // Fill 3 concise bullet points
        const bullets = [
            "outcome-bullet-1",
            "outcome-bullet-2",
            "outcome-bullet-3"
        ];
        
        // Handle Task Feedback
        const feedbackContainer = document.getElementById("task-feedback-container");
        if (data.taskFeedback && data.taskFeedback.strengths) {
            feedbackContainer.classList.remove("hidden");
            document.getElementById("task-feedback-strengths").textContent = data.taskFeedback.strengths;
            document.getElementById("task-feedback-missing").textContent = data.taskFeedback.missing || "None identified.";
            document.getElementById("task-feedback-suggestions").textContent = data.taskFeedback.suggestions || "Keep executing.";
        } else if (feedbackContainer) {
            feedbackContainer.classList.add("hidden");
        }

        // Handle Boardroom Feedback
        const brContainer = document.getElementById("boardroom-feedback-container");
        if (data.boardroomFeedback && data.boardroomFeedback.scores) {
            brContainer.classList.remove("hidden");
            const scores = data.boardroomFeedback.scores;
            document.getElementById("br-score-clarity").textContent = scores.clarity;
            document.getElementById("br-score-justification").textContent = scores.justification;
            document.getElementById("br-score-riskAwareness").textContent = scores.riskAwareness;
            document.getElementById("br-score-confidence").textContent = scores.confidence;
            document.getElementById("br-feedback-strengths").textContent = data.boardroomFeedback.strengths || "Strong response.";
            document.getElementById("br-feedback-weaknesses").textContent = data.boardroomFeedback.weaknesses || "None identified.";
        } else if (brContainer) {
            brContainer.classList.add("hidden");
        }

        // Handle Stakeholder Reactions & Trust Updates
        const currentCast = loadCastState();
        const updatedCast = data.updatedCastState || currentCast;
        const impactCast = data.stakeholderImpact || {};
        saveCastState(updatedCast);

        const applyStakeholderUI = (key, previousVal, newVal, impactVal, reactionStr) => {
            const valEl = document.getElementById(`trust-val-${key}`);
            const statusEl = document.getElementById(`trust-status-${key}`);
            const barEl = document.getElementById(`trust-bar-${key}`);
            const reactionEl = document.getElementById(`reaction-${key}`);

            if (!valEl || !statusEl || !barEl || !reactionEl) return;
            
            // Text updating with arrow
            let arrow = impactVal > 0 ? "↑" : impactVal < 0 ? "↓" : "-";
            let color = impactVal > 0 ? "var(--green)" : impactVal < 0 ? "var(--red)" : "var(--text-muted)";
            let sign = impactVal > 0 ? "+" : "";

            valEl.innerHTML = `<span style="font-size:1.1rem; color:var(--text-muted); font-weight:600;">${previousVal} <i class="ph-bold ph-arrow-right"></i></span>
                               <span style="font-size:1.8rem; font-weight:800; color:var(--text-main); margin:0 0.5rem;">${newVal}</span>
                               <span style="font-size:1.15rem; font-weight:800; color:${color}; margin-left:0.3rem;">${arrow} (${sign}${impactVal})</span>`;
            
            // Bar updating
            barEl.style.width = `${newVal}%`;
            
            // Status Tag updating
            statusEl.className = "trust-status-label"; // reset
            if (newVal >= 80) { statusEl.textContent = "High Trust"; statusEl.classList.add("status-high"); }
            else if (newVal >= 60) { statusEl.textContent = "Stable"; statusEl.classList.add("status-stable"); }
            else if (newVal >= 40) { statusEl.textContent = "Uncertain"; statusEl.classList.add("status-uncertain"); }
            else { statusEl.textContent = "Critical"; statusEl.classList.add("status-critical"); }
            
            // Reaction updating
            reactionEl.textContent = reactionStr || "Waiting for report...";
        };

        if (data.reactions && Array.isArray(data.reactions) && data.reactions.length >= 4) {
            applyStakeholderUI("riskTaker", currentCast.riskTaker, updatedCast.riskTaker, impactCast.riskTaker || 0, data.reactions[0]?.replace(/^CTO:\s*/i, ''));
            applyStakeholderUI("conservative", currentCast.conservative, updatedCast.conservative, impactCast.conservative || 0, data.reactions[1]?.replace(/^Investor:\s*/i, ''));
            applyStakeholderUI("trendFollower", currentCast.trendFollower, updatedCast.trendFollower, impactCast.trendFollower || 0, data.reactions[2]?.replace(/^Customer:\s*/i, ''));
            applyStakeholderUI("dataDriven", currentCast.dataDriven, updatedCast.dataDriven, impactCast.dataDriven || 0, data.reactions[3]?.replace(/^Regulator:\s*/i, ''));
        } else {
            // Fallback if AI fails to return 4 valid elements
            applyStakeholderUI("riskTaker", currentCast.riskTaker, updatedCast.riskTaker, impactCast.riskTaker || 0, "We survived the change, but technical debt is creeping up behind us.");
            applyStakeholderUI("conservative", currentCast.conservative, updatedCast.conservative, impactCast.conservative || 0, "I'm glad we moved forward, but the ROI on this isn't obvious yet.");
            applyStakeholderUI("trendFollower", currentCast.trendFollower, updatedCast.trendFollower, impactCast.trendFollower || 0, "It works alright, but it feels like it’s missing some polish.");
            applyStakeholderUI("dataDriven", currentCast.dataDriven, updatedCast.dataDriven, impactCast.dataDriven || 0, "Keeping a close eye on compliance.");
        }

        let points = [];
        if (data.narrative && data.narrative.includes(". ")) {
            // Split narrative into sentences, use first 3
            points = data.narrative.split(/\.( |$)/).map(s => s.trim()).filter(Boolean).slice(0, 3);
        }
        if (points.length < 3) {
            // Fallback: use insight and some generic points
            points = [
                points[0] || data.insight || "Key result achieved.",
                "Budget: " + (data.impact?.cash > 0 ? "+" : "") + (data.impact?.cash || 0) + "k, Trust: " + (data.impact?.trust > 0 ? "+" : "") + (data.impact?.trust || 0),
                "Users: " + (data.impact?.users > 0 ? "+" : "") + (data.impact?.users || 0) + "k"
            ];
        }
        if ((data.qualityScore || 100) < 45) {
            points = [
                "Low-quality decision input detected.",
                ...(data.qualityReasons || []).slice(0, 2)
            ];
            while (points.length < 3) points.push("Metrics were adjusted with a risk penalty.");
        }
        bullets.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.textContent = points[i] || "";
        });

        document.getElementById("outcome-insight").textContent = data.insight || "Every action has consequences.";

        // Render animated impact metrics
        animateMetric("outcome-stat-cash", data.impact?.cash || 0, "", true);
        animateMetric("outcome-stat-staffHours", data.impact?.staffHours || 0, "", false);
        animateMetric("outcome-stat-reputation", data.impact?.reputation || 0, "", false);
        animateMetric("outcome-stat-investorTrust", data.impact?.investorTrust || 0, "", false);

        currentMetrics.cash += data.impact?.cash || 0;
        currentMetrics.staffHours += data.impact?.staffHours || 0;
        currentMetrics.reputation = Math.max(0, Math.min(100, currentMetrics.reputation + (data.impact?.reputation || 0)));
        currentMetrics.investorTrust = Math.max(0, Math.min(100, currentMetrics.investorTrust + (data.impact?.investorTrust || 0)));
        persistMetrics();
        updateMetricsUI(data.impact || {});

        // Arm proceed gate; crisis should happen only after user clicks Proceed.
        scenarioComplete = true;
        proceedGateArmed = true;
        crisisResolvedThisStage = false;
        const proceedBtn = document.getElementById("btn-proceed");
        if (proceedBtn) proceedBtn.disabled = false;
        
    } catch (err) {
        console.error("Outcome AI Error", err);
        const fallback = buildLocalOutcome(chosen);
        applyOutcomeVisualState(fallback);
        document.getElementById("outcome-title").textContent = fallback.title;
        document.getElementById("outcome-insight").textContent = fallback.insight;
        animateMetric("outcome-stat-cash", fallback.impact.cash || 0, "", true);
        animateMetric("outcome-stat-staffHours", fallback.impact.staffHours || 0, "", false);
        animateMetric("outcome-stat-reputation", fallback.impact.reputation || 0, "", false);
        animateMetric("outcome-stat-investorTrust", fallback.impact.investorTrust || 0, "", false);
        currentMetrics.cash = Math.max(0, currentMetrics.cash + (fallback.impact.cash || 0));
        currentMetrics.staffHours = Math.max(0, currentMetrics.staffHours + (fallback.impact.staffHours || 0));
        currentMetrics.reputation = Math.max(0, Math.min(100, currentMetrics.reputation + (fallback.impact.reputation || 0)));
        currentMetrics.investorTrust = Math.max(0, Math.min(100, currentMetrics.investorTrust + (fallback.impact.investorTrust || 0)));
        persistMetrics();
        updateMetricsUI(fallback.impact);
        
        let points = [];
        if (fallback.narrative) points = fallback.narrative.split(/\\.( |$)/).map(s => s.trim()).filter(Boolean);
        document.getElementById("outcome-bullet-1").textContent = points[0] || "Metrics were aggressively modified by reality.";
        document.getElementById("outcome-bullet-2").textContent = fallback.qualityReasons?.[0] || points[1] || "The strategy forced compromises.";
        document.getElementById("outcome-bullet-3").textContent = fallback.qualityReasons?.[1] || "Operations adjusted accordingly.";
        
        // Inline fallback Stakeholder updating
        const shMap = { 0: "riskTaker", 1: "conservative", 2: "trendFollower", 3: "dataDriven" };
        const currentCast = loadCastState();
        for (let i = 0; i < 4; i++) {
            const key = shMap[i];
            const pVal = currentCast[key];
            const tImpact = fallback.stakeholderImpact[key] || 0;
            const nVal = Math.max(0, Math.min(100, pVal + tImpact));
            currentCast[key] = nVal;
            
            const vEl = document.getElementById(`trust-val-${key}`);
            const sEl = document.getElementById(`trust-status-${key}`);
            const bEl = document.getElementById(`trust-bar-${key}`);
            const rEl = document.getElementById(`reaction-${key}`);
            if(vEl && sEl && bEl && rEl) {
                let arrow = tImpact > 0 ? "↑" : tImpact < 0 ? "↓" : "-";
                let color = tImpact > 0 ? "var(--green)" : tImpact < 0 ? "var(--red)" : "var(--text-muted)";
                let sign = tImpact > 0 ? "+" : "";
                
                vEl.innerHTML = `<span style="font-size:1.1rem; color:var(--text-muted); font-weight:600;">${pVal} <i class="ph-bold ph-arrow-right"></i></span>
                                 <span style="font-size:1.8rem; font-weight:800; color:var(--text-main); margin:0 0.5rem;">${nVal}</span>
                                 <span style="font-size:1.15rem; font-weight:800; color:${color}; margin-left:0.3rem;">${arrow} (${sign}${tImpact})</span>`;
                bEl.style.width = `${nVal}%`;
                sEl.className = "trust-status-label";
                if (nVal >= 80) { sEl.textContent = "High Trust"; sEl.classList.add("status-high"); }
                else if (nVal >= 60) { sEl.textContent = "Stable"; sEl.classList.add("status-stable"); }
                else if (nVal >= 40) { sEl.textContent = "Uncertain"; sEl.classList.add("status-uncertain"); }
                else { sEl.textContent = "Critical"; sEl.classList.add("status-critical"); }
                rEl.textContent = fallback.reactions[i] || "Reacting to changing market conditions.";
            }
        }
        saveCastState(currentCast);
        scenarioComplete = true;
        proceedGateArmed = true;
        crisisResolvedThisStage = false;
        const proceedBtn = document.getElementById("btn-proceed");
        if (proceedBtn) proceedBtn.disabled = false;
    } finally {
        outcomeInProgress = false;
    }
}

function animateMetric(elementId, targetValue, suffix, isCurrency) {
    const el = document.getElementById(elementId);
    let startTimestamp = null;
    const duration = 1200;
    
    const sign = targetValue > 0 ? "+" : targetValue < 0 ? "-" : "";
    const prefix = isCurrency ? "₹" : "";
    const safeTarget = Math.abs(targetValue || 0);
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * safeTarget);
        
        el.textContent = `${sign}${prefix}${current}${suffix}`;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            if (targetValue > 0) el.classList.add("text-positive");
            if (targetValue < 0) el.classList.add("text-negative");
        }
    };
    
    window.requestAnimationFrame(step);
}

function updateMetricsUI(impact = {}) {
    document.getElementById("metric-cash").textContent = `$${currentMetrics.cash.toLocaleString()}`;
    document.getElementById("metric-staffHours").textContent = `${currentMetrics.staffHours}`;
    document.getElementById("metric-reputation").textContent = `${currentMetrics.reputation}`;
    document.getElementById("metric-investorTrust").textContent = `${currentMetrics.investorTrust}`;

    flashMetricDelta("cash", impact.cash, "");
    flashMetricDelta("staffHours", impact.staffHours, "");
    flashMetricDelta("reputation", impact.reputation, "");
    flashMetricDelta("investorTrust", impact.investorTrust, "");
}

function flashMetricDelta(metricName, delta, suffix) {
    const node = document.getElementById(`metric-${metricName}-delta`);
    if (!node || !delta) return;

    const sign = delta > 0 ? "+" : "";
    node.textContent = `${sign}${delta}${suffix}`;
    node.classList.remove("positive", "negative", "show");
    node.classList.add(delta > 0 ? "positive" : "negative");

    requestAnimationFrame(() => node.classList.add("show"));
    window.setTimeout(() => node.classList.remove("show"), 1800);
}

// Crisis Scenario Functions
async function checkForCrisis() {
    // 30% chance of crisis after each outcome
    if (Math.random() < 0.3) {
        await triggerCrisis();
        return true;
    } else {
        // No crisis; caller decides how to proceed.
        const proceedBtn = document.getElementById("btn-proceed");
        if (proceedBtn) proceedBtn.disabled = false;
        return false;
    }
}

async function triggerCrisis() {
    try {
        const proceedBtn = document.getElementById("btn-proceed");
        if (proceedBtn) proceedBtn.disabled = true;
        const response = await fetch("/api/get-crisis");
        if (!response.ok) throw new Error("Failed to get crisis");
        
        const crisis = await response.json();
        
        // Show crisis modal
        const modal = document.getElementById("crisis-modal");
        document.getElementById("crisis-title").textContent = crisis.title;
        document.getElementById("crisis-description").textContent = crisis.description;
        
        const optionsContainer = document.getElementById("crisis-options");
        optionsContainer.innerHTML = "";
        
        crisis.options.forEach((option, index) => {
            const optionCard = document.createElement("div");
            optionCard.className = "decision-card crisis-option";
            optionCard.onclick = () => resolveCrisis(crisis.id, index);
            
            optionCard.innerHTML = `
                <div class="decision-header">
                    <h3>${option.title}</h3>
                </div>
                <p class="decision-desc">${option.description}</p>
                <div class="decision-impact">
                    <span class="impact-item ${option.impact.cash >= 0 ? 'positive' : 'negative'}">
                        <i class="ph-fill ph-coins"></i> ${option.impact.cash >= 0 ? '+' : ''}${option.impact.cash}k Budget
                    </span>
                    <span class="impact-item ${option.impact.reputation >= 0 ? 'positive' : 'negative'}">
                        <i class="ph-fill ph-handshake"></i> ${option.impact.reputation >= 0 ? '+' : ''}${option.impact.reputation} Trust
                    </span>
                    <span class="impact-item ${option.impact.impact >= 0 ? 'positive' : 'negative'}">
                        <i class="ph-fill ph-chart-line-up"></i> ${option.impact.impact >= 0 ? '+' : ''}${option.impact.impact} Impact
                    </span>
                </div>
            `;
            
            optionsContainer.appendChild(optionCard);
        });
        
        modal.classList.remove("hidden");
        
    } catch (error) {
        console.error("Crisis trigger error:", error);
        // If crisis fails, allow continuing
        const proceedBtn = document.getElementById("btn-proceed");
        if (proceedBtn) proceedBtn.disabled = false;
    }
}

async function resolveCrisis(crisisId, optionIndex) {
    try {
        const response = await fetch("/api/resolve-crisis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId: sessionStorage.getItem('simulationSessionId'),
                crisisId,
                optionIndex
            })
        });
        
        if (!response.ok) throw new Error("Failed to resolve crisis");
        
        const data = await response.json();
        
        // Update metrics
        currentMetrics.cash += data.impact.cash;
        currentMetrics.reputation += data.impact.reputation;
        currentMetrics.investorTrust += data.impact.investorTrust;
        currentMetrics.reputation = Math.max(0, Math.min(100, currentMetrics.reputation));
        currentMetrics.investorTrust = Math.max(0, Math.min(100, currentMetrics.investorTrust));
        currentMetrics.cash = Math.max(0, currentMetrics.cash);
        persistMetrics();
        
        updateMetricsUI(data.impact || {});
        
        // Flash deltas
        flashMetricDelta("cash", data.impact.cash, "k");
        flashMetricDelta("trust", data.impact.reputation, "");
        flashMetricDelta("impact", data.impact.impact, "");
        
        // Hide crisis modal
        document.getElementById("crisis-modal").classList.add("hidden");
        
        // Show a quick crisis outcome message, then enable proceed
        alert(`Crisis Resolved: ${data.title}\n\n${data.narrative}\n\nInsight: ${data.insight}`);
        
        crisisResolvedThisStage = true;
        const proceedBtn = document.getElementById("btn-proceed");
        if (proceedBtn) proceedBtn.disabled = false;
        
    } catch (error) {
        console.error("Crisis resolution error:", error);
        // If resolution fails, just proceed
        document.getElementById("crisis-modal").classList.add("hidden");
        crisisResolvedThisStage = true;
        const proceedBtn = document.getElementById("btn-proceed");
        if (proceedBtn) proceedBtn.disabled = false;
    }
}

function completeScenario() {
    stopStageTimers();
    const proceedBtn = document.getElementById("btn-proceed");
    if (proceedBtn) {
        proceedBtn.disabled = true;
    }

    // Always increment stage and go to next, unless last stage
    let nextStage = currentStageMeta.stage + 1;
    // Unlock next stage in journey data
    let journey = [];
    try {
        journey = JSON.parse(sessionStorage.getItem('journeyData') || '[]');
    } catch {}
    if (nextStage > currentStageMeta.total) {
        sessionStorage.removeItem("currentStageData");
        sessionStorage.removeItem("currentStageIndex");
        sessionStorage.removeItem("totalStages");
        window.location.href = "dashboard.html";
    } else {
        if (Array.isArray(journey) && journey[nextStage - 1]) {
            journey[nextStage - 1].locked = false;
            sessionStorage.setItem('journeyData', JSON.stringify(journey));
            // Critical: also update the stage metadata used by simulation.html
            sessionStorage.setItem('currentStageData', JSON.stringify(journey[nextStage - 1]));
        } else {
            // If we can't find the stage object, at least clear stale metadata
            sessionStorage.removeItem('currentStageData');
        }

        sessionStorage.setItem('currentStageIndex', String(nextStage - 1));
        sessionStorage.setItem('totalStages', String(currentStageMeta.total));
        sessionStorage.setItem('completedStageIndex', String(currentStageMeta.stage - 1));
        // Instead of reloading, reset state and fetch new scenario for next stage
        setTimeout(() => {
            window.location.href = "simulation.html";
        }, 100);
    }
}

// REAL WORLD OPPORTUNITIES
let currentOpportunities = [];
let activeOpportunity = null;

async function fetchOpportunities() {
    try {
        const oppSection = document.getElementById("opp-section");
        const cardsContainer = document.getElementById("opp-cards-container");
        if (!oppSection || !cardsContainer) return;
        
        const response = await fetch(`/api/get-opportunities?stage=${currentStageMeta.stage}`);
        if (!response.ok) return;
        
        const data = await response.json();
        currentOpportunities = data;
        
        if (data.length > 0) {
            oppSection.classList.remove("hidden");
            cardsContainer.innerHTML = data.map(opp => `
                <div class="opp-card">
                    <span class="opp-type-badge type-${opp.type}">${opp.type}</span>
                    <h3 class="opp-title">${opp.title}</h3>
                    <p class="opp-desc">${opp.description}</p>
                    <div class="opp-meta">
                        <strong>Benefit: <span>${opp.benefit}</span></strong>
                        <strong style="margin-top:0.3rem;">Requirement: <span style="color:var(--text-muted);">${opp.requirement}</span></strong>
                    </div>
                    <button class="btn btn-outline" style="width:100%;" onclick="openOppModal('${opp.id}')">${opp.cta}</button>
                </div>
            `).join("");
        } else {
            oppSection.classList.add("hidden");
        }
    } catch (error) {
        console.error("Failed to fetch opportunities:", error);
    }
}

function openOppModal(oppId) {
    activeOpportunity = currentOpportunities.find(o => o.id === oppId);
    if (!activeOpportunity) return;
    
    document.getElementById("opp-modal-title").textContent = activeOpportunity.title;
    document.getElementById("opp-modal-desc").textContent = activeOpportunity.description;
    document.getElementById("opp-modal-benefit").textContent = activeOpportunity.benefit;
    document.getElementById("opp-modal-req").textContent = activeOpportunity.requirement;
    
    const tasksContainer = document.getElementById("opp-modal-tasks");
    tasksContainer.innerHTML = "";
    
    if (activeOpportunity.taskType === "QUICK_QUESTIONS") {
        tasksContainer.innerHTML = activeOpportunity.questions.map((q, i) => `
            <div>
                <label class="opp-question-label">${q}</label>
                <input type="text" class="opp-input" id="opp-input-${i}" placeholder="Your answer..." />
            </div>
        `).join("");
    } else if (activeOpportunity.taskType === "MICRO_PITCH") {
        tasksContainer.innerHTML = `
            <div>
                <label class="opp-question-label">Deliver Your Pitch (Max 3 lines)</label>
                <textarea class="opp-textarea" id="opp-textarea-pitch" rows="4" placeholder="Hi, we are..." ></textarea>
            </div>
        `;
    } else if (activeOpportunity.taskType === "DECISION_CHOICE") {
        tasksContainer.innerHTML = activeOpportunity.options.map((opt, i) => `
            <button class="opp-choice-btn" onclick="selectOppChoice(this, '${opt}')">${opt}</button>
        `).join("");
    }
    
    document.getElementById("opp-modal").classList.remove("hidden");
    
    // Provide a way to submit
    const submitBtn = document.getElementById("opp-modal-submit");
    submitBtn.onclick = () => submitOpportunity();
}

function closeOppModal() {
    document.getElementById("opp-modal").classList.add("hidden");
    activeOpportunity = null;
    selectedOppChoice = null;
}

let selectedOppChoice = null;
function selectOppChoice(btn, choiceText) {
    document.querySelectorAll(".opp-choice-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedOppChoice = choiceText;
}

async function submitOpportunity() {
    if (!activeOpportunity) return;
    
    let userInput = "";
    
    if (activeOpportunity.taskType === "QUICK_QUESTIONS") {
        const inputs = [];
        for (let i=0; i<activeOpportunity.questions.length; i++) {
            const val = document.getElementById(`opp-input-${i}`)?.value || "";
            if (!val.trim()) return alert("Please answer all questions.");
            inputs.push(`Q: ${activeOpportunity.questions[i]} | A: ${val}`);
        }
        userInput = inputs.join("\\n");
    } else if (activeOpportunity.taskType === "MICRO_PITCH") {
        userInput = document.getElementById("opp-textarea-pitch")?.value || "";
        if (!userInput.trim() || userInput.trim().length < 10) return alert("Please enter a valid pitch.");
    } else if (activeOpportunity.taskType === "DECISION_CHOICE") {
        if (!selectedOppChoice) return alert("Please select an option.");
        userInput = selectedOppChoice;
    }
    
    const submitBtn = document.getElementById("opp-modal-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    
    try {
        const response = await fetch("/api/resolve-opportunity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId: sessionStorage.getItem('simulationSessionId'),
                opportunityId: activeOpportunity.id,
                userInput,
                currentMetrics,
                currentCastState: loadCastState()
            })
        });
        
        if (!response.ok) throw new Error("Resolution failed");
        
        const data = await response.json();
        
        // Hide the input modal
        closeOppModal();
        
        // Remove the opportunity card so they can't spam it
        document.querySelector(`.opp-card button[onclick="openOppModal('${activeOpportunity.id}')"]`)?.parentElement.remove();
        
        // Process metrics using standard tools
        currentMetrics.cash += (data.impact?.cash || 0);
        currentMetrics.staffHours += (data.impact?.staffHours || 0);
        currentMetrics.reputation = Math.max(0, Math.min(100, currentMetrics.reputation + (data.impact?.reputation || 0)));
        currentMetrics.investorTrust = Math.max(0, Math.min(100, currentMetrics.investorTrust + (data.impact?.investorTrust || 0)));
        persistMetrics();
        updateMetricsUI(data.impact || {});
        
        if (data.stakeholderImpact) {
            const shMap = { riskTaker: "riskTaker", conservative: "conservative", trendFollower: "trendFollower", dataDriven: "dataDriven" };
            const currentCast = loadCastState();
            for (let i = 0; i < 4; i++) {
                const key = Object.keys(shMap)[i];
                const pVal = currentCast[key];
                const tImpact = data.stakeholderImpact[key] || 0;
                const nVal = Math.max(0, Math.min(100, pVal + tImpact));
                currentCast[key] = nVal;
                
                const vEl = document.getElementById(`trust-val-${key}`);
                const bEl = document.getElementById(`trust-bar-${key}`);
                if(vEl && bEl) {
                    let arrow = tImpact > 0 ? "↑" : tImpact < 0 ? "↓" : "-";
                    let color = tImpact > 0 ? "var(--green)" : tImpact < 0 ? "var(--red)" : "var(--text-muted)";
                    let sign = tImpact > 0 ? "+" : "";
                    vEl.innerHTML = `<span style="font-size:1.1rem; color:var(--text-muted); font-weight:600;">${pVal} <i class="ph-bold ph-arrow-right"></i></span>
                                    <span style="font-size:1.8rem; font-weight:800; color:var(--text-main); margin:0 0.5rem;">${nVal}</span>
                                    <span style="font-size:1.15rem; font-weight:800; color:${color}; margin-left:0.3rem;">${arrow} (${sign}${tImpact})</span>`;
                    bEl.style.width = `${nVal}%`;
                }
            }
            saveCastState(currentCast);
        }
        
        // Show outcome
        alert(`Opportunity Result: ${data.result}\n\n${data.explanation}`);
        
    } catch (err) {
        console.error("Opportunity submit error", err);
        alert("Failed to submit opportunity. Try again later.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
}

