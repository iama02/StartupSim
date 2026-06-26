// Roadmap details mapping
const roadmapData = {
    "Problem Discovery": "Identify burning pain points and validate them with real users before writing a single line of code.",
    "Stakeholder Mapping": "Understand who pays, who uses, and who vetos your product. Build the ecosystem.",
    "Solution Design": "Crafting the perfect minimum viable loop. Keep it lean, keep it fast.",
    "Pilot & MVP": "Launch to a small cohort. This stage requires balancing speed with acceptable quality.",
    "Resource Allocation": "Managing burn rate. Hiring the right people at the right time. Don't run out of cash.",
    "Crisis Management": "Handling sudden PR disasters, funding drops, or co-founder conflicts. Only the resilient survive.",
    "Scaling": "Pouring fuel on the fire. Optimizing acquiring cost and maximizing lifetime value."
};

// Handle Roadmap Hover Effects
const nodes = document.querySelectorAll('.roadmap-node');
const detailsBox = document.getElementById('roadmap-details');
const rmTitle = document.getElementById('rm-title');
const rmDesc = document.getElementById('rm-desc');

nodes.forEach(node => {
    node.addEventListener('mouseenter', () => {
        const title = node.getAttribute('data-title');
        rmTitle.textContent = title;
        rmDesc.textContent = roadmapData[title] || "Explore this phase of your startup simulation.";
        detailsBox.classList.add('active');

        // Minor pulse effect
        node.style.transform = "scale(1.05) translateY(-5px)";
    });

    node.addEventListener('mouseleave', () => {
        detailsBox.classList.remove('active');
        node.style.transform = "none";

        // Reset to default
        setTimeout(() => {
            if (!detailsBox.classList.contains('active')) {
                rmTitle.textContent = "Hover a stage";
                rmDesc.textContent = "Explore the different phases of your simulation journey.";
            }
        }, 300);
    });
});

// Demo Interaction Logic
const scenarioCard = document.querySelector('.scenario-card');
const feedbackCard = document.getElementById('demo-feedback');
const fbIcon = document.getElementById('fb-icon');
const fbTitle = document.getElementById('fb-title');
const fbText = document.getElementById('fb-text');

const feedbackResults = {
    1: {
        icon: '<i class="ph-fill ph-warning-circle" style="color: #ef4444"></i>',
        title: "Morale Tanked! (-30%)",
        text: "You saved runway, but firing 30% of the team caused panic. Top performers are now looking to leave. A classic rookie founder reflex."
    },
    2: {
        icon: '<i class="ph-fill ph-check-circle" style="color: #10b981"></i>',
        title: "Smart Pivot (+2 Runway)",
        text: "Excellent agility! The new product hit MVP in 4 weeks, generating early revenue and impressing the remaining investors."
    },
    3: {
        icon: '<i class="ph-fill ph-x-circle" style="color: #ef4444"></i>',
        title: "Game Over (Bankrupt)",
        text: "You burned through your remaining cash trying to sell a product the market couldn't afford. You failed to adapt to the new reality."
    }
};

function handleChoice(choiceId) {
    const result = feedbackResults[choiceId];

    // Set feedback content
    fbIcon.innerHTML = result.icon;
    fbTitle.textContent = result.title;
    fbText.textContent = result.text;

    // Trigger CSS 3D Flip
    scenarioCard.classList.add('flipped');
    setTimeout(() => {
        feedbackCard.classList.remove('hidden');
    }, 150); // halfway through flip
}

function resetDemo() {
    feedbackCard.classList.add('hidden');
    setTimeout(() => {
        scenarioCard.classList.remove('flipped');
    }, 200);
}

// Simple Intersection Observer for scroll animations (fade in)
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Apply initial styles and observe
document.querySelectorAll('.feature-card, .step, .pitch-showcase').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
    observer.observe(el);
});
