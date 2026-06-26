let generatedStageData = [];
const JOURNEY_KEY = "journeyData";
const STAGE_INDEX_KEY = "currentStageIndex";
const COMPLETED_STAGE_INDEX_KEY = "completedStageIndex";
const CONTEXT_SIGNATURE_KEY = "journeyContextSignature";

function buildContextSignature(idea, audience, budget) {
    return JSON.stringify({
        idea: (idea || "").trim(),
        audience: (audience || "").trim(),
        budget: (budget || "").trim()
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const aiState = document.getElementById('ai-processing-state');
    const pathScreen = document.getElementById('generated-path-screen');
    const aiTitle = document.getElementById('ai-title');
    const aiSubtitle = document.getElementById('ai-subtitle');
    
    // Animate Text Cycle
    const cycle1 = setTimeout(() => updateAIText("Understanding your problem...", "Aligning to market needs"), 1500);
    const cycle2 = setTimeout(() => updateAIText("Identifying stakeholders...", "Mapping key audience targets"), 3000);
    const cycle3 = setTimeout(() => updateAIText("Structuring your journey...", "Finalizing the simulation roadmap"), 4500);
    const cycle4 = setTimeout(() => updateAIText("Consulting AI Advisors...", "Generating deep personalized insights"), 6000);

    function updateAIText(title, sub) {
        aiTitle.style.transform = "scale(1.05)";
        setTimeout(() => aiTitle.style.transform = "scale(1)", 150);
        aiTitle.textContent = title;
        if(sub) aiSubtitle.textContent = sub;
    }

    // Fetch AI Data
    const idea = sessionStorage.getItem('startupIdea') || "A new mobile app";
    const audience = sessionStorage.getItem('startupAudience') || "General consumers";
    const budget = sessionStorage.getItem('startupBudget') || "Unknown";
    const contextSignature = buildContextSignature(idea, audience, budget);

    // Reuse existing journey when user comes back from simulation to avoid overwriting unlocked stages
    let existingJourney = [];
    try {
        existingJourney = JSON.parse(sessionStorage.getItem(JOURNEY_KEY) || "[]");
    } catch (error) {
        existingJourney = [];
    }
    const existingSignature = sessionStorage.getItem(CONTEXT_SIGNATURE_KEY);
    const canReuseJourney = Array.isArray(existingJourney) && existingJourney.length > 0 && existingSignature === contextSignature;

    if (canReuseJourney) {
        clearTimeout(cycle1);
        clearTimeout(cycle2);
        clearTimeout(cycle3);
        clearTimeout(cycle4);

        generatedStageData = existingJourney;
        buildRoadmapDOM(generatedStageData);

        aiState.style.display = 'none';
        pathScreen.classList.remove('hidden');
        requestAnimationFrame(() => startRoadmapAnimation(generatedStageData.length));
        return;
    }

    const isLocalDevelopment = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const isDifferentPort = window.location.port !== '3000';
    const isFileScheme = window.location.protocol === 'file:';
    
    const backendUrl = (isFileScheme || (isLocalDevelopment && isDifferentPort)) 
        ? 'http://localhost:3000/api/generate-journey' 
        : '/api/generate-journey';

    const fetchPromise = fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, audience, budget })
    }).then(async (res) => {
        // Handle common non-JSON responses (like 404 HTML pages from Live Server)
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return res.json();
        } else {
            throw new Error("Backend not reachable or returned non-JSON response.");
        }
    });

    // Minimum animation time promise (e.g. 5 seconds min for cool effect)
    const minDelayPromise = new Promise(resolve => setTimeout(resolve, 5000));

    Promise.all([fetchPromise, minDelayPromise])
        .then(([data]) => {
            if(data.error) {
                updateAIText("Error Detected!", data.error);
                return; // halt and show error
            }
            
            // Clear future cycles if fetch resolved early
            clearTimeout(cycle1);
            clearTimeout(cycle2);
            clearTimeout(cycle3);
            clearTimeout(cycle4);

            generatedStageData = data;
            buildRoadmapDOM(generatedStageData);
            sessionStorage.setItem(CONTEXT_SIGNATURE_KEY, contextSignature);
            sessionStorage.setItem(COMPLETED_STAGE_INDEX_KEY, "-1");

            // Create Simulation Session in MongoDB
            fetch(backendUrl.replace('generate-journey', 'simulation/start'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea, audience, budget })
            })
            .then(res => res.json())
            .then(dbRes => {
                if(dbRes.sessionId) {
                    sessionStorage.setItem('simulationSessionId', dbRes.sessionId);
                }
            })
            .catch(console.error);

            // Fade out AI Space
            aiState.classList.add('fade-out');
            setTimeout(() => {
                aiState.style.display = 'none';
                pathScreen.classList.remove('hidden');
                requestAnimationFrame(() => startRoadmapAnimation(generatedStageData.length));
            }, 800);
        })
        .catch(err => {
            console.error(err);
            updateAIText("Connection Failed", "Ensure backend server is running and API key is set.");
        });
});

