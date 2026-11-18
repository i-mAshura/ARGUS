"""
SPL (Search Processing Language) Query Parser

Translates Splunk-like search syntax into Elasticsearch query DSL.

Supported syntax:
  event_type=sysmon                          Field:value filter
  event_type=sysmon EventID=1                Multiple field:value filters
  source="sysmon"                            Quoted value
  "free text phrase"                         Quoted free-text search (across all fields)
  hostname=win*                              Wildcard prefix search
  event_type=sysmon "powershell"             Field filter + free-text
  | head 20  or  | limit 20                  Limit results
  | sort -timestamp                          Sort descending by field
  earliest=-24h  or  latest=now              Time range (relative)
  event_type=sysmon EventID=1 | head 10      Full pipeline with pipe

Examples:
  event_type=sysmon EventID=1 "cmd.exe"
  event_type=process_creation "powershell" | head 50
  source_ip=192.168.* | sort -timestamp | limit 100
  earliest=-1h event_type=sysmon
"""

import re
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

# Known top-level ES index fields (these can be queried as keyword/term filters)
KNOWN_TOP_LEVEL_FIELDS = {
    "event_type", "hostname", "agent_id", "source_ip", "destination_ip",
    "status", "log_type", "source_program", "event_id",
}

# Fields that map to event_data sub-fields (queried via nested path)
EVENT_DATA_FIELDS = {
    "image", "command_line", "parent_image", "process_name", "process_id",
    "pid", "user", "EventID", "Image", "CommandLine", "ParentImage",
    "SourceIp", "DestinationIp", "DestinationPort", "Protocol",
    "TargetFilename", "TargetObject", "QueryName", "QueryResults",
    "md5", "sha1", "sha256", "event_summary",
    "source_ip", "destination_ip", "source_port", "destination_port",
    "file_path", "file_name", "registry_path", "message",
}

# Fields that are mapped as ES `ip` type — require exact term match, not text search
IP_FIELDS = {"source_ip", "destination_ip", "SourceIp", "DestinationIp"}

# ─── Parser State ─────────────────────────────────────────────────────────────

class SPLQuery:
    """Result of parsing an SPL query string."""

    def __init__(self):
        # ES-style filters (term-level)
        self.term_filters: Dict[str, str] = {}
        # Free-text search terms (AND'd together)
        self.free_text_terms: List[str] = []
        # Range filters (e.g. timestamp >= ...)
        self.range_filters: Dict[str, Dict[str, str]] = {}
        # Post-processing pipeline
        self.limit: int = 100
        self.sort_field: Optional[str] = None
        self.sort_order: str = "desc"  # 'asc' or 'desc'
        # Parsing errors
        self.errors: List[str] = []


def _parse_time_expression(expr: str) -> Optional[datetime]:
    """Parse relative time expressions like -24h, -30m, -7d, or 'now'."""
    expr = expr.strip().lower()
    if expr == "now":
        return datetime.utcnow()
    m = re.match(r'^(-?\d+)([hmd])$', expr)
    if not m:
        return None
    value = int(m.group(1))
    unit = m.group(2)
    if unit == "h":
        return datetime.utcnow() + timedelta(hours=value)
    elif unit == "m":
        return datetime.utcnow() + timedelta(minutes=value)
    elif unit == "d":
        return datetime.utcnow() + timedelta(days=value)
    return None


def _determine_field(field_name: str) -> Tuple[str, bool]:
    """Determine whether a field is top-level or lives inside event_data.

    Returns (resolved_field_path, is_top_level).
    """
    clean = field_name.strip().lower()
    if clean in KNOWN_TOP_LEVEL_FIELDS:
        return clean, True
    if clean in {f.lower() for f in EVENT_DATA_FIELDS}:
        return f"event_data.{field_name}", False
    # Default: treat as top-level keyword (may not match, but won't error)
    return field_name, True


