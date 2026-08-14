# coding: utf-8
with open('d:/DSI/TurfChai/frontend/src/pages/owner/OwnerOnboardingPage.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("<- Back", "&larr; Back")
code = code.replace("Next Step ->", "Next Step &rarr;")

with open('d:/DSI/TurfChai/frontend/src/pages/owner/OwnerOnboardingPage.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
