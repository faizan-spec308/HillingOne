import streamlit as st
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Hillingdon AI Assistant",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Styling ───────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    /* Brand colours: Hillingdon green + dark navy */
    :root {
        --hl-green: #00703C;
        --hl-dark:  #1a1a2e;
        --hl-light: #f4f9f6;
    }

    /* Hide default streamlit chrome */
    #MainMenu, footer, header {visibility: hidden;}

    /* Top banner */
    .top-banner {
        background: linear-gradient(135deg, #00703C 0%, #004d29 100%);
        color: white;
        padding: 1.2rem 2rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .top-banner h1 { margin: 0; font-size: 1.8rem; font-weight: 700; }
    .top-banner p  { margin: 0; font-size: 0.9rem; opacity: 0.9; }
    .badge {
        background: rgba(255,255,255,0.2);
        border-radius: 20px;
        padding: 0.3rem 0.9rem;
        font-size: 0.8rem;
        font-weight: 600;
    }

    /* Chat bubbles */
    .chat-user {
        background: #00703C;
        color: white;
        padding: 0.75rem 1rem;
        border-radius: 18px 18px 4px 18px;
        margin: 0.4rem 0 0.4rem 20%;
        line-height: 1.5;
    }
    .chat-bot {
        background: white;
        color: #1a1a2e;
        padding: 0.75rem 1rem;
        border-radius: 18px 18px 18px 4px;
        margin: 0.4rem 20% 0.4rem 0;
        border: 1px solid #e0e0e0;
        line-height: 1.6;
    }
    .chat-label {
        font-size: 0.75rem;
        color: #777;
        margin: 0.1rem 0;
    }
    .chat-label-right { text-align: right; }

    /* Quick action chips */
    .stButton > button {
        background: white;
        border: 2px solid #00703C;
        color: #00703C;
        border-radius: 20px;
        font-size: 0.82rem;
        padding: 0.3rem 0.8rem;
        font-weight: 500;
        transition: all 0.2s;
    }
    .stButton > button:hover {
        background: #00703C;
        color: white;
    }

    /* Input styling */
    .stTextInput > div > div > input {
        border-radius: 25px;
        border: 2px solid #00703C;
        padding: 0.6rem 1.2rem;
    }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background: #f4f9f6;
    }
    .service-card {
        background: white;
        border-left: 4px solid #00703C;
        padding: 0.5rem 0.8rem;
        border-radius: 4px;
        margin: 0.4rem 0;
        font-size: 0.87rem;
    }

    /* Stats row */
    .stat-box {
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        padding: 0.8rem 1rem;
        text-align: center;
    }
    .stat-num { font-size: 1.6rem; font-weight: 700; color: #00703C; }
    .stat-lbl { font-size: 0.78rem; color: #555; }
</style>
""", unsafe_allow_html=True)

# ── Gemini setup ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are the Hillingdon AI Assistant — a friendly, knowledgeable virtual helper for
Hillingdon Council residents. You help with all council services clearly and concisely.

Services you know about:
- Housing: applications, repairs, housing benefit, homelessness, Right to Buy
- Council Tax: payments, discounts, exemptions, appeals, direct debit
- Waste & Recycling: bin schedules, bulky item collection, recycling centres, fly-tipping
- Planning & Building: planning applications, permitted development, building regulations
- Roads & Transport: pothole reporting, street lighting, parking permits, road closures
- Schools & Education: admissions, free school meals, SEND support, term dates, Ofsted
- Social Care: adult social care, children's services, carer support, safeguarding
- Environment: parks, allotments, noise complaints, pollution, pest control
- Libraries: membership, opening hours, digital resources, events
- Benefits & Support: housing benefit, council tax reduction, food banks, community grants
- Licensing: business, premises, taxis, street trading
- Births, Deaths & Marriages: registration, ceremonies, certificates, name changes
- Leisure & Culture: sports centres, museums, arts venues, events

Key facts:
- Hillingdon Council main line: 01895 250111
- Website: www.hillingdon.gov.uk
- Borough covers: Uxbridge, Hayes, Ruislip, Northwood, Harefield, Yiewsley, West Drayton
- Emergencies: 999 (life-threatening) or 101 (non-emergency police)
- Council offices: Civic Centre, High Street, Uxbridge, UB8 1UW

Rules:
- Be warm, concise, and clear — no jargon
- For complex legal/financial matters, recommend professional advice
- Always give a next step the resident can take
- If unsure, direct to the main council number or website
- Never invent specific dates, reference numbers, or amounts
"""

@st.cache_resource
def get_model():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=SYSTEM_PROMPT,
    )

# ── Session state ─────────────────────────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []
if "chat" not in st.session_state:
    st.session_state.chat = None

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🏛️ Hillingdon Council")
    st.markdown("**AI Resident Assistant**")
    st.divider()

    st.markdown("### 📋 Services")
    services = [
        ("🏠", "Housing & Homelessness"),
        ("💰", "Council Tax & Benefits"),
        ("♻️", "Waste & Recycling"),
        ("🏗️", "Planning & Building"),
        ("🚗", "Roads & Parking"),
        ("🎓", "Schools & Education"),
        ("🤝", "Social Care"),
        ("🌳", "Parks & Environment"),
        ("📚", "Libraries"),
        ("📄", "Births, Deaths & Marriages"),
    ]
    for icon, name in services:
        st.markdown(f'<div class="service-card">{icon} {name}</div>', unsafe_allow_html=True)

    st.divider()
    st.markdown("### 📞 Contact")
    st.info("**01895 250111**\nMon–Fri 9am–5pm\n\nwww.hillingdon.gov.uk")

    st.divider()
    if st.button("🗑️ Clear conversation"):
        st.session_state.messages = []
        st.session_state.chat = None
        st.rerun()

    st.markdown("---")
    st.caption("Powered by Google Gemini AI\nBuilt for Hillingdon Council Hackathon 2025")

# ── Main area ─────────────────────────────────────────────────────────────────
st.markdown("""
<div class="top-banner">
  <div>
    <h1>🏛️ Hillingdon AI Assistant</h1>
    <p>Get instant help with any Hillingdon Council service</p>
  </div>
  <span class="badge">🤖 AI Powered</span>
</div>
""", unsafe_allow_html=True)

# Stats row
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.markdown('<div class="stat-box"><div class="stat-num">350K+</div><div class="stat-lbl">Borough Residents</div></div>', unsafe_allow_html=True)
with col2:
    st.markdown('<div class="stat-box"><div class="stat-num">10+</div><div class="stat-lbl">Council Services</div></div>', unsafe_allow_html=True)
with col3:
    st.markdown('<div class="stat-box"><div class="stat-num">24/7</div><div class="stat-lbl">AI Availability</div></div>', unsafe_allow_html=True)
with col4:
    st.markdown('<div class="stat-box"><div class="stat-num">&lt;2s</div><div class="stat-lbl">Response Time</div></div>', unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ── API key check ─────────────────────────────────────────────────────────────
model = get_model()
if model is None:
    st.error("⚠️ **GEMINI_API_KEY not set.** Add it to your `.env` file and restart.")
    st.code("GEMINI_API_KEY=your_key_here", language="bash")
    st.markdown("Get a free key at [aistudio.google.com](https://aistudio.google.com)")
    st.stop()

# Initialise chat session
if st.session_state.chat is None:
    st.session_state.chat = model.start_chat(history=[])

# ── Quick action buttons ──────────────────────────────────────────────────────
st.markdown("**Quick questions:**")
quick = [
    "How do I report a missed bin collection?",
    "How do I apply for council housing?",
    "How do I pay my council tax?",
    "Report a pothole on my road",
    "How do I apply for a school place?",
    "How do I report fly-tipping?",
]
cols = st.columns(3)
for i, question in enumerate(quick):
    if cols[i % 3].button(question, key=f"q{i}"):
        st.session_state.messages.append({"role": "user", "content": question})
        with st.spinner("Thinking..."):
            response = st.session_state.chat.send_message(question)
        st.session_state.messages.append({"role": "assistant", "content": response.text})
        st.rerun()

st.divider()

# ── Chat history ──────────────────────────────────────────────────────────────
if not st.session_state.messages:
    st.markdown("""
    <div style='text-align:center; padding: 2rem; color: #666;'>
        <h3>👋 Welcome to the Hillingdon AI Assistant</h3>
        <p>Ask me anything about council services — housing, bins, parking, schools, and more.</p>
        <p>Use the quick questions above or type your own below.</p>
    </div>
    """, unsafe_allow_html=True)
else:
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            st.markdown(f'<p class="chat-label chat-label-right">You</p>', unsafe_allow_html=True)
            st.markdown(f'<div class="chat-user">{msg["content"]}</div>', unsafe_allow_html=True)
        else:
            st.markdown(f'<p class="chat-label">🏛️ Hillingdon AI</p>', unsafe_allow_html=True)
            st.markdown(f'<div class="chat-bot">{msg["content"]}</div>', unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# ── Input ─────────────────────────────────────────────────────────────────────
with st.form("chat_form", clear_on_submit=True):
    user_input = st.text_input(
        "Ask about any council service...",
        placeholder="e.g. How do I register a new birth?",
        label_visibility="collapsed",
    )
    submitted = st.form_submit_button("Send →", use_container_width=False)

if submitted and user_input.strip():
    st.session_state.messages.append({"role": "user", "content": user_input.strip()})
    with st.spinner("Thinking..."):
        response = st.session_state.chat.send_message(user_input.strip())
    st.session_state.messages.append({"role": "assistant", "content": response.text})
    st.rerun()