def _build_wildcard_query(field_path: str, pattern: str) -> Dict[str, Any]:
    """Build an ES wildcard query for glob-like patterns (win*, *temp, *test*).

    Uses the ES ``wildcard`` query type which is more performant than
    ``regexp`` for simple ``*`` and ``?`` patterns.
    """
    return {"wildcard": {field_path: {"value": pattern}}}


def parse_spl(query_str: str) -> SPLQuery:
    """Parse an SPL-like query string into an SPLQuery object."""
    result = SPLQuery()
    query_str = query_str.strip()
    if not query_str:
        return result

    # ── 1. Split on pipe (|) for pipeline commands ──────────────────────
    parts = re.split(r'\s*\|\s*', query_str)
    search_part = parts[0].strip()
    pipeline_parts = parts[1:] if len(parts) > 1 else []

    # ── 2. Parse search part ────────────────────────────────────────────
    # Tokenize: handle quoted strings, field=value pairs, and bare words
    tokens = _tokenize(search_part)

    i = 0
    while i < len(tokens):
        token = tokens[i]

        # Handle earliest= / latest= time expressions
        if token.startswith("earliest="):
            val = token[len("earliest="):]
            dt = _parse_time_expression(val)
            if dt:
                result.range_filters["timestamp"] = {"gte": dt.isoformat()}
            else:
                result.errors.append(f"Invalid earliest expression: {val}")
            i += 1
            continue
        if token.startswith("latest="):
            val = token[len("latest="):]
            dt = _parse_time_expression(val)
            if dt:
                existing = result.range_filters.get("timestamp", {})
                existing["lte"] = dt.isoformat()
                result.range_filters["timestamp"] = existing
            else:
                result.errors.append(f"Invalid latest expression: {val}")
            i += 1
            continue

        # Handle field=value (including field="quoted value")
        eq_pos = token.find("=")
        if eq_pos > 0 and not token.startswith('"'):
            field = token[:eq_pos].strip()
            value = token[eq_pos + 1:].strip()

            # Strip surrounding quotes from value
            value = _strip_quotes(value)

            if field and value:
                resolved_field, is_top = _determine_field(field)

                # Wildcard check
                if "*" in value or "?" in value:
                    result.term_filters[resolved_field] = {
                        "type": "wildcard",
                        "value": value,
                    }
                else:
                    result.term_filters[resolved_field] = {
                        "type": "term",
                        "value": value,
                    }
            i += 1
            continue

        # Handle "quoted phrase" free-text
        if token.startswith('"') and token.endswith('"'):
            phrase = token[1:-1]
            if phrase.strip():
                result.free_text_terms.append(phrase.strip())
            i += 1
            continue

        # Bare word: free-text search term
        if token.strip():
            result.free_text_terms.append(token.strip())
        i += 1

    # ── 3. Parse pipeline commands ──────────────────────────────────────
    for pipe_part in pipeline_parts:
        pipe_part = pipe_part.strip()

        # | head N  or  | limit N
        m = re.match(r'(?:head|limit)\s+(\d+)', pipe_part, re.IGNORECASE)
        if m:
            result.limit = min(int(m.group(1)), 1000)
            continue

        # | sort field  or  | sort -field (desc) or  | sort +field (asc)
        m = re.match(r'sort\s+([+-]?)(\S+)', pipe_part, re.IGNORECASE)
        if m:
            order_prefix = m.group(1)
            field_name = m.group(2)
            result.sort_field = field_name
            result.sort_order = "asc" if order_prefix == "+" else "desc"
            continue

        result.errors.append(f"Unknown pipeline command: {pipe_part}")

    return result


def _tokenize(text: str) -> List[str]:
    """Tokenize the SPL query string into tokens, handling quoted strings."""
    tokens = []
    current = []
    in_quote = False
    quote_char = None

    i = 0
    while i < len(text):
        ch = text[i]

        if in_quote:
            if ch == quote_char:
                current.append(ch)
                tokens.append("".join(current))
                current = []
                in_quote = False
                quote_char = None
            else:
                current.append(ch)
        elif ch in ('"', "'"):
            if current:
                tokens.append("".join(current))
                current = []
            in_quote = True
            quote_char = ch
            current.append(ch)
        elif ch in (' ', '\t'):
            if current:
                tokens.append("".join(current))
                current = []
        else:
            current.append(ch)

        i += 1

    if current:
        tokens.append("".join(current))

    return tokens


