"""
SPL (Search Processing Language) Search Endpoints

Provides a Splunk-like search language interface over the Elasticsearch event store.

Endpoints:
  POST /api/v1/search/spl   – Execute an SPL query and return matching events
  GET  /api/v1/search/help  – Return SPL syntax documentation
"""
import logging
from fastapi import APIRouter, Body, HTTPException

from app.services.spl_parser import parse_spl, build_es_query, search_with_spl

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── SPL Syntax Help ──────────────────────────────────────────────────────────

SPL_HELP = {
    "syntax": {
        "field_value_filter": "event_type=sysmon  –  Field:value exact match filter",
        "wildcard_filter": "hostname=win*  –  Wildcard prefix/suffix match with * or ?",
        "free_text_search": '"powershell.exe"  –  Quoted phrase searched across all fields',
        "bare_word": "powershell  –  Bare word searched across hostname, event_type, and event_data fields",
        "time_range_earliest": "earliest=-24h  –  Look back 24 hours (supports h, m, d units)",
        "time_range_latest": "latest=now  –  End time for the time range",
        "pipe_limit": "| head 50  or  | limit 50  –  Limit number of results",
        "pipe_sort": "| sort -timestamp  –  Sort by field (- for desc, + for asc)",
        "pipeline_combined": "event_type=sysmon EventID=1 'cmd.exe' | sort -timestamp | head 10",
    },
    "examples": [
        {"query": "event_type=sysmon EventID=1 'powershell'", "description": "Find Sysmon process creation events involving PowerShell"},
        {"query": "event_type=sysmon EventID=3 | head 100", "description": "Find Sysmon network connection events"},
        {"query": "source_ip=192.168.* 'alert' | sort -timestamp | limit 50", "description": "Find events from 192.168.x.x containing 'alert', newest first"},
        {"query": "earliest=-1h event_type=sysmon", "description": "All Sysmon events from the last hour"},
        {"query": "hostname=win*", "description": "All events from hosts starting with 'win'"},
        {"query": "'base64' 'powershell'", "description": "Events containing both 'base64' and 'powershell' in any field"},
    ],
    "notes": [
        "Use single or double quotes for phrases with spaces",
        "Multiple field=value filters are AND'd together",
        "Wildcards work on keyword fields (hostname, event_type)",
        "The | pipe separates the search from post-processing commands",
        "Results are sorted by timestamp descending by default",
    ],
}


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/spl", response_model=dict)
async def spl_search(
    query: str = Body(..., embed=True, description="SPL query string"),
    default_limit: int = Body(100, embed=False),
):
    """
    Execute an SPL (Search Processing Language) query against Elasticsearch.

    The query string is parsed into filters, free-text terms, time ranges,
    and pipeline commands (| head, | sort, | limit), then translated into
    an Elasticsearch query DSL and executed against the `spyderxdr-events`
    index.

    Returns matching events along with parsed query metadata for debugging.
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="SPL query cannot be empty")

    from app.main import elastic_service

    try:
        result = await search_with_spl(
            elastic_service,
            query_str=query.strip(),
            default_limit=min(default_limit, 1000),
        )
        return result
    except Exception as exc:
        logger.error("SPL search failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"SPL search error: {str(exc)}")


@router.post("/spl/explain", response_model=dict)
async def spl_explain(
    query: str = Body(..., embed=True, description="SPL query string to explain"),
):
    """
    Parse an SPL query and return the parsed representation without executing it.

    Useful for debugging SPL syntax — shows what filters, terms, time ranges,
    and pipeline commands the parser extracted.
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="SPL query cannot be empty")

    try:
        spl = parse_spl(query.strip())

        # Build the ES query that would be generated
        es_body = build_es_query(spl)

        return {
            "query": query.strip(),
            "parsed": {
                "term_filters": {k: v["value"] for k, v in spl.term_filters.items()},
                "free_text_terms": spl.free_text_terms,
                "range_filters": spl.range_filters,
                "limit": spl.limit,
                "sort_field": spl.sort_field,
                "sort_order": spl.sort_order,
            },
            "elasticsearch_query": es_body,
            "errors": spl.errors,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SPL parse error: {str(exc)}")


@router.get("/help", response_model=dict)
async def spl_help():
    """Return SPL syntax documentation, examples, and usage notes."""
    return SPL_HELP
