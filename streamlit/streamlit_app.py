"""Shopsmith Mark V part identifier - Streamlit in Snowflake.

Take a photo, store it on an encrypted stage, and ask a Cortex vision model to match it
against the SHOPSMITH_GUIDE.APP.PARTS catalog.
"""
import json
import re
import uuid
from datetime import datetime
from io import BytesIO

import streamlit as st
from snowflake.snowpark.context import get_active_session

MODEL = "claude-sonnet-4-5"  # best match quality in testing; pixtral-large misidentified the planer
STAGE = "@SHOPSMITH_GUIDE.APP.PHOTOS"
GUIDE_URL = "https://sfc-gh-dfreriks.github.io/shopsmith-guide/"

st.set_page_config(page_title="Shopsmith Part ID", layout="centered")
session = get_active_session()


@st.cache_data(ttl=3600)
def load_parts():
    rows = session.sql(
        "SELECT ID, NAME, CATEGORY, VISUAL, MOUNT, USE_TEXT, GUIDE_SECTION, PART_NUMBERS, REFS "
        "FROM SHOPSMITH_GUIDE.APP.PARTS ORDER BY ID"
    ).collect()
    return {r["ID"]: r.as_dict() for r in rows}


def build_prompt(parts, hint):
    cat = "\n".join(f'{p["ID"]} | {p["NAME"]} | {p["CATEGORY"]} | {p["VISUAL"]}' for p in parts.values())
    return (
        "You identify parts and accessories for a Shopsmith Mark V woodworking machine "
        "(2003, likely Model 520) that has Planer and Belt Sander special-purpose tools. "
        "Match the photo to this catalog (id | name | category | appearance):\n" + cat + "\n\n"
        + (f"Owner's hint: {hint}\n\n" if hint else "")
        + 'Reply ONLY with JSON: {"matches":[{"id":"<catalog id>","confidence":0-100,"reason":"what in the photo matches"}],'
        '"not_in_catalog":"best plain-language guess if nothing fits, else empty","is_shopsmith":true,'
        '"photo_tips":"how to retake if unsure, else empty"}. Up to 3 matches, best first. Only use catalog ids. '
        "Be honest about low confidence."
    )


def identify(img_bytes, hint):
    parts = load_parts()
    path = f"uploads/{datetime.utcnow():%Y%m%d}/{uuid.uuid4().hex}.jpg"
    session.file.put_stream(BytesIO(img_bytes), f"{STAGE}/{path}", auto_compress=False, overwrite=True)
    sql = (
        f"SELECT AI_COMPLETE('{MODEL}', PROMPT('{{0}}\\n\\nPhoto: {{1}}', ?, TO_FILE('{STAGE}', ?)))::STRING AS R"
    )
    raw = session.sql(sql, params=[build_prompt(parts, hint), path]).collect()[0]["R"]
    if raw.startswith('"'):  # variant string still JSON-encoded
        raw = json.loads(raw)
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        raise ValueError("The model did not return a usable answer.")
    return json.loads(m.group(0)), parts


def part_card(p, header=None, reason=None):
    with st.container(border=True):
        if header:
            st.markdown(f"**{header}**")
        st.subheader(p["NAME"])
        nums = json.loads(p["PART_NUMBERS"]) if isinstance(p["PART_NUMBERS"], str) else (p["PART_NUMBERS"] or [])
        st.caption(p["CATEGORY"] + (f" · #{', #'.join(nums)}" if nums else ""))
        if reason:
            st.write(f"_{reason}_")
        st.markdown(f"**Looks like:** {p['VISUAL']}")
        st.markdown(f"**Mount:** {p['MOUNT']}")
        st.markdown(f"**Use:** {p['USE_TEXT']}")
        if p["GUIDE_SECTION"]:
            st.link_button("Open guide section", f"{GUIDE_URL}#/guide/{p['GUIDE_SECTION']}")


st.title("Shopsmith part ID")
st.caption("Photograph a part. Good light, fill the frame, include a coin for scale, and show any stamped numbers.")

src = st.radio("Photo source", ["Camera", "Upload"], horizontal=True, label_visibility="collapsed")
photo = st.camera_input("Take a photo") if src == "Camera" else st.file_uploader(
    "Choose a photo", type=["jpg", "jpeg", "png"])
hint = st.text_input("Optional hint", placeholder='e.g. "found in the planer box"')

if photo and st.button("Identify", type="primary", use_container_width=True):
    data = photo.getvalue()
    if len(data) > 9_000_000:
        st.error("Photo is too large (over ~9 MB). Try a lower camera resolution.")
        st.stop()
    with st.spinner("Identifying..."):
        try:
            result, parts = identify(data, hint.strip())
        except Exception as e:  # surface Cortex/stage errors to the user
            st.error(f"Identification failed: {e}")
            st.stop()
    if result.get("is_shopsmith") is False:
        st.warning("This may not be a Shopsmith part.")
    shown = 0
    for i, m in enumerate(result.get("matches") or []):
        p = parts.get(m.get("id"))
        if not p:
            continue
        conf = int(float(m.get("confidence") or 0))
        part_card(p, f"{'Best match' if i == 0 else 'Possible match'} · {conf}% confident", m.get("reason"))
        shown += 1
    if result.get("not_in_catalog"):
        st.info(f"Not in the catalog. Best guess: {result['not_in_catalog']}")
    if result.get("photo_tips"):
        st.caption(f"Photo tip: {result['photo_tips']}")
    if not shown and not result.get("not_in_catalog"):
        st.write("No match found. Try a closer, well-lit photo.")

st.divider()
st.link_button("Open the full guide", GUIDE_URL)