def _strip_quotes(value: str) -> str:
    """Remove surrounding matching quotes from a value."""
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        return value[1:-1]
    return value


def build_es_query(spl: SPLQuery) -> Dict[str, Any]:
    """Convert a parsed SPLQuery into an Elasticsearch query DSL body.

    Returns the full body dict ready for ``_client.search(body=...)``.
    """
    must_clauses: List[Dict[str, Any]] = []
    should_clauses: List[Dict[str, Any]] = []
    filter_clauses: List[Dict[str, Any]] = []

    # ── Term filters ────────────────────────────────────────────────────
    for field, config in spl.term_filters.items():
        q_type = config.get("type", "term")
        value = config["value"]

        if q_type == "wildcard":
            filter_clauses.append(_build_wildcard_query(field, value))
        else:
            filter_clauses.append({"term": {field: value}})

    # ── Free-text search ────────────────────────────────────────────────
    if spl.free_text_terms:
        for term in spl.free_text_terms:
            must_clauses.append({
                "multi_match": {
                    "query": term,
                    "fields": [
                        "hostname^3",
                        "event_type^3",
                        "source_ip",
                        "destination_ip",
                        "event_data.*",
                    ],
                    "type": "phrase_prefix",
                    "lenient": True,
                }
            })

    # ── Range filters (time) ────────────────────────────────────────────
    for field, range_dict in spl.range_filters.items():
        filter_clauses.append({"range": {field: range_dict}})

    # ── Assemble query ──────────────────────────────────────────────────
    bool_clause: Dict[str, Any] = {}
    if must_clauses:
        bool_clause["must"] = must_clauses
    if filter_clauses:
        bool_clause["filter"] = filter_clauses

    if bool_clause:
        body: Dict[str, Any] = {"query": {"bool": bool_clause}}
    else:
        # No conditions → match all (return everything)
        body = {"query": {"match_all": {}}}

    return body


async def search_with_spl(
    elastic_service,
    query_str: str,
    default_limit: int = 100,
) -> Dict[str, Any]:
    """Convenience: parse an SPL query, build the ES query, and run it.

    Returns the same shape as ``elastic_service.search_events()``:
        {"total": int, "events": list, "query": str (original), "errors": list}
    """
    spl = parse_spl(query_str)
    limit = spl.limit if spl.limit else default_limit

    body = build_es_query(spl)

    # Build sort
    sort_clause: List[Dict[str, Any]] = []
    if spl.sort_field:
        sort_clause.append({spl.sort_field: {"order": spl.sort_order}})
    else:
        sort_clause.append({"timestamp": {"order": "desc"}})

    try:
        resp = await elastic_service._client.search(
            index="spyderxdr-events",
            body=body,
            size=limit,
            sort=sort_clause,
        )
        hits = resp.get("hits", {})
        total = hits.get("total", {}).get("value", 0)
        raw_hits = hits.get("hits", [])

        events = []
        for hit in raw_hits:
            src = hit.get("_source", {})
            src["id"] = hit.get("_id")
            src["_score"] = hit.get("_score")
            events.append(src)

        return {
            "total": total,
            "events": events,
            "query": query_str,
            "parsed": {
                "filters": {k: v["value"] for k, v in spl.term_filters.items()},
                "free_text": spl.free_text_terms,
                "limit": limit,
                "sort": f"{spl.sort_field or 'timestamp'} ({spl.sort_order})",
            },
            "errors": spl.errors,
        }
    except Exception as exc:
        logger.error("SPL search failed: %s", exc)
        return {
            "total": 0,
            "events": [],
            "query": query_str,
            "errors": [str(exc)],
        }
