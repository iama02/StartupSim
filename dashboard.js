document.addEventListener("DOMContentLoaded", () => {
    const aiState = document.getElementById('dashboard-loading');
    const contentScreen = document.getElementById('dashboard-content');
    
    // Fetch AI Data
    const sessionId = sessionStorage.getItem('simulationSessionId');

    if (!sessionId) {
        document.getElementById("investor-letter-body").innerHTML = "<p>No active simulation session found. Did you complete the journey?</p>";
        aiState.style.display = 'none';
        contentScreen.classList.remove('hidden');
        return;
    }

    fetch('/api/generate-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
    })
    .then(async (res) => {
        if (!res.ok) throw new Error("Backend not reachable or returned error.");
        return res.json();
    })
    .then(data => {
        if(data.error) throw new Error(data.error);
        
        // Render Evaluation
        document.getElementById("final-grade").textContent = data.evaluation?.finalScore || "N/A";
        document.getElementById("founder-archetype").textContent = data.evaluation?.founderType || "Founder Profile Analysis";
        document.getElementById("investor-letter-body").innerHTML = data.evaluation?.letterHtml || "<p>Data unavailable.</p>";

        // Render Metrics
        document.getElementById("final-cash").textContent = `$${data.metrics?.cash || 0}`;
        document.getElementById("bar-cash").style.width = `${Math.min(100, (data.metrics?.cash || 0) / 2000)}%`;

        document.getElementById("final-staffHours").textContent = `${data.metrics?.staffHours || 0}`;
        document.getElementById("bar-staffHours").style.width = `${Math.min(100, data.metrics?.staffHours || 0)}%`;

        document.getElementById("final-reputation").textContent = `${data.metrics?.reputation || 0}/100`;
        document.getElementById("bar-reputation").style.width = `${data.metrics?.reputation || 0}%`;

        document.getElementById("final-investorTrust").textContent = `${data.metrics?.investorTrust || 0}/100`;
        document.getElementById("bar-investorTrust").style.width = `${data.metrics?.investorTrust || 0}%`;

        // Render History
        const timeline = document.getElementById("timeline-container");
        timeline.innerHTML = data.history.map((h, i) => `
            <div class="timeline-item" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--surface); border-radius: var(--radius-md); box-shadow: var(--shadow-soft);">
                <h4><span style="color:var(--primary);">Stage ${i+1}:</span> ${h.stageName}</h4>
                <p><strong>Decision:</strong> ${h.decisionTitle}</p>
                <p><strong>Outcome:</strong> ${h.narrative}</p>
                <p><em>Insight: ${h.insight}</em></p>
            </div>
        `).join("");

        renderResources(data.evaluation?.resources || {});

        // Fade out AI Loading
        aiState.classList.add('fade-out');
        setTimeout(() => {
            aiState.style.display = 'none';
            contentScreen.classList.remove('hidden');
        }, 800);
    })
    .catch(err => {
        console.error("Dashboard Fetch Error:", err);
        document.getElementById("investor-letter-body").innerHTML = "<p>An error occurred connecting to the VC Simulation backend.</p>";
        renderResources({});
        aiState.style.display = 'none';
        contentScreen.classList.remove('hidden');
    });
});

function safeList(list) {
    return Array.isArray(list) ? list : [];
}

function normalizeUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return raw;
    return `https://${raw}`;
}

function renderLinks(item) {
    const website = normalizeUrl(item?.website);
    const contact = normalizeUrl(item?.contact);
    if (!website && !contact) return "";

    const websiteHtml = website
        ? `<a href="${website}" target="_blank" rel="noopener noreferrer" style="margin-right:0.8rem;">Website</a>`
        : "";
    const contactHtml = contact
        ? `<a href="${contact}" target="_blank" rel="noopener noreferrer">Contact</a>`
        : "";

    return `<p style="margin:0.25rem 0 0 0;">${websiteHtml}${contactHtml}</p>`;
}

function buildResourceSection(title, icon, items, renderer) {
    const body = items.length
        ? items.map(renderer).join("")
        : `<p style="color:var(--text-muted);margin:0;">No suggestions generated for this section.</p>`;

    return `
        <div class="timeline-item" style="margin-bottom: 1.5rem; padding: 1.25rem; background: var(--surface); border-radius: var(--radius-md); box-shadow: var(--shadow-soft);">
            <h4 style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.9rem;">
                <i class="${icon}" style="color:var(--primary);"></i> ${title}
            </h4>
            ${body}
        </div>
    `;
}

function renderResources(resources) {
    const host = document.getElementById("resources-container");
    if (!host) return;

    const ngos = safeList(resources.ngos);
    const stakeholders = safeList(resources.stakeholders);
    const grants = safeList(resources.grants);
    const communities = safeList(resources.communities);

    host.innerHTML = [
        buildResourceSection("Relevant NGOs / Nonprofits", "ph-fill ph-heart", ngos, item => `
            <div style="margin-bottom:0.8rem;">
                <p style="margin:0;"><strong>${item.name || "NGO"}</strong></p>
                <p style="margin:0.2rem 0;color:var(--text-muted);">${item.whyRelevant || ""}</p>
                <p style="margin:0;color:var(--primary);"><em>Next step:</em> ${item.action || "-"}</p>
                ${renderLinks(item)}
            </div>
        `),
        buildResourceSection("Key Stakeholders", "ph-fill ph-users-three", stakeholders, item => `
            <div style="margin-bottom:0.8rem;">
                <p style="margin:0;"><strong>${item.name || "Stakeholder"}</strong> - ${item.role || ""}</p>
                <p style="margin:0;color:var(--primary);"><em>Engage:</em> ${item.action || "-"}</p>
                ${renderLinks(item)}
            </div>
        `),
        buildResourceSection("Grants / Funding Programs", "ph-fill ph-currency-circle-dollar", grants, item => `
            <div style="margin-bottom:0.8rem;">
                <p style="margin:0;"><strong>${item.name || "Grant"}</strong></p>
                <p style="margin:0.2rem 0;color:var(--text-muted);">${item.fit || ""}</p>
                <p style="margin:0;color:var(--primary);"><em>Next step:</em> ${item.nextStep || "-"}</p>
                ${renderLinks(item)}
            </div>
        `),
        buildResourceSection("Communities / Networks", "ph-fill ph-handshake", communities, item => `
            <div style="margin-bottom:0.8rem;">
                <p style="margin:0;"><strong>${item.name || "Community"}</strong></p>
                <p style="margin:0.2rem 0;color:var(--text-muted);">${item.value || ""}</p>
                <p style="margin:0;color:var(--primary);"><em>Join path:</em> ${item.joinPath || "-"}</p>
                ${renderLinks(item)}
            </div>
        `)
    ].join("");
}