function buildRoadmapDOM(stageDataArr) {
    const container = document.getElementById('roadmap-container');
    // Save journey data for unlocking logic
    sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(stageDataArr));
    // Reset container with just the drawing line
    container.innerHTML = `<div class="vertical-line" id="drawing-line"></div>`;

    stageDataArr.forEach((stageObj, index) => {
        const isUnlocked = !stageObj.locked;
        const stateClass = isUnlocked ? "unlocked active-node" : "locked";
        const iconHtml = isUnlocked ? `<i class="ph-fill ph-magnifying-glass"></i>` : `<i class="ph-fill ph-lock-key"></i>`;
        // Extract just the name for the label (e.g., "Stage 1: Food Delivery" -> "Food Delivery")
        let labelName = stageObj.title;
        if (labelName.includes(':')) {
            labelName = labelName.split(':')[1].trim();
        }
        container.innerHTML += `
            <div class="v-node hidden-node ${stateClass}" onclick="selectStage(${index})">
                <div class="v-node-icon">${iconHtml}</div>
                <div class="v-node-label">${labelName}</div>
            </div>
        `;
    });
}

function startRoadmapAnimation(nodeCount) {
    // 1. Draw the line downwards
    const line = document.getElementById('drawing-line');
    if (line) line.style.height = '100%';

    // 2. Sequentially pop in the nodes
    const nodes = document.querySelectorAll('.v-node.hidden-node');
    nodes.forEach((node, index) => {
        setTimeout(() => {
            node.classList.remove('hidden-node');
            node.classList.add('pop-in-node');
            
            // Add extra glow for the first unlocked node
            if (index === 0) {
                node.querySelector('.v-node-icon').classList.add('pulse-glow-active');
            }
        }, 400 * (index + 1)); // Stagger by 400ms
    });

    // 3. Auto-select first stage and fade in the details panel
    setTimeout(() => {
        const detailsPanel = document.getElementById('details-panel');
        if (detailsPanel) {
            detailsPanel.classList.remove('hidden-panel');
            detailsPanel.classList.add('slide-in-panel');
        }
        const latestIndex = Number(sessionStorage.getItem(STAGE_INDEX_KEY));
        const safeIndex = Number.isFinite(latestIndex) && latestIndex >= 0 && latestIndex < nodeCount ? latestIndex : 0;
        selectStage(safeIndex); 
    }, 400 * nodeCount + 500); // 500ms after last node
}

function selectStage(index) {
    if (generatedStageData.length === 0) return;
    
    const data = generatedStageData[index];
    if (!data) return; 
    
    const panelTitle = document.getElementById('panel-title');
    const panelObj = document.getElementById('panel-objective');
    const panelTasks = document.getElementById('panel-tasks');
    const panel = document.getElementById('details-panel');
    
    // Animate change
    panel.style.transform = 'scale(0.98)';
    panel.style.opacity = '0.5';
    
    setTimeout(() => {
        panelTitle.textContent = data.title;
        panelObj.textContent = data.objective;
        
        let tasksHtml = '';
        if (data.tasks) {
            data.tasks.forEach(task => {
                const iconColor = data.locked ? '#cbd5e1' : '#8b5cf6';
                tasksHtml += `<li><i class="ph-fill ph-check-circle" style="color: ${iconColor};"></i> ${task}</li>`;
            });
        }
        panelTasks.innerHTML = tasksHtml;
        
        // Determine CTA State
        const ctaBtn = panel.querySelector('.btn-primary');
        if (data.locked) {
            ctaBtn.textContent = "Locked";
            ctaBtn.classList.add('btn-disabled');
            ctaBtn.style.opacity = "0.5";
            ctaBtn.style.cursor = "not-allowed";
            ctaBtn.onclick = null;
        } else {
            ctaBtn.textContent = "Start Stage";
            ctaBtn.classList.remove('btn-disabled');
            ctaBtn.style.opacity = "1";
            ctaBtn.style.cursor = "pointer";
            ctaBtn.onclick = () => {
                sessionStorage.setItem('currentStageData', JSON.stringify(data));
                sessionStorage.setItem(STAGE_INDEX_KEY, String(index));
                sessionStorage.setItem('totalStages', String(generatedStageData.length));
                window.location.href = 'simulation.html';
            };
        }

        const secondaryBtn = panel.querySelector('.btn-outline');
        if (secondaryBtn) {
            secondaryBtn.textContent = "Back to Home";
            secondaryBtn.onclick = () => {
                window.location.href = 'index.html';
            };
        }

        panel.style.transform = 'scale(1)';
        panel.style.opacity = '1';
    }, 200);
}
